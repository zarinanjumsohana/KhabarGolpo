/* KhabarGolpo cart: kept in this browser and shared by every customer page.
   Also remembers the pages visited in this tab, so the back button can step back through them. */
(() => {
  const KEY = 'kg-cart';
  const TRAIL = 'kg-trail';
  const MAX_LINES = 30;
  const clamp = (n) => Math.max(1, Math.min(20, n));

  /* ---------- cart ---------- */
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  };
  const write = (lines) => {
    localStorage.setItem(KEY, JSON.stringify(lines));
    window.dispatchEvent(new Event('kg-cart-changed'));
  };

  window.KGCart = {
    lines: read,
    count: () => read().reduce((a, l) => a + l.qty, 0),
    add(item_id, qty = 1) {
      const lines = read();
      const line = lines.find((x) => x.item_id === item_id);
      if (line) {
        line.qty = clamp(line.qty + qty);
      } else {
        if (lines.length >= MAX_LINES) return false;
        lines.push({ item_id, qty: clamp(qty) });
      }
      write(lines);
      return true;
    },
    setQty(item_id, qty) {
      write(read().map((l) => (l.item_id === item_id ? { ...l, qty: clamp(qty) } : l)));
    },
    remove(item_id) {
      write(read().filter((l) => l.item_id !== item_id));
    },
    clear() {
      write([]);
    },
  };

  /* Number badge on every cart button */
  const badges = () => {
    const n = KGCart.count();
    document.querySelectorAll('.cart-count').forEach((b) => {
      b.textContent = String(n);
      b.hidden = n === 0;
    });
  };
  window.addEventListener('kg-cart-changed', badges);
  window.addEventListener('storage', (e) => { if (e.key === KEY) badges(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', badges);
  else badges();

  /* Home page: the cart button takes the place of the login button while the menu is on screen */
  const menu = document.getElementById('menu');
  const topbar = document.getElementById('topbar');
  if (menu && topbar) {
    new IntersectionObserver(
      ([e]) => topbar.classList.toggle('in-menu', e.isIntersecting && e.intersectionRatio > 0.25),
      { threshold: [0, 0.25] }
    ).observe(menu);
  }

  /* ---------- back button: steps back through the pages of this visit (kept per tab) ---------- */
  const here = () => location.pathname.split('/').pop() + location.search + location.hash;

  const readTrail = () => {
    try {
      const v = JSON.parse(sessionStorage.getItem(TRAIL) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  };
  const writeTrail = (t) => sessionStorage.setItem(TRAIL, JSON.stringify(t.slice(-30)));

  /* Every page adds itself to the trail when it loads (a reload does not add it twice) */
  function recordPage() {
    const t = readTrail();
    const page = here();
    if (t[t.length - 1] !== page) {
      t.push(page);
      writeTrail(t);
    }
  }

  /* Goes to the page before this one. If there is none, goes to the menu. */
  function goBack(e) {
    e.preventDefault();
    const t = readTrail();
    if (t[t.length - 1] === here()) t.pop();   // drop this page
    const target = t.pop();                    // the page before it
    writeTrail(t);
    location.href = target || 'index.html#menu';
  }

  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', goBack));
  recordPage();
})();