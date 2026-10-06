/**
 * Paste this into https://script.google.com while logged in as the
 * Gmail that should send booking emails (an older mailbox inboxes better
 * than a brand-new one).
 *
 * Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Project Settings → Script properties:
 *   SECRET = the same value as GMAIL_WEBAPP_SECRET on Netlify
 */

function doGet() {
  return json_({ ok: true, service: 'pana-carlosa-mail' });
}

function doPost(e) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('SECRET') || '';
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!expected || data.secret !== expected) {
      return json_({ ok: false, error: 'Unauthorized' });
    }
    if (!data.to || !String(data.to).includes('@') || !data.subject) {
      return json_({ ok: false, error: 'Missing to/subject' });
    }
    GmailApp.sendEmail(String(data.to), String(data.subject), String(data.text || ''), {
      htmlBody: data.html || undefined,
      name: String(data.fromName || 'Pana Carlosa'),
      replyTo: data.replyTo || Session.getActiveUser().getEmail()
    });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
