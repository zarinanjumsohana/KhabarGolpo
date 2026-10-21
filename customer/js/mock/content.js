/* KhabarGolpo customer content.
   TODAY: mock data, so the pages work before the database is ready.
   LATER: replace the body of each function with the matching call from js/api/public.js.
   Every function returns { data, error }, the same shape as the API contract. */
(() => {
  const wait = v => new Promise(res => setTimeout(() => res(v), 120));
  const ok = data => ({ data, error: null });
  const fail = (code, message) => ({ data: null, error: { code, message } });
  const PHONE = /^(\+8801|01)[3-9]\d{8}$/;

  /* Reservation times, 12:00 to 21:30 every 30 minutes. Placeholder: set your real times in the admin panel. */
  const SLOTS = [];
  for (let m = 12 * 60; m <= 21 * 60 + 30; m += 30) {
    SLOTS.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }

  /* Settings. Address, phone, email and hours are blank until the admin fills them in. */
  const SETTINGS = {
    restaurant_name: 'KhabarGolpo',
    phone: '',
    email: '',
    address: '',
    hours: '',
    reservation_slots: SLOTS,
    // DRAFT story: a starting point only. Replace with your real story.
    story: [
      'Every good meal begins long before the first plate reaches the table. For us, it began with the people who taught us to cook: kitchens where nobody was ever rushed, and tables that always had room for one more.',
      'KhabarGolpo grew from a simple wish: to give every guest that same feeling. We wanted food that tastes like home, served in a place that feels warm the moment you walk in.',
      'Every recipe here has been tried, tasted and shared again and again until it was just right. Each dish carries a little of the hands that made it.',
      'Come in, grab a seat, and let every flavour tell its tale.'
    ]
  };

  /* Categories: name, photo and description are added by the admin. Photos are empty until uploaded. */
  const CATEGORIES = [
    { id: 'cat-mains', name: 'Mains', sort_order: 1, intro: 'Slow-cooked dishes from family kitchens, served with rice.', image_url: '' },
    { id: 'cat-sides', name: 'Sides', sort_order: 2, intro: 'Small plates that go with everything on the table.', image_url: '' },
    { id: 'cat-desserts', name: 'Desserts', sort_order: 3, intro: 'Something sweet to finish.', image_url: '' }
  ];

  /* Gallery: place the photos at these paths. Missing files show as colour tiles. */
  const GALLERY = [1, 2, 3, 4, 5, 6].map(n => ({
    id: 'gal-' + n,
    image_url: 'assets/images/gallery/0' + n + '.jpg',
    caption: 'Photo ' + n
  }));

  /* ---------- validation (same rules as the database) ---------- */
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

  /* ---------- the functions the pages call ---------- */
  window.KG = {
    getSettings: () => wait(ok(SETTINGS)),
    getCategories: () => wait(ok(CATEGORIES.slice().sort((a, b) => a.sort_order - b.sort_order))),
    getGallery: () => wait(ok(GALLERY)),
    createReservation: r => {
      const err = checkReservation(r);
      return wait(err || ok({ id: 'mock-' + Date.now(), status: 'pending' }));
    },
    submitFeedback: f => {
      const err = checkFeedback(f);
      return wait(err || ok({ id: 'mock-' + Date.now() }));
    }
  };
})();