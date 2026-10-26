/* KhabarGolpo menu: one row per category (plate and text side by side). Rows move up and down
   one at a time as you scroll. No sparkles. Categories come from the shared store through window.KG. */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 820px)');

  const section = document.getElementById('menu');
  const track = document.getElementById('mnTrack');
  const stage = document.getElementById('mnStage');
  const unitsEl = document.getElementById('mnUnits');
  const dotsEl = document.getElementById('mnDots');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let cats = [], N = 0;
  let STEP = 60;          // how many vh of scrolling each category takes
  let units = [], dots = [];
  let P = 0, Pd = 0, shown = -1;

  /* Categories come from the shared store. */
  async function loadCategories() {
    if (!window.KG) return [];
    const { data, error } = await window.KG.getCategories();
    return error ? [] : (data || []);
  }

  /* Accepts the database names (description, image_url) and the older mock names (intro, image) */
   function normalise(raw) {
    return raw
      .map((c) => ({
        id: c.id,
        name: c.name || '',
        intro: c.description || c.intro || '',
        image: c.image_url || c.image || '',
      }))
      .filter((c) => c.name);
  }

  /* ---------- build one row per category (textContent only) ---------- */
  function buildDOM() {
    cats.forEach((c, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';

      const unit = make('div', 'mn-unit');
      unit.dataset.side = side;

      const plate = make('div', 'mn-plate');
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

      const text = make('div', 'mn-text');
      text.append(make('h3', '', c.name));
      if (c.intro) text.append(make('p', 'mn-intro', c.intro));

      unit.append(plate, text);
      unit.addEventListener('click', () => {
        location.href = `category.html?id=${encodeURIComponent(c.id)}`;
      });
      unitsEl.append(unit);

      const dot = make('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', c.name);
      dot.addEventListener('click', () => goTo(i));
      dotsEl.append(dot);
    });
    units = [...unitsEl.children];
    dots = [...dotsEl.children];
  }

  /* Track height: one screen, plus one step for each extra category, so each step moves one row. */
  function layout() {
    STEP = MOBILE.matches ? 72 : 60;
    track.style.height = `calc(100vh + ${Math.max(0, N - 1) * STEP}vh)`;
    measure();
  }

  /* scroll progress: P runs from 0 (first category) to N-1 (last) */
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

  /* ---------- frame loop ---------- */
  function frame() {
    requestAnimationFrame(frame);
    Pd += (P - Pd) * (RM ? 1 : 0.14);

    units.forEach((u, i) => {
      const d = i - Pd;
      const a = Math.abs(d);
      u.style.opacity = Math.max(0, 1 - a * 1.1).toFixed(3);
      u.style.transform = `translate3d(-50%, calc(-50% + ${(d * STEP).toFixed(2)}vh), 0)`;
      u.firstElementChild.style.transform =
        `rotate(${(RM ? 0 : -d * 90).toFixed(1)}deg) scale(${(1 - 0.1 * Math.min(1, a)).toFixed(3)})`;
    });

    const idx = clamp(Math.round(Pd), 0, N - 1);
    if (idx !== shown) {
      shown = idx;
      dots.forEach((b, j) => b.setAttribute('aria-current', String(j === idx)));
    }
  }

  /* ---------- boot ---------- */
  async function init() {
    cats = normalise(await loadCategories());
    N = cats.length;
    if (!N) { section.hidden = true; return; }   // no categories yet: hide the section

    buildDOM();
    layout();
    Pd = P;

    addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', layout);
    requestAnimationFrame(frame);
  }

  init();
})();