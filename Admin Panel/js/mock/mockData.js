// js/mock/mockData.js — deterministic seed data + report math.
// Shape mirrors the real Postgres tables so the swap to Supabase is a config flip.

/* ------------------------------ seeded rng ------------------------------ */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261015);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;

/* ------------------------------ thumbnails ------------------------------ */
export function foodThumb(name, hue) {
  const letter = (String(name).trim()[0] || 'K').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},64%,58%)"/><stop offset="1" stop-color="hsl(${(hue + 34) % 360},58%,38%)"/>
</linearGradient></defs>
<rect width="480" height="360" fill="url(#g)"/>
<circle cx="392" cy="52" r="130" fill="rgba(255,255,255,.13)"/>
<circle cx="56" cy="330" r="96" fill="rgba(0,0,0,.14)"/>
<circle cx="240" cy="180" r="96" fill="rgba(255,255,255,.16)"/>
<text x="240" y="216" font-family="Georgia,serif" font-size="104" text-anchor="middle" fill="rgba(255,255,255,.92)">${letter}</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export function galleryThumb(hue, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},58%,52%)"/><stop offset="1" stop-color="hsl(${(hue + 46) % 360},52%,30%)"/>
</linearGradient></defs>
<rect width="800" height="560" fill="url(#g)"/>
<g fill="rgba(255,255,255,.12)">
<circle cx="140" cy="120" r="90"/><circle cx="660" cy="420" r="140"/><circle cx="620" cy="120" r="54"/><circle cx="180" cy="450" r="66"/>
</g>
<g fill="rgba(0,0,0,.10)"><rect x="0" y="360" width="800" height="200"/></g>
<text x="400" y="300" font-family="Georgia,serif" font-size="64" text-anchor="middle" fill="rgba(255,255,255,.9)">${label}</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* ------------------------------ settings ------------------------------ */
export const settings = {
  id: 1,
  name: 'Khabar Golpo',
  tagline: 'Every dish tells a story',
  address: 'House 24, Road 7, Dhanmondi, Dhaka 1209',
  phone: '+880 1711-000000',
  email: 'hello@khabargolpo.com',
  hours_week: '11:00 AM – 11:00 PM',
  hours_weekend: '11:00 AM – 12:00 AM',
  tax_rate: 5,
  timezone: 'Asia/Dhaka',
  pickup_enabled: true,
  delivery_enabled: true,
  delivery_fee: 60,
  min_delivery_order: 500,
  delivery_note: 'We deliver inside Dhanmondi, Gulshan, Banani and Uttara.',
  prep_time_minutes: 25,
  pickup_hours: '11:00 AM – 10:00 PM',
  logo: null,
};

/* ------------------------------ tables ------------------------------ */
export const tables = Array.from({ length: 14 }, (_, i) => ({
  id: `tbl_${i + 1}`,
  table_number: i + 1,
  seats: i < 8 ? 4 : 6,
  is_active: i < 12,
  created_at: new Date(Date.now() - (120 - i) * 864e5).toISOString(),
}));

/* ------------------------------ categories + menu ------------------------------ */
export const categories = [
  { id: 'cat_1', name: 'Starters', sort_order: 1 },
  { id: 'cat_2', name: 'Main Course', sort_order: 2 },
  { id: 'cat_3', name: 'Biryani & Rice', sort_order: 3 },
  { id: 'cat_4', name: 'Breads', sort_order: 4 },
  { id: 'cat_5', name: 'Beverages', sort_order: 5 },
  { id: 'cat_6', name: 'Desserts', sort_order: 6 },
  { id: 'cat_7', name: "Drinks & Mocktails", sort_order: 7 },
  { id: 'cat_8', name: "Coffee", sort_order: 8 },
  { id: 'cat_9', name: "Tea", sort_order: 9 },
  { id: 'cat_10', name: "Ice Cream", sort_order: 10 },
  { id: 'cat_11', name: "Shakes & Smoothies", sort_order: 11 },
  { id: 'cat_12', name: "Soups", sort_order: 12 },
  { id: 'cat_13', name: "Salads", sort_order: 13 },
  { id: 'cat_14', name: "Combo Meals", sort_order: 14 },
  { id: 'cat_15', name: "Chef's Special", sort_order: 15 },
];

