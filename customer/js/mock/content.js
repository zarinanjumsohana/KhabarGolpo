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
      name, phone: String(p.phone), address, address_note, note, pickup_time,
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
      const sb = await getClient();
      if (!sb) {
        return withStore((S) =>
          ok(
            S.categories.slice().sort(byOrder).map((c) => ({
              id: c.id,
              name: c.name,
              sort_order: c.sort_order,
              description: c.description || '',
              image_url: c.image_url || '',
            }))
          )
        );
      }

      const { data, error } = await sb.from('categories').select('*').order('sort_order');
      if (error) return fail('CATEGORIES_FAILED', error.message);
      return ok((data || []).map((c) => ({
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
        description: c.description || '',
        image_url: c.image_url || '',
      })));
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

      const { data, error } = await sb.rpc('place_online_order', {
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

      if (error) return fail('ORDER_FAILED', error.message);
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
      return ok(data);
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
            phone: String(r.phone),
            date: r.date,
            time: r.time,
            guests: Number(r.guests),
            note: String(r.note || '').trim(),
            status: 'pending',
            created_at: new Date().toISOString(),
          };
          S.reservations.push(rec);
          save();
          return ok({ id: rec.id, status: 'pending' });
        });
      }

      const { data, error } = await sb.from('reservations').insert({
        name: String(r.name).trim(),
        phone: String(r.phone),
        date: r.date,
        time: r.time,
        guests: Number(r.guests),
        note: String(r.note || '').trim(),
      }).select().single();

      if (error) return fail('RESERVATION_FAILED', error.message);
      return ok({ id: data.id, status: data.status });
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

      const { data, error } = await sb.from('feedback').insert({
        type: f.type,
        name: String(f.name).trim(),
        phone: f.phone ? String(f.phone) : null,
        rating: f.type === 'review' ? Number(f.rating) : null,
        message: String(f.message).trim(),
      }).select().single();

      if (error) return fail('FEEDBACK_FAILED', error.message);
      return ok({ id: data.id });
    },
  };
})();
