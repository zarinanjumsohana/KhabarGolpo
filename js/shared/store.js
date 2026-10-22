// js/shared/store.js — one shared data store for the admin panel and the customer site.
//
// NOW (mock mode): saved in the browser's localStorage. Open both sites from the same address
//   (for example http://127.0.0.1:5500) so they share the same storage.
// LATER (database): replace getStore / reloadStore / saveStore with Supabase calls.

const KEY = 'kg-store-v1';

/* Sample dishes: [name, description, price, category number, veg, featured, available] */
const RAW_DISHES = [
  ['Chicken Chaap', 'Slow-cooked chicken in a rich, silky mustard gravy.', 320, 1, 0, 1, 1],
  ['Fuchka (6 pcs)', 'Crisp shells, spiced potato, tamarind water.', 120, 1, 1, 1, 1],
  ['Beef Kabab (4 pcs)', 'Char-grilled minced beef with burnt onion.', 280, 1, 0, 0, 0],
  ['Shami Kebab (4 pcs)', 'Lentil and beef patties, soft centre.', 240, 1, 0, 0, 1],
  ['Spring Roll (6 pcs)', 'Vegetable rolls with sweet chilli dip.', 180, 1, 1, 0, 1],
  ['Chicken Rezala', 'Yoghurt and white pepper chicken curry.', 420, 2, 0, 0, 1],
  ['Beef Bhuna', 'Slow-reduced beef with roasted spices.', 480, 2, 0, 1, 1],
  ['Mutton Rezala', 'Festive mutton in a delicate cashew gravy.', 620, 2, 0, 0, 1],
  ['Dal Tadka', 'Yellow lentils finished with garlic tempering.', 220, 2, 1, 0, 1],
  ['Kacchi Biryani (Mutton)', 'Dum-cooked aromatic rice with tender mutton.', 650, 3, 0, 1, 1],
  ['Chicken Biryani', 'Layered basmati with spiced chicken.', 420, 3, 0, 0, 1],
  ['Beef Tehari', 'Short-grain rice stir-fried with beef.', 380, 3, 0, 0, 1],
  ['Polao', 'Fragrant ghee rice with fried onion and raisins.', 320, 3, 1, 0, 1],
  ['Bhuna Khichuri', 'Rice and lentils, slow roasted with ghee.', 300, 3, 1, 0, 1],
  ['Paratha', 'Flaky whole-wheat flatbread on the tawa.', 60, 4, 1, 0, 1],
  ['Naan', 'Tandoor-baked butter naan.', 80, 4, 1, 0, 1],
  ['Lachcha Paratha', 'Layered, crisp and buttery.', 90, 4, 1, 0, 1],
  ['Steamed Rice', 'A plate of plain basmati rice.', 40, 4, 1, 0, 1],
  ['Borhani', 'Salted yoghurt drink with mint and black pepper.', 120, 5, 1, 1, 1],
  ['Fresh Lime Soda', 'Sweet, salted or mixed.', 110, 5, 1, 0, 1],
  ['Mango Lassi', 'Thick yoghurt blended with mango.', 150, 5, 1, 0, 1],
  ['Masala Tea', 'Cardamom and ginger tea.', 70, 5, 1, 0, 1],
  ['Rasmalai (2 pcs)', 'Soft cheese discs in chilled milk.', 140, 6, 1, 0, 1],
  ['Falooda', 'Vermicelli, basil seeds, ice cream and rose syrup.', 180, 6, 1, 1, 1],
  ['Firni', 'Set rice pudding in a clay pot.', 130, 6, 1, 0, 0],
  ['Mint Lemonade', 'Fresh lime, mint and crushed ice.', 130, 7, 1, 1, 1],
  ['Blue Lagoon Mocktail', 'Blue curacao syrup, lime and soda.', 190, 7, 1, 0, 1],
  ['Virgin Mojito', 'Mint, lime and sparkling soda.', 180, 7, 1, 0, 1],
  ['Cappuccino', 'Espresso with silky steamed milk foam.', 190, 8, 1, 1, 1],
  ['Cafe Latte', 'Smooth espresso with warm milk.', 200, 8, 1, 0, 1],
  ['Cold Coffee', 'Iced coffee blended with ice cream.', 220, 8, 1, 0, 1],
  ['Milk Tea', 'Strong leaf tea with milk.', 60, 9, 1, 0, 1],
  ['Green Tea', 'Light and fresh, served hot.', 80, 9, 1, 0, 1],
  ['Lemon Honey Tea', 'Hot tea with lemon and honey.', 90, 9, 1, 0, 1],
  ['Vanilla Scoop', 'Two scoops of classic vanilla.', 90, 10, 1, 0, 1],
  ['Chocolate Sundae', 'Ice cream, chocolate sauce and nuts.', 190, 10, 1, 1, 1],
  ['Mango Kulfi', 'Dense, slow-frozen mango milk.', 120, 10, 1, 0, 1],
  ['Chocolate Shake', 'Thick shake with chocolate ice cream.', 230, 11, 1, 1, 1],
  ['Mango Smoothie', 'Fresh mango blended with yoghurt.', 200, 11, 1, 0, 1],
  ['Oreo Shake', 'Cookies and cream shake.', 250, 11, 1, 0, 1],
  ['Thai Soup', 'Hot and sour soup with chicken and herbs.', 220, 12, 0, 0, 1],
  ['Corn Soup', 'Creamy sweetcorn soup.', 180, 12, 1, 0, 1],
  ['Chicken Hot & Sour', 'Peppery soup with vegetables.', 230, 12, 0, 0, 1],
  ['Caesar Salad', 'Crisp lettuce, croutons and parmesan.', 280, 13, 1, 0, 1],
  ['Garden Salad', 'Seasonal vegetables with lemon dressing.', 200, 13, 1, 0, 1],
  ['Chicken Salad', 'Grilled chicken on fresh greens.', 260, 13, 0, 0, 1],
  ['Burger Combo', 'Beef burger, fries and a drink.', 450, 14, 0, 1, 1],
  ['Biryani Combo', 'Chicken biryani, borhani and salad.', 520, 14, 0, 0, 1],
  ['Family Platter', 'Mixed grills and rice for four.', 1200, 14, 0, 0, 1],
  ["Chef's Platter", "Chef's selection of grilled meats.", 780, 15, 0, 1, 1],
  ['Smoked Beef Ribs', 'Slow-smoked ribs with house sauce.', 890, 15, 0, 1, 1],
  ['Prawn Malai Curry', 'Prawns in coconut cream gravy.', 720, 15, 0, 0, 1],
];