const RAW_ITEMS = [
  ['Chicken Chaap', 'Slow-cooked chicken in a rich, silky mustard gravy.', 320, 'cat_1', false, true, true],
  ['Fuchka (6 pcs)', 'Crisp shells, spiced potato, tamarind water.', 120, 'cat_1', true, true, true],
  ['Beef Kabab (4 pcs)', 'Char-grilled minced beef with burnt onion.', 280, 'cat_1', false, false, false],
  ['Shami Kebab (4 pcs)', 'Lentil and beef patties, soft centre.', 240, 'cat_1', false, false, true],
  ['Spring Roll (6 pcs)', 'Vegetable rolls with sweet chilli dip.', 180, 'cat_1', true, false, true],
  ['Chicken Rezala', 'Yoghurt and white pepper chicken curry.', 420, 'cat_2', false, false, true],
  ['Beef Bhuna', 'Slow-reduced beef with roasted spices.', 480, 'cat_2', false, true, true],
  ['Mutton Rezala', 'Festive mutton in a delicate cashew gravy.', 620, 'cat_2', false, false, true],
  ['Dal Tadka', 'Yellow lentils finished with garlic tempering.', 220, 'cat_2', true, false, true],
  ['Kacchi Biryani (Mutton)', 'Dum-cooked aromatic rice with tender mutton.', 650, 'cat_3', false, true, true],
  ['Chicken Biryani', 'Layered basmati with spiced chicken.', 420, 'cat_3', false, false, true],
  ['Beef Tehari', 'Short-grain rice stir-fried with beef.', 380, 'cat_3', false, false, true],
  ['Polao', 'Fragrant ghee rice with fried onion and raisins.', 320, 'cat_3', true, false, true],
  ['Bhuna Khichuri', 'Rice and lentils, slow roasted with ghee.', 300, 'cat_3', true, false, true],
  ['Paratha', 'Flaky whole-wheat flatbread on the tawa.', 60, 'cat_4', true, false, true],
  ['Naan', 'Tandoor-baked butter naan.', 80, 'cat_4', true, false, true],
  ['Lachcha Paratha', 'Layered, crisp and buttery.', 90, 'cat_4', true, false, true],
  ['Steamed Rice', 'A plate of plain basmati rice.', 40, 'cat_4', true, false, true],
  ['Borhani', 'Salted yoghurt drink with mint and black pepper.', 120, 'cat_5', true, true, true],
  ['Fresh Lime Soda', 'Sweet, salted or mixed.', 110, 'cat_5', true, false, true],
  ['Mango Lassi', 'Thick yoghurt blended with mango.', 150, 'cat_5', true, false, true],
  ['Masala Tea', 'Cardamom and ginger tea.', 70, 'cat_5', true, false, true],
  ['Rasmalai (2 pcs)', 'Soft cheese discs in chilled milk.', 140, 'cat_6', true, false, true],
  ['Falooda', 'Vermicelli, basil seeds, ice cream and rose syrup.', 180, 'cat_6', true, true, true],
  ['Firni', 'Set rice pudding in a clay pot.', 130, 'cat_6', true, false, false],
  ['Mint Lemonade', 'Fresh lime, mint and crushed ice.', 130, 'cat_7', true, true, true],
  ['Blue Lagoon Mocktail', 'Blue curacao syrup, lime and soda.', 190, 'cat_7', true, false, true],
  ['Virgin Mojito', 'Mint, lime and sparkling soda.', 180, 'cat_7', true, false, true],
  ['Cappuccino', 'Espresso with silky steamed milk foam.', 190, 'cat_8', true, true, true],
  ['Cafe Latte', 'Smooth espresso with warm milk.', 200, 'cat_8', true, false, true],
  ['Cold Coffee', 'Iced coffee blended with ice cream.', 220, 'cat_8', true, false, true],
  ['Milk Tea', 'Strong leaf tea with milk.', 60, 'cat_9', true, false, true],
  ['Green Tea', 'Light and fresh, served hot.', 80, 'cat_9', true, false, true],
  ['Lemon Honey Tea', 'Hot tea with lemon and honey.', 90, 'cat_9', true, false, true],
  ['Vanilla Scoop', 'Two scoops of classic vanilla.', 90, 'cat_10', true, false, true],
  ['Chocolate Sundae', 'Ice cream, chocolate sauce and nuts.', 190, 'cat_10', true, true, true],
  ['Mango Kulfi', 'Dense, slow-frozen mango milk.', 120, 'cat_10', true, false, true],
  ['Chocolate Shake', 'Thick shake with chocolate ice cream.', 230, 'cat_11', true, true, true],
  ['Mango Smoothie', 'Fresh mango blended with yoghurt.', 200, 'cat_11', true, false, true],
  ['Oreo Shake', 'Cookies and cream shake.', 250, 'cat_11', true, false, true],
  ['Thai Soup', 'Hot and sour soup with chicken and herbs.', 220, 'cat_12', false, false, true],
  ['Corn Soup', 'Creamy sweetcorn soup.', 180, 'cat_12', true, false, true],
  ['Chicken Hot & Sour', 'Peppery soup with vegetables.', 230, 'cat_12', false, false, true],
  ['Caesar Salad', 'Crisp lettuce, croutons and parmesan.', 280, 'cat_13', true, false, true],
  ['Garden Salad', 'Seasonal vegetables with lemon dressing.', 200, 'cat_13', true, false, true],
  ['Chicken Salad', 'Grilled chicken on fresh greens.', 260, 'cat_13', false, false, true],
  ['Burger Combo', 'Beef burger, fries and a drink.', 450, 'cat_14', false, true, true],
  ['Biryani Combo', 'Chicken biryani, borhani and salad.', 520, 'cat_14', false, false, true],
  ['Family Platter', 'Mixed grills and rice for four.', 1200, 'cat_14', false, false, true],
  ['Chef\'s Platter', 'Chef\'s selection of grilled meats.', 780, 'cat_15', false, true, true],
  ['Smoked Beef Ribs', 'Slow-smoked ribs with house sauce.', 890, 'cat_15', false, true, true],
  ['Prawn Malai Curry', 'Prawns in coconut cream gravy.', 720, 'cat_15', false, false, true],
];

