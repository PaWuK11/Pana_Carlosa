/** Shared booking → Telegram message builder + confirm/reject handling. */

const { sendDecisionEmail, mailReady } = require('./booking-email.cjs');

const REQUIRED = ['name', 'phone', 'email', 'service', 'date', 'time'];
const LIMITS = {
  name: 80,
  phone: 32,
  service: 120,
  date: 10,
  time: 5,
  email: 120,
  message: 800,
  lang: 8
};

const CALLBACK_OK = 'book:ok';
const CALLBACK_NO = 'book:no';
const PAYLOAD_PREFIX = 'pc1.';
const MARK_OK = '✅ CONFIRMED';
const MARK_NO = '❌ DECLINED';
const MARK_OK_LEGACY = '✅ POTWIERDZONO';
const MARK_NO_LEGACY = '❌ ODRZUCONO';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('base64')
    : btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(pad, 'base64').toString('utf8');
  }
  const bin = atob(pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function cleanBody(body) {
  const clean = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    clean[key] = String(body[key] || '').slice(0, max).trim();
  }
  return clean;
}

function packBooking(body) {
  const clean = cleanBody(body);
  return {
    name: clean.name,
    phone: clean.phone,
    email: clean.email,
    service: clean.service,
    date: clean.date,
    time: clean.time,
    message: clean.message,
    duration: body.duration ? Number(body.duration) : null,
    lang: clean.lang === 'en' ? 'en' : 'pl'
  };
}

function encodeBookingPayload(booking) {
  return PAYLOAD_PREFIX + toBase64Url(JSON.stringify({
    n: booking.name,
    p: booking.phone,
    e: booking.email,
    s: booking.service,
    d: booking.date,
    t: booking.time,
    m: booking.message || '',
    u: booking.duration || 0,
    l: booking.lang || 'pl'
  }));
}

function unpackPayload(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const email = String(obj.e || '').trim();
  const name = String(obj.n || '').trim();
  const service = String(obj.s || '').trim();
  const date = String(obj.d || '').trim();
  const time = String(obj.t || '').trim();
  if (!email || !name || !service || !date || !time) return null;
  return {
    name,
    phone: String(obj.p || '').trim(),
    email,
    service,
    date,
    time,
    message: String(obj.m || '').trim(),
    duration: obj.u ? Number(obj.u) : null,
    lang: obj.l === 'en' ? 'en' : 'pl'
  };
}

function decodeBookingPayload(text) {
  const match = String(text || '').match(/pc1\.([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    return unpackPayload(JSON.parse(fromBase64Url(match[1])));
  } catch {
    return null;
  }
}

function alreadyDecided(text) {
  const s = String(text || '');
  return s.includes(MARK_OK) || s.includes(MARK_NO)
    || s.includes(MARK_OK_LEGACY) || s.includes(MARK_NO_LEGACY);
}

function buildBookingMessage(body) {
  const booking = packBooking(body);
  const duration = booking.duration;

  const text = [
    '✂️ <b>New appointment request</b>',
    '',
    `<b>Name:</b> ${escHtml(booking.name)}`,
    `<b>Phone:</b> ${escHtml(booking.phone)}`,
    `<b>Email:</b> ${escHtml(booking.email)}`,
    `<b>Service:</b> ${escHtml(booking.service)}`,
    `<b>When:</b> ${escHtml(booking.date)} — ${escHtml(booking.time)}` +
      (duration ? ` (${duration} min)` : ''),
    booking.message ? `<b>Message:</b> ${escHtml(booking.message)}` : null,
    '',
    '<i>Confirm or decline below — the client will get an email.</i>',
    '',
    `<tg-spoiler>${escHtml(encodeBookingPayload(booking))}</tg-spoiler>`
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { text, clean: booking, booking };
}

function decisionKeyboard() {
  return {
    inline_keyboard: [[
      { text: '✅ Confirm', callback_data: CALLBACK_OK },
      { text: '❌ Decline', callback_data: CALLBACK_NO }
    ]]
  };
}

async function tgApi(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { ok: false, description: raw }; }
  return { ok: res.ok && data.ok !== false, status: res.status, data };
}

async function sendBookingToTelegram(body, { token, chatId }) {
  const missing = REQUIRED.filter((k) => !String(body[k] || '').trim());
  if (missing.length) {
    return { ok: false, status: 400, error: 'Missing fields', missing };
  }

  const { text, booking } = buildBookingMessage(body);
  const result = await tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: decisionKeyboard()
  });

  return {
    ok: result.ok,
    status: result.status,
    data: result.data,
    text,
    booking
  };
}

