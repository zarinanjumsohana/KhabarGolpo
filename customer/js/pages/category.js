/* Category page.
   - Left: a window of 5 categories (3 on phones). Arrows slide the window when there are more.
   - Middle: the chosen category's dishes. Changing dish turns the plate round, like the reference.
   - Bottom: dish thumbnails, with arrows when there are more than fit. */
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
    ? { rows: 3, size: 72, gap: 12 }
    : { rows: 5, size: 84, gap: 16 });
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
      if (c.image_url) {
        const img = new Image();
        img.alt = '';
        img.src = c.image_url;
        a.append(img);
      } else {
        a.append(make('span', '', c.name.charAt(0).toUpperCase()));
      }
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
    const shift = railStart * (g.size + g.gap);
    $('#railTrack').style.transform = WIDE.matches
      ? `translateX(${-shift}px)`
      : `translateY(${-shift}px)`;

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

      const btn = $('#addBtn');
      btn.disabled = !d.is_available;
      btn.textContent = d.is_available ? 'Add to plate' : 'Sold out';
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
    const added = KGCart.add(d.id, 1);
    $('#addMsg').textContent = added
      ? `${d.name} is on your plate.`
      : 'Your plate is full (30 different dishes).';
  });

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
    current = cats.find((x) => x.id === params.get('id')) || cats[0];
    if (!current) return showEmpty('No categories yet.', true);

    dishes = menu
      .filter((d) => d.category_id === current.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    $('#catName').textContent = current.name;
    const desc = $('#catDesc');
    desc.textContent = current.description || '';
    desc.hidden = !current.description;
    document.title = `KhabarGolpo · ${current.name}`;

    drawRail();
    if (!dishes.length) return showEmpty('No dishes in this category yet.', true);

    drawThumbs();
    show(0, false);
  }

  init();
})();