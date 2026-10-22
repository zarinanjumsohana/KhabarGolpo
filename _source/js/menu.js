/* KhabarGolpo menu: categories only. Sticky stage, plates spin and slide with scroll,
   sparkles fly from one plate to the next. Dishes open later. */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 820px)');

  const track = document.getElementById('mnTrack');
  const stage = document.getElementById('mnStage');
  const platesEl = document.getElementById('mnPlates');
  const slidesEl = document.getElementById('mnSlides');
  const dotsEl = document.getElementById('mnDots');
  const fx = document.getElementById('mnFx');
  const fctx = fx.getContext('2d');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // One soft glow, drawn once and reused for every sparkle
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  {
    const g = sprite.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,250,235,1)');
    gr.addColorStop(.35, 'rgba(255,238,200,.55)');
    gr.addColorStop(1, 'rgba(255,238,200,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
  }

  let cats = [], N = 0;
  let plateNodes = [], slideNodes = [], dotNodes = [];
  let W = 0, H = 0, DPR = 1, anchors = [], stars = [], parts = [];
  let P = 0, Pd = 0, prevPd = 0, shown = -1, last = performance.now(), inView = true;

  async function loadCategories() {
    const { data, error } = await window.KG.getCategories();
    return error ? [] : data;
  }

  function normalise(raw) {
    return raw
      .map(c => ({ name: c.name || '', intro: c.intro || '', image: c.image_url || '' }))
      .filter(c => c.name);
  }

  /* ---------- build the plates, text and dots (textContent only) ---------- */
  function buildDOM() {
    cats.forEach((c, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';

      const plate = make('div', 'mn-plate');
      plate.dataset.side = side;
      plate.append(make('div', 'mn-disc'));
      if (c.image) {
        const img = new Image();
        img.alt = '';
        img.src = c.image;
        img.addEventListener('error', () => plate.classList.add('no-img'));
        plate.prepend(img);
      } else {
        plate.classList.add('no-img');
      }
      platesEl.append(plate);

      const slide = make('div', 'mn-slide');
      slide.dataset.side = side === 'left' ? 'right' : 'left';
      slide.append(make('h3', '', c.name));
      if (c.intro) slide.append(make('p', 'mn-intro', c.intro));
      slidesEl.append(slide);

      const dot = make('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', c.name);
      dot.addEventListener('click', () => goTo(i));
      dotsEl.append(dot);
    });
    plateNodes = [...platesEl.children];
    slideNodes = [...slidesEl.children];
    dotNodes = [...dotsEl.children];
  }

  /* ---------- sizing ---------- */
  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    fx.width = Math.round(W * DPR);
    fx.height = Math.round(H * DPR);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    track.style.height = (N * 100) + 'vh';

    const m = MOBILE.matches;
    anchors = cats.map((_, i) => (m
      ? { x: W * .5, y: H * .34 }
      : { x: W * (i % 2 === 0 ? .27 : .73), y: H * .5 }));

    stars = Array.from({ length: 46 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: .6 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.6
    }));
  }

  /* ---------- scroll progress: P runs from 0 (first category) to N-1 (last) ---------- */
  function measure() {
    const total = track.offsetHeight - stage.offsetHeight;
    const scrolled = total > 0 ? clamp(-track.getBoundingClientRect().top / total) : 0;
    P = scrolled * Math.max(0, N - 1);
  }

  function goTo(i) {
    const total = track.offsetHeight - stage.offsetHeight;
    const top = track.getBoundingClientRect().top + scrollY + (N > 1 ? i / (N - 1) : 0) * total;
    window.scrollTo({ top, behavior: RM ? 'auto' : 'smooth' });
  }

  /* ---------- sparkles ---------- */
  function spawn(a, b) {
    const ang = Math.random() * 6.283;
    const rad = (.1 + Math.random() * .9) * Math.min(W, H) * .22;
    const x0 = a.x + Math.cos(ang) * rad, y0 = a.y + Math.sin(ang) * rad;
    const x1 = b.x + (Math.random() - .5) * 40, y1 = b.y + (Math.random() - .5) * 40;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const bend = (Math.random() * 2 - 1) * .35 * len;
    parts.push({
      x0, y0, x1, y1,
      cx: (x0 + x1) / 2 - dy / len * bend,
      cy: (y0 + y1) / 2 + dx / len * bend,
      age: 0, life: .8 + Math.random() * .9, s: 1 + Math.random() * 2.6
    });
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  }

  /* ---------- frame loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    const m = MOBILE.matches;

    Pd += (P - Pd) * (RM ? 1 : .14);
    const v = Math.abs(Pd - prevPd);
    prevPd = Pd;

    // Plates: slide out vertically, spin in place, fade at the edges
    const offVh = m ? 26 : 38;
    plateNodes.forEach((pl, i) => {
      const d = i - Pd, a = Math.min(1, Math.abs(d));
      pl.style.opacity = (1 - a).toFixed(3);
      const spin = RM ? 0 : -d * 120;
      pl.style.transform = `translate3d(-50%, calc(-50% + ${(d * offVh).toFixed(2)}vh), 0) rotate(${spin.toFixed(1)}deg) scale(${(1 - .16 * a).toFixed(3)})`;
    });

    // Text: same rhythm, a little slower
    slideNodes.forEach((sl, i) => {
      const d = i - Pd, a = Math.min(1, Math.abs(d));
      sl.style.opacity = Math.max(0, 1 - a * 1.5).toFixed(3);
      const y = (d * 22).toFixed(1);
      sl.style.transform = m
        ? `translate3d(0, ${y}px, 0)`
        : `translate3d(0, calc(-50% + ${y}px), 0)`;
    });

    const idx = clamp(Math.round(Pd), 0, N - 1);
    if (idx !== shown) {
      shown = idx;
      dotNodes.forEach((b, j) => b.setAttribute('aria-current', String(j === idx)));
    }

    if (!RM && inView) {
      // Sparkles travel from the leaving plate to the arriving one, in the direction you scroll
      if (v > .0002) {
        const fwd = P >= Pd;
        const from = fwd ? Math.floor(Pd) : Math.ceil(Pd);
        const to = fwd ? from + 1 : from - 1;
        if (from >= 0 && from < N && to >= 0 && to < N) {
          const n = Math.min(12, Math.ceil(v * 700));
          for (let k = 0; k < n; k++) spawn(anchors[from], anchors[to]);
        }
      }

      fctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        fctx.globalAlpha = .18 + .32 * (.5 + .5 * Math.sin(now * .0012 * s.sp + s.ph));
        const q = s.r * 6;
        fctx.drawImage(sprite, s.x - q / 2, s.y - q / 2, q, q);
      }
      parts = parts.filter(p => (p.age += dt) < p.life);
      for (const p of parts) {
        const u = p.age / p.life, k = 1 - u;
        const x = k * k * p.x0 + 2 * k * u * p.cx + u * u * p.x1;
        const y = k * k * p.y0 + 2 * k * u * p.cy + u * u * p.y1;
        const q = p.s * 5 * (1 - u * .4);
        fctx.globalAlpha = Math.sin(Math.PI * u);
        fctx.drawImage(sprite, x - q / 2, y - q / 2, q, q);
      }
      fctx.globalAlpha = 1;
    }
  }

  /* ---------- boot ---------- */
  async function init() {
    cats = normalise(await loadCategories());
    N = cats.length;
    if (!N) { track.style.display = 'none'; return; }

    buildDOM();
    layout();
    measure();
    Pd = P;

    addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', () => { layout(); measure(); });
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(track);
    requestAnimationFrame(frame);
  }

  init();
})();