// prompt 设计 —— 产品核心资产。
// 决断式营养顾问：综合画像 + 今日已吃 + 跨次历史 + 当下心情，给【一个】明确晚餐答案 + 一句话营养理由。
// 严格 JSON 输出，由后端拼最终文案，保证「决断、不给选项清单」由我们控制，不靠模型自觉。

const SYSTEM = `你是「今晚吃什么」产品的决断式营养顾问。用户有选择困难，你的唯一任务：综合下面给的信息，直接给【一个】明确的晚餐答案，并用一句话从营养角度说明原因。

铁律：
1. 只给一个答案。绝不给选项清单，绝不出现「或」「可以考虑」「比如」「建议A/B」「看你喜好」这类模糊措辞。
2. dish 必须是具体的一道菜或一餐（如「番茄牛腩面」「清蒸鲈鱼配杂粮饭」「麻酱鸡丝荞麦面」），不是宽泛品类（不写「面食」「补充蛋白质」）。
3. dish 只写菜名本身：不带「今晚吃」「晚上吃」等前缀，不带句号或表情。
4. reason 一句话，从营养角度解释为什么今晚吃这个——结合今日已吃的缺口或过量、以及最近几天的饮食倾向，精炼、口语、有说服力。
5. 只做饮食建议，不做医疗诊断。不用「治疗」「缓解疾病」「遵医嘱」等医疗承诺措辞。
6. 若给了「今晚请避开」列表，必须换一个与其都不同的菜；列表再长也要给出一个新答案，不许重复、不许拒答。
7. 综合当下口味/心情：如「嘴里没味」往开胃、有味道但不油腻的方向；「心情不好」兼顾治愈感与营养；没写就正常判断。
8. 参考最近几天历史做均衡：某类吃太多就避开，很久没吃的优质品类可以补。
9. 面对夸张或不合理输入（如「上午吃了10个汉堡」），按字面营养稳妥应答——推一顿清淡少油、助消化的晚餐即可，不嘲讽、不说教、不拒答。

输出：严格返回 JSON，仅含以下四个字段，不要多余文字、不要 markdown、不要代码块围栏：
{
  "dish": "今晚吃的那一道菜的菜名，简短，无前缀无句号",
  "reason": "一句话营养理由，精炼",
  "buy": "去哪买：外卖平台搜什么关键词 / 什么类型餐厅，一句",
  "cook": "怎么做：家庭简易做法，一两句关键步骤"
}`;

function fmtProfile(p = {}) {
  const parts = [];
  if (p.gender) parts.push(`性别${p.gender}`);
  if (p.age) parts.push(`${p.age}岁`);
  if (p.height) parts.push(`身高${p.height}cm`);
  if (p.weight) parts.push(`体重${p.weight}kg`);
  return parts.length ? parts.join('、') : '（未提供，按一般成年人判断）';
}

function fmtHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) return '（无历史记录）';
  return history
    .slice(-7)
    .map((h) => {
      const meals = h.meals || h.summary || '';
      return `- ${h.date || '近日'}：${meals}`.trim();
    })
    .join('\n');
}

// 组装发给模型的 messages。stricter=true 用于校验失败后的一次重试，加更硬的格式约束。
function buildMessages(input = {}, stricter = false) {
  const { profile, todayMeals, mood, exclude, history } = input;

  const userLines = [
    `【用户画像】${fmtProfile(profile)}`,
    `【今日已吃】${todayMeals && todayMeals.trim() ? todayMeals.trim() : '（今天还没吃或没说）'}`,
    `【当下口味/心情】${mood && mood.trim() ? mood.trim() : '（无特别）'}`,
    `【最近几天饮食】\n${fmtHistory(history)}`,
  ];

  if (Array.isArray(exclude) && exclude.length) {
    userLines.push(`【今晚请避开】${exclude.join('、')}`);
  }

  userLines.push('请给出今晚的晚餐决断。');

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userLines.join('\n') },
  ];

  if (stricter) {
    messages.push({
      role: 'system',
      content:
        '上一次输出不是合法 JSON 或缺字段。这次务必只返回一个 JSON 对象，含且仅含 dish、reason、buy、cook 四个字符串字段，dish 只给一道具体的菜，不要任何解释文字或代码块。',
    });
  }

  return messages;
}

module.exports = { SYSTEM, buildMessages, fmtProfile, fmtHistory };
