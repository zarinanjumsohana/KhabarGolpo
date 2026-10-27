/* KhabarGolpo full menu — every dish added in the admin panel, shown on the home page.
   Category chips filter the grid. Tapping a dish opens its category page with that dish selected.
   Data comes from window.KG (js/mock/content.js), so mock mode and Supabase both work. */
(() => {
  const grid = document.getElementById('allGrid');
  const chipsEl = document.getElementById('allChips');
  const emptyEl = document.getElementById('allEmpty');
  const section = document.getElementById('all-menu');
  if (!grid || !chipsEl || !section) return;

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const money = (n) => `৳ ${Number(n || 0).toLocaleString('en-US')}`;

  let cats = [];
  let items = [];
  let catName = new Map();
  let catOrder = new Map();
  let filter = '';

  /* ---------- one dish card ---------- */
  function buildCard(it) {
    const soldOut = it.is_available === false;
    const card = make('article', 'dish-card' + (soldOut ? ' sold' : ''));
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `${it.name}, ${money(it.price)}${soldOut ? ', sold out' : ''}`);

    const media = make('div', 'dish-card-media');
    if (it.image_url) {
      const img = new Image();
      img.loading = 'lazy';
      img.alt = '';
      img.src = it.image_url;
      img.addEventListener('error', () => {
        img.remove();
        media.classList.add('no-img');
        media.append(make('span', 'dish-card-ph', (it.name || 'K').trim().charAt(0).toUpperCase()));
      });
      media.append(img);
    } else {
      media.classList.add('no-img');
      media.append(make('span', 'dish-card-ph', (it.name || 'K').trim().charAt(0).toUpperCase()));
    }

    const badges = make('div', 'dish-card-badges');
    if (it.is_featured) badges.append(make('span', 'dish-badge badge-feat', 'Signature'));
    if (it.is_veg) badges.append(make('span', 'dish-badge badge-veg', 'Veg'));
    if (soldOut) badges.append(make('span', 'dish-badge badge-sold', 'Sold out'));
    if (badges.children.length) media.append(badges);

    const body = make('div', 'dish-card-body');
    body.append(make('p', 'dish-card-cat', catName.get(it.category_id) || 'Menu'));
    body.append(make('h3', 'dish-card-name', it.name));
    if (it.description) body.append(make('p', 'dish-card-desc', it.description));

    const foot = make('div', 'dish-card-foot');
    foot.append(make('span', 'dish-card-price', money(it.price)));

    const add = make('button', 'dish-add', soldOut ? 'Sold out' : 'Add');
    add.type = 'button';
    add.disabled = soldOut;
    add.setAttribute('aria-label', soldOut ? `${it.name} is sold out` : `Add ${it.name} to your plate`);
    add.addEventListener('click', (e) => {
      e.stopPropagation();
      if (soldOut) return;
      const added = window.KGCart ? window.KGCart.add(it.id, 1) : false;
      add.textContent = added ? 'Added ✓' : 'Plate full';
      add.classList.toggle('is-added', added);
      clearTimeout(add._reset);
      add._reset = setTimeout(() => {
        add.textContent = 'Add';
        add.classList.remove('is-added');
      }, 1500);
    });
    foot.append(add);
    body.append(foot);

    card.append(media, body);

    const open = () => {
      location.href = `category.html?id=${encodeURIComponent(it.category_id)}&dish=${encodeURIComponent(it.id)}`;
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    return card;
  }

  /* ---------- filter chips ---------- */
  function drawChips() {
    chipsEl.textContent = '';
    const counts = new Map();
    items.forEach((i) => counts.set(i.category_id, (counts.get(i.category_id) || 0) + 1));

    const options = [{ id: '', name: 'All dishes', count: items.length }]
      .concat(
        cats
          .filter((c) => counts.get(c.id))
          .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) }))
      );

    options.forEach((o) => {
      const b = make('button', 'all-chip');
      b.type = 'button';
      b.dataset.cat = o.id;
      b.setAttribute('aria-pressed', String(filter === o.id));
      b.append(make('span', '', o.name), make('span', 'all-chip-count', String(o.count)));
      b.addEventListener('click', () => {
        filter = filter === o.id ? '' : o.id;
        [...chipsEl.children].forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === filter)));
        render();
        if (!filter) section.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
      });
      chipsEl.append(b);
    });
  }

  /* ---------- the grid ---------- */
  function render() {
    const list = filter ? items.filter((i) => i.category_id === filter) : items;
    grid.textContent = '';

    if (!list.length) {
      emptyEl.textContent = items.length
        ? 'No dishes in this category yet.'
        : 'The menu is being prepared. Dishes added in the admin panel will appear here.';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    const frag = document.createDocumentFragment();
    list.forEach((it) => frag.append(buildCard(it)));
    grid.append(frag);

    if (!RM) {
      [...grid.children].forEach((card, i) => {
        card.style.animationDelay = `${Math.min(i * 28, 420)}ms`;
      });
    }
  }

  /* ---------- boot ---------- */
  async function init() {
    if (!window.KG) return;
    const [c, m] = await Promise.all([window.KG.getCategories(), window.KG.getMenu()]);
    if (c.error || m.error) {
      emptyEl.textContent = 'The menu could not be loaded right now. Please refresh the page.';
      emptyEl.hidden = false;
      return;
    }

    cats = (c.data || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    catName = new Map(cats.map((x) => [x.id, x.name]));
    catOrder = new Map(cats.map((x, i) => [x.id, i]));

    items = (m.data || [])
      .slice()
      .sort(
        (a, b) =>
          (catOrder.get(a.category_id) ?? 999) - (catOrder.get(b.category_id) ?? 999) ||
          (a.sort_order || 0) - (b.sort_order || 0)
      );

    drawChips();
    render();
  }

  init();
})();
