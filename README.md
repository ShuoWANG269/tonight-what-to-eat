<div align="center">

# 🍽️ 今晚吃什么

**专治「选择困难」的决断式晚餐推荐**

一句话说出今天早/午吃了啥 → 给你**一个**明确的晚餐答案 + 一句营养理由。
不给选项清单，不让你再纠结。

![status](https://img.shields.io/badge/1.0-M1--M4%20完成-brightgreen)
![stack](https://img.shields.io/badge/后端-Node.js%20零依赖-informational)
![llm](https://img.shields.io/badge/LLM-OpenAI%20兼容%20·%20可换模型-blueviolet)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

</div>

---

## 这是什么

选择困难症用户要的不是一堆选项，而是**一个明确答案**。

「今晚吃什么」用一句话自然语言输入（如"早上吉野家牛肉饭，中午麦当劳"），综合你的**画像**、**今日已吃**、**最近几天饮食**和**当下心情**，由大模型给出一个决断式的晚餐推荐，并从营养角度解释为什么是它。

## 效果示例

> **输入**：早上吉野家牛肉饭，中午麦当劳巨无霸套餐 ｜ 心情：嘴里没味
>
> **输出**：
> ### 今晚吃 **酸辣开胃鱼片汤**。
> 今天高油高热量食物吃多了，这道菜酸辣开胃又能促消化，鱼肉优质蛋白还低脂，正好平衡营养。
>
> `😋 想吃 →` 去哪买 / 怎么做　　`🙅 不想吃 →` 换一个

## 特性

- **决断式输出**：一个答案 + 一句营养理由，不给选项清单（由后端拼文案控制，不靠模型自觉）
- **营养均衡**：结合今日已吃的缺口/过量给理由，措辞避免医疗承诺
- **换一个**：不满意就换，自动避开已推荐过的菜
- **怎么做 / 去哪买**：想吃就展开家庭做法和外卖关键词
- **画像 + 跨次记忆**：身高体重性别年龄 + 历史吃饭记录，全存浏览器 `localStorage`，**后端零存储**
- **随意换模型**：DeepSeek / 通义千问 / 任意 OpenAI 兼容接口，只改 3 个环境变量，不改代码
- **零运行时依赖**：Node 原生 `fetch` + `http`，`git clone` 完即可跑

## 快速开始

```bash
cd app
npm start                 # 打开 http://localhost:3000
```

- **不配 key** → 自动 mock 模式，内置示例数据，前端全链路（含换一个/怎么做）都能点通。
- **配了 key** → 真实推荐：复制 `app/.env.example` 为 `app/.env`，填入 `MODEL_API_KEY`。

```ini
# app/.env —— 默认走阿里云百炼（DashScope）OpenAI 兼容接口
MODEL_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL=qwen-flash
MODEL_API_KEY=sk-你的key
```

## 架构

无状态薄网关：前端只管交互，后端只管「藏 key + 拼 prompt + 调模型 + 校验 JSON」。

```
浏览器（画像/历史存 localStorage）
   │  POST /api/recommend  { profile, todayMeals, mood, exclude, history }
   ▼
薄网关（Node）— 拼 prompt → 调模型(OpenAI兼容) → JSON 校验 → 一次重试 → 兜底
   │  { dish, reason, buy, cook }
   ▼
前端渲染决断卡片
```

```txt
今晚吃什么/
├── README.md              ← 你正在看的这份
├── 需求-今晚吃什么.md      产品需求
├── 1.0方案.md             范围 / 输入输出契约 / 里程碑
├── 后端技术选型.md         模型选型 / 存储 / 部署决策
├── 待澄清问题.md
└── app/                   可运行产品代码
    ├── src/
    │   ├── prompt.js      决断式营养顾问 prompt（核心资产）
    │   ├── core.js        拼prompt→调模型→校验→重试→兜底（含 mock）
    │   ├── handler.js     阿里云函数计算 FC 入口
    │   └── server.js      本地联调服务器
    └── web/               单页前端（index.html / style.css / app.js）
```

## 接口契约

`POST /api/recommend`

```jsonc
// 请求
{ "profile": { "gender": "男", "age": 25, "height": 175, "weight": 70 },
  "todayMeals": "早上吉野家牛肉饭，中午麦当劳",
  "mood": "嘴里没味",              // 可选
  "exclude": ["清蒸鲈鱼"],          // 换一个时带上，避开已推荐的
  "history": [{ "date": "2026-07-01", "meals": "晚餐推荐：红烧肉" }] }

// 响应
{ "ok": true,
  "data": { "dish": "…", "reason": "…", "buy": "…", "cook": "…" },
  "meta": { "source": "model|mock|fallback", "model": "qwen-flash" } }
```

## 里程碑

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M1 | 输入早/午餐 → 决断晚餐 + 营养理由 | ✅ 真实模型验证 |
| M2 | 画像采集 + 跨次记忆（localStorage） | ✅ |
| M3 | 换一个 / 怎么做 / 去哪买 | ✅ |
| M4 | 决断度 · 理由 · 口吻打磨 | ✅ 6 类 badcase 实测达标 |

**Fast-follow（1.0 不做）**：放纵博弈余量研判、二次传播趣味输出、拍照识别、小程序端。

## 部署到阿里云（可选）

- 前端 `app/web/` → OSS 静态托管 + CDN
- 后端 `app/src/`（入口 `handler.handler`）→ 函数计算 FC，Node.js，HTTP 触发；key 写入 FC 环境变量
- 绑自有域名需 ICP 备案

## 免责声明

营养/热量相关内容为产品功能性饮食建议，**非医疗诊断**，不替代专业医生或营养师意见。

## License

[MIT](LICENSE)
