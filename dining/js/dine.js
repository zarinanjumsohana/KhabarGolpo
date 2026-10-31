/* Dine-in menu (dining/). Table-wise QR: the QR on table 5 opens dine.html?table=5 and the table is fixed.
   Flow: scan QR -> menu (categories on top, dishes below) -> Add to plate -> plate drawer -> place order -> live status.
   The drawer slides in from the right on the first Add to plate; the cart button hides or shows it.
   Data comes from window.KG (customer/js/mock/content.js). Orders go through KG.placeDineinOrder() so they
   appear in both the admin panel and the kitchen panel correctly (Supabase or localStorage depending on MOCK_MODE).
   LATER (database): already wired — KG.placeDineinOrder() calls kg_place_dinein_order on Supabase. */
(() => {
  const $ = (s) => document.querySelector(s);
  const money = (n) => '৳' + Math.round(n).toLocaleString('en-US');
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const PLATE_KEY = 'kg-dine-plate';
  const TABLE_KEY = 'kg-dine-table';
  const ORDERS_KEY = 'kg-dine-orders'; // stores [{ id, receipt, created_at }] for this session
  const MAX_TABLE = 99;
  const TABLE_COUNT = 12;                              // tables offered when a guest opens the page without a table QR
  const ORDER_TYPE = 'dine-in';
  const FLOW = ['new', 'approved', 'preparing', 'ready', 'completed'];
  const LABEL = {
    new: 'Received',
    approved: 'Accepted',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
  };
  const POLL_MS = 5000;

  let table = null;        // 1..99 or null
  let tableLocked = false; // true when the table came from the QR link (?table=N)
  let cats = [];
  let menu = [];
  let settings = { tax_rate: 0 };
  let filter = 'all';      // all | <category id>
  let query = '';
  let plate = [];          // [{ item_id, qty }]
  let picked = null;
  let pickedQty = 1;
  let autoOpened = false;  // the drawer opens by itself only on the first Add to plate
  let freshReceipt = '';   // the order just placed, highlighted for a moment
  let pollTimer = null;

  /* ---------- small storage helpers (session only, so the next guest starts fresh) ---------- */
  const save = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* storage may be blocked */ } };
  const load = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const validTable = (v) => {
    const n = Number(v);
    return v !== '' && v != null && Number.isInteger(n) && n >= 1 && n <= MAX_TABLE ? n : null;
  };
  const sum = (list) => list.reduce((a, l) => a + l.qty, 0);
  const clampQty = (n) => Math.max(1, Math.min(20, n));
  const findItem = (id) => menu.find((m) => m.id === id);

  /* ---------- table: chip at the top + table box in the drawer ---------- */
  function fillTableSelect() {
    const sel = $('#plForm').elements.namedItem('table');
    const max = Math.max(TABLE_COUNT, table || 0);
    sel.textContent = '';
    sel.append(new Option('Select your table', ''));
    for (let n = 1; n <= max; n += 1) sel.append(new Option(`Table ${n}`, String(n)));
  }
  function showTable() {
    const chip = $('#tableChip');
    chip.hidden = !table;
    chip.textContent = table ? `Table ${table}` : '';
    const sel = $('#plForm').elements.namedItem('table');
    sel.value = table ? String(table) : '';
    sel.disabled = tableLocked;
    $('#tableHint').hidden = !tableLocked;
  }
  $('#plForm').elements.namedItem('table').addEventListener('change', (e) => {
    table = validTable(e.target.value);
    if (table) save(TABLE_KEY, String(table));
    showTable();
    loadOrders();
  });

  /* ---------- drawer ---------- */
  const drawer = $('#drawer');
  const isOpen = () => drawer.classList.contains('open');
  function setDrawer(open) {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('drawer-open', open);
    $('#plateBtn').setAttribute('aria-expanded', String(open));
    setTimeout(updateArrows, 480);
  }
  $('#plateBtn').addEventListener('click', () => setDrawer(!isOpen()));
  $('#drawerClose').addEventListener('click', () => setDrawer(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen() && !$('#itemDlg').open) setDrawer(false);
  });

  /* ---------- plate ---------- */
  function readPlate() {
    try {
      const v = JSON.parse(load(PLATE_KEY) || '[]');
      return Array.isArray(v) ? v.filter((l) => l && l.item_id && Number.isInteger(l.qty) && l.qty > 0) : [];
    } catch (e) { return []; }
  }
  function writePlate() {
    save(PLATE_KEY, JSON.stringify(plate));
    const n = sum(plate);
    const badge = $('#plateCount');
    badge.textContent = String(n);
    badge.hidden = n === 0;
    drawPlate();
  }
  function bump() {
    const b = $('#plateBtn');
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }
  function addToPlate(id, qty) {
    const line = plate.find((l) => l.item_id === id);
    if (line) line.qty = clampQty(line.qty + qty);
    else if (plate.length < 30) plate.push({ item_id: id, qty: clampQty(qty) });
    else return false;
    writePlate();
    bump();
    if (!autoOpened) { autoOpened = true; setDrawer(true); }   // first add: the drawer opens by itself
    return true;
  }

  function totals() {
    const subtotal = plate.reduce((a, l) => {
      const it = findItem(l.item_id);
      return a + (it && it.is_available ? it.price * l.qty : 0);
    }, 0);
    const tax = Math.round((subtotal * (Number(settings.tax_rate) || 0)) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }

  function drawPlate() {
    const empty = plate.length === 0;
    $('#plEmpty').hidden = !empty;
    $('#plTotals').hidden = empty;
    $('#plFields').hidden = empty;
    $('#plFoot').hidden = empty;
    const list = $('#plLines');
    list.textContent = '';

    plate.forEach((l) => {
      const it = findItem(l.item_id);
      if (!it) return;
      const li = make('li', 'cart-line');
      const img = new Image();
      img.alt = '';
      img.src = it.image_url || '';
      img.addEventListener('error', () => img.remove());

      const info = make('div', 'cart-info');
      info.append(make('h3', '', it.name), make('p', 'muted', `${money(it.price)} each${it.is_available ? '' : ' · sold out'}`));

      /* --- qty stepper: − qty + (tap − on qty 1 removes the item) --- */
      const qtyWrap = make('div', 'dn-line-qty');
      const btnMinus = make('button', 'qty-btn', '−');
      btnMinus.type = 'button';
      btnMinus.setAttribute('aria-label', `Reduce ${it.name}`);
      const qtySpan = make('span', 'qty-val', String(l.qty));
      const btnPlus = make('button', 'qty-btn', '+');
      btnPlus.type = 'button';
      btnPlus.setAttribute('aria-label', `Increase ${it.name}`);

      btnMinus.addEventListener('click', () => {
        const line = plate.find((x) => x.item_id === l.item_id);
        if (!line) return;
        if (line.qty <= 1) { plate = plate.filter((x) => x.item_id !== l.item_id); }
        else { line.qty = clampQty(line.qty - 1); }
        writePlate();
      });
      btnPlus.addEventListener('click', () => {
        const line = plate.find((x) => x.item_id === l.item_id);
        if (!line) return;
        line.qty = clampQty(line.qty + 1);
        writePlate();
      });
      qtyWrap.append(btnMinus, qtySpan, btnPlus);

      const remove = make('button', 'ghost', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', () => { plate = plate.filter((x) => x.item_id !== l.item_id); writePlate(); });

      li.append(img, info, qtyWrap, make('span', 'line-total', money(it.price * l.qty)), remove);
      list.append(li);
    });

    const t = totals();
    const box = $('#plTotals');
    box.textContent = '';
    box.append(make('p', '', `Subtotal: ${money(t.subtotal)}`), make('p', '', `Tax: ${money(t.tax)}`), make('p', 'grand', `Total: ${money(t.total)}`));
    $('#footCount').textContent = `${sum(plate)} ${sum(plate) === 1 ? 'item' : 'items'}`;
    $('#footTotal').textContent = money(t.total);
  }

  /* ---------- categories: one row of circles (All first) ---------- */
  function drawCats() {
    const box = $('#dnCats');
    box.textContent = '';
    [{ id: 'all', name: 'All' }, ...cats].forEach((c) => {
      const b = make('button', 'dn-cat');
      b.type = 'button';
      b.setAttribute('aria-current', String(c.id === filter));
      const circle = make('span', 'dn-circle');
      if (c.id === 'all') {
        circle.classList.add('small');
        circle.textContent = 'All';
      } else if (c.image_url) {
        const img = new Image();
        img.alt = '';
        img.src = c.image_url;
        img.addEventListener('error', () => { img.remove(); circle.textContent = c.name.charAt(0).toUpperCase(); });
        circle.append(img);
      } else {
        circle.textContent = c.name.charAt(0).toUpperCase();
      }
      b.append(circle, make('span', '', c.name));
      b.addEventListener('click', () => { filter = c.id; drawCats(); drawGrid(); });
      box.append(b);
    });
    updateArrows();
  }

  /* < and > slide the row by one window (7 circles at a time on a wide screen) */
  function updateArrows() {
    const box = $('#dnCats');
    const max = box.scrollWidth - box.clientWidth;
    const more = max > 4;
    $('#catPrev').hidden = !more;
    $('#catNext').hidden = !more;
    $('#catPrev').disabled = box.scrollLeft <= 2;
    $('#catNext').disabled = box.scrollLeft >= max - 2;
  }
  $('#catPrev').addEventListener('click', () => $('#dnCats').scrollBy({ left: -$('#dnCats').clientWidth, behavior: 'smooth' }));
  $('#catNext').addEventListener('click', () => $('#dnCats').scrollBy({ left: $('#dnCats').clientWidth, behavior: 'smooth' }));
  $('#dnCats').addEventListener('scroll', updateArrows, { passive: true });
  addEventListener('resize', updateArrows);

  /* ---------- dishes: available first, sold-out dishes always at the end ---------- */
  function drawGrid() {
    const grid = $('#dnGrid');
    grid.textContent = '';
    const q = query.trim().toLowerCase();
    const items = menu
      .filter((m) => {
        if (filter !== 'all' && m.category_id !== filter) return false;
        return !q || m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0));
    $('#dnEmpty').hidden = items.length > 0;
    $('#dnEmpty').textContent = q ? 'No dish matches your search.' : 'No dishes here yet.';

    items.forEach((it) => {
      const card = make('article', 'dn-card' + (it.is_available ? '' : ' out'));

      const open = make('button', 'dn-open');
      open.type = 'button';
      open.disabled = !it.is_available;
      const thumb = make('div', 'dn-thumb');
      if (it.image_url) {
        const img = new Image();
        img.alt = '';
        img.src = it.image_url;
        img.addEventListener('error', () => { img.remove(); thumb.textContent = it.name.charAt(0).toUpperCase(); });
        thumb.append(img);
      } else {
        thumb.textContent = it.name.charAt(0).toUpperCase();
      }
      const row = make('div', 'dn-row');
      row.append(make('span', 'dn-price', money(it.price)));
      open.append(thumb, make('h3', '', it.name), row);
      open.addEventListener('click', () => openDish(it));
      card.append(open);

      if (it.is_available) {
        const add = make('button', 'dn-addcart', 'Add to plate');
        add.type = 'button';
        add.setAttribute('aria-label', `Add ${it.name} to plate`);
        add.addEventListener('click', () => {
          if (!addToPlate(it.id, 1)) return;
          add.textContent = '✓ Added';
          add.classList.add('added');
          setTimeout(() => { add.textContent = 'Add to plate'; add.classList.remove('added'); }, 900);
        });
        card.append(add);
      } else {
        card.append(make('span', 'dn-soldline', 'Sold out'));
        card.append(make('span', 'dn-sold', 'Sold out'));
      }
      grid.append(card);
    });
  }

  /* ---------- dish card: photo, description, price (all from the admin menu data) ---------- */
  function openDish(it) {
    picked = it;
    pickedQty = 1;
    const img = $('#idImg');
    img.hidden = !it.image_url;
    img.src = it.image_url || '';
    $('#idName').textContent = it.name;
    $('#idTags').textContent = '';
    $('#idDesc').textContent = it.description;
    $('#idPrice').textContent = money(it.price);
    $('#idQty').textContent = '1';
    $('#idMsg').textContent = '';
    $('#itemDlg').showModal();
  }
  $('#idMinus').addEventListener('click', () => { pickedQty = clampQty(pickedQty - 1); $('#idQty').textContent = String(pickedQty); });
  $('#idPlus').addEventListener('click', () => { pickedQty = clampQty(pickedQty + 1); $('#idQty').textContent = String(pickedQty); });
  $('#idAdd').addEventListener('click', () => {
    if (!picked) return;
    const okAdd = addToPlate(picked.id, pickedQty);
    $('#idMsg').textContent = okAdd ? `Added ${pickedQty} × ${picked.name} to your plate.` : 'Your plate is full (30 dishes).';
    if (okAdd) setTimeout(() => $('#itemDlg').close(), 700);
  });
  $('#itemClose').addEventListener('click', () => $('#itemDlg').close());

  /* ---------- success banner shown after a successful order ---------- */
  function showOrderSuccess(receipt) {
    const banner = make('div', 'dn-success');
    const icon = make('span', 'dn-success-icon', '✓');
    const text = make('div', 'dn-success-text');
    text.append(
      make('strong', '', 'Order placed!'),
      make('p', '', receipt ? `Receipt: ${receipt}` : 'Your order is on its way to the kitchen.')
    );
    const sub = make('p', 'dn-success-sub', 'Scroll down to track your order status.');
    text.append(sub);
    banner.append(icon, text);

    const plEmpty = $('#plEmpty');
    plEmpty.parentNode.insertBefore(banner, plEmpty.nextSibling);
    setTimeout(() => banner.remove(), 6000);  // auto-remove after 6 s
  }

  /* ---------- place the dine-in order via KG.placeDineinOrder() ----------
     This routes through content.js which uses Supabase (live) or localStorage (mock),
     so the order shows up in the admin panel and the kitchen panel. */
  $('#plForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $('#plErr');
    err.textContent = '';
    if (!plate.length) return;

    const tableNo = validTable(f.elements.namedItem('table').value);
    if (!tableNo) { err.textContent = 'Please select your table so we know where to serve.'; return; }

    const btn = $('#plPlace');
    btn.disabled = true;
    btn.textContent = 'Placing order…';

    const res = await KG.placeDineinOrder({
      table_number: tableNo,
      lines: plate.map((l) => ({ item_id: l.item_id, qty: l.qty })),
      name: f.elements.namedItem('name').value.trim() || `Table ${tableNo}`,
      phone: '',
      note: f.elements.namedItem('note').value,
      honeypot: f.elements.namedItem('company').value,
    });

    btn.disabled = false;
    btn.textContent = 'Place order';

    if (res.error) { err.textContent = res.error.message; return; }

    table = tableNo;
    save(TABLE_KEY, String(tableNo));
    freshReceipt = res.data.receipt || '';

    /* save this order id so loadOrders can track it via KG.getOrder() */
    const orderId = res.data.id || '';
    if (orderId) {
      const prev = JSON.parse(load(ORDERS_KEY) || '[]');
      prev.unshift({ id: orderId, receipt: freshReceipt, created_at: new Date().toISOString() });
      save(ORDERS_KEY, JSON.stringify(prev.slice(0, 10)));
    }

    plate = [];
    f.elements.namedItem('note').value = '';
    showTable();
    writePlate();
    await loadOrders();

    /* ---- success banner: replaces the empty-plate message briefly ---- */
    showOrderSuccess(freshReceipt);
    $('#drawerScroll').scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- orders of this table with live status (checks every 5 seconds) ---------- */
  const timeOf = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  async function loadOrders() {
    const sec = $('#ordersSec');
    if (!table) { sec.hidden = true; return; }
    let rows = [];
    try {
      /* Read the order ids placed in this session */
      const stored = JSON.parse(load(ORDERS_KEY) || '[]');
      if (!stored.length) { sec.hidden = true; return; }

      /* Fetch fresh status for each order via KG.getOrder() (works for both mock & Supabase) */
      const results = await Promise.all(stored.map((s) => KG.getOrder(s.id)));
      const now = Date.now();
      rows = results
        .filter((r) => r.data)
        .map((r) => r.data)
        .filter((o) => {
          /* only show orders that belong to this table */
          if (Number(o.table_number) !== table) return false;
          const age = now - new Date(o.created_at).getTime();
          if (o.status === 'cancelled') return age < 60 * 60000;
          return FLOW.includes(o.status) && age < 8 * 3600000;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
    } catch (e) { rows = []; }

    sec.hidden = rows.length === 0;
    $('#ordersTitle').textContent = `Orders for Table ${table}`;
    const list = $('#ordersList');
    list.textContent = '';

    rows.forEach((o) => {
      const card = make('article', 'dn-order' + (o.receipt === freshReceipt ? ' fresh' : ''));
      const top = make('div', 'dn-order-top');
      top.append(make('b', '', `Order ${o.receipt}`), make('span', '', timeOf(o.created_at)));
      card.append(top);

      if (o.status === 'cancelled') {
        card.append(make('p', 'dn-order-bad', 'This order was cancelled. Please ask the waiter.'));
      } else {
        const steps = make('ol', 'steps');
        const at = Math.max(0, FLOW.indexOf(o.status));
        FLOW.forEach((s, i) => steps.append(make('li', 'step' + (i < at ? ' done' : i === at ? ' current' : ''), LABEL[s])));
        card.append(steps);
      }

      const items = make('ul');
      (o.items || []).forEach((i) => items.append(make('li', '', `${i.qty} × ${i.name}`)));
      card.append(items);
      if (o.note) card.append(make('p', 'dn-order-note', `Note: ${o.note}`));
      list.append(card);
    });
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(loadOrders, POLL_MS);
    addEventListener('storage', loadOrders);                         // another tab changed an order
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadOrders(); });
  }

  /* ---------- logo: back to the first page of this dining menu ---------- */
  $('#homeLink').addEventListener('click', (e) => {
    e.preventDefault();
    filter = 'all';
    query = '';
    $('#dnSearch').value = '';
    if ($('#itemDlg').open) $('#itemDlg').close();
    drawCats();
    drawGrid();
    $('#dnCats').scrollTo({ left: 0 });
    scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- search ---------- */
  $('#dnSearch').addEventListener('input', (e) => { query = e.target.value; drawGrid(); });

  /* ---------- boot ---------- */
  async function init() {
    // the table QR opens ...dine.html?table=5, so the table is fixed; without it the guest selects a table
    const fromLink = validTable(new URLSearchParams(location.search).get('table'));
    tableLocked = !!fromLink;
    table = fromLink || validTable(load(TABLE_KEY));
    if (table) save(TABLE_KEY, String(table));
    fillTableSelect();
    showTable();

    plate = readPlate();
    writePlate();

    const [c, m, s] = await Promise.all([KG.getCategories(), KG.getMenu(), KG.getSettings()]);
    cats = (c.data || []).filter((x) => x && x.name);
    menu = m.data || [];
    if (s.data) settings = { ...settings, ...s.data };
    if (s.data && s.data.restaurant_name) document.title = `${s.data.restaurant_name} · Dine-in Menu`;

    drawCats();
    drawGrid();
    drawPlate();
    await loadOrders();
    startPolling();
  }

  init();
})();
