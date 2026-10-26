/* Cart page: review the plate, set quantities, choose pickup or delivery, and place the order. */
(() => {
  const $ = (s) => document.querySelector(s);
  const form = $('#orderForm');
  const F = (name) => form.elements.namedItem(name);
  const PHONE = /^(\+8801|01)[3-9]\d{8}$/;
  const money = (n) => '৳' + Math.round(n).toLocaleString('en-US');

  let menu = [];
  let settings = { tax_rate: 0, delivery_fee: 0, pickup_enabled: true, delivery_enabled: true, prep_time_minutes: 20 };
  let mode = 'pickup';

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
    renderTotals();
  }

  function applySettings(s) {
    settings = { ...settings, ...s };
    const radios = [...form.querySelectorAll('input[name=mode]')];
    radios.find((r) => r.value === 'pickup').disabled = !settings.pickup_enabled;
    radios.find((r) => r.value === 'delivery').disabled = !settings.delivery_enabled;

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#orderErr');
    err.textContent = '';
    if (F('company').value) return; // honeypot

    const name = F('name').value.trim();
    const phone = F('phone').value.replace(/[\s-]/g, '');
    if (!name) return (err.textContent = 'Please enter your name.');
    if (!PHONE.test(phone)) return (err.textContent = 'Please enter a valid mobile number, like 01712345678.');
    if (mode === 'pickup' && !F('pickup_time').value) return (err.textContent = 'Choose a pickup time.');
    if (mode === 'delivery' && F('address').value.trim().length < 5)
      return (err.textContent = 'Please enter your delivery address.');

    const btn = $('#placeBtn');
    btn.disabled = true;
    const res = await KG.placeOrder({
      lines: KGCart.lines(),
      order_type: mode,
      name,
      phone,
      pickup_time: F('pickup_time').value,
      address: F('address').value,
      address_note: F('address_note').value,
      note: F('note').value,
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