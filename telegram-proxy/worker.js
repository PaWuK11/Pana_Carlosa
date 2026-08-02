/**
 * Booking-request proxy for Pana Carlosa Barber Shop.
 *
 * WHY THIS EXISTS
 * A Telegram bot token is a password. Anything in index.html / script.js is
 * readable by every visitor, so the token cannot live there — someone would
 * take over the bot within days. This tiny Worker keeps the token server-side
 * and is the only thing the browser talks to.
 *
 * DEPLOY (free tier is plenty — this handles a few requests a day)
 *   1. npm i -g wrangler && wrangler login
 *   2. cd telegram-proxy && wrangler deploy
 *   3. wrangler secret put BOT_TOKEN     ← from @BotFather
 *      wrangler secret put CHAT_ID       ← from @userinfobot, or a group id
 *   4. Copy the printed URL into BOOKING_ENDPOINT in ../script.js
 *
 * Set ALLOWED_ORIGIN in wrangler.toml to your real domain once you have one;
 * '*' is fine while testing but lets any site post through your bot.
 */

import { buildBookingMessage } from '../booking-message.cjs';

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin);
    }

    // A bot filled the hidden field — accept silently so it doesn't retry.
    if (body.company) return json({ ok: true }, 200, origin);

    const missing = ['name', 'phone', 'service', 'date', 'time']
      .filter((k) => !String(body[k] || '').trim());
    if (missing.length) {
      return json({ error: 'Missing fields', missing }, 400, origin);
    }

    const { text } = buildBookingMessage(body);

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!tg.ok) {
      // Log for `wrangler tail`, but never leak Telegram's response to the page.
      console.error('Telegram error', tg.status, await tg.text());
      return json({ error: 'Upstream failed' }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  }
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) }
  });
}
