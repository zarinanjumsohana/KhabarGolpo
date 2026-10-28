// js/utils/emailService.js — Automated reservation email confirmation helper.

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

export async function sendReservationConfirmation(r) {
  const email = extractReservationEmail(r);
  if (!email) {
    return { ok: false, error: 'NO_EMAIL', message: 'No email address found for this guest.' };
  }

  const { subject, body, name, tableNum, dateStr, timeStr, guests } = composeConfirmationEmail(r);
  const cfg = getEmailConfig();

  // 1. If EmailJS is configured, send via EmailJS REST API
  if (cfg.provider === 'emailjs' && cfg.serviceId && cfg.templateId && cfg.publicKey) {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          template_params: {
            to_name: name,
            to_email: email,
            reservation_date: dateStr,
            reservation_time: timeStr,
            party_size: guests,
            table_info: tableNum,
            message: body,
          },
        }),
      });

      if (res.ok) {
        return { ok: true, method: 'emailjs', email };
      }
      const errText = await res.text();
      console.warn('EmailJS error:', errText);
    } catch (e) {
      console.error('EmailJS network error:', e);
    }
  }

  // 2. If a custom Webhook URL is configured
  if (cfg.provider === 'webhook' && cfg.webhookUrl) {
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'reservation_confirmed',
          email,
          name,
          date: dateStr,
          time: timeStr,
          guests,
          table: tableNum,
          body,
        }),
      });
      if (res.ok) {
        return { ok: true, method: 'webhook', email };
      }
    } catch (e) {
      console.error('Webhook error:', e);
    }
  }

  // 3. Instant Native Mailto Fallback
  const mailtoUri = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  
  // Open default email client in new background tab / mail handler
  const a = document.createElement('a');
  a.href = mailtoUri;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();

  return { ok: true, method: 'mailto', email };
}
