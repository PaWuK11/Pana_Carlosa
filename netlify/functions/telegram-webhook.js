/**
 * Telegram callback webhook — Carlos taps Confirm / Decline, the client
 * gets an email. Set this URL with scripts/set-telegram-webhook.js after deploy.
 *
 * NETLIFY ENV (same as booking.js, plus mail):
 *   BOT_TOKEN, CHAT_ID
 *   MAIL_FROM              e.g. Pana Carlosa <rezerwacje@your-domain>
 *   RESEND_API_KEY         or BREVO_API_KEY
 *   TELEGRAM_WEBHOOK_SECRET  optional; derived from BOT_TOKEN if omitted
 */

const { handleTelegramUpdate, webhookSecret } = require('../../booking-message.cjs');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return reply(200, { ok: true, service: 'telegram-webhook' });
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed' });
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;
  if (!token || !chatId) {
    console.error('BOT_TOKEN / CHAT_ID missing from the Netlify environment');
    return reply(500, { error: 'Not configured' });
  }

  const expected = webhookSecret(process.env);
  const got = event.headers['x-telegram-bot-api-secret-token']
    || event.headers['X-Telegram-Bot-Api-Secret-Token']
    || '';
  if (expected && got !== expected) {
    return reply(401, { error: 'Unauthorized' });
  }

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }

  try {
    const result = await handleTelegramUpdate(update, {
      token,
      chatId,
      env: process.env
    });
    return reply(200, { ok: true, ignored: Boolean(result.ignored) });
  } catch (err) {
    console.error('Telegram webhook failed:', err);
    return reply(200, { ok: true });
  }
};

function reply(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}
