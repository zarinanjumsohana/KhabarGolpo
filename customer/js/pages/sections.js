/* KhabarGolpo sections: story, gallery, contact details, reservation (calendar + form), feedback form */
(() => {
  const KG = window.KG;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const field = (form, name) => form.elements.namedItem(name);   // safer than form.name, which is a form property
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const PHONE = /^(\+8801|01)[3-9]\d{8}$/;
  const clean = s => String(s || '').replace(/[\s-]/g, '');

  $('#year').textContent = new Date().getFullYear();

  /* ---------- reveal on scroll ---------- */
  const reveals = document.querySelectorAll('[data-reveal]');
  if (RM || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { threshold: 0.12 });
    reveals.forEach(el => io.observe(el));
  }

  /* ---------- settings: story, contact details, reservation times ---------- */
  KG.getSettings().then(({ data: s }) => {
    if (!s) return;

    const sb = $('#storyBody');
    sb.textContent = '';
    (s.story || []).forEach(t => sb.append(make('p', '', t)));

    const dl = $('#conList');
    dl.textContent = '';
    [['Address', s.address], ['Phone', s.phone], ['Email', s.email], ['Hours', s.hours]]
      .forEach(([k, v]) => {
        const item = make('div', 'con-item');
        item.append(make('dt', '', k), make('dd', '', v || 'To be added'));
        dl.append(item);
      });

    const times = field(resForm, 'time');
    times.textContent = '';
    times.append(new Option('Choose a time', ''));
    (s.reservation_slots || []).forEach(t => times.append(new Option(t, t)));
  });

  /* ---------- gallery ---------- */
  const lightbox = $('#lightbox'), lbImg = $('#lbImg');
  KG.getGallery().then(({ data }) => {
    const grid = $('#galGrid');
    grid.textContent = '';
    if (!data || !data.length) {
      const note = make('p', 'muted', 'Photos added in the admin panel will appear here.');
      note.style.gridColumn = '1 / -1';
      grid.append(note);
      return;
    }
    data.forEach((g) => {
      const b = make('button', 'gal-item');
      b.type = 'button';
      b.setAttribute('aria-label', 'Open photo: ' + g.caption);
      const img = new Image();
      img.loading = 'lazy';
      img.alt = g.caption;
      img.src = g.image_url;
      img.addEventListener('error', () => img.remove());
      b.append(img, make('span', 'gal-cap', g.caption));
      b.addEventListener('click', () => {
        lbImg.src = g.image_url;
        lbImg.alt = g.caption;
        lightbox.showModal();
      });
      grid.append(b);
    });
  });
  $('#lbClose').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });

  /* ---------- reservation: calendar, then the button, then the form ---------- */
  const resForm = $('#resForm'), resBtn = $('#resBtn'), resHint = $('#resHint');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = '';

  const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const prettyDate = key => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  function drawCalendar() {
    $('#calTitle').textContent = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    $('#calPrev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);

    const days = $('#calDays');
    days.textContent = '';
    const lead = (view.getDay() + 6) % 7;                  // weeks start on Monday
    for (let i = 0; i < lead; i++) days.append(make('span'));

    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= count; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const key = isoOf(date);
      const b = make('button', 'cal-day', String(d));
      b.type = 'button';
      const past = date < today;
      b.classList.toggle('past', past);
      b.setAttribute('aria-disabled', past ? 'true' : 'false');
      b.tabIndex = past ? -1 : 0;
      b.classList.toggle('today', date.getTime() === today.getTime());
      b.classList.toggle('selected', key === selected);
      b.setAttribute('aria-pressed', key === selected ? 'true' : 'false');
      b.setAttribute('aria-label', prettyDate(key));
      b.addEventListener('click', () => choose(key));
      days.append(b);
    }
  }

  function choose(key) {
    if (key < isoOf(today)) {
      resHint.textContent = 'That date has passed — please pick today or a later date.';
      return;
    }
    selected = key;
    drawCalendar();
    resBtn.disabled = false;
    resHint.textContent = 'Selected: ' + prettyDate(key);
    if (!resForm.hidden) {                                // date changed while the form is open
      field(resForm, 'date').value = key;
      resForm.querySelector('.picked').textContent = 'Booking for ' + prettyDate(key) + '.';
    }
  }

  $('#calPrev').addEventListener('click', () => { view.setMonth(view.getMonth() - 1); drawCalendar(); });
  $('#calNext').addEventListener('click', () => { view.setMonth(view.getMonth() + 1); drawCalendar(); });
  drawCalendar();

  function openForm() {
    resForm.hidden = false;
    resBtn.hidden = true;
    field(resForm, 'date').value = selected;
    resForm.querySelector('.picked').textContent = 'Booking for ' + prettyDate(selected) + '.';
    resForm.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    field(resForm, 'name').focus();
  }

  function closeForm() {
    resForm.hidden = true;
    resBtn.hidden = false;
    resForm.reset();
    $('#resErr').textContent = '';
    $('#resOk').textContent = '';
  }

  resBtn.addEventListener('click', () => { if (selected) openForm(); });
  $('#resCancel').addEventListener('click', closeForm);

  resForm.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#resErr'), ok = $('#resOk'), btn = $('#resSubmit');
    err.textContent = '';
    ok.textContent = '';
    if (field(resForm, 'company').value) return;             // honeypot

    const name = field(resForm, 'name').value.trim();
    const email = (field(resForm, 'email')?.value || '').trim();
    const phone = clean(field(resForm, 'phone').value);
    const time = field(resForm, 'time').value;
    const guests = Number(field(resForm, 'guests').value);
    const note = field(resForm, 'note').value.trim();

    if (!name) return (err.textContent = 'Please enter the name for the booking.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (err.textContent = 'Please enter a valid email address.');
    if (!PHONE.test(phone)) return (err.textContent = 'Please enter a valid mobile number.');
    if (!time) return (err.textContent = 'Please choose a time.');

    btn.disabled = true;
    const { error } = await KG.createReservation({ name, email, phone, date: selected, time, guests, note, honeypot: '' });
    btn.disabled = false;

    if (error) {
      err.textContent = error.message;
      return;
    }

    ok.textContent = `Thank you, ${name}! Your reservation for ${guests} guest${guests !== 1 ? 's' : ''} on ${prettyDate(selected)} at ${time} has been submitted. An email confirmation will be sent to ${email} once confirmed.`;
    resForm.reset();
    field(resForm, 'date').value = selected;
  });

  /* ---------- feedback form ---------- */
  const fb = $('#fbForm');
  const starBox = $('#stars');
  const ratingWrap = $('#ratingWrap');
  let rating = 0;

  for (let i = 1; i <= 5; i++) {
    const b = make('button', 'star', '★');
    b.type = 'button';
    b.setAttribute('aria-label', i + (i === 1 ? ' star' : ' stars'));
    b.addEventListener('click', () => {
      rating = i;
      [...starBox.children].forEach((s, j) => s.classList.toggle('on', j < i));
    });
    starBox.append(b);
  }

  const syncRating = () => { ratingWrap.hidden = field(fb, 'type').value !== 'review'; };
  field(fb, 'type').addEventListener('change', syncRating);
  syncRating();

  fb.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#fbErr'), ok = $('#fbOk');
    err.textContent = '';
    ok.textContent = '';
    if (field(fb, 'company').value) return;                  // honeypot

    const type = field(fb, 'type').value;
    const name = field(fb, 'name').value.trim();
    const message = field(fb, 'message').value.trim();
    const phone = clean(field(fb, 'phone').value);

    if (!name) return (err.textContent = 'Please enter your name.');
    if (type === 'review' && !rating) return (err.textContent = 'Please tap a star rating for your review.');
    if (!message) return (err.textContent = 'Please write a short message.');

    const payload = { type, name, message, honeypot: '' };
    if (phone) payload.phone = phone;
    if (type === 'review') payload.rating = rating;

    const { error } = await KG.submitFeedback(payload);
    if (error) { err.textContent = error.message; return; }

    ok.textContent = 'Thank you. Your message has been sent.';
    fb.reset();
    rating = 0;
    [...starBox.children].forEach(s => s.classList.remove('on'));
    syncRating();
  });
})();
