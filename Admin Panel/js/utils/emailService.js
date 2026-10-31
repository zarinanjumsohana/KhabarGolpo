// js/utils/emailService.js — Automated reservation + order email confirmation helper.

const STORAGE_KEY = 'kg.email.config';

export function getEmailConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveEmailConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg || {}));
}

export function extractReservationEmail(r) {
  if (r && r.email && r.email.includes('@')) return r.email.trim();
  const m = String(r?.note || '').match(/\[Email:\s*([^\]]+)\]/i);
  return m ? m[1].trim() : '';
}

export function cleanReservationNote(r) {
  return String(r?.note || '').replace(/\[Email:\s*[^\]]+\]\s*/gi, '').trim();
}

/* Shared delivery: EmailJS -> webhook -> native mailto. */
async function sendEmail({ email, subject, body, templateParams }) {
  const cfg = getEmailConfig();

  if (cfg.provider === 'emailjs' && cfg.serviceId && cfg.templateId && cfg.publicKey) {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          template_params: Object.assign(
            { to_name: '', to_email: email, subject, body },
            templateParams || {}
          ),
        }),
      });
      if (res.ok) return { ok: true, method: 'emailjs', email };
      console.warn('EmailJS error:', await res.text());
    } catch (e) {
      console.error('EmailJS network error:', e);
    }
  }

  if (cfg.provider === 'webhook' && cfg.webhookUrl) {
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'email', to: email, subject, body }),
      });
      if (res.ok) return { ok: true, method: 'webhook', email };
    } catch (e) {
      console.error('Webhook error:', e);
    }
  }

  const mailtoUri = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const a = document.createElement('a');
  a.href = mailtoUri;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();

  return { ok: true, method: 'mailto', email };
}

export async function sendReservationConfirmation(r) {
  const email = extractReservationEmail(r);
  if (!email) {
    return { ok: false, error: 'NO_EMAIL', message: 'No email address found for this guest.' };
  }

  const { subject, body, name, tableNum, dateStr, timeStr, guests } = composeConfirmationEmail(r);
  const out = await sendEmail({
    email,
    subject,
    body,
    templateParams: {
      to_name: name,
      to_email: email,
      reservation_date: dateStr,
      reservation_time: timeStr,
      party_size: guests,
      table_info: tableNum,
      message: body,
    },
  });
  if (!out.ok) {
    return { ok: false, error: 'SEND_FAILED', message: `Could not send the confirmation email (${out.method || 'unknown'}).` };
  }
  return { ok: true, method: out.method, email };
}

export function composeOrderEmail(o) {
  const email = (o && o.email) || extractReservationEmail(o) || '';
  const name = o?.customer_name || o?.name || 'Guest';
  const receipt = o?.receipt || o?.receipt_number || '';
  const type = o?.order_type || 'order';
  const items = (o?.items || []).map((i) => `• ${i.qty} × ${i.name} — ৳${Math.round(Number(i.line_total) || 0)}`);
  const body = [
    `Dear ${name},`,
    ``,
    `Thank you for ordering at Khabar Golpo! Your order is confirmed.`,
    ``,
    `Order: ${receipt}`,
    `Type: ${type}`,
    ...items,
    `Total: ৳${Math.round(Number(o?.total) || 0)}`,
    o?.note ? `Note: ${String(o.note)}` : '',
    ``,
    `We will keep you updated. If you need to change anything, please call the restaurant.`,
    ``,
    `Warm regards,
The Khabar Golpo Team`,
  ].join('\n');

  return { email, subject: `Order Confirmed · Khabar Golpo (${receipt})`, body, name, receipt, type };
}

export async function sendOrderConfirmation(o) {
  const { email, subject, body } = composeOrderEmail(o);
  if (!email) {
    return { ok: false, error: 'NO_EMAIL', message: 'No email address found for this guest.' };
  }
  const out = await sendEmail({ email, subject, body });
  if (!out.ok) {
    return { ok: false, error: 'SEND_FAILED', message: `Could not send the confirmation email (${out.method || 'unknown'}).` };
  }
  return { ok: true, method: out.method, email };
}

export function composeConfirmationEmail(r) {
  const email = extractReservationEmail(r);
  const name = r.name || 'Guest';
  const tableNum = (r.tables && r.tables.table_number) ? `Table ${r.tables.table_number}` : (r.table_id || 'Table Reserved');
  const dateStr = r.date || 'your chosen date';
  const timeStr = r.time || '';
  const guests = r.guests || 1;
  const note = cleanReservationNote(r);

  const subject = `Booking Confirmed · Khabar Golpo (Table for ${guests})`;
  const body =
`Dear ${name},

We are delighted to confirm your table reservation at Khabar Golpo!

------------------------------------------
Reservation Details:
• Guest Name: ${name}
• Date: ${dateStr}
• Time: ${timeStr}
• Party Size: ${guests} guest${guests > 1 ? 's' : ''}
• Seating: ${tableNum}
${note ? `• Special Requests: ${note}\n` : ''}------------------------------------------

We look forward to welcoming you for a memorable dining experience.
If you need to make changes or have questions, please give us a call or reply to this email.

Warm regards,
The Khabar Golpo Team
“Every dish tells a story — welcome to ours.”`;

  return { email, subject, body, name, tableNum, dateStr, timeStr, guests, note };
}
