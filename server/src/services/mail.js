import { config } from '../config.js';

/**
 * Email through the Mailgun HTTP API (the same variables as the other projects:
 * MAILGUN_API_KEY, MAILGUN_BASE_URL, FROM_EMAIL, MAILGUN_SENDER_NAME). APP_URL is the public address used in links.
 *
 * Without those variables nothing is sent. Outside production the message (and its link) is printed to the console so
 * sign-up and password reset can still be tried locally. Tests read `outbox` instead of a real mailbox.
 */
export const outbox = [];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function isMailConfigured() {
  const { apiKey, senderEmail, domain } = config.mailgun;
  return Boolean(apiKey && senderEmail && domain);
}

const FONT = "Archivo,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function shell({ preheader, heading, bodyHtml }) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(heading)}</title></head>
  <body style="margin:0;padding:0;background-color:#f4f4ef;">
    <span style="display:none;font-size:1px;color:#f4f4ef;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4ef;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e3e0d6;">
          <tr><td style="padding:26px 32px 0 32px;font-family:${FONT};font-size:17px;font-weight:700;color:#15130f;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background-color:#ff6a1a;margin-right:8px;"></span>Akasa Air <span style="color:#8a867c;font-weight:400;">&nbsp;|&nbsp; Layover</span>
          </td></tr>
          <tr><td style="padding:20px 32px 4px 32px;"><h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:24px;line-height:1.25;color:#15130f;">${escapeHtml(heading)}</h1></td></tr>
          <tr><td style="padding:8px 32px 28px 32px;font-family:${FONT};font-size:15px;line-height:1.65;color:#3c3a34;">${bodyHtml}</td></tr>
          <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #e3e0d6;font-family:${FONT};font-size:12px;line-height:1.6;color:#6b675d;">
            You are getting this because someone used this address on Layover. If that was not you, you can ignore this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const button = (url, label) =>
  `<p style="margin:0 0 20px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background-color:#ff6a1a;color:#15130f;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:9px;">${escapeHtml(label)}</a></p>`;

export function verifyEmail({ name, url }) {
  return {
    subject: 'Confirm your email for Layover',
    text: `Hi ${name},\n\nThanks for signing up. Please confirm this email address:\n\n${url}\n\nThe link works for 24 hours. After that, the Head of Department will assign your manager and you can apply for leave.`,
    html: shell({
      preheader: 'One click to confirm your email.',
      heading: 'Confirm your email',
      bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 20px 0;">Thanks for signing up. Please confirm this email address. The link works for 24 hours.</p>${button(url, 'Confirm my email')}<p style="margin:0;color:#6b675d;">Once you are confirmed, the Head of Department will assign your manager and you can start applying for leave.</p>`,
    }),
  };
}

export function resetEmail({ name, url }) {
  return {
    subject: 'Reset your Layover password',
    text: `Hi ${name},\n\nSomeone asked to reset the password for your Layover account. To choose a new one, open this link:\n\n${url}\n\nIt works for 60 minutes. If you did not ask for this, ignore this email and your password stays as it is.`,
    html: shell({
      preheader: 'Choose a new password.',
      heading: 'Reset your password',
      bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 20px 0;">Someone asked to reset the password for your account. Use the button to choose a new one. The link works for 60 minutes.</p>${button(url, 'Choose a new password')}<p style="margin:0;color:#6b675d;">If you did not ask for this, ignore this email and your password stays as it is.</p>`,
    }),
  };
}

export function passwordChangedEmail({ name }) {
  return {
    subject: 'Your Layover password was changed',
    text: `Hi ${name},\n\nThe password for your Layover account was just changed. If this was you, there is nothing to do. If it was not, reset your password straight away and tell the Head of Department.`,
    html: shell({
      preheader: 'Your password was changed.',
      heading: 'Your password was changed',
      bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 16px 0;">The password for your account was just changed. If this was you, there is nothing to do.</p><p style="margin:0;">If it was not you, reset your password straight away and tell the Head of Department.</p>`,
    }),
  };
}

/** Sends one email. Returns { ok, skipped }. Never throws: a mail problem must not break the request that triggered it. */
export async function sendMail({ to, subject, text, html }, { link } = {}) {
  if (!isMailConfigured()) {
    if (!config.isProd) {
      console.log(`\n[mail] Not configured, so not sent. To: ${to}\n[mail] ${subject}${link ? `\n[mail] Link: ${link}` : ''}\n`);
    }
    if (process.env.NODE_ENV === 'test') {
      outbox.push({ to, subject, text, link });
      if (outbox.length > 50) outbox.shift();
    }
    return { ok: false, skipped: true };
  }
  const { apiKey, baseUrl, senderEmail, senderName, domain } = config.mailgun;
  const form = new URLSearchParams({ from: `${senderName} <${senderEmail}>`, to, subject, text });
  if (html) form.set('html', html);
  try {
    const res = await fetch(`${baseUrl}/v3/${domain}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) {
      console.error(JSON.stringify({ level: 'error', event: 'mail_send_failed', status: res.status }));
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'mail_request_failed', error: err?.name }));
    return { ok: false };
  }
}
