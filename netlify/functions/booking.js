/**
 * Booking request → Telegram, running on Netlify Functions.
 *
 * The site is a static deploy, so there is no server.js in production and
 * nothing can serve /config.js. This function is what the form actually
 * talks to: same origin as the site (so no CORS), with BOT_TOKEN and
 * CHAT_ID kept in Netlify's environment, never in the client bundle.
 *
 * SET THESE IN NETLIFY (Site configuration → Environment variables):
 *   BOT_TOKEN   from @BotFather
 *   CHAT_ID     numeric id from @userinfobot, or a group id like -100123…
 *
 * Redeploy after adding them — functions only pick up env vars at deploy.
 */

const { sendBookingToTelegram } = require('../../booking-message.cjs');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
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

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }

  // A bot filled the hidden field — accept silently so it stops retrying.
  if (body.company) return reply(200, { ok: true });

  let result;
  try {
    result = await sendBookingToTelegram(body, { token, chatId });
  } catch (err) {
    console.error('Telegram request threw:', err);
    return reply(502, { error: 'Upstream failed' });
  }

  if (!result.ok) {
    if (result.status === 400 && result.missing) {
      return reply(400, { error: 'Missing fields', missing: result.missing });
    }
    // Visible in the Netlify function log; never echoed to the page.
    console.error('Telegram rejected the message:', result.status, result.data);
    return reply(502, { error: 'Upstream failed' });
  }

  return reply(200, { ok: true });
};

function reply(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}
