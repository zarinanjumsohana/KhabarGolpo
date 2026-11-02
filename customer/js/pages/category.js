/* Category page.
   - Left: "Categories" label + a window of 5 category pills (photo + name; 3 on phones).
   - Middle: the chosen category's dishes. Changing dish turns the plate round, like the reference.
   - Bottom: dish thumbnails, with arrows when there are more than fit.
   - Right: a side cart that opens with the first dish and stays until checkout
     (docked panel on wide screens, bottom sheet on smaller ones). */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WIDE = matchMedia('(max-width: 820px)');
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const stage = $('#dishStage');

  let cats = [];
  let menu = [];
  let dishes = [];
  let current = null;
  let idx = 0;
  let railStart = 0;

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* Rail size. Must match .rail-item and .rail-track in shop.css. */
  const geom = () => (WIDE.matches
    ? { rows: 3, size: 52, gap: 10 }
    : { rows: 5, size: 56, gap: 12 });
  const maxStart = () => Math.max(0, cats.length - geom().rows);

  /* ---------- categories ---------- */
  function drawRail() {
    const track = $('#railTrack');
    track.textContent = '';
    cats.forEach((c) => {
      const a = make('a', 'rail-item' + (c.id === current.id ? ' on' : ''));
      a.href = `category.html?id=${encodeURIComponent(c.id)}`;
      a.title = c.name;
      a.setAttribute('aria-label', c.name);

      const photo = make('span', 'rail-photo');
      if (c.image_url) {
        const img = new Image();
        img.alt = '';
        img.src = c.image_url;
        photo.append(img);
      } else {
        photo.textContent = c.name.charAt(0).toUpperCase();
      }

      a.append(photo, make('span', 'rail-name', c.name));
      track.append(a);
    });
    // open the window so the chosen category is in view
    const at = Math.max(0, cats.findIndex((c) => c.id === current.id));
    railStart = Math.min(Math.max(0, at - Math.floor(geom().rows / 2)), maxStart());
    applyRail();
  }

  function moveRail(dir) {
    railStart = Math.min(Math.max(0, railStart + dir), maxStart());
    applyRail();
  }

  function applyRail() {
    railStart = Math.min(railStart, maxStart());
    const g = geom();
    const view = document.querySelector('.rail-view');
    const track = $('#railTrack');
    const items = [...track.children];
    if (!items.length || !view) return;

    if (WIDE.matches) {
      /* phones: the rail scrolls sideways, so follow the chosen pill */
      track.style.transform = 'none';
      const it = items[railStart];
      const x = it.offsetLeft - track.offsetLeft;
      view.scrollTo({ left: Math.max(0, x - 4), behavior: RM ? 'auto' : 'smooth' });
    } else {
      const shift = railStart * (g.size + g.gap);
      track.style.transform = `translateY(${-shift}px)`;
    }

    const more = cats.length > g.rows;
    const up = $('#railUp');
    const down = $('#railDown');
    up.hidden = !more;
    down.hidden = !more;
    up.disabled = railStart === 0;
    down.disabled = railStart >= maxStart();
  }

  /* ---------- dish thumbnails ---------- */
  function drawThumbs() {
    const row = $('#thumbs');
    row.textContent = '';
    dishes.forEach((d, i) => {
      const b = make('button', 'thumb');
      b.type = 'button';
      b.setAttribute('aria-label', d.name);
      const img = new Image();
      img.alt = '';
      img.src = d.image_url;
      b.append(img, make('span', '', d.name));
      b.addEventListener('click', () => show(i, true));
      row.append(b);
    });
    markThumbs();
    updateThumbArrows();
  }

  function markThumbs() {
    const row = $('#thumbs');
    [...row.children].forEach((b, i) => b.setAttribute('aria-current', String(i === idx)));
    const active = row.children[idx];
    if (active && row.scrollWidth > row.clientWidth) {
      const x = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, x), behavior: RM ? 'auto' : 'smooth' });
    }
  }

  function scrollThumbs(dir) {
    $('#thumbs').scrollBy({ left: dir * 180, behavior: RM ? 'auto' : 'smooth' });
  }

  function updateThumbArrows() {
    const row = $('#thumbs');
    const more = row.scrollWidth > row.clientWidth + 2;
    const prev = $('#thumbPrev');
    const next = $('#thumbNext');
    prev.hidden = !more;
    next.hidden = !more;
    prev.disabled = row.scrollLeft <= 2;
    next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
  }

  /* ---------- plate helpers ---------- */
  const cartLines = () => (window.KGCart ? window.KGCart.lines() : []);
  const qtyOf = (id) => {
    const line = cartLines().find((l) => l.item_id === id);
    return line ? line.qty : 0;
  };
  const itemOf = (id) => menu.find((m) => m.id === id);
  const money = (n) => '৳ ' + Math.round(n).toLocaleString('en-US');

  /* the Add to plate button keeps a different colour while the dish is on the plate */
  function paintAddBtn() {
    const d = dishes[idx];
    const btn = $('#addBtn');
    if (!d || !btn) return;

    const qty = qtyOf(d.id);
    btn.disabled = !d.is_available;
    btn.classList.toggle('is-added', d.is_available && qty > 0);
    btn.textContent = !d.is_available
      ? 'Sold out'
      : qty > 0
        ? `Added to plate ×${qty}`
        : 'Add to plate';
  }

  /* ---------- the big dish ---------- */
  function show(i, animate) {
    idx = i;
    const d = dishes[i];

    const apply = () => {
      $('#dishName').textContent = d.name;
      $('#dishDesc').textContent = d.description || '';
      $('#dishPrice').textContent = `৳ ${d.price}`;
      $('#dishTags').textContent = [d.is_veg ? 'Vegetarian' : '', d.is_featured ? 'Signature' : '']
        .filter(Boolean).join(' · ');

      paintAddBtn();
      $('#addMsg').textContent = '';

      const img = $('#dishImg');
      img.src = d.image_url;
      img.alt = d.name;
      stage.classList.remove('leave');
      if (animate && !RM) {               // restart the turning animation
        img.classList.remove('turn');
        void img.offsetWidth;
        img.classList.add('turn');
      }
      markThumbs();
    };

    if (!animate || RM) return apply();
    stage.classList.add('leave');
    setTimeout(apply, 380);
  }

  $('#addBtn').addEventListener('click', () => {
    const d = dishes[idx];
    if (!d) return;
    const wasEmpty = window.KGCart.count() === 0;
    const added = window.KGCart.add(d.id, 1);

    $('#addMsg').textContent = added
      ? `${d.name} is on your plate.`
      : 'Your plate is full (30 different dishes).';

    paintAddBtn();
    if (added && wasEmpty) openCart();      // first dish: slide the cart open
    else if (!sideCart.hidden) renderCart();
  });

  /* ---------- side cart: appears after the first dish is added ---------- */
  const sideCart = $('#sideCart');
  const catMain = $('#catMain');
  const boxCart = $('#boxCart');
  let taxRate = 0;

  const trow = (label, value, grand) => {
    const row = make('div', 'sc-trow' + (grand ? ' sc-grand' : ''));
    row.append(make('span', '', label), make('b', '', value));
    return row;
  };

  /* cart lines that still match a dish on the menu */
  const visibleLines = () => cartLines()
    .map((l) => ({ ...l, it: itemOf(l.item_id) }))
    .filter((l) => l.it);

  function renderCart() {
    const list = $('#scLines');
    const lines = visibleLines();

    list.textContent = '';
    lines.forEach(({ it, qty }) => {
      const li = make('li', 'sc-line');
      li.append(make('span', 'sc-name', it.name), make('span', 'sc-meta', money(it.price)));

      const box = make('div', 'sc-qty');

      const dec = make('button', 'qty-btn', '−');
      dec.type = 'button';
      dec.setAttribute('aria-label', `One less ${it.name}`);
      dec.addEventListener('click', () =>
        qty > 1 ? window.KGCart.setQty(it.id, qty - 1) : window.KGCart.remove(it.id)
      );

      const inc = make('button', 'qty-btn', '+');
      inc.type = 'button';
      inc.setAttribute('aria-label', `One more ${it.name}`);
      inc.addEventListener('click', () => window.KGCart.setQty(it.id, qty + 1));

      const rm = make('button', 'sc-remove', 'Remove');
      rm.type = 'button';
      rm.addEventListener('click', () => window.KGCart.remove(it.id));

      box.append(
        dec,
        make('span', 'qty-val', String(qty)),
        inc,
        rm,
        make('span', 'sc-line-total', money(it.price * qty))
      );
      li.append(box);
      list.append(li);
    });

    $('#scEmpty').hidden = lines.length > 0;

    const subtotal = lines.reduce((a, l) => a + l.it.price * l.qty, 0);
    const tax = Math.round((subtotal * taxRate) / 100);
    const totals = $('#scTotals');
    totals.textContent = '';
    totals.append(
      trow('Subtotal', money(subtotal)),
      trow('Tax', money(tax)),
      trow('Total', money(subtotal + tax), true)
    );

    $('#scCheckout').classList.toggle('is-off', lines.length === 0);
    if (!lines.length) closeCart();
  }

  function openCart() {
    if (!visibleLines().length) {
      closeCart();
      return;
    }
    renderCart();
    sideCart.hidden = false;
    catMain.classList.add('has-cart');
    boxCart.setAttribute('aria-expanded', 'true');
    void sideCart.offsetWidth;               // paint the hidden state first so the slide runs
    sideCart.classList.add('open');
  }

  function closeCart() {
    sideCart.classList.remove('open');
    catMain.classList.remove('has-cart');
    boxCart.setAttribute('aria-expanded', 'false');
    const hide = () => { if (!sideCart.classList.contains('open')) sideCart.hidden = true; };
    if (WIDE.matches) setTimeout(hide, 400);
    else hide();
  }

  /* The plate shown after the first dish stays on screen until the order is
     checked out — it is not dismissed by a button, the backdrop or Escape. */
  boxCart.addEventListener('click', () => {
    if (!sideCart.hidden) return;
    openCart();
  });

  window.addEventListener('kg-cart-changed', () => {
    paintAddBtn();
    if (!sideCart.hidden) renderCart();
  });

  KG.getSettings().then(({ data }) => {
    if (data) taxRate = Number(data.tax_rate) || 0;
    if (!sideCart.hidden) renderCart();
  }).catch(() => {});

  /* ---------- arrows and resizing ---------- */
  $('#railUp').addEventListener('click', () => moveRail(-1));
  $('#railDown').addEventListener('click', () => moveRail(1));
  $('#thumbPrev').addEventListener('click', () => scrollThumbs(-1));
  $('#thumbNext').addEventListener('click', () => scrollThumbs(1));
  $('#thumbs').addEventListener('scroll', updateThumbArrows, { passive: true });
  window.addEventListener('resize', () => {
    applyRail();
    updateThumbArrows();
  });

  /* ---------- start ---------- */
  function showEmpty(message, hideDishes) {
    $('#empty').textContent = message;
    $('#empty').hidden = false;
    if (hideDishes) {
      stage.hidden = true;
      document.querySelector('.thumbs-wrap').hidden = true;
    }
  }

  async function init() {
    const [c, m] = await Promise.all([KG.getCategories(), KG.getMenu()]);
    cats = c.data || [];
    menu = m.data || [];

    /* forget cart lines whose dish is gone from the menu (old ids, deleted dishes) */
    if (window.KGCart && menu.length) window.KGCart.prune(menu.map((d) => d.id));
    current = cats.find((x) => x.id === params.get('id')) || cats[0];
    if (!current) return showEmpty('No categories yet.', true);

    dishes = menu
      .filter((d) => d.category_id === current.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    $('#catName').textContent = current.name;
    const desc = $('#catDesc');
    if (desc) { desc.textContent = ''; desc.hidden = true; }
    document.title = `KhabarGolpo · ${current.name}`;

    drawRail();
    if (!dishes.length) return showEmpty('No dishes in this category yet.', true);

    drawThumbs();
    // A dish can be picked from the home page: category.html?id=…&dish=…
    const wanted = params.get('dish');
    const at = wanted ? dishes.findIndex((d) => d.id === wanted) : 0;
    show(at >= 0 ? at : 0, false);

    /* the plate stays on screen until checkout: reopen it on arrival if dishes are waiting */
    if (visibleLines().length) openCart();
  }

  init();
})();