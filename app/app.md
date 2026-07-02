# app

「今晚吃什么」1.0 核心闭环的产出代码目录：薄网关后端 + 单页前端，零运行时依赖，本地端到端可跑。设计母文档见 [[1.0方案]] 与 [[后端技术选型]]，用法见 [[README]]。

```txt
app/
├── app.md            本入口 note
├── README.md         运行与部署说明
├── package.json
├── .env.example
├── .gitignore
├── src/
│   ├── prompt.js     决断式营养顾问 prompt
│   ├── core.js       拼 prompt→调模型→校验→重试→兜底（含 mock）
│   ├── handler.js    阿里云 FC 入口
│   └── server.js     本地联调服务器
└── web/
    ├── index.html
    ├── style.css
    └── app.js
```
