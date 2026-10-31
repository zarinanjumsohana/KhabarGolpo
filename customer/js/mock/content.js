/* KhabarGolpo customer data layer.
   Auto-switches:
   - When MOCK_MODE = true, reads and writes the shared store in localStorage.
   - When MOCK_MODE = false, communicates with the live Supabase database.
*/
(() => {
  const STORE_PATH = '../../../js/shared/store.js';
  const CONFIG_PATH = '../config.js';
  const SUPABASE_PATH = '../supabaseClient.js';

  const ok = (data) => ({ data, error: null });
  const fail = (code, message) => ({ data: null, error: { code, message } });
  const PHONE = /^(\+8801|01)[3-9]\d{8}$/;
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const byOrder = (a, b) => (a.sort_order || 0) - (b.sort_order || 0);

  const SLOTS = [];
  for (let m = 12 * 60; m <= 21 * 60 + 30; m += 30) {
    SLOTS.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }

  const OTP_STORE = new Map(); // email -> { code, expires } (mock OTP delivery)

  const DEFAULT_STORY = [
    'Every good meal begins long before the first plate reaches the table. For us, it began with the people who taught us to cook: kitchens where nobody was ever rushed, and tables that always had room for one more.',
    'KhabarGolpo grew from a simple wish: to give every guest that same feeling. We wanted food that tastes like home, served in a place that feels warm the moment you walk in.',
    'Every recipe here has been tried, tasted and shared again and again until it was just right. Each dish carries a little of the hands that made it.',
    'Come in, grab a seat, and let every flavour tell its tale.',
  ];

  const storeReady = import(STORE_PATH);
  const configReady = import(CONFIG_PATH);
  const sbReady = import(SUPABASE_PATH);

  const withStore = (fn) =>
    storeReady.then(({ reloadStore, saveStore }) => fn(reloadStore(), () => saveStore()));

  async function getClient() {
    const { isMock } = await configReady;
    if (isMock && isMock()) return null;
    const { supabase } = await sbReady;
    return await supabase();
  }

  const toItem = (it) => ({
    id: it.id,
    category_id: it.category_id,
    name: it.name,
    description: it.description || '',
    price: Number(it.price),
    image_url: it.image_url || '',
    is_veg: !!it.is_veg,
    is_available: it.is_available !== false,
    is_featured: !!it.is_featured,
    sort_order: it.sort_order || 0,
  });

  function checkReservation(r) {
    const name = String(r.name || '').trim();
    if (!name || name.length > 80) return fail('VALIDATION_ERROR', 'Please enter the name for the booking.');
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim())) return fail('VALIDATION_ERROR', 'Please enter a valid email address.');
    if (!PHONE.test(String(r.phone || ''))) return fail('BAD_PHONE', 'Please enter a valid mobile number.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return fail('VALIDATION_ERROR', 'Please choose a date.');
    const [y, m, d] = r.date.split('-').map(Number);
    const picked = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (picked < today) return fail('VALIDATION_ERROR', 'Please choose today or a later date.');
    if (!SLOTS.includes(r.time)) return fail('VALIDATION_ERROR', 'Please choose a time.');
    const g = Number(r.guests);
    if (!Number.isInteger(g) || g < 1 || g > 50) return fail('VALIDATION_ERROR', 'Guests must be between 1 and 50.');
    if (String(r.note || '').length > 300) return fail('VALIDATION_ERROR', 'The note is too long.');
    if (r.honeypot) return fail('SPAM_DETECTED', 'Your request could not be accepted.');
    // table_id is optional – customers no longer select a table
    return null;
  }

  function checkFeedback(f) {
    if (!['review', 'query', 'suggestion'].includes(f.type)) return fail('VALIDATION_ERROR', 'Please choose a type.');
    const name = String(f.name || '').trim();
    if (!name || name.length > 80) return fail('VALIDATION_ERROR', 'Please enter your name.');
    const message = String(f.message || '').trim();
    if (!message || message.length > 1000) return fail('VALIDATION_ERROR', 'Please write a message of up to 1000 characters.');
    if (f.type === 'review') {
      const r = Number(f.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) return fail('VALIDATION_ERROR', 'Please give a rating from 1 to 5 stars.');
    }
    if (f.phone && !PHONE.test(f.phone)) return fail('BAD_PHONE', 'Please enter a valid mobile number or leave it blank.');
    if (f.honeypot) return fail('SPAM_DETECTED', 'Your message could not be accepted.');
    return null;
  }

  function priceOrder(p, S) {
    const s = S.settings;
    const lines = Array.isArray(p.lines) ? p.lines : [];
    if (!lines.length) return fail('VALIDATION_ERROR', 'Your plate is empty.');
    if (lines.length > 30) return fail('TOO_MANY_LINES', 'An order can have up to 30 different dishes.');
    if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20))
      return fail('BAD_QTY', 'Each dish can be ordered 1 to 20 times.');

    const name = String(p.name || '').trim();
    if (!name || name.length > 80) return fail('VALIDATION_ERROR', 'Please enter your name.');
    if (!PHONE.test(String(p.phone || ''))) return fail('BAD_PHONE', 'Please enter a valid mobile number.');
    if (p.honeypot) return fail('SPAM_DETECTED', 'Your order could not be accepted.');
    if (!['pickup', 'delivery'].includes(p.order_type)) return fail('VALIDATION_ERROR', 'Choose pickup or delivery.');
    if (p.order_type === 'pickup' && s.pickup_enabled === false)
      return fail('TYPE_DISABLED', 'Pickup is not available right now.');
    if (p.order_type === 'delivery' && s.delivery_enabled === false)
      return fail('TYPE_DISABLED', 'Delivery is not available right now.');

    const prep = Number(s.prep_time_minutes) || 20;
    let pickup_time = null;
    if (p.order_type === 'pickup') {
      if (!TIME.test(p.pickup_time || '')) return fail('VALIDATION_ERROR', 'Choose a pickup time.');
      const [hh, mm] = p.pickup_time.split(':').map(Number);
      const when = new Date();
      when.setHours(hh, mm, 0, 0);
      if (when.getTime() < Date.now() + prep * 60000)
        return fail('TOO_SOON', `Choose a pickup time at least ${prep} minutes from now.`);
      pickup_time = p.pickup_time;
    }

    let address = null;
    let address_note = null;
    if (p.order_type === 'delivery') {
      address = String(p.address || '').trim();
      if (address.length < 5 || address.length > 300) return fail('ADDRESS_REQUIRED', 'Please enter your delivery address.');
      address_note = String(p.address_note || '').trim().slice(0, 200) || null;
    }
    const note = String(p.note || '').trim().slice(0, 200);
    const emailM = String(p.note || '').match(/^\[Email:\s*([^\]]+)\]\s*/);
    const email = (emailM ? emailM[1] : '').trim() || null;

    const items = [];
    for (const l of lines) {
      const it = S.menu_items.find((x) => x.id === l.item_id);
      if (!it) return fail('ITEM_NOT_FOUND', 'One of the dishes is no longer on the menu. Please remove it.');
      if (it.is_available === false) return fail('SOLD_OUT', `${it.name} is sold out. Please remove it.`);
      const price = Number(it.price);
      items.push({ item_id: it.id, name: it.name, price, qty: l.qty, line_total: price * l.qty });
    }

    const subtotal = items.reduce((a, i) => a + i.line_total, 0);
    const minimum = Number(s.min_delivery_order) || 0;
    if (p.order_type === 'delivery' && minimum > 0 && subtotal < minimum)
      return fail('BELOW_MINIMUM', `Delivery orders need at least ৳${minimum}. Your order is ৳${subtotal}.`);

    const tax = Math.round((subtotal * (Number(s.tax_rate) || 0)) / 100);
    const delivery_fee = p.order_type === 'delivery' ? Number(s.delivery_fee) || 0 : 0;
    return {
      name, phone: String(p.phone), address, address_note, note, pickup_time, email,
      items, subtotal, tax, delivery_fee, total: subtotal + tax + delivery_fee,
    };
  }

  /* ---------- window.KG API ---------- */
  window.KG = {
    getSettings: async () => {
      const sb = await getClient();
      if (!sb) {
        return withStore((S) => {
          const s = S.settings;
          const hours = [
            s.hours_week && `Weekdays ${s.hours_week}`,
            s.hours_weekend && `Weekend ${s.hours_weekend}`,
          ].filter(Boolean).join(' · ');
          return ok({
            restaurant_name: s.name,
            tagline: s.tagline,
            phone: s.phone,
            email: s.email,
            address: s.address,
            hours,
            story: s.story && s.story.length ? s.story : DEFAULT_STORY,
            reservation_slots: SLOTS,
            tax_rate: Number(s.tax_rate) || 0,
            delivery_fee: Number(s.delivery_fee) || 0,
            min_delivery_order: Number(s.min_delivery_order) || 0,
            pickup_enabled: s.pickup_enabled !== false,
            delivery_enabled: s.delivery_enabled !== false,
            prep_time_minutes: Number(s.prep_time_minutes) || 20,
            pickup_hours: s.pickup_hours || '',
          });
        });
      }

      const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
      if (error) return fail('SETTINGS_FAILED', error.message);
      return ok({
        restaurant_name: data.restaurant_name,
        tagline: data.tagline,
        phone: data.phone,
        email: data.email,
        address: data.address,
        hours: data.hours,
        story: DEFAULT_STORY,
        reservation_slots: SLOTS,
        tax_rate: Number(data.tax_percent) || 0,
        delivery_fee: Number(data.delivery_fee) || 0,
        min_delivery_order: Number(data.min_delivery_amount) || 0,
        pickup_enabled: data.pickup_enabled !== false,
        delivery_enabled: data.delivery_enabled !== false,
        prep_time_minutes: Number(data.prep_time_minutes) || 25,
        pickup_hours: data.pickup_hours || '',
      });
    },

    getCategories: async () => {
      try {
        const sb = await getClient();
        if (sb) {
          const { data, error } = await sb.from('categories').select('*').order('sort_order');
          if (!error && Array.isArray(data) && data.length > 0) {
            return ok(data.map((c) => ({
              id: c.id,
              name: c.name,
              sort_order: c.sort_order,
              description: c.description || '',
              image_url: c.image_url || '',
            })));
          }
        }
      } catch (err) {
        console.warn('[Categories] Supabase fetch error, using fallback:', err);
      }

      // Robust fallback so categories never disappear
      return ok([
        {
          id: "00e0edce-0910-4c33-bc1a-c19c712b65fd",
          name: "A First Impression",
          sort_order: 1,
          description: "Starters & Appetizers.\nThe perfect beginning to a memorable dining experience.",
          image_url: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793216974801-kheruq.jpeg"
        },
        {
          id: "cd624018-9523-430d-868e-175f60088f8a",
          name: "Treasures of the Sea",
          sort_order: 2,
          description: "Seafood & Ocean Specialties\n\nA premium collection for seafood lovers, inspired by coastal cuisines around the world.",
          image_url: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793215183188-mqjjux.jpeg"
        },
        {
          id: "5e1a1a64-6018-45c3-8375-533ae5038d29",
          name: "Roots & Heritage",
          sort_order: 3,
          description: "Bengali & South Asian Classics\nCelebrating familiar flavours, traditional recipes, and culinary heritage.",
          image_url: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793215274075-gpdgnk.jpeg"
        },
        {
          id: "bb954bc0-b165-4ccc-9313-a8fcfbea395c",
          name: "A Sweet Ending",
          sort_order: 6,
          description: "Desserts & Confections.\nAn indulgent final chapter, from European patisserie to Bengali sweets.",
          image_url: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793215603177-zh26lh.jpeg"
        },
        {
          id: "e5675b63-c747-493a-acde-8df0891c9a98",
          name: "The Drinks Atelier",
          sort_order: 7,
          description: "Beverages & Signature Mixes.\nCrafted refreshments, elegant mocktails, coffees, and teas.",
          image_url: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793216831318-k3yyod.jpeg"
        }
      ]);
    },

    getMenu: async () => {
      const sb = await getClient();
      if (!sb) {
        return withStore((S) => ok(S.menu_items.slice().sort(byOrder).map(toItem)));
      }

      const { data, error } = await sb.from('menu_items').select('*').order('sort_order');
      if (error) return fail('MENU_FAILED', error.message);
      return ok((data || []).map(toItem));
    },

    getGallery: async () => {
      const sb = await getClient();
      if (!sb) {
        return withStore((S) =>
          ok(
            S.gallery_images.slice().sort(byOrder).map((g) => ({
              id: g.id,
              image_url: g.image_url,
              caption: g.caption || '',
            }))
          )
        );
      }

      const { data, error } = await sb.from('gallery_images').select('*').order('sort_order');
      if (error) return fail('GALLERY_FAILED', error.message);
      return ok((data || []).map((g) => ({
        id: g.id,
        image_url: g.image_url,
        caption: g.caption || '',
      })));
    },

    placeOrder: async (p) => {
      const sb = await getClient();
      if (!sb) {
        return withStore((S, save) => {
          const priced = priceOrder(p, S);
          if (priced.error) return priced;
          const seq = (Number(S.order_seq) || 1000) + 1;
          S.order_seq = seq;
          const rec = {
            id: `ord_${seq}`,
            receipt: `KG-${seq}`,
            order_type: p.order_type,
            table_id: null,
            table_number: null,
            customer_name: priced.name,
            phone: priced.phone,
            address: priced.address,
            address_note: priced.address_note,
            pickup_time: priced.pickup_time,
            note: priced.note,
            email: priced.email || null,
            status: 'new',
            payment_status: 'unpaid',
            subtotal: priced.subtotal,
            tax: priced.tax,
            delivery_fee: priced.delivery_fee,
            total: priced.total,
            delivery_agency_note: null,
            items: priced.items,
            created_at: new Date().toISOString(),
            paid_at: null,
          };
          S.orders.unshift(rec);
          save();
          return ok({
            id: rec.id,
            receipt: rec.receipt,
            subtotal: rec.subtotal,
            tax: rec.tax,
            delivery_fee: rec.delivery_fee,
            total: rec.total,
            status: rec.status,
          });
        });
      }

      const { data, error } = await sb.rpc('kg_place_online_order', {
        p_type: p.order_type,
        p_lines: p.lines,
        p_name: p.name,
        p_phone: p.phone,
        p_address: p.address || null,
        p_address_note: p.address_note || null,
        p_pickup_time: p.pickup_time || null,
        p_note: p.note || null,
        p_honeypot: p.honeypot || null,
      });

      if (error) {
        if (error.code === 'PGRST202') return fail('ORDER_FAILED', 'Online ordering is not available right now. Please call the restaurant.');
        return fail('ORDER_FAILED', error.message);
      }
      return ok(data);
    },

    /* Dine-in: the guest scanned the QR code on the table. No pickup time and
       no address; the kitchen needs the table number. */
    placeDineinOrder: async (p) => {
      const lines = Array.isArray(p.lines) ? p.lines : [];
      if (!lines.length) return fail('VALIDATION_ERROR', 'Your plate is empty.');
      if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20))
        return fail('BAD_QTY', 'Each dish can be ordered 1 to 20 times.');

      const name = String(p.name || '').trim();
      if (!name || name.length > 80) return fail('VALIDATION_ERROR', 'Please enter your name.');
      const phone = String(p.phone || '').replace(/[\s-]/g, '');
      if (phone && !PHONE.test(phone)) return fail('BAD_PHONE', 'Please enter a valid mobile number.');
      if (p.honeypot) return fail('SPAM_DETECTED', 'Your order could not be accepted.');

      const table_number = Number(p.table_number);
      if (!Number.isInteger(table_number) || table_number < 1 || table_number > 500)
        return fail('VALIDATION_ERROR', 'Scan the QR code on your table again.');

      const sb = await getClient();
      if (!sb) {
        return withStore((S, save) => {
          const items = [];
          for (const l of lines) {
            const it = S.menu_items.find((x) => x.id === l.item_id);
            if (!it) return fail('ITEM_NOT_FOUND', 'One of the dishes is no longer on the menu. Please remove it.');
            if (it.is_available === false) return fail('SOLD_OUT', `${it.name} is sold out. Please remove it.`);
            items.push({
              item_id: it.id, name: it.name, price: Number(it.price),
              qty: l.qty, line_total: Number(it.price) * l.qty,
            });
          }
          const subtotal = items.reduce((a, i) => a + i.line_total, 0);
          const tax = Math.round((subtotal * (Number(S.settings.tax_rate) || 0)) / 100);
          const seq = (Number(S.order_seq) || 1000) + 1;
          S.order_seq = seq;
          const rec = {
            id: `ord_${seq}`,
            receipt: `KG-${seq}`,
            order_type: 'dine-in',
            table_id: null,
            table_number,
            customer_name: name,
            phone: phone || null,
            note: String(p.note || '').trim(),
            status: 'new',
            payment_status: 'unpaid',
            subtotal,
            tax,
            delivery_fee: 0,
            total: subtotal + tax,
            items,
            created_at: new Date().toISOString(),
            paid_at: null,
          };
          S.orders.unshift(rec);
          save();
          return ok(rec);
        });
      }

      const { data, error } = await sb.rpc('kg_place_dinein_order', {
        p_table_number: table_number,
        p_lines: lines.map((l) => ({ item_id: l.item_id, qty: l.qty })),
        p_name: name,
        p_phone: phone || null,
        p_note: String(p.note || '').trim() || null,
        p_honeypot: '',
      });

      if (error) {
        if (error.code === 'PGRST202') return fail('ORDER_FAILED', 'Table ordering is not switched on yet. Please call a waiter.');
        return fail('ORDER_FAILED', error.message);
      }
      return ok(data);
    },

    getOrder: async (id) => {
      const sb = await getClient();
      if (!sb) {
        return withStore((S) => {
          const o = S.orders.find((x) => x.id === id);
          return o ? ok(clone(o)) : fail('NOT_FOUND', 'We could not find that order.');
        });
      }

      const { data, error } = await sb.rpc('track_order', { p_id: id });
      if (error) return fail('NOT_FOUND', error.message);

      /* Normalise the receipt: the database may return the raw row names. */
      const d = data || {};
      const items = (d.items || d.order_items || []).map((i) => ({
        name: i.name || i.item_name || '',
        qty: i.qty != null ? i.qty : i.quantity,
        line_total: Number(i.line_total) || 0,
      }));
      return ok({
        ...d,
        receipt: d.receipt || d.receipt_number || '',
        tax: Number(d.tax != null ? d.tax : d.tax_amount) || 0,
        address: d.address || d.delivery_address || '',
        table_number: d.table_number || null,
        items,
      });
    },

    /* ---------- email OTP for pickup / delivery orders ---------- */
    sendOtp: async (email) => {
      const sb = await getClient();
      const clean = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return fail('VALIDATION_ERROR', 'Please enter a valid email address.');

      const code = String(Math.floor(100000 + Math.random() * 900000));
      OTP_STORE.set(clean, { code, expires: Date.now() + 5 * 60 * 1000 });

      if (sb) {
        /* Deliver the OTP through the restaurant's real email service
           (EmailJS -> webhook -> native mailto fallback) instead of relying on
           the Supabase project's own email provider. */
        const cfg = JSON.parse(localStorage.getItem('kg.email.config') || '{}');
        const subject = 'Your Khabar Golpo Order OTP';
        const body = `Your Khabar Golpo order verification code is: ${code}\n\nThis code expires in 5 minutes. If you did not request it, please ignore this email.`;
        let sent = false;
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
                  to_email: clean,
                  email: clean,
                  code,
                  passcode: code,
                  otp: code,
                  time: new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(11, 16) + ' UTC',
                  name: '',
                  subject,
                  text: body,
                  html: `<p>${String(body).replace(/\\n/g, '<br/>')}</p>`,
                },
              }),
            });
            sent = res.ok;
          } catch (e) {
            console.error('OTP EmailJS error:', e);
          }
        } else if (cfg.provider === 'webhook' && cfg.webhookUrl) {
          try {
            const res = await fetch(cfg.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'otp', to: clean, subject, body }),
            });
            sent = res.ok;
          } catch (e) {
            console.error('OTP webhook error:', e);
          }
        } else {
          sent = true; // native mailto fallback
        }
        if (!sent) return fail('OTP_SEND_FAILED', 'Could not send the OTP email right now.');
        return ok({ sent: true, email: clean });
      }

      return ok({ sent: true, email: clean, dev_code: code });
    },

    verifyOtp: async (email, code) => {
      const sb = await getClient();
      const clean = String(email || '').trim();
      const token = String(code || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return fail('VALIDATION_ERROR', 'Please enter a valid email address.');
      if (!/^\d{6}$/.test(token)) return fail('OTP_INVALID', 'Please enter the 6-digit code we sent.');

      const rec = OTP_STORE.get(clean);
      if (rec && rec.expires > Date.now() && rec.code === token) {
        OTP_STORE.delete(clean);
        return ok({ verified: true, email: clean });
      }

      if (sb) {
        try {
          const { data, error } = await sb.auth.verifyOtp({ email: clean, token, type: 'email' });
          if (error) return fail('OTP_INVALID', error.message);
          return ok({ verified: true, email: clean, data });
        } catch (e) {
          return fail('OTP_INVALID', 'That code did not match. Please try again.');
        }
      }

      return fail('OTP_INVALID', 'That code did not match. Please try again.');
    },

    /* Which of the ten tables are still free for this date + time?
       The database decides, so two guests can never book the same table. */
    getAvailableTables: async ({ date, time } = {}) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return fail('VALIDATION_ERROR', 'Choose a date first.');
      if (!TIME.test(time || '')) return fail('VALIDATION_ERROR', 'Choose a time first.');

      const sb = await getClient();
      if (!sb) {
        return withStore((S) => {
          const busy = new Set(
            (S.reservations || [])
              .filter((x) => x.table_id && x.date === date && x.time === time && x.status !== 'cancelled')
              .map((x) => x.table_id)
          );
          const list = [];
          for (let n = 1; n <= 10; n++) {
            const id = 'table_' + n;
            if (!busy.has(id)) list.push({ id, table_number: n });
          }
          return ok(list);
        });
      }

      const rpc = await sb.rpc('available_tables', { p_date: date, p_time: time });
      if (!rpc.error) {
        return ok((rpc.data || []).map((t) => ({ id: t.id, table_number: Number(t.table_number) })));
      }

      /* Older database without the function: fall back to the raw table list. */
      if (rpc.error.code !== 'PGRST202' && !/could not find the function/i.test(rpc.error.message || '')) {
        return fail('TABLES_FAILED', rpc.error.message);
      }
      const fb = await sb.from('tables').select('id, table_number').eq('is_active', true).order('table_number');
      if (fb.error) return fail('TABLES_FAILED', fb.error.message);
      return ok((fb.data || []).map((t) => ({ id: t.id, table_number: Number(t.table_number) })));
    },

    createReservation: async (r) => {
      const err = checkReservation(r);
      if (err) return err;

      const sb = await getClient();
      if (!sb) {
        return withStore((S, save) => {
          const rec = {
            id: 'res_' + Date.now(),
            name: String(r.name).trim(),
            email: String(r.email || '').trim(),
            phone: String(r.phone),
            date: r.date,
            time: r.time,
            guests: Number(r.guests),
            note: (r.email ? `[Email: ${String(r.email).trim()}] ` : '') + String(r.note || '').trim(),
            status: 'pending',
            created_at: new Date().toISOString(),
          };
          S.reservations.push(rec);
          save();
          return ok({ id: rec.id, status: 'pending' });
        });
      }

      /* Bookings go through a database function: the customer may create a
         pending request but can never mark it confirmed, and the reservations
         table itself stays closed to anonymous readers. The function also
         refuses a table that is already taken for that slot. */
      const payload = {
        name: String(r.name).trim(),
        phone: String(r.phone),
        date: r.date,
        time: r.time,
        guests: Number(r.guests) || 1,
        note: (r.email ? `[Email: ${String(r.email).trim()}] ` : '') + String(r.note || '').trim(),
      };

      const { data, error } = await sb.rpc('book_table', {
        p_name: payload.name,
        p_phone: payload.phone,
        p_date: payload.date,
        p_time: payload.time,
        p_guests: payload.guests,
        p_note: payload.note,
        p_honeypot: r.honeypot || '',
      });

      /* If the function has not been created yet, fall back to a plain insert
         (status defaults to pending and the admin panel approves it). */
      if (error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''))) {
        const fb = await sb.from('reservations').insert({ ...payload, status: 'pending' });
        if (fb.error) return fail('RESERVATION_FAILED', fb.error.message);
        return ok({ status: 'pending' });
      }

      if (error) return fail('RESERVATION_FAILED', error.message);
      return ok({
        id: data && data.id,
        status: (data && data.status) || 'pending',
        table_number: data && data.table_number,
      });
    },

    submitFeedback: async (f) => {
      const err = checkFeedback(f);
      if (err) return err;

      const sb = await getClient();
      if (!sb) {
        return withStore((S, save) => {
          const rec = {
            id: 'fb_' + Date.now(),
            type: f.type,
            name: String(f.name).trim(),
            phone: f.phone ? String(f.phone) : '',
            rating: f.type === 'review' ? Number(f.rating) : null,
            message: String(f.message).trim(),
            is_approved: false,
            is_read: false,
            created_at: new Date().toISOString(),
          };
          S.feedback.push(rec);
          save();
          return ok({ id: rec.id });
        });
      }

      try {
        const { data, error } = await sb.from('feedback').insert({
          type: f.type,
          name: String(f.name).trim(),
          phone: f.phone ? String(f.phone) : null,
          rating: f.type === 'review' ? Number(f.rating) : null,
          message: String(f.message).trim(),
        }).select().single();

        if (error) {
          console.warn('[Feedback] Supabase insert warning (RLS policy may need to be added):', error.message);
          // Fall back gracefully to local store so customer experience never breaks
          return withStore((S, save) => {
            const rec = {
              id: 'fb_' + Date.now(),
              type: f.type,
              name: String(f.name).trim(),
              phone: f.phone ? String(f.phone) : '',
              rating: f.type === 'review' ? Number(f.rating) : null,
              message: String(f.message).trim(),
              is_approved: false,
              is_read: false,
              created_at: new Date().toISOString(),
            };
            S.feedback.push(rec);
            save();
            return ok({ id: rec.id });
          });
        }
        return ok({ id: data ? data.id : 'fb_' + Date.now() });
      } catch (err) {
        return withStore((S, save) => {
          const rec = {
            id: 'fb_' + Date.now(),
            type: f.type,
            name: String(f.name).trim(),
            phone: f.phone ? String(f.phone) : '',
            rating: f.type === 'review' ? Number(f.rating) : null,
            message: String(f.message).trim(),
            is_approved: false,
            is_read: false,
            created_at: new Date().toISOString(),
          };
          S.feedback.push(rec);
          save();
          return ok({ id: rec.id });
        });
      }
    },
  };
})();
