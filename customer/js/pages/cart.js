/* Cart page: review the plate, set quantities, choose pickup or delivery, and place the order. */
(() => {
  const $ = (s) => document.querySelector(s);
  const form = $('#orderForm');
  const F = (name) => form.elements.namedItem(name);
  const PHONE = /^01[3-9]\d{8}$/;
  /* Accept every Bangladeshi mobile operator (013–019). "+880…" and "880…"
     are folded back to the local 11-digit "01…" form. */
  const normalizePhone = (v) => {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('8801')) d = '0' + d.slice(3);
    return d.slice(0, 11);
  };
  const money = (n) => '৳' + Math.round(n).toLocaleString('en-US');

  let menu = [];
  let settings = { tax_rate: 0, delivery_fee: 0, pickup_enabled: true, delivery_enabled: true, prep_time_minutes: 20 };
  let mode = 'pickup';
  let otp = { sent: false, verified: false, email: '' };

  /* Table QR links look like /customer/index.html?table=5 */
  const fromUrl = Number(new URLSearchParams(location.search).get('table'));
  const remembered = Number(localStorage.getItem('kg-table'));
  const tableNumber =
    Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl
      : Number.isInteger(remembered) && remembered > 0 ? remembered
        : 0;
  if (tableNumber) localStorage.setItem('kg-table', String(tableNumber));

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function totals() {
    const subtotal = KGCart.lines().reduce((a, l) => {
      const it = menu.find((m) => m.id === l.item_id);
      return a + (it && it.is_available ? it.price * l.qty : 0);
    }, 0);
    const tax = Math.round((subtotal * (settings.tax_rate || 0)) / 100);
    const fee = mode === 'delivery' ? Number(settings.delivery_fee) || 0 : 0;
    return { subtotal, tax, fee, total: subtotal + tax + fee };
  }

  function renderTotals() {
    const t = totals();
    const box = $('#totals');
    box.textContent = '';
    box.append(make('p', '', `Subtotal: ${money(t.subtotal)}`));
    box.append(make('p', '', `Tax: ${money(t.tax)}`));
    if (mode === 'delivery') box.append(make('p', '', `Delivery fee: ${money(t.fee)}`));
    box.append(make('p', 'grand', `Total: ${money(t.total)}`));
  }

  function renderLines() {
    const lines = KGCart.lines();
    const list = $('#cartLines');
    list.textContent = '';
    $('#cartEmpty').hidden = lines.length > 0;
    form.hidden = lines.length === 0;

    lines.forEach((l) => {
      const it = menu.find((m) => m.id === l.item_id);
      if (!it) return;
      const li = make('li', 'cart-line');
      const img = new Image();
      img.alt = '';
      img.src = it.image_url;

      const info = make('div', 'cart-info');
      info.append(make('h3', '', it.name), make('p', 'muted', `${money(it.price)} each${it.is_available ? '' : ' · sold out'}`));

      const qty = make('div', 'qty');
      const minus = make('button', 'qty-btn', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', 'Reduce quantity');
      minus.addEventListener('click', () => KGCart.setQty(it.id, l.qty - 1));
      const plus = make('button', 'qty-btn', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Increase quantity');
      plus.addEventListener('click', () => KGCart.setQty(it.id, l.qty + 1));
      qty.append(minus, make('span', 'qty-val', String(l.qty)), plus);

      const remove = make('button', 'ghost', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', () => KGCart.remove(it.id));

      li.append(img, info, qty, make('span', 'line-total', money(it.price * l.qty)), remove);
      list.append(li);
    });
    renderTotals();
  }

  function setMode(m) {
    mode = m;
    form.querySelectorAll('input[name=mode]').forEach((r) => { r.checked = r.value === m; });
    $('#pickupBox').hidden = m !== 'pickup';
    $('#deliveryBox').hidden = m !== 'delivery';
    F('pickup_time').required = m === 'pickup';
    F('address').required = m === 'delivery';
    F('phone').required = m !== 'dine-in';
    $('#emailRow').hidden = m === 'dine-in';
    F('email').required = m !== 'dine-in';
    $('#otpBox').hidden = m === 'dine-in';
    renderTotals();
  }

  function applySettings(s) {
    settings = { ...settings, ...s };
    const radios = [...form.querySelectorAll('input[name=mode]')];
    radios.find((r) => r.value === 'pickup').disabled = !settings.pickup_enabled;
    radios.find((r) => r.value === 'delivery').disabled = !settings.delivery_enabled;

    /* A guest who scanned a table QR can only order for that table. */
    if (tableNumber) {
      $('#dineMode').hidden = false;
      $('#dineLabel').textContent = 'Dine-in · Table ' + tableNumber;
      setMode('dine-in');
      $('#modeNote').textContent = `Ordering for Table ${tableNumber}. We will serve it at your table.`;
      return;
    }

    const first = settings.pickup_enabled ? 'pickup' : settings.delivery_enabled ? 'delivery' : null;
    if (!first) {
      $('#modeNote').textContent = 'Online ordering is closed right now.';
      $('#placeBtn').disabled = true;
    } else {
      setMode(first);
      $('#modeNote').textContent = `Your order is ready in about ${settings.prep_time_minutes} minutes.`;
    }
  }

  form.querySelectorAll('input[name=mode]').forEach((r) =>
    r.addEventListener('change', () => setMode(r.value))
  );

  /* Mobile numbers: keep digits only, cap at 11, and tidy "+880…" to "01…". */
  F('phone').addEventListener('input', (e) => {
    const tidy = normalizePhone(e.target.value);
    if (e.target.value !== tidy) e.target.value = tidy;
  });

  let resendTimer = null;
  const sendLabel = (t) => { const el = $('#btnSendOtpText'); if (el) el.textContent = t; };

  function startResendCountdown() {
    const btn = $('#btnSendOtp');
    clearInterval(resendTimer);
    let left = 60;
    btn.disabled = true;
    sendLabel(`Resend in ${left}s`);
    resendTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
        btn.disabled = false;
        sendLabel('Resend code');
      } else {
        sendLabel(`Resend in ${left}s`);
      }
    }, 1000);
  }

  function setOtpMessage(text, ok) {
    const msg = $('#otpMsg');
    if (!msg) return;
    msg.textContent = text || '';
    msg.classList.toggle('ok', !!ok);
  }

  async function doSendOtp() {
    const now = Date.now();
    if (otp.lockedUntil && otp.lockedUntil > now) {
      setOtpMessage(`Too many wrong codes. Try again after ${Math.ceil((otp.lockedUntil - now) / 60000)} min.`);
      return false;
    }
    if (otp.verified) return true;
    if (otp.lastSent && now - otp.lastSent < 60000) {
      setOtpMessage('Please wait a moment before asking for a new code.');
      return false;
    }
    const email = F('email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpMessage('Enter a valid email address first, then tap “Email me the code”.');
      return false;
    }
    const res = await KG.sendOtp(email);
    if (res.error) {
      setOtpMessage(res.error.message || 'We could not send the code right now. Please try again.');
      otp = { sent: false, verified: false, email };
      return false;
    }
    otp = { sent: true, verified: false, email, attempts: 0, lastSent: Date.now(), lockedUntil: 0 };
    const target = $('#otpTarget');
    if (target) target.textContent = email;
    setOtpMessage(`Code sent to ${email}. Check your inbox (and spam) — it expires in 5 minutes.`);
    startResendCountdown();
    return true;
  }

  async function doVerifyOtp() {
    const now = Date.now();
    if (otp.verified) return true;
    if (otp.lockedUntil && otp.lockedUntil > now) {
      setOtpMessage('Too many wrong codes. Please wait a few minutes.');
      otp.verified = false;
      return false;
    }
    const res = await KG.verifyOtp(otp.email, F('otp').value);
    if (res.error) {
      const attempts = (otp.attempts || 0) + 1;
      const lockedUntil = attempts >= 3 ? now + 5 * 60000 : 0;
      otp = { ...otp, attempts, verified: false, lockedUntil };
      setOtpMessage(
        lockedUntil
          ? 'Too many wrong codes. Please wait 5 minutes and request a new one.'
          : 'That code did not match. Check the 6 digits in your inbox and try again.'
      );
      return false;
    }
    otp.verified = true;
    setOtpMessage('Email verified successfully ✓ You can place your order now.', true);
    clearInterval(resendTimer);
    resendTimer = null;
    const btn = $('#btnSendOtp');
    if (btn) { btn.disabled = true; sendLabel('Email verified'); }
    return true;
  }

  $('#btnSendOtp').addEventListener('click', async () => {
    const btn = $('#btnSendOtp');
    btn.disabled = true;
    sendLabel('Sending…');
    const ok = await doSendOtp();
    if (!ok && !resendTimer) {
      btn.disabled = false;
      sendLabel(otp.sent ? 'Resend code' : 'Email me the code');
    }
  });

  $('#otpInput').addEventListener('input', (e) => {
    const v = (e.target.value || '').replace(/\D/g, '').slice(0, 6);
    e.target.value = v;
    if (v.length === 6) doVerifyOtp();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#orderErr');
    err.textContent = '';
    if (F('company').value) return; // honeypot

    const name = F('name').value.trim();
    const phone = normalizePhone(F('phone').value);
    if (!name) return (err.textContent = 'Please enter your name.');
    if (mode !== 'dine-in' && !PHONE.test(phone))
      return (err.textContent = 'Enter an 11-digit Bangladeshi mobile number, like 01712345678.');
    if (mode === 'dine-in' && phone && !PHONE.test(phone))
      return (err.textContent = 'Enter an 11-digit mobile number, or leave it empty.');
    if (mode === 'pickup' && !F('pickup_time').value) return (err.textContent = 'Choose a pickup time.');
    if (mode === 'delivery' && F('address').value.trim().length < 5)
      return (err.textContent = 'Please enter your delivery address.');

    /* Pickup / delivery orders carry an email for the confirmation step. */
    const email = F('email').value.trim();
    if (mode !== 'dine-in') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return (err.textContent = 'Please enter a valid email address, like you@example.com.');
    }
    const rawNote = F('note').value.trim();
    const note = mode !== 'dine-in' && email
      ? `[Email: ${email}] ${rawNote}`.trim()
      : rawNote;

    const btn = $('#placeBtn');
    btn.disabled = true;

    /* Pickup / delivery: email + OTP must be verified before the order goes out. */
    if (mode !== 'dine-in') {
      if (!otp.verified) {
        const sent = await doSendOtp();
        if (!sent) { btn.disabled = false; return; }
        if (!otp.verified) {
          err.textContent = 'Please enter the OTP code we sent to your email.';
          btn.disabled = false;
          return;
        }
      }
    }

    const res = mode === 'dine-in'
      ? await KG.placeDineinOrder({
        lines: KGCart.lines(),
        name,
        phone,
        table_number: tableNumber,
        note: F('note').value,
        honeypot: '',
      })
      : await KG.placeOrder({
        lines: KGCart.lines(),
        order_type: mode,
        name,
        phone,
        pickup_time: F('pickup_time').value,
        address: F('address').value,
        address_note: F('address_note').value,
        note,
        honeypot: '',
      });
    btn.disabled = false;
    if (res.error) return (err.textContent = res.error.message);

    KGCart.clear();
    location.href = `order.html?id=${encodeURIComponent(res.data.id)}`;
  });

  addEventListener('kg-cart-changed', renderLines);

  async function init() {
    renderLines();
    const [m, s] = await Promise.all([KG.getMenu(), KG.getSettings()]);
    menu = m.data || [];
    if (s.data) applySettings(s.data);
    renderLines();
  }

  init();
})();