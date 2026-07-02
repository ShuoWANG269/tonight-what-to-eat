// 阿里云函数计算 FC（Node.js，HTTP 触发）入口。薄适配层：解析请求 → 复用 core.recommend → 返回结构化 JSON。
// 部署时把 web/ 交给 OSS+CDN 静态托管，本函数只做 /api/recommend 这一个网关职责。
const { recommend } = require('./core');

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      const b = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
      return resolve(b);
    }
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

// FC 3.0 Node HTTP 函数签名：async (req, resp, context)
exports.handler = async (req, resp) => {
  const send = (status, obj) => {
    resp.setStatusCode(status);
    resp.setHeader('Content-Type', 'application/json; charset=utf-8');
    resp.setHeader('Access-Control-Allow-Origin', '*');
    resp.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    resp.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    resp.send(Buffer.from(JSON.stringify(obj)));
  };

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') return send(200, { ok: true });
  if (method !== 'POST') return send(405, { ok: false, error: 'method not allowed' });

  let input = {};
  try {
    input = JSON.parse((await readBody(req)) || '{}');
  } catch (_) {
    return send(400, { ok: false, error: 'invalid json body' });
  }

  try {
    const result = await recommend(input);
    return send(200, result);
  } catch (e) {
    return send(500, { ok: false, error: String(e.message || e) });
  }
};
