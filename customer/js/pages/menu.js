/* KhabarGolpo menu: one row per category, alternating left and right, natural vertical scrolling. */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section = document.getElementById('menu');
  const unitsEl = document.getElementById('mnUnits');

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const DEFAULT_CATS = [
    {
      id: "00e0edce-0910-4c33-bc1a-c19c712b65fd",
      name: "A First Impression",
      intro: "Starters & Appetizers.\nThe perfect beginning to a memorable dining experience.",
      image: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793216974801-kheruq.jpeg"
    },
    {
      id: "cd624018-9523-430d-868e-175f60088f8a",
      name: "Treasures of the Sea",
      intro: "Seafood & Ocean Specialties\n\nA premium collection for seafood lovers, inspired by coastal cuisines around the world.",
      image: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793215183188-mqjjux.jpeg"
    },
    {
      id: "5e1a1a64-6018-45c3-8375-533ae5038d29",
      name: "Roots & Heritage",
      intro: "Bengali & South Asian Classics\nCelebrating familiar flavours, traditional recipes, and culinary heritage.",
      image: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793215274075-gpdgnk.jpeg"
    },
    {
      id: "bb954bc0-b165-4ccc-9313-a8fcfbea395c",
      name: "A Sweet Ending",
      intro: "Desserts & Confections.\nAn indulgent final chapter, from European patisserie to Bengali sweets.",
      image: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793215603177-zh26lh.jpeg"
    },
    {
      id: "e5675b63-c747-493a-acde-8df0891c9a98",
      name: "The Drinks Atelier",
      intro: "Beverages & Signature Mixes.\nCrafted refreshments, elegant mocktails, coffees, and teas.",
      image: "https://ewsvwxgoyfbsnhsrxnoo.supabase.co/storage/v1/object/public/menu-images/1793216831318-k3yyod.jpeg"
    }
  ];

  async function loadCategories() {
    if (!window.KG) return DEFAULT_CATS;
    try {
      const { data, error } = await window.KG.getCategories();
      if (error || !data || !data.length) return DEFAULT_CATS;
      return data;
    } catch (e) {
      return DEFAULT_CATS;
    }
  }

  function normalise(raw) {
    const list = raw
      .map((c) => ({
        id: c.id,
        name: c.name || '',
        intro: c.description || c.intro || '',
        image: c.image_url || c.image || '',
      }))
      .filter((c) => c.name);
    return list.length ? list : DEFAULT_CATS;
  }

  function renderRows(cats) {
    if (!unitsEl) return;
    unitsEl.textContent = '';

    cats.forEach((c, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';

      const unit = make('div', 'mn-unit');
      unit.dataset.side = side;
      unit.setAttribute('data-reveal', '');

      // Plate
      const plate = make('div', 'mn-plate');
      const disc = make('div', 'mn-disc');
      disc.append(make('span', 'mn-disc-letter', (c.name || 'K').trim().charAt(0).toUpperCase()));
      plate.append(disc);
      if (c.image) {
        const img = new Image();
        img.alt = c.name;
        img.src = c.image;
        img.loading = 'lazy';
        img.addEventListener('error', () => plate.classList.add('no-img'));
        plate.prepend(img);
      } else {
        plate.classList.add('no-img');
      }

      // Text
      const text = make('div', 'mn-text');
      text.append(make('p', 'mn-chapter-num', `Chapter ${String(i + 1).padStart(2, '0')}`));
      text.append(make('h3', '', c.name));
      if (c.intro) text.append(make('p', 'mn-intro', c.intro));

      const link = make('a', 'mn-cta', 'Explore Dishes →');
      link.href = `category.html?id=${encodeURIComponent(c.id)}`;
      text.append(link);

      unit.append(plate, text);
      unit.addEventListener('click', (e) => {
        if (!e.target.closest('a')) {
          location.href = `category.html?id=${encodeURIComponent(c.id)}`;
        }
      });

      unitsEl.append(unit);
    });

    // Reveal animations on scroll
    const reveals = unitsEl.querySelectorAll('[data-reveal]');
    if (RM || !('IntersectionObserver' in window)) {
      reveals.forEach(el => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      }, { threshold: 0.12 });
      reveals.forEach(el => io.observe(el));
    }
  }

  async function init() {
    if (!section) return;
    section.hidden = false;
    const cats = normalise(await loadCategories());
    renderRows(cats);
  }

  init();
})();
