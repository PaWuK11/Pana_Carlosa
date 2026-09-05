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
 *      wrangler secret put MAIL_FROM
 *      wrangler secret put RESEND_API_KEY   (or BREVO_API_KEY)
 *   4. Copy the printed URL into BOOKING_ENDPOINT in ../script.js
 *   5. Point the bot webhook at this same Worker URL (callback_query).
 *
 * Set ALLOWED_ORIGIN in wrangler.toml to your real domain once you have one;
 * '*' is fine while testing but lets any site post through your bot.
 */

import {
  sendBookingToTelegram,
  handleTelegramUpdate,
  webhookSecret
} from '../booking-message.cjs';

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method === 'GET') {
      return json({ ok: true, service: 'pana-carlosa-booking' }, 200, origin);
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

    if (body.callback_query || body.update_id) {
      const expected = webhookSecret(env);
      const got = request.headers.get('x-telegram-bot-api-secret-token') || '';
      if (expected && got !== expected) {
        return json({ error: 'Unauthorized' }, 401, origin);
      }
      try {
        await handleTelegramUpdate(body, {
          token: env.BOT_TOKEN,
          chatId: env.CHAT_ID,
          env
        });
      } catch (err) {
        console.error('Telegram webhook failed:', err);
      }
      return json({ ok: true }, 200, origin);
    }

    // A bot filled the hidden field — accept silently so it doesn't retry.
    if (body.company) return json({ ok: true }, 200, origin);

    const result = await sendBookingToTelegram(body, {
      token: env.BOT_TOKEN,
      chatId: env.CHAT_ID
    });

    if (result.missing) {
      return json({ error: 'Missing fields', missing: result.missing }, 400, origin);
    }

    if (!result.ok) {
      console.error('Telegram error', result.status, result.data);
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
