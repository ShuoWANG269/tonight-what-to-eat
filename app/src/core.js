// 薄网关核心逻辑：拼 prompt → 调模型（OpenAI 兼容）→ 解析 + 校验 JSON → 一次重试 → 兜底。
// adapter = 配置：换模型只改三个环境变量（BASE_URL / MODEL / API_KEY），不建抽象层。
// server.js（本地）与 handler.js（阿里云 FC）都复用 recommend()。

const { buildMessages } = require('./prompt');

function getConfig() {
  return {
    baseUrl: (process.env.MODEL_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
    model: process.env.MODEL || 'qwen-flash',
    apiKey: process.env.MODEL_API_KEY || '',
    // 无 key 或显式 MOCK=1 时走 mock，保证没有 key 也能端到端跑通、演示前端。
    mock: process.env.MOCK === '1' || !process.env.MODEL_API_KEY,
    timeoutMs: Number(process.env.MODEL_TIMEOUT_MS || 20000),
  };
}

// 清洗 dish：去掉「今晚吃/晚上吃/晚餐吃」等前缀与首尾标点，避免和前端「今晚吃 X。」外壳重复。
function sanitizeDish(s) {
  return String(s || '')
    .trim()
    // 仅当以时间词（今晚/晚上/晚餐）开头才剥离前缀，避免误伤「上汤娃娃菜」这类正常菜名
    .replace(/^["'「『]?\s*(?:今晚|今天晚上|晚上|晚餐)\s*(?:就)?\s*(?:吃)?\s*[:：、,，\-]*\s*/, '')
    .replace(/[。.！!～~\s"'」』]+$/, '')
    .trim();
}

// 校验模型输出是否满足输出契约。
function validate(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const ok = (v) => typeof v === 'string' && v.trim().length > 0;
  // dish / reason 必填；buy / cook 尽量有，缺了不算致命（后端可留空）。
  return ok(obj.dish) && ok(obj.reason);
}

// 从模型返回文本里稳健取出 JSON（容忍偶发的代码块围栏 / 前后废话）。
function parseJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch (_) {}
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch (_) {}
  }
  return null;
}

async function callModel(messages, cfg) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`模型接口 ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// 无 key 时的确定性 mock：按输入变化给出不同结果，能演示「换一个」「怎么做/去哪买」全链路。
function mockRecommend(input = {}) {
  const pool = [
    { dish: '番茄龙利鱼', reason: '午餐偏主食缺优质蛋白，龙利鱼低脂高蛋白正好补上，番茄开胃不腻。', buy: '外卖搜「酸汤龙利鱼」，或去快餐简餐店点番茄鱼。', cook: '龙利鱼切块焯水，番茄炒出汁加水煮开，下鱼片3分钟调盐即可。' },
    { dish: '杂蔬鸡胸荞麦面', reason: '今天油和主食都够了，换低GI的荞麦面配鸡胸和青菜，热量友好又管饱。', buy: '外卖搜「荞麦面 鸡胸」或轻食沙拉店。', cook: '荞麦面煮熟过凉，鸡胸煎熟切条，加焯过的西兰花胡萝卜，淋麻酱生抽。' },
    { dish: '清蒸鲈鱼配杂粮饭', reason: '白天红肉偏多，晚上换清蒸白肉鱼减负担，杂粮饭补充膳食纤维。', buy: '外卖搜「清蒸鲈鱼」，或家常菜馆。', cook: '鲈鱼铺姜丝蒸8分钟，淋蒸鱼豉油热油；杂粮饭电饭煲同煮。' },
    { dish: '西红柿鸡蛋打卤面', reason: '今天吃得清淡缺点热量和蛋白，一碗热乎的番茄蛋面暖胃又补能量。', buy: '外卖搜「番茄鸡蛋面」，面馆基本都有。', cook: '番茄炒软加水，打入蛋花调味成卤，浇在煮好的面上。' },
    { dish: '孜然口蘑炒牛柳配米饭', reason: '这几天蛋白偏少，牛柳补铁补蛋白，口蘑增鲜低脂，孜然够味解馋。', buy: '外卖搜「孜然牛肉」或小炒快餐。', cook: '牛柳腌10分钟大火快炒盛出，口蘑煸香回锅，撒孜然辣椒面翻匀。' },
  ];
  const exclude = Array.isArray(input.exclude) ? input.exclude : [];
  const seed = ((input.todayMeals || '').length + exclude.length * 3) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const cand = pool[(seed + i) % pool.length];
    if (!exclude.includes(cand.dish)) return cand;
  }
  return pool[0];
}

const FALLBACK = {
  dish: '番茄鸡蛋面',
  reason: '暖胃好消化、蛋白和碳水均衡，是稳妥的晚餐选择。',
  buy: '外卖搜「番茄鸡蛋面」，附近面馆基本都有。',
  cook: '番茄炒出汁加水烧开，打入蛋花调味，浇在煮好的面条上。',
};

// 主入口。返回 { ok, data, meta }。
async function recommend(input = {}) {
  const cfg = getConfig();

  if (cfg.mock) {
    return { ok: true, data: mockRecommend(input), meta: { source: 'mock', model: 'mock' } };
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const messages = buildMessages(input, attempt > 0);
      const raw = await callModel(messages, cfg);
      const parsed = parseJson(raw);
      if (validate(parsed)) {
        return {
          ok: true,
          data: {
            dish: sanitizeDish(parsed.dish),
            reason: parsed.reason.trim(),
            buy: (parsed.buy || '').trim(),
            cook: (parsed.cook || '').trim(),
          },
          meta: { source: 'model', model: cfg.model, retried: attempt > 0 },
        };
      }
      lastErr = new Error('模型输出不是合法 JSON 或缺必填字段');
    } catch (e) {
      lastErr = e;
    }
  }

  // 两次都失败 → 友好兜底文案，不把错误抛给用户。
  return {
    ok: true,
    data: FALLBACK,
    meta: { source: 'fallback', model: cfg.model, error: lastErr ? String(lastErr.message || lastErr) : 'unknown' },
  };
}

module.exports = { recommend, validate, parseJson, sanitizeDish, getConfig, mockRecommend, FALLBACK };
