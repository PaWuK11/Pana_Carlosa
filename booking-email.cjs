/** Client emails after Carlos confirms or rejects a booking in Telegram. */

const SHOP = {
  name: 'Pana Carlosa',
  fullName: 'Pana Carlosa Barber Shop',
  phone: '+48 788 354 540',
  address: 'Pasaż Zielińskiego, Aleja Niebieska, Stoisko 11.11, 50-088 Wrocław',
  maps: 'https://www.google.com/maps/search/?api=1&query=Pasa%C5%BC+Zieli%C5%84skiego,+Aleja+Niebieska,+Stoisko+11.11,+50-088+Wroc%C5%82aw'
};

const MONTHS = {
  pl: [
    'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso, lang) {
  const parts = String(iso || '').split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => !n)) return String(iso || '');
  const [y, m, d] = parts;
  const months = MONTHS[lang] || MONTHS.pl;
  const month = months[m - 1] || String(m);
  return lang === 'en' ? `${d} ${month} ${y}` : `${d} ${month} ${y}`;
}

function parseFrom(raw, fallbackName) {
  const value = String(raw || '').trim();
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, '') || fallbackName,
      email: match[2].trim()
    };
  }
  return { name: fallbackName, email: value };
}

function copy(booking, action) {
  const lang = booking.lang === 'en' ? 'en' : 'pl';

  if (lang === 'en') {
    if (action === 'ok') {
      return {
        subject: `Appointment confirmation, ${SHOP.name}`,
        heading: 'See you at the shop',
        intro: `Hi ${booking.name}, your visit is confirmed.`,
        closing: 'If you need to change the time, please call us.',
        status: 'Confirmed'
      };
    }
    return {
      subject: `Appointment update, ${SHOP.name}`,
      heading: 'This time did not work',
      intro: `Hi ${booking.name}, we cannot confirm the slot you asked for.`,
      closing: 'Please pick another time on the website or call us.',
      status: 'Not confirmed'
    };
  }

  if (action === 'ok') {
    return {
      subject: `Potwierdzenie wizyty, ${SHOP.name}`,
      heading: 'Do zobaczenia w zakładzie',
      intro: `Cześć ${booking.name}, potwierdzamy Twoją wizytę.`,
      closing: 'Jeśli musisz zmienić godzinę, zadzwoń proszę.',
      status: 'Potwierdzona'
    };
  }
  return {
    subject: `Informacja o wizycie, ${SHOP.name}`,
    heading: 'Ten termin nie wszedł',
    intro: `Cześć ${booking.name}, niestety nie możemy potwierdzić wybranego terminu.`,
    closing: 'Wybierz inną godzinę na stronie albo zadzwoń.',
    status: 'Niepotwierdzona'
  };
}

function labels(lang) {
  return lang === 'en'
    ? { service: 'Service', when: 'Date & time', phone: 'Phone', address: 'Address' }
    : { service: 'Usługa', when: 'Termin', phone: 'Telefon', address: 'Adres' };
}

function buildDecisionEmail(booking, action) {
  const lang = booking.lang === 'en' ? 'en' : 'pl';
  const t = copy(booking, action);
  const l = labels(lang);
  const when = `${formatDate(booking.date, lang)}, ${booking.time}` +
    (booking.duration ? ` (${booking.duration} min)` : '');

  const text = [
    t.intro,
    '',
    `${l.service}: ${booking.service}`,
    `${l.when}: ${when}`,
    `${l.address}: ${SHOP.address}`,
    `${l.phone}: ${SHOP.phone}`,
    '',
    t.closing,
    '',
    SHOP.fullName
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:16px;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
  <p style="margin:0 0 12px;">${esc(t.intro)}</p>
  <p style="margin:0 0 6px;"><strong>${esc(l.service)}:</strong> ${esc(booking.service)}</p>
  <p style="margin:0 0 6px;"><strong>${esc(l.when)}:</strong> ${esc(when)}</p>
  <p style="margin:0 0 6px;"><strong>${esc(l.address)}:</strong> ${esc(SHOP.address)}</p>
  <p style="margin:0 0 16px;"><strong>${esc(l.phone)}:</strong> ${esc(SHOP.phone)}</p>
  <p style="margin:0 0 16px;">${esc(t.closing)}</p>
  <p style="margin:0;font-size:14px;color:#333333;">${esc(SHOP.fullName)}</p>
</body>
</html>`;

  return { subject: t.subject, text, html };
}

function smtpConfig(env) {
  const user = String(env.SMTP_USER || '').trim();
  const pass = String(env.SMTP_PASS || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
  if (!user || !pass) return null;
  const gmail = /@(gmail|googlemail)\.com$/i.test(user);
  const host = String(env.SMTP_HOST || '').trim() || (gmail ? 'smtp.gmail.com' : '');
  if (!host) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return { host, port, user, pass };
}

function mailReady(env) {
  const from = parseFrom(env.MAIL_FROM, env.MAIL_FROM_NAME || SHOP.name);
  const hasFrom = Boolean(from.email && from.email.includes('@'));
  const hasProvider = Boolean(smtpConfig(env) || env.BREVO_API_KEY || env.RESEND_API_KEY);
  return hasFrom && hasProvider;
}

function encodeWord(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  if (/^[\x20-\x7e]+$/.test(str) && !/[,;<>@"]/.test(str)) return str;
  return `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`;
}

function formatAddress(name, email) {
  const encoded = encodeWord(name);
  return encoded ? `${encoded} <${email}>` : email;
}

function rfc5322Date(date = new Date()) {
  return date.toUTCString().replace(/GMT$/, '+0000');
}

function messageIdFor(email) {
  const domain = String(email || 'localhost').split('@')[1] || 'localhost';
  const rand = require('crypto').randomBytes(8).toString('hex');
  return `<pc.${Date.now()}.${rand}@${domain}>`;
}

function buildMime({ from, to, toName, subject, html, text }) {
  const boundary = 'pc' + Date.now().toString(16);
  const plain = String(text || '').replace(/\r?\n/g, '\r\n');
  const rich = String(html || '').replace(/\r?\n/g, '\r\n');
  return [
    `From: ${formatAddress(from.name, from.email)}`,
    `To: ${formatAddress(toName, to)}`,
    `Reply-To: ${from.email}`,
    `Date: ${rfc5322Date()}`,
    `Message-ID: ${messageIdFor(from.email)}`,
    `Subject: ${encodeWord(subject) || 'Appointment'}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    plain,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    rich,
    `--${boundary}--`,
    ''
  ].join('\r\n');
}

