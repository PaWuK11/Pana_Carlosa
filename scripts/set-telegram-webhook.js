#!/usr/bin/env node
/* Point the bot at this site's decision webhook.
   Run: node scripts/set-telegram-webhook.js
   Needs BOT_TOKEN and SITE_URL in .env (https://your-site.netlify.app). */
const fs = require('fs');
const path = require('path');
const { webhookSecret, tgApi } = require('../booking-message.cjs');

const ROOT = path.join(__dirname, '..');

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

async function main() {
  const token = process.env.BOT_TOKEN;
  const site = String(process.env.SITE_URL || '').replace(/\/+$/, '');
  if (!token) {
    console.error('Missing BOT_TOKEN in .env');
    process.exit(1);
  }
  if (!site || !/^https:\/\//i.test(site)) {
    console.error('Set SITE_URL in .env to the public https origin, e.g.');
    console.error('  SITE_URL=https://your-site.netlify.app');
    process.exit(1);
  }

  const url = `${site}/telegram-webhook`;
  const secret = webhookSecret(process.env);
  const result = await tgApi(token, 'setWebhook', {
    url,
    secret_token: secret || undefined,
    allowed_updates: ['callback_query'],
    drop_pending_updates: false
  });

  if (!result.ok) {
    console.error('setWebhook failed:', result.status, JSON.stringify(result.data));
    process.exit(1);
  }

  console.log('Webhook set →', url);
  const info = await tgApi(token, 'getWebhookInfo', {});
  if (info.data && info.data.result) {
    console.log(JSON.stringify(info.data.result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