function decisionCopy(action, mail) {
  if (action === 'ok') {
    return mail && mail.ok
      ? `${MARK_OK} — email sent to the client.`
      : `${MARK_OK} — email NOT sent: ${escHtml((mail && mail.error) || 'not configured')}`;
  }
  return mail && mail.ok
    ? `${MARK_NO} — email sent to the client.`
    : `${MARK_NO} — email NOT sent: ${escHtml((mail && mail.error) || 'not configured')}`;
}

function rebuildDecidedMessage(booking, action, mail) {
  const duration = booking.duration;
  return [
    decisionCopy(action, mail),
    '',
    `<b>Name:</b> ${escHtml(booking.name)}`,
    `<b>Phone:</b> ${escHtml(booking.phone)}`,
    `<b>Email:</b> ${escHtml(booking.email)}`,
    `<b>Service:</b> ${escHtml(booking.service)}`,
    `<b>When:</b> ${escHtml(booking.date)} — ${escHtml(booking.time)}` +
      (duration ? ` (${duration} min)` : ''),
    booking.message ? `<b>Message:</b> ${escHtml(booking.message)}` : null
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function handleTelegramUpdate(update, { token, chatId, env }) {
  const cb = update && update.callback_query;
  if (!cb) return { ok: true, ignored: true };

  const action = cb.data === CALLBACK_OK ? 'ok' : cb.data === CALLBACK_NO ? 'no' : null;
  if (!action) return { ok: true, ignored: true };

  const fromChat = cb.message && cb.message.chat ? String(cb.message.chat.id) : '';
  if (chatId && fromChat && fromChat !== String(chatId)) {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Not allowed.',
      show_alert: true
    });
    return { ok: false, error: 'Wrong chat' };
  }

  const text = (cb.message && (cb.message.text || cb.message.caption)) || '';
  if (alreadyDecided(text)) {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'This request has already been handled.',
      show_alert: false
    });
    return { ok: true, already: true };
  }

  const booking = decodeBookingPayload(text);
  if (!booking) {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Could not read this request.',
      show_alert: true
    });
    return { ok: false, error: 'Missing payload' };
  }

  let mail = { ok: false, error: 'Set MAIL_FROM and RESEND_API_KEY or BREVO_API_KEY' };
  if (mailReady(env)) {
    try {
      mail = await sendDecisionEmail(booking, action, env);
    } catch (err) {
      mail = { ok: false, error: err.message || 'Email failed' };
    }
  }

  if (!mail.ok) {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: `Email was not sent: ${mail.error}`,
      show_alert: true
    });
    return { ok: false, action, mail, booking };
  }

  const messageId = cb.message && cb.message.message_id;
  if (messageId) {
    await tgApi(token, 'editMessageText', {
      chat_id: fromChat,
      message_id: messageId,
      text: rebuildDecidedMessage(booking, action, mail),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }

  await tgApi(token, 'answerCallbackQuery', {
    callback_query_id: cb.id,
    text: action === 'ok' ? 'Confirmed. Email sent.' : 'Declined. Email sent.'
  });

  return { ok: true, action, mail, booking };
}

function webhookSecret(env) {
  const explicit = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (explicit) return explicit;
  const token = String(env.BOT_TOKEN || '');
  if (!token || typeof require !== 'function') return '';
  try {
    return require('crypto')
      .createHash('sha256')
      .update(`pc-wh:${token}`)
      .digest('hex')
      .slice(0, 32);
  } catch {
    return '';
  }
}

module.exports = {
  REQUIRED,
  LIMITS,
  CALLBACK_OK,
  CALLBACK_NO,
  escHtml,
  cleanBody,
  packBooking,
  encodeBookingPayload,
  decodeBookingPayload,
  buildBookingMessage,
  sendBookingToTelegram,
  handleTelegramUpdate,
  webhookSecret,
  tgApi,
  alreadyDecided
};
