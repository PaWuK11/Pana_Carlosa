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
        subject: `Your appointment is confirmed — ${SHOP.name}`,
        heading: 'See you at the shop',
        intro: `Hi ${booking.name}, your visit is confirmed.`,
        closing: 'If you need to change the time, call us — please do not just skip the slot.',
        status: 'Confirmed'
      };
    }
    return {
      subject: `We could not confirm your appointment — ${SHOP.name}`,
      heading: 'This time did not work',
      intro: `Hi ${booking.name}, we cannot confirm the slot you asked for.`,
      closing: 'Please pick another time on the website or call us and we will find something that works.',
      status: 'Not confirmed'
    };
  }

  if (action === 'ok') {
    return {
      subject: `Wizyta potwierdzona — ${SHOP.name}`,
      heading: 'Do zobaczenia w zakładzie',
      intro: `Cześć ${booking.name}, potwierdzamy Twoją wizytę.`,
      closing: 'Jeśli musisz zmienić godzinę, zadzwoń — prosimy nie opuszczać terminu bez uprzedzenia.',
      status: 'Potwierdzona'
    };
  }
  return {
    subject: `Nie potwierdziliśmy wizyty — ${SHOP.name}`,
    heading: 'Ten termin nie wszedł',
    intro: `Cześć ${booking.name}, niestety nie możemy potwierdzić wybranego terminu.`,
    closing: 'Wybierz inną godzinę na stronie albo zadzwoń — znajdziemy coś, co pasuje.',
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
  const when = `${formatDate(booking.date, lang)} · ${booking.time}` +
    (booking.duration ? ` (${booking.duration} min)` : '');
  const ok = action === 'ok';
  const accent = ok ? '#c4a35a' : '#8a3a32';

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
<body style="margin:0;padding:0;background:#14110e;color:#f3ead8;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14110e;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#1c1814;border:1px solid #3a3228;">
        <tr><td style="padding:28px 28px 12px;border-bottom:3px solid ${accent};">
          <p style="margin:0 0 6px;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:${accent};font-family:Arial,sans-serif;">${esc(SHOP.fullName)}</p>
          <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:400;color:#f3ead8;">${esc(t.heading)}</h1>
        </td></tr>
        <tr><td style="padding:24px 28px 8px;font-size:16px;line-height:1.6;">
          <p style="margin:0 0 18px;">${esc(t.intro)}</p>
          <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${accent};">${esc(t.status)}</p>
          <p style="margin:0 0 6px;"><strong>${esc(l.service)}:</strong> ${esc(booking.service)}</p>
          <p style="margin:0 0 6px;"><strong>${esc(l.when)}:</strong> ${esc(when)}</p>
          <p style="margin:0 0 6px;"><strong>${esc(l.address)}:</strong> <a href="${esc(SHOP.maps)}" style="color:#c4a35a;">${esc(SHOP.address)}</a></p>
          <p style="margin:0 0 18px;"><strong>${esc(l.phone)}:</strong> <a href="tel:${SHOP.phone.replace(/\s/g, '')}" style="color:#c4a35a;">${esc(SHOP.phone)}</a></p>
          <p style="margin:0 0 8px;">${esc(t.closing)}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:13px;color:#b9a992;font-family:Arial,sans-serif;">
          ${esc(SHOP.fullName)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: t.subject, text, html };
}

function smtpConfig(env) {
  const user = String(env.SMTP_USER || '').trim();
  const pass = String(env.SMTP_PASS || '').replace(/\s+/g, '');
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

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(String(subject), 'utf8').toString('base64')}?=`;
}

function buildMime({ from, to, toName, subject, html, text }) {
  const boundary = 'pc' + Date.now().toString(16);
  const fromLine = from.name ? `${from.name} <${from.email}>` : from.email;
  const toLine = toName ? `${toName} <${to}>` : to;
  const plain = String(text || '').replace(/\r?\n/g, '\r\n');
  const rich = String(html || '').replace(/\r?\n/g, '\r\n');
  return [
    `From: ${fromLine}`,
    `To: ${toLine}`,
    `Subject: ${encodeSubject(subject)}`,
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
    return sendSmtp({ ...smtp, from, to, toName, subject, html, text });
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
