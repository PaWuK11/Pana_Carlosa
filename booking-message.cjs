/** Shared booking → Telegram message builder (server.js + telegram-proxy/worker.js). */

const REQUIRED = ['name', 'phone', 'service', 'date', 'time'];
const LIMITS = {
  name: 80,
  phone: 32,
  service: 120,
  date: 10,
  time: 5,
  email: 120,
  message: 800
};

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cleanBody(body) {
  const clean = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    clean[key] = String(body[key] || '').slice(0, max).trim();
  }
  return clean;
}

function buildBookingMessage(body) {
  const clean = cleanBody(body);
  const duration = body.duration ? Number(body.duration) : null;

  const text = [
    '✂️ <b>Nowa prośba o wizytę</b>',
    '',
    `<b>Imię:</b> ${escHtml(clean.name)}`,
    `<b>Telefon:</b> ${escHtml(clean.phone)}`,
    `<b>Usługa:</b> ${escHtml(clean.service)}`,
    `<b>Termin:</b> ${escHtml(clean.date)} — ${escHtml(clean.time)}` +
      (duration ? ` (${duration} min)` : ''),
    clean.email ? `<b>E-mail:</b> ${escHtml(clean.email)}` : null,
    clean.message ? `<b>Wiadomość:</b> ${escHtml(clean.message)}` : null,
    '',
    '<i>Termin NIE jest zarezerwowany w Booksy — potwierdź go ręcznie.</i>'
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { text, clean };
}

async function sendBookingToTelegram(body, { token, chatId }) {
  const missing = REQUIRED.filter((k) => !String(body[k] || '').trim());
  if (missing.length) {
    return { ok: false, status: 400, error: 'Missing fields', missing };
  }

  const { text } = buildBookingMessage(body);
  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const raw = await tg.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { ok: false, description: raw };
  }

  return {
    ok: tg.ok,
    status: tg.status,
    data,
    text
  };
}

module.exports = {
  REQUIRED,
  LIMITS,
  escHtml,
  cleanBody,
  buildBookingMessage,
  sendBookingToTelegram
};