export const menu_items = RAW_ITEMS.map(([name, description, price, category_id, is_veg, is_featured, is_available], i) => ({
  id: `itm_${i + 1}`,
  category_id,
  name,
  description,
  price,
  is_veg,
  is_featured,
  is_available,
  sort_order: i + 1,
  image_url: foodThumb(name, (i * 37 + 18) % 360),
  created_at: new Date(Date.now() - (200 - i) * 864e5).toISOString(),
}));

/* ------------------------------ orders ------------------------------ */
const NAMES = ['Rafi Ahmed', 'Nusrat Jahan', 'Tanvir Hossain', 'Sadia Islam', 'Arif Rahman', 'Farhan Kabir', 'Ishrat Karim', 'Zubair Hasan', 'Mahin Chowdhury', 'Afrin Begum', 'Sabbir Rahman', 'Rumana Aktar', 'Imran Siddiqui', 'Keya Das', 'Nafisa Islam', 'Tanim Mahmud'];
const ADDRESS = [
  ['House 12, Road 5, Dhanmondi, Dhaka', 'Beside the blue mosque'],
  ['Flat 4B, Road 11, Banani, Dhaka', '_lift_ broken, 3rd floor'],
  ['House 45, Gulshan Avenue, Dhaka', 'Near Gulshan 2 circle'],
  ['House 7, Sector 4, Uttara, Dhaka', 'Behind the park'],
  ['Road 3, Mirpur DOHS, Dhaka', 'Gate 2, call on arrival'],
  ['House 89, Elephant Road, Dhaka', 'Opposite City College'],
];
const NOTES = ['Less spicy please', 'No onion in the salad', 'Extra ketchup', 'Please cut the naan in half', ''];
const AGENCY = ['Pathao · riderassigned', 'RedX · tracking KG-8891', 'Steadfast · rider 01712345678'];

function makeItems() {
  const n = ri(1, 4);
  const used = new Set();
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 40) {
    const it = pick(menu_items);
    if (used.has(it.id)) continue;
    used.add(it.id);
    const qty = ri(1, 3);
    out.push({ item_id: it.id, name: it.name, price: it.price, qty, line_total: it.price * qty });
  }
  return out;
}

function statusFor(dayBack, type) {
  if (dayBack >= 2) return chance(0.07) ? 'cancelled' : 'completed';
  if (dayBack === 1) return chance(0.05) ? 'cancelled' : 'completed';
  const roll = rnd();
  if (type === 'dine_in') {
    if (roll < 0.22) return 'new';
    if (roll < 0.45) return 'preparing';
    if (roll < 0.68) return 'ready';
    if (roll < 0.96) return 'completed';
    return 'cancelled';
  }
  if (roll < 0.2) return 'new';
  if (roll < 0.42) return 'preparing';
  if (roll < 0.62) return 'ready';
  if (type === 'delivery' && roll < 0.78) return 'out_for_delivery';
  if (roll < 0.95) return 'completed';
  return 'cancelled';
}

