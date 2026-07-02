// 本地联调服务器（零依赖，Node 内置 http）：静态托管 web/ + POST /api/recommend。
// 与阿里云 FC 的 handler.js 共用 core.recommend，行为一致，方便本地端到端验证 M1-M4。
const http = require('http');
const fs = require('fs');
const path = require('path');

// 极简 .env 载入（零依赖）：把项目根的 .env 灌进 process.env，已存在的不覆盖。
(function loadDotenv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const { recommend, getConfig } = require('./core');

const PORT = Number(process.env.PORT || 3000);
const WEB_DIR = path.join(__dirname, '..', 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(WEB_DIR, path.normalize(urlPath));
  // 防目录穿越
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const method = (req.method || '').toUpperCase();
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/api/recommend') {
    if (method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let input = {};
      try {
        input = JSON.parse(body || '{}');
      } catch (_) {
        return sendJson(res, 400, { ok: false, error: 'invalid json body' });
      }
      try {
        const result = await recommend(input);
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, 500, { ok: false, error: String(e.message || e) });
      }
    });
    return;
  }

  if (urlPath === '/api/health') {
    const cfg = getConfig();
    return sendJson(res, 200, { ok: true, mode: cfg.mock ? 'mock' : 'model', model: cfg.model });
  }

  if (method === 'GET') return serveStatic(req, res);
  sendJson(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  const cfg = getConfig();
  console.log(`今晚吃什么 · 本地服务 → http://localhost:${PORT}`);
  console.log(`模型模式：${cfg.mock ? 'MOCK（未配置 MODEL_API_KEY，用内置示例数据）' : `真实模型 ${cfg.model} @ ${cfg.baseUrl}`}`);
});
