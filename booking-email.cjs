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

function mailReady(env) {
  const from = parseFrom(env.MAIL_FROM, env.MAIL_FROM_NAME || SHOP.name);
  const hasFrom = Boolean(from.email && from.email.includes('@'));
  const hasProvider = Boolean(env.RESEND_API_KEY || env.BREVO_API_KEY);
  return hasFrom && hasProvider;
}

async function sendMail({ to, toName, subject, html, text }, env) {
  const from = parseFrom(env.MAIL_FROM, env.MAIL_FROM_NAME || SHOP.name);
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'Missing recipient' };
  }
  if (!from.email || !from.email.includes('@')) {
    return { ok: false, error: 'MAIL_FROM is not set' };
  }

  if (env.RESEND_API_KEY) {
    return sendResend({ to, subject, html, text, from }, env.RESEND_API_KEY);
  }
  if (env.BREVO_API_KEY) {
    return sendBrevo({ to, toName, subject, html, text, from }, env.BREVO_API_KEY);
  }
  return { ok: false, error: 'Set RESEND_API_KEY or BREVO_API_KEY' };
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