/* Simple letter picture for dishes that have no photo yet */
function thumb(name, hue) {
  const letter = (String(name).trim()[0] || 'K').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},64%,58%)"/><stop offset="1" stop-color="hsl(${(hue + 34) % 360},58%,38%)"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><circle cx="240" cy="180" r="96" fill="rgba(255,255,255,.16)"/><text x="240" y="216" font-family="Georgia,serif" font-size="104" text-anchor="middle" fill="rgba(255,255,255,.92)">${letter}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const SEED = {
  categories: [
    { id: 'cat_1',  name: 'Starters',           sort_order: 1,  description: '', image_url: '' },
    { id: 'cat_2',  name: 'Main Course',        sort_order: 2,  description: '', image_url: '' },
    { id: 'cat_3',  name: 'Biryani & Rice',     sort_order: 3,  description: '', image_url: '' },
    { id: 'cat_4',  name: 'Breads',             sort_order: 4,  description: '', image_url: '' },
    { id: 'cat_5',  name: 'Beverages',          sort_order: 5,  description: '', image_url: '' },
    { id: 'cat_6',  name: 'Desserts',           sort_order: 6,  description: '', image_url: '' },
    { id: 'cat_7',  name: 'Drinks & Mocktails', sort_order: 7,  description: '', image_url: '' },
    { id: 'cat_8',  name: 'Coffee',             sort_order: 8,  description: '', image_url: '' },
    { id: 'cat_9',  name: 'Tea',                sort_order: 9,  description: '', image_url: '' },
    { id: 'cat_10', name: 'Ice Cream',          sort_order: 10, description: '', image_url: '' },
    { id: 'cat_11', name: 'Shakes & Smoothies', sort_order: 11, description: '', image_url: '' },
    { id: 'cat_12', name: 'Soups',              sort_order: 12, description: '', image_url: '' },
    { id: 'cat_13', name: 'Salads',             sort_order: 13, description: '', image_url: '' },
    { id: 'cat_14', name: 'Combo Meals',        sort_order: 14, description: '', image_url: '' },
    { id: 'cat_15', name: "Chef's Special",     sort_order: 15, description: '', image_url: '' },
  ],
  menu_items: RAW_DISHES.map(([name, description, price, cat, veg, feat, avail], i) => ({
    id: `itm_${i + 1}`,
    category_id: `cat_${cat}`,
    name,
    description,
    price,
    is_veg: !!veg,
    is_featured: !!feat,
    is_available: !!avail,
    sort_order: i + 1,
    image_url: thumb(name, (i * 37 + 18) % 360),
    created_at: new Date().toISOString(),
  })),
  gallery_images: [],
  orders: [],
  order_seq: 1000,
  reservations: [],
  feedback: [],
  // Contact details and hours are blank, so no made-up numbers show on the customer site.
  settings: {
    id: 1,
    name: 'Khabar Golpo',
    tagline: '',
    address: '',
    phone: '',
    email: '',
    hours_week: '',
    hours_weekend: '',
    pickup_hours: '',
    tax_rate: 5,
    timezone: 'Asia/Dhaka',
    pickup_enabled: true,
    delivery_enabled: true,
    delivery_fee: 0,
    min_delivery_order: 0,
    delivery_note: '',
    prep_time_minutes: 25,
    story: [],
    logo: null,
  },
};

const clone = (v) => JSON.parse(JSON.stringify(v));
let state = null;

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) {
    return null;
  }
}

/** Returns the shared data. Loads it from storage the first time. */
export function getStore() {
  if (!state) state = { ...clone(SEED), ...(readSaved() || {}) };
  return state;
}

/** Re-reads the saved data, so changes made in another tab or page are picked up. */
export function reloadStore() {
  state = null;
  return getStore();
}

/** Writes the shared data to storage. Pass only the lists that changed. */
export function saveStore(patch = {}) {
  state = { ...getStore(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('KhabarGolpo store: could not save. Storage may be full (photos are the usual cause).', e);
  }
  return state;
}

export function resetStore() {
  localStorage.removeItem(KEY);
  state = null;
}

/* From the browser console: KGStore.reset() puts back the starting data. */
window.KGStore = {
  getStore,
  reloadStore,
  saveStore,
  resetStore,
  reset: () => { resetStore(); location.reload(); },
};