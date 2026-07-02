# 今晚吃什么 · app（1.0 核心闭环）

网页 MVP：一句话输入早/午餐 → 决断式晚餐答案 + 一句话营养理由。含「换一个」「怎么做/去哪买」，画像与跨次历史存浏览器 localStorage，后端为无状态薄网关。**零运行时依赖**（Node 原生 `fetch` + `http`）。

对应设计：[[1.0方案]]、[[后端技术选型]]。里程碑 M1–M4 全部落在本目录。

## 结构

```
app/
├── src/
│   ├── prompt.js    决断式营养顾问 prompt（产品核心资产）
│   ├── core.js      薄网关核心：拼 prompt→调模型→校验JSON→一次重试→兜底；含 mock
│   ├── handler.js   阿里云 FC（Node HTTP）入口
│   └── server.js    本地联调服务器（静态托管 web/ + /api/recommend + 极简 .env 载入）
└── web/
    ├── index.html   单页：画像弹层 + 输入 + 结果卡片
    ├── style.css
    └── app.js       localStorage 画像/历史 + 换一个 + 展开怎么做/去哪买
```

## 本地运行

```bash
cd app
npm start          # 或 node src/server.js
# 打开 http://localhost:3000
```

- **不配 key** → 自动 mock 模式，内置示例数据，前端全链路（含换一个/怎么做）都能点通。
- **配了模型 key** → 真实推荐。复制 `.env.example` 为 `.env` 填 `MODEL_API_KEY`（阿里云百炼 DashScope key），可选调 `MODEL`。

## 换模型 = 改配置（不改代码）

三个环境变量：`MODEL_BASE_URL` / `MODEL` / `MODEL_API_KEY`。默认走阿里云百炼 OpenAI 兼容接口；换 DeepSeek 官方或通义千问只改这三项。

## 接口契约

`POST /api/recommend`

请求：
```json
{ "profile": {"gender":"男","age":25,"height":175,"weight":70},
  "todayMeals": "早上吉野家牛肉饭，中午没吃",
  "mood": "嘴里没味",
  "exclude": ["麻辣香锅"],
  "history": [{"date":"2026-06-30","meals":"..."}] }
```
响应：
```json
{ "ok": true,
  "data": { "dish":"…", "reason":"…", "buy":"…", "cook":"…" },
  "meta": { "source":"model|mock|fallback", "model":"…" } }
```

## 部署到阿里云（真上线，本次未做）

- 前端 `web/` → OSS 静态托管 + CDN。
- 后端 `src/`（入口 `handler.handler`）→ 函数计算 FC，Node.js，HTTP 触发；`MODEL_API_KEY` 等写入 FC 环境变量。
- 绑自有域名需 ICP 备案。checklist 见 [[后端技术选型]] §6。