function waitReply(socket) {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP timeout'));
    }, 15000);
    function onData(chunk) {
      data += chunk.toString('utf8');
      const lines = data.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (/^\d{3} /.test(last) && data.endsWith('\r\n')) {
        cleanup();
        resolve({ code: Number(last.slice(0, 3)), text: data.trim() });
      }
    }
    function onErr(err) {
      cleanup();
      reject(err);
    }
    function cleanup() {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onErr);
    }
    socket.on('data', onData);
    socket.on('error', onErr);
  });
}

async function smtpCmd(socket, line) {
  socket.write(line + '\r\n');
  return waitReply(socket);
}

function sendSmtp({ host, port, user, pass, from, to, toName, subject, html, text }) {
  const tls = require('tls');
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host }, async () => {
      try {
        const greet = await waitReply(socket);
        if (greet.code !== 220) throw new Error(greet.text);
        let ehlo = await smtpCmd(socket, `EHLO panacarlosa`);
        if (ehlo.code !== 250) throw new Error(ehlo.text);
        let auth = await smtpCmd(socket, 'AUTH LOGIN');
        if (auth.code !== 334) throw new Error(auth.text);
        auth = await smtpCmd(socket, Buffer.from(user).toString('base64'));
        if (auth.code !== 334) throw new Error(auth.text);
        auth = await smtpCmd(socket, Buffer.from(pass).toString('base64'));
        if (auth.code !== 235) throw new Error(auth.text);
        let reply = await smtpCmd(socket, `MAIL FROM:<${from.email}>`);
        if (reply.code !== 250) throw new Error(reply.text);
        reply = await smtpCmd(socket, `RCPT TO:<${to}>`);
        if (reply.code !== 250) throw new Error(reply.text);
        reply = await smtpCmd(socket, 'DATA');
        if (reply.code !== 354) throw new Error(reply.text);
        const mime = buildMime({ from, to, toName, subject, html, text })
          .replace(/(^|\r\n)\./g, '$1..');
        socket.write(mime + '\r\n.\r\n');
        reply = await waitReply(socket);
        if (reply.code !== 250) throw new Error(reply.text);
        await smtpCmd(socket, 'QUIT').catch(() => {});
        socket.end();
        resolve({ ok: true, provider: 'smtp' });
      } catch (err) {
        try { socket.destroy(); } catch { /* ignore */ }
        resolve({ ok: false, error: err.message || 'SMTP failed' });
      }
    });
    socket.setTimeout(15000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'SMTP timeout' });
    });
    socket.on('error', (err) => {
      resolve({ ok: false, error: err.message || 'SMTP failed' });
    });
  });
}

async function sendMail({ to, toName, subject, html, text }, env) {
  const from = parseFrom(env.MAIL_FROM, env.MAIL_FROM_NAME || SHOP.name);
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'Missing recipient' };
  }
  if (!from.email || !from.email.includes('@')) {
    return { ok: false, error: 'MAIL_FROM is not set' };
  }

  const smtp = smtpConfig(env);
  if (smtp) {
    const fromSmtp = { name: from.name, email: smtp.user };
    return sendSmtp({ ...smtp, from: fromSmtp, to, toName, subject, html, text });
  }
  if (env.BREVO_API_KEY) {
    return sendBrevo({ to, toName, subject, html, text, from }, env.BREVO_API_KEY);
  }
  if (env.RESEND_API_KEY) {
    return sendResend({ to, subject, html, text, from }, env.RESEND_API_KEY);
  }
  return { ok: false, error: 'Set SMTP_USER + SMTP_PASS (Gmail) or BREVO_API_KEY' };
}

async function sendResend({ to, subject, html, text, from }, apiKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${from.name} <${from.email}>`,
      to: [to],
      subject,
      html,
      text
    })
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { message: raw }; }
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.message || data.error || raw };
  }
  return { ok: true, id: data.id, provider: 'resend' };
}

async function sendBrevo({ to, toName, subject, html, text, from }, apiKey) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: to, name: toName || undefined }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { message: raw }; }
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.message || raw };
  }
  return { ok: true, id: data.messageId, provider: 'brevo' };
}

async function sendDecisionEmail(booking, action, env) {
  const letter = buildDecisionEmail(booking, action);
  return sendMail({
    to: booking.email,
    toName: booking.name,
    subject: letter.subject,
    html: letter.html,
    text: letter.text
  }, env);
}

module.exports = {
  SHOP,
  formatDate,
  mailReady,
  buildDecisionEmail,
  sendMail,
  sendDecisionEmail
};
