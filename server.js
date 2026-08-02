/* Tiny zero-dependency static server for local preview.
   Run:  node server.js      →  http://localhost:4321
   Copy .env.example → .env for local secrets (BOT_TOKEN, CHAT_ID).
   (Not needed for deployment — index.html works as a plain static file.) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  buildBookingMessage,
  sendBookingToTelegram
} = require('./booking-message.cjs');

const ROOT = __dirname;

function loadEnv(file) {
  const envPath = path.join(ROOT, file);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv('.env');

const PORT = Number(process.env.PORT) || 4321;
const BOOKING_ENDPOINT =
  process.env.BOOKING_ENDPOINT || `http://localhost:${PORT}/booking`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8'
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function handleBooking(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders()).end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...corsHeaders() })
      .end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders() })
      .end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  if (body.company) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders() })
      .end(JSON.stringify({ ok: true }));
    return;
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!token || !chatId) {
    const missing = ['name', 'phone', 'service', 'date', 'time']
      .filter((k) => !String(body[k] || '').trim());
    if (missing.length) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders() })
        .end(JSON.stringify({ error: 'Missing fields', missing }));
      return;
    }
    const { text } = buildBookingMessage(body);
    console.log('[booking] BOT_TOKEN/CHAT_ID missing — would send to Telegram:', text);
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders() })
      .end(JSON.stringify({ ok: true, mock: true }));
    return;
  }

  const result = await sendBookingToTelegram(body, { token, chatId });

  if (result.missing) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders() })
      .end(JSON.stringify({ error: 'Missing fields', missing: result.missing }));
    return;
  }

  if (!result.ok) {
    console.error('[booking] Telegram error', result.status, JSON.stringify(result.data));
    res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders() })
      .end(JSON.stringify({ error: 'Upstream failed' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders() })
    .end(JSON.stringify({ ok: true }));
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url === '/config.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(`window.__ENV__=${JSON.stringify({ BOOKING_ENDPOINT })};`);
    return;
  }

  if (url === '/booking' || url === '/mock-booking') {
    handleBooking(req, res);
    return;
  }

  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);

  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Pan Carlos → http://localhost:${PORT}`);
  if (process.env.BOT_TOKEN && process.env.CHAT_ID) {
    console.log('Booking → Telegram (BOT_TOKEN + CHAT_ID from .env)');
  } else {
    console.log('Booking → mock only (add BOT_TOKEN + CHAT_ID to .env to send for real)');
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Either:`);
    console.error(`  • open http://localhost:${PORT} — the server may already be running`);
    console.error(`  • stop it:  lsof -ti :${PORT} | xargs kill`);
    console.error(`  • use another port:  PORT=4322 node server.js`);
    process.exit(1);
  }
  throw err;
});
