/* KhabarGolpo kitchen — Menu & Sold Out board.
   Reads the same menu_items rows the admin panel writes, so every dish added
   in Admin → Menu shows up here. The kitchen can flip a dish to sold out
   (is_available = false) and the customer site stops offering it.

   Writes go through the set_item_availability(uuid, boolean) RPC, which
   checks that the caller is staff (admin or chef) before updating. */

import { requireStaff } from './session.js';

(() => {
  const board = document.getElementById('menuBoard');
  if (!board) return;

  const searchEl = document.getElementById('kdsMenuSearch');
  const filterBtns = Array.prototype.slice.call(document.querySelectorAll('[data-menu-filter]'));
  const refreshBtn = document.querySelector('[data-menu-refresh]');
  const availableEl = document.querySelector('[data-menu-available]');
  const soldEl = document.querySelector('[data-menu-soldout]');
  const navCountEl = document.querySelector('[data-menu-nav-count]');
  const liveEl = document.querySelector('[data-menu-live]');

  const money = (n) => '৳ ' + Number(n || 0).toLocaleString('en-US');

  let sb = null;
  let items = [];
  let cats = [];
  let filter = 'all';
  let query = '';
  let lastFocus = Date.now();
  let loading = false;

  /* ---------------------------------------------------------------- helpers */

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const announce = (message) => {
    if (liveEl) liveEl.textContent = message;
  };

  const isAvailable = (item) => item.is_available !== false;

  const stateBox = (message, withRetry) => {
    board.textContent = '';
    const box = make('div', 'menu-state');
    box.append(make('p', '', message));
    if (withRetry) {
      const btn = make('button', 'menu-refresh', 'Try again');
      btn.type = 'button';
      btn.addEventListener('click', () => load({ silent: false }));
      box.append(btn);
    }
    board.append(box);
  };

  /* ------------------------------------------------------------------ cards */

  function buildCard(item) {
    const available = isAvailable(item);

    const card = make('article', 'menu-card' + (available ? '' : ' is-soldout'));
    card.dataset.itemId = item.id;

    const top = make('div', 'menu-card-top');
    const id = make('div', 'menu-card-id');
    id.append(make('h3', 'menu-name', item.name));

    const catName = (cats.find((c) => c.id === item.category_id) || {}).name || 'Menu';
    id.append(make('p', 'menu-meta', catName + ' · ' + money(item.price)));

    const btn = make('button', 'switch');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('data-availability-toggle', '');
    btn.setAttribute('aria-checked', available ? 'false' : 'true');
    btn.setAttribute('aria-label', available ? 'Mark ' + item.name + ' as sold out' : 'Mark ' + item.name + ' as available');

    const track = make('span', 'switch-track');
    track.setAttribute('aria-hidden', 'true');
    track.append(make('span', 'switch-thumb'));
    btn.append(track);
    btn.append(make('span', 'switch-label', available ? 'Available' : 'Sold out'));

    btn.addEventListener('click', () => toggle(item, btn));

    top.append(id, btn);
    card.append(top);
    return card;
  }

  function paint(item) {
    const card = board.querySelector('[data-item-id="' + item.id + '"]');
    if (!card) return;
    const available = isAvailable(item);
    card.classList.toggle('is-soldout', !available);

    const btn = card.querySelector('[data-availability-toggle]');
    if (btn) {
      btn.setAttribute('aria-checked', available ? 'false' : 'true');
      btn.setAttribute('aria-label', available ? 'Mark ' + item.name + ' as sold out' : 'Mark ' + item.name + ' as available');
      const label = btn.querySelector('.switch-label');
      if (label) label.textContent = available ? 'Available' : 'Sold out';
    }
  }

  /* ----------------------------------------------------------------- render */

  function visible() {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const available = isAvailable(item);
      if (filter === 'available' && !available) return false;
      if (filter === 'soldout' && available) return false;
      if (q && String(item.name || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function counts() {
    const total = items.length;
    const sold = items.filter((item) => !isAvailable(item)).length;
    if (availableEl) availableEl.textContent = String(total - sold);
    if (soldEl) soldEl.textContent = String(sold);
    if (navCountEl) navCountEl.textContent = String(total - sold);
  }

  function render() {
    counts();

    const list = visible();
    board.textContent = '';

    if (!items.length) {
      stateBox('No dishes yet. Add them in the admin panel (Admin → Menu) and they will appear here.');
      return;
    }

    if (!list.length) {
      stateBox(query ? 'No dish matches "' + query + '".' : 'No dishes in this filter.');
      return;
    }

    const order = new Map();
    cats.forEach((c, i) => order.set(c.id, i));

    const groups = new Map();
    list.forEach((item) => {
      const key = item.category_id || 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    const keys = Array.from(groups.keys()).sort((a, b) => {
      const ai = order.has(a) ? order.get(a) : 999;
      const bi = order.has(b) ? order.get(b) : 999;
      return ai - bi;
    });

    const frag = document.createDocumentFragment();

    keys.forEach((key) => {
      const groupItems = groups.get(key);
      const cat = cats.find((c) => c.id === key);
      const section = make('section', 'menu-group');
      if (cat) section.setAttribute('aria-label', cat.name);

      const head = make('div', 'menu-group-head');
      head.append(make('h2', 'menu-group-title', cat ? cat.name : 'Other'));
      head.append(make('p', 'menu-group-meta', groupItems.length + (groupItems.length === 1 ? ' item' : ' items')));
      section.append(head);

      const grid = make('div', 'menu-grid');
      groupItems
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .forEach((item) => grid.append(buildCard(item)));

      section.append(grid);
      frag.append(section);
    });

    board.append(frag);
  }

  /* ------------------------------------------------------------------- save */

  async function toggle(item, btn) {
    const next = !isAvailable(item);
    const before = isAvailable(item);

    btn.disabled = true;
    item.is_available = next;
    paint(item);
    counts();

    let error = null;
    try {
      const res = await sb.rpc('set_item_availability', { p_item_id: item.id, p_available: next });
      error = res.error || null;

      /* No RPC yet (setup SQL not run): fall back to a plain update, which the
         admin account is allowed to do through its own policy. */
      if (error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''))) {
        const fb = await sb.from('menu_items').update({ is_available: next }).eq('id', item.id).select('id');
        error = fb.error || null;
        /* RLS silently drops writes it does not allow: zero rows means "no". */
        if (!error && (!fb.data || !fb.data.length)) {
          error = { code: 'RLS_DENIED', message: 'This account is not allowed to change the menu.' };
        }
      }
    } catch (e) {
      error = { message: String(e && e.message ? e.message : e) };
    }

    if (error) {
      item.is_available = before;
      paint(item);
      counts();
      const denied = error.code === '42501' || /permission denied|only staff|not allowed/i.test(error.message || '');
      announce(
        denied
          ? 'Only staff can change availability. Ask the owner to run the kitchen setup SQL.'
          : 'Could not save. ' + (error.message || 'Unknown error')
      );
    } else {
      announce(item.name + (next ? ' marked as available again.' : ' marked as sold out.'));
    }

    btn.disabled = false;
  }

  /* ------------------------------------------------------------------- load */

  async function load(opts) {
    if (loading) return;
    const silent = opts && opts.silent;
    loading = true;
    if (!silent) stateBox('Loading the menu...');
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      const [c, m] = await Promise.all([
        sb.from('categories').select('id,name,sort_order').order('sort_order', { ascending: true }),
        sb.from('menu_items').select('id,name,description,price,image_url,category_id,is_available,sort_order'),
      ]);

      if (c.error) throw c.error;
      if (m.error) throw m.error;

      cats = (c.data || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      items = m.data || [];
      render();
    } catch (e) {
      stateBox('The menu could not be loaded. ' + (e && e.message ? e.message : ''), true);
    } finally {
      loading = false;
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------- boot */

  async function boot() {
    const staff = await requireStaff(); // anonymous visitors go to login.html
    if (!staff) return;

    sb = staff.sb;
    if (!sb) return stateBox('The database is not configured.', true);

    if (searchEl) {
      searchEl.addEventListener('input', () => {
        query = searchEl.value;
        render();
      });
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.getAttribute('data-menu-filter') || 'all';
        filterBtns.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        render();
      });
    });

    if (refreshBtn) refreshBtn.addEventListener('click', () => load({ silent: false }));

    /* keep the board fresh if the admin adds or edits a dish while this tab is open */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFocus < 30000) return;
      lastFocus = Date.now();
      load({ silent: true });
    });

    load({ silent: false });
  }

  boot();
})();
