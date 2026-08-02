#!/usr/bin/env node
/* Run: node scripts/test-telegram-booking.js
   Sends every realistic form variant to Telegram and reports failures. */
const fs = require('fs');
const path = require('path');
const {
  buildBookingMessage,
  sendBookingToTelegram
} = require('../booking-message.cjs');

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

const SERVICES = [
  'Strzyżenie włosów — 80 zł',
  'Strzyżenie — 1. wizyta — 100 zł',
  'Strzyżenie dziecka — 70 zł',
  'Combo — strzyżenie + broda — 100 zł',
  'Combo — 1. wizyta — 130 zł',
  'Strzyżenie brody — 40 zł',
  'Odsiwianie — 25 zł'
];

const DURATIONS = [15, 30, 35, 40];

const CASES = [
  {
    label: 'minimal',
    body: {
      name: 'Jan Kowalski',
      phone: '+48 600 100 200',
      service: SERVICES[0],
      date: '2026-08-15',
      time: '14:30',
      duration: 30
    }
  },
  {
    label: 'first visit + dots in service',
    body: {
      name: 'Piotr Nowak',
      phone: '+48 501 234 567',
      service: 'Strzyżenie — 1. wizyta — 100 zł',
      date: '2026-08-20',
      time: '10:00',
      duration: 30
    }
  },
  {
    label: 'html injection in fields',
    body: {
      name: '<script>alert(1)</script> Anna & Jan',
      phone: '+48-22-123.456',
      service: 'Combo — strzyżenie + broda — 100 zł',
      date: '2026-09-01',
      time: '18:45',
      duration: 40,
      email: 'test.user+tag@mail.co.uk',
      message: 'Proszę o <b>krótko</b> & długo — 1. strzyżenie.'
    }
  },
  {
    label: 'special chars name',
    body: {
      name: "Jan-O'Kowalski (VIP)",
      phone: '+48 888 999 000',
      service: 'Odsiwianie — 25 zł',
      date: '2026-08-02',
      time: '12:00',
      duration: 15,
      message: 'Czy można wcześniej? Dziękuję!'
    }
  }
];

function assertHtmlSafe(text) {
  const issues = [];
  const tags = text.match(/<\/?[a-z][^>]*>/gi) || [];
  const allowed = new Set([
    '<b>', '</b>', '<i>', '</i>', '<strong>', '</strong>',
    '<em>', '</em>', '<u>', '</u>', '<s>', '</s>', '<code>', '</code>'
  ]);
  for (const tag of tags) {
    if (!allowed.has(tag.toLowerCase())) {
      issues.push(`unexpected tag: ${tag}`);
    }
  }
  return issues;
}

async function main() {
  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing BOT_TOKEN or CHAT_ID in .env');
    process.exit(1);
  }

  let failed = 0;
  const toRun = [...CASES];

  for (const service of SERVICES) {
    const duration = DURATIONS[SERVICES.indexOf(service) % DURATIONS.length];
    toRun.push({
      label: `service: ${service.slice(0, 40)}`,
      body: {
        name: 'Test Automatyczny',
        phone: '+48 600 000 001',
        service,
        date: '2026-08-25',
        time: '11:15',
        duration
      }
    });
  }

  console.log(`Running ${toRun.length} Telegram booking tests…\n`);

  for (const { label, body } of toRun) {
    const { text } = buildBookingMessage(body);
    const htmlIssues = assertHtmlSafe(text);
    if (htmlIssues.length) {
      failed++;
      console.log(`✗ ${label} — HTML structure: ${htmlIssues.join('; ')}`);
      continue;
    }

    const result = await sendBookingToTelegram(body, { token, chatId });
    const desc = result.data && result.data.description ? result.data.description : '';

    if (result.ok) {
      console.log(`✓ ${label}`);
      continue;
    }

    if (/can't parse entities|parse entities/i.test(desc)) {
      failed++;
      console.log(`✗ ${label} — HTML parse error: ${desc}`);
      continue;
    }

    if (/chat not found/i.test(desc)) {
      console.log(`✓ ${label} — format OK (fix CHAT_ID in .env to deliver)`);
      continue;
    }

    failed++;
    console.log(`✗ ${label} — HTTP ${result.status}: ${desc || JSON.stringify(result.data)}`);
  }

  console.log(failed ? `\n${failed} format test(s) failed.` : `\nAll ${toRun.length} format tests passed.`);
  if (failed === 0) {
    const probe = await sendBookingToTelegram(toRun[0].body, { token, chatId });
    const desc = probe.data && probe.data.description ? probe.data.description : '';
    if (/chat not found/i.test(desc)) {
      console.log('\nNote: CHAT_ID is wrong or the bot has no access to that chat.');
      console.log('  • DM: message @userinfobot, copy your numeric id into .env');
      console.log('  • Group: add the bot, then use a group id like -100…');
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