function paymentFor(status, dayBack) {
  if (status === 'cancelled') return 'unpaid';
  if (status === 'completed') return chance(dayBack > 3 ? 0.96 : 0.85) ? 'paid' : 'unpaid';
  if (status === 'ready') return chance(0.3) ? 'paid' : 'unpaid';
  return 'unpaid';
}

function buildOrders() {
  const out = [];
  const taxRate = settings.tax_rate;
  const now = new Date();
  let seq = 1001;

  for (let d = 45; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const dow = day.getDay();
    const base = dow === 5 || dow === 6 ? ri(7, 13) : ri(4, 9);
    const count = d === 0 ? Math.max(4, Math.round(base * 0.7)) : base;

    let windowStart;
    if (d === 0) {
      const morning = new Date(day);
      morning.setHours(11, 0, 0, 0);
      windowStart = Math.max(morning.getTime(), now.getTime() - 9 * 36e5);
      if (windowStart >= now.getTime() - 15 * 6e4) windowStart = now.getTime() - 5 * 36e5;
    }

    for (let i = 0; i < count; i++) {
      const created = new Date(day);
      if (d === 0) {
        created.setTime(windowStart + rnd() * Math.max(60000, now.getTime() - windowStart - 60000));
      } else {
        created.setHours(ri(11, 21), ri(0, 59), ri(0, 59), 0);
      }

      const r = rnd();
      const order_type = r < 0.46 ? 'dine_in' : r < 0.74 ? 'pickup' : 'delivery';
      const tbl = pick(tables.filter((t) => t.is_active));
      const items = makeItems();
      const subtotal = items.reduce((a, it) => a + it.line_total, 0);
      const tax = Math.round((subtotal * taxRate) / 100);
      const delivery_fee = order_type === 'delivery' ? settings.delivery_fee : 0;
      const total = subtotal + tax + delivery_fee;
      const status = statusFor(d, order_type);
      const payment_status = paymentFor(status, d);
      const cust = pick(NAMES);
      const phone = `01${ri(3, 9)}${ri(10000000, 99999999)}`;
      const [addr, note2] = pick(ADDRESS);

      out.push({
        id: `ord_${seq}`,
        receipt: `KG-${seq}`,
        order_type,
        table_id: order_type === 'dine_in' ? tbl.id : null,
        table_number: order_type === 'dine_in' ? tbl.table_number : null,
        customer_name: order_type === 'dine_in' ? null : cust,
        phone: order_type === 'dine_in' ? null : phone,
        address: order_type === 'delivery' ? addr : null,
        address_note: order_type === 'delivery' ? note2.replace('_ ', '') : null,
        pickup_time: order_type === 'pickup' && chance(0.35) ? `${ri(12, 21)}:${pick(['00', '15', '30', '45'])}` : null,
        note: pick(NOTES),
        status,
        payment_status,
        subtotal,
        tax,
        delivery_fee,
        total,
        delivery_agency_note: order_type === 'delivery' && (status === 'out_for_delivery' || status === 'completed') ? pick(AGENCY) : null,
        items,
        created_at: created.toISOString(),
        paid_at: payment_status === 'paid' ? new Date(created.getTime() + ri(18, 75) * 60000).toISOString() : null,
      });
      seq++;
    }
  }
  return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export const orders = buildOrders();

/* ------------------------------ reservations ------------------------------ */
function buildReservations() {
  const statuses = ['pending', 'pending', 'confirmed', 'confirmed', 'cancelled'];
  const out = [];
  for (let i = 0; i < 16; i++) {
    const day = new Date();
    day.setDate(day.getDate() + ri(-3, 9));
    out.push({
      id: `res_${i + 1}`,
      name: pick(NAMES),
      phone: `01${ri(3, 9)}${ri(10000000, 99999999)}`,
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      time: `${ri(12, 21)}:${pick(['00', '30'])}`,
      guests: ri(2, 10),
      note: chance(0.3) ? pick(['Window seat if possible', 'Birthday dinner', 'Wheelchair access needed', '']) : '',
      status: statuses[Math.min(i, statuses.length - 1)] || 'pending',
      created_at: new Date(Date.now() - ri(0, 10) * 864e5).toISOString(),
    });
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}
export const reservations = buildReservations();

/* ------------------------------ feedback ------------------------------ */
function buildFeedback() {
  const reviews = [
    ['The kacchi was outstanding, exactly like the old Dhaka flavour.', 5],
    ['Great food, but delivery took 50 minutes.', 3],
    ['Falooda and borhani are a must. Lovely place.', 5],
    ['Reservation was honoured, staff were polite.', 4],
    ['Dal khichuri felt a bit dry this time.', 3],
    ['Best rezala in Dhanmondi, hands down.', 5],
  ];
  const queries = [
    ['Do you do catering for 40 people?', 0],
    ['Is there parking behind the building?', 0],
    ['Can I change my reservation to 9 PM?', 0],
  ];
  const suggestions = [
    ['Please add a jollof-free spicy chicken burger :)', 0],
    ['A small outdoor seating area would be nice.', 0],
    ['Could you introduce a lunch combo box?', 0],
  ];
  const out = [];
  let i = 0;
  const add = (arr, type) =>
    arr.forEach(([message, rating]) => {
      out.push({
        id: `fb_${++i}`,
        type,
        name: pick(NAMES),
        rating: type === 'review' ? rating : null,
        message,
        is_approved: type === 'review' ? chance(0.55) : false,
        is_read: chance(0.5),
        created_at: new Date(Date.now() - ri(0, 16) * 864e5).toISOString(),
      });
    });
  add(reviews, 'review');
  add(queries, 'query');
  add(suggestions, 'suggestion');
  return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
export const feedback = buildFeedback();

/* ------------------------------ gallery ------------------------------ */
const GLABEL = ['Dining Hall', 'Kacchi Platter', 'Chef at Work', 'Evening Light', 'Table Setting', 'Dessert Corner', 'Our Entrance', 'Fresh Naan'];
export const gallery_images = GLABEL.map((caption, i) => ({
  id: `gal_${i + 1}`,
  image_url: galleryThumb((i * 47 + 12) % 360, caption.split(' ')[0]),
  caption,
  sort_order: i + 1,
  created_at: new Date(Date.now() - (30 - i) * 864e5).toISOString(),
}));

/* ------------------------------ report math ------------------------------ */
const paidOrders = (list) => list.filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled');

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function periodRange(kind) {
  const now = new Date();
  const today = startOfDay(now);
  if (kind === 'today') return [today, endOfDay(now)];
  if (kind === 'week') {
    const dow = (today.getDay() + 6) % 7; // Monday start
    const from = new Date(today);
    from.setDate(from.getDate() - dow);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return [from, endOfDay(to)];
  }
  if (kind === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [from, endOfDay(to)];
  }
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), 11, 31);
  return [from, endOfDay(to)];
}

function sumFor(kind) {
  const [from, to] = periodRange(kind);
  const rows = paidOrders(orders).filter((o) => {
    const t = new Date(o.paid_at || o.created_at);
    return t >= from && t <= to;
  });
  return {
    revenue: rows.reduce((a, o) => a + o.total, 0),
    orders: rows.length,
    count: rows.length,
  };
}

export function revenueSummary() {
  const [tf, tt] = periodRange('today');
  const todaysAll = orders.filter((o) => {
    const t = new Date(o.created_at);
    return t >= tf && t <= tt;
  });

  const counts = { dine_in: 0, pickup: 0, delivery: 0 };
  todaysAll.filter((o) => o.status !== 'cancelled').forEach((o) => counts[o.order_type]++);

  const window7 = paidOrders(orders).filter((o) => new Date(o.paid_at || o.created_at) >= new Date(Date.now() - 7 * 864e5));
  const tally = {};
  window7.forEach((o) => o.items.forEach((it) => (tally[it.name] = (tally[it.name] || 0) + it.qty)));
  const topItems = Object.entries(tally)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const [f, t] = [startOfDay(d), endOfDay(d)];
    const v = paidOrders(orders)
      .filter((o) => {
        const p = new Date(o.paid_at || o.created_at);
        return p >= f && p <= t;
      })
      .reduce((a, o) => a + o.total, 0);
    series.push({ label: `${d.getDate()}`, value: v });
  }

  const recent = orders.filter((o) => o.status !== 'cancelled').slice(0, 12);

  return {
    today: sumFor('today'),
    week: sumFor('week'),
    month: sumFor('month'),
    year: sumFor('year'),
    pending: orders.filter((o) => ['new', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
    counts,
    topItems,
    series,
    recent,
  };
}

const pad = (n) => String(n).padStart(2, '0');
const dayLabel = (d) => `${pad(d.getDate())} ${d.toLocaleString('en-GB', { month: 'short' })}`;

function rangeFor(group) {
  const now = new Date();
  if (group === 'daily') return [new Date(Date.now() - 6 * 864e5), endOfDay(now), 'day'];
  if (group === 'weekly') return [new Date(Date.now() - 55 * 864e5), endOfDay(now), 'week'];
  if (group === 'monthly') return [new Date(now.getFullYear(), now.getMonth() - 11, 1), endOfDay(now), 'month'];
  return [new Date(now.getFullYear() - 4, 0, 1), endOfDay(now), 'year'];
}

function bucketKey(d, mode) {
  if (mode === 'day') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (mode === 'week') {
    const t = new Date(d);
    const dow = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() - dow);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }
  if (mode === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return `${d.getFullYear()}`;
}

function labelFor(key, mode) {
  if (mode === 'day' || mode === 'week') {
    const [y, m, d] = key.split('-').map(Number);
    return dayLabel(new Date(y, m - 1, d));
  }
  if (mode === 'month') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' });
  }
  return key;
}

export function salesReport({ group = 'daily', from = null, to = null } = {}) {
  const [rf, rt, mode] = rangeFor(group);
  const start = from ? new Date(from) : rf;
  const end = to ? new Date(to) : rt;

  const inRange = orders.filter((o) => {
    const c = new Date(o.created_at);
    return c >= start && c <= end && o.status !== 'cancelled';
  });
  const paid = inRange.filter((o) => o.payment_status === 'paid');

  const buckets = new Map();
  inRange.forEach((o) => {
    const key = bucketKey(new Date(o.created_at), mode);
    if (!buckets.has(key)) buckets.set(key, { key, orders: 0, revenue: 0, delivery_fees: 0, tax: 0 });
    const b = buckets.get(key);
    b.orders++;
    if (o.payment_status === 'paid') {
      b.revenue += o.total;
      b.delivery_fees += o.delivery_fee;
      b.tax += o.tax;
    }
  });

  const rows = [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ ...b, label: labelFor(b.key, mode) }));

  const tally = {};
  paid.forEach((o) =>
    o.items.forEach((it) => {
      if (!tally[it.name]) tally[it.name] = { name: it.name, qty: 0, revenue: 0 };
      tally[it.name].qty += it.qty;
      tally[it.name].revenue += it.line_total;
    })
  );
  const topItems = Object.values(tally).sort((a, b) => b.qty - a.qty).slice(0, 8);

  const byType = { dine_in: 0, pickup: 0, delivery: 0 };
  paid.forEach((o) => (byType[o.order_type] += o.total));
  const delivery_fee_total = paid.reduce((a, o) => a + o.delivery_fee, 0);

  return {
    group,
    rows,
    chart: rows.map((r) => ({ label: r.label, value: r.revenue })),
    topItems,
    byType,
    delivery_fee_total,
    totals: {
      orders: inRange.length,
      paid_orders: paid.length,
      revenue: paid.reduce((a, o) => a + o.total, 0),
      delivery_fees: delivery_fee_total,
      tax: paid.reduce((a, o) => a + o.tax, 0),
      avg_ticket: paid.length ? Math.round(paid.reduce((a, o) => a + o.total, 0) / paid.length) : 0,
    },
  };
}

export function tableBill(tableId) {
  const rows = orders.filter((o) => o.table_id === tableId && o.status !== 'cancelled' && o.payment_status === 'unpaid');
  const tbl = tables.find((t) => t.id === tableId);
  return {
    table_id: tableId,
    table_number: tbl ? tbl.table_number : null,
    orders: rows,
    subtotal: rows.reduce((a, o) => a + o.subtotal, 0),
    tax: rows.reduce((a, o) => a + o.tax, 0),
    total: rows.reduce((a, o) => a + o.total, 0),
  };
}

export function nextReceipt() {
  const max = orders.reduce((a, o) => Math.max(a, Number(String(o.receipt).replace('KG-', '')) || 0), 1000);
  return `KG-${max + 1}`;
}
