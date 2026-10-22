// js/mock/index.js — mock API namespace.
// Every function returns the standard shape: { data, error: null | { code, message } }.
// Mirrors js/api/* exactly so MOCK_MODE can be switched off without touching pages.

import { reloadStore } from '../../../js/shared/store.js';
import { CONFIG } from '../config.js';
import * as db from './mockData.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms ?? 160 + Math.random() * 220));
const clone = (v) => JSON.parse(JSON.stringify(v));
const ok = async (data, ms) => {
  await delay(ms);
  db.persist(); // keep the shared store in step with every admin change
  return { data: clone(data), error: null };
};
const fail = (code, message) => ({ data: null, error: { code, message } });

/* ------------------------------- auth ------------------------------- */
const DEMO = {
  'admin@khabargolpo.com': { password: 'admin123', role: 'admin', name: 'Khabar Golpo Admin' },
  'chef@khabargolpo.com': { password: 'chef123', role: 'chef', name: 'Head Chef' },
};

export const Mock = {
  auth: {
    async signIn({ email, password }) {
      await delay();
      const key = String(email || '').trim().toLowerCase();
      const rec = DEMO[key];
      if (!rec) return fail('NO_ACCOUNT', 'No account found for that email address.');
      if (rec.password !== password) return fail('BAD_PASSWORD', 'That password does not match our records.');
       if (rec.role !== 'admin') return fail('WRONG_ROLE', 'This account is not allowed to access the admin panel.');
       return { data: { email: key, role: rec.role, name: rec.name }, error: null };
    },
    async signOut() {
      await delay(80);
      return { data: true, error: null };
    },
    async getSession() {
      return { data: null, error: null };
    },
    async getProfile() {
      return { data: { role: 'admin' }, error: null };
    },
  },

  /* ----------------------------- public ----------------------------- */
  public: {
    async getSettings() {
      return ok(db.settings, 120);
    },
  },

  /* -------------------------- admin orders -------------------------- */
  adminOrders: {
    async listOrders(filters = {}) {
      const { type = '', status = '', payment = '', table = '', q = '', from = '', to = '', page = 1, perPage = 10 } = filters;
      let rows = db.orders.slice();

      if (type) rows = rows.filter((o) => o.order_type === type);
      if (status) rows = rows.filter((o) => o.status === status);
      if (payment) rows = rows.filter((o) => o.payment_status === payment);
      if (table) rows = rows.filter((o) => String(o.table_number) === String(table));
      if (from) rows = rows.filter((o) => new Date(o.created_at) >= new Date(from));
      if (to) rows = rows.filter((o) => new Date(o.created_at) <= new Date(`${String(to).slice(0, 10)}T23:59:59`));
      if (q) {
        const s = q.toLowerCase();
        rows = rows.filter(
          (o) =>
            o.receipt.toLowerCase().includes(s) ||
            String(o.customer_name || '').toLowerCase().includes(s) ||
            String(o.phone || '').includes(s) ||
            String(o.table_number || '').includes(s)
        );
      }
      const total = rows.length;
      const start = (page - 1) * perPage;
      return ok({ rows: rows.slice(start, start + perPage), total, page, perPage }, 200);
    },

    async getOrder(id) {
      const found = db.orders.find((o) => o.id === id);
      return found ? ok(found) : fail('NOT_FOUND', 'That order could not be found.');
    },

    async cancelOrder(id) {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return fail('NOT_FOUND', 'That order could not be found.');
      if (['completed', 'cancelled'].includes(o.status))
        return fail('INVALID_TRANSITION', 'This order is already finished and cannot be cancelled.');
      o.status = 'cancelled';
      o.payment_status = 'unpaid';
      return ok(o);
    },

    async markOutForDelivery(id, note = '') {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return fail('NOT_FOUND', 'That order could not be found.');
      if (o.order_type !== 'delivery') return fail('WRONG_TYPE', 'Out for delivery only applies to delivery orders.');
      if (o.status !== 'ready') return fail('INVALID_TRANSITION', 'Only a ready order can go out for delivery.');
      o.status = 'out_for_delivery';
      if (note) o.delivery_agency_note = note;
      return ok(o);
    },

    async markDelivered(id) {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return fail('NOT_FOUND', 'That order could not be found.');
      if (o.order_type !== 'delivery') return fail('WRONG_TYPE', 'This is not a delivery order.');
      if (o.status !== 'out_for_delivery') return fail('INVALID_TRANSITION', 'The order must be out for delivery first.');
      o.status = 'completed';
      return ok(o);
    },

    async markPickedUp(id) {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return fail('NOT_FOUND', 'That order could not be found.');
      if (o.order_type !== 'pickup') return fail('WRONG_TYPE', 'This is not a pickup order.');
      if (o.status !== 'ready') return fail('INVALID_TRANSITION', 'Only a ready order can be picked up.');
      o.status = 'completed';
      return ok(o);
    },

    async markPaid(id) {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return fail('NOT_FOUND', 'That order could not be found.');
      if (o.status === 'cancelled') return fail('CANCELLED', 'A cancelled order can never be paid.');
      if (o.payment_status === 'paid') return fail('ALREADY_PAID', 'This order is already marked as paid.');
      o.payment_status = 'paid';
      o.paid_at = new Date().toISOString();
      return ok(o);
    },

    async getTableBill(tableId) {
      const bill = db.tableBill(tableId);
      if (!bill.orders.length) return fail('NO_OPEN_BILL', 'This table has no unpaid orders.');
      return ok(bill);
    },

    async markTablePaid(tableId) {
      const bill = db.tableBill(tableId);
      if (!bill.orders.length) return fail('NO_OPEN_BILL', 'This table has no unpaid orders.');
      const now = new Date().toISOString();
      bill.orders.forEach((o) => {
        const target = db.orders.find((x) => x.id === o.id);
        if (target) {
          target.payment_status = 'paid';
          target.paid_at = now;
        }
      });
      return ok({ ...bill, orders: bill.orders.map((o) => db.orders.find((x) => x.id === o.id)) });
    },
  },

  /* ------------------------- admin content -------------------------- */
  adminContent: {
    async listCategories() {
      return ok(db.categories.slice().sort((a, b) => a.sort_order - b.sort_order));
    },
    async createCategory(payload = {}) {
      const name = String(payload.name || '').trim();
      if (!name) return fail('VALIDATION', 'Category name is required.');
      if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
        return fail('DUPLICATE', 'A category with that name already exists.');
      const cat = {
        id: `cat_${Date.now()}`,
        name,
        sort_order: Number(payload.sort_order) || db.categories.length + 1,
        description: String(payload.description || '').trim().slice(0, 180),
        image_url: payload.image_url || '',
      };
      db.categories.push(cat);
      return ok(cat);
    },
    async updateCategory(id, patch) {
      const c = db.categories.find((x) => x.id === id);
      if (!c) return fail('NOT_FOUND', 'Category not found.');
      Object.assign(c, patch);
      return ok(c);
    },
    async deleteCategory(id) {
      if (db.menu_items.some((i) => i.category_id === id))
        return fail('CATEGORY_NOT_EMPTY', 'Move or delete the items in this category first.');
      const i = db.categories.findIndex((c) => c.id === id);
      if (i < 0) return fail('NOT_FOUND', 'Category not found.');
      const [removed] = db.categories.splice(i, 1);
      return ok(removed);
    },

    async listMenuItems() {
      return ok(db.menu_items.slice().sort((a, b) => a.sort_order - b.sort_order));
    },
    async createMenuItem(payload) {
      const err = validateItem(payload);
      if (err) return fail('VALIDATION', err);
      const item = {
        id: `itm_${Date.now()}`,
        category_id: payload.category_id,
        name: payload.name.trim(),
        description: (payload.description || '').trim(),
        price: Number(payload.price),
        is_veg: !!payload.is_veg,
        is_featured: !!payload.is_featured,
        is_available: payload.is_available !== false,
        sort_order: db.menu_items.length + 1,
        image_url: payload.image_url || db.foodThumb(payload.name, Math.floor(Math.random() * 360)),
        created_at: new Date().toISOString(),
      };
      db.menu_items.push(item);
      return ok(item);
    },
    async updateMenuItem(id, patch) {
      const it = db.menu_items.find((x) => x.id === id);
      if (!it) return fail('NOT_FOUND', 'Item not found.');
      const err = validateItem({ ...it, ...patch });
      if (err) return fail('VALIDATION', err);
      Object.assign(it, patch, patch.price != null ? { price: Number(patch.price) } : {});
      return ok(it);
    },
    async deleteMenuItem(id) {
      const i = db.menu_items.findIndex((x) => x.id === id);
      if (i < 0) return fail('NOT_FOUND', 'Item not found.');
      const [removed] = db.menu_items.splice(i, 1);
      return ok(removed);
    },
    async setAvailability(id, is_available) {
      const it = db.menu_items.find((x) => x.id === id);
      if (!it) return fail('NOT_FOUND', 'Item not found.');
      it.is_available = !!is_available;
      return ok(it);
    },
    async uploadImage(file) {
      await delay(500);
      if (!file) return fail('NO_FILE', 'No file selected.');
      if (!String(file.type || '').startsWith('image/')) return fail('BAD_TYPE', 'Only image files can be uploaded.');
      if (file.size > 2 * 1024 * 1024) return fail('TOO_LARGE', 'Images must be 2 MB or smaller.');
      const url = await new Promise((res) => {
        const r = typeof FileReader !== 'undefined' ? new FileReader() : null;
        if (r) {
          r.onload = () => res(r.result);
          r.onerror = () => res(foodThumb(file.name || 'Photo', 260));
          r.readAsDataURL(file);
        } else {
          res('data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#e9a94a"/><text x="240" y="200" font-size="42" text-anchor="middle" fill="white">KG</text></svg>'));
        }
      });
      return ok(url, 40);
    },

    async listTables() {
      return ok(db.tables.slice().sort((a, b) => a.table_number - b.table_number));
    },
    async createTable({ table_number, seats = 4 }) {
      const n = Number(table_number);
      if (!n || n < 1) return fail('VALIDATION', 'Enter a valid table number.');
      if (db.tables.some((t) => t.table_number === n)) return fail('DUPLICATE', `Table ${n} already exists.`);
      const t = { id: `tbl_${Date.now()}`, table_number: n, seats: Number(seats) || 4, is_active: true, created_at: new Date().toISOString() };
      db.tables.push(t);
      return ok(t);
    },
    async updateTable(id, patch) {
      const t = db.tables.find((x) => x.id === id);
      if (!t) return fail('NOT_FOUND', 'Table not found.');
      Object.assign(t, patch);
      return ok(t);
    },
    async deleteTable(id) {
      if (db.orders.some((o) => o.table_id === id && o.status !== 'cancelled'))
        return fail('IN_USE', 'This table has order history and cannot be deleted. Deactivate it instead.');
      const i = db.tables.findIndex((t) => t.id === id);
      if (i < 0) return fail('NOT_FOUND', 'Table not found.');
      const [removed] = db.tables.splice(i, 1);
      return ok(removed);
    },

    async listReservations(filters = {}) {
      const { date = '', status = '', q = '' } = filters;
      let rows = db.reservations.slice();
      if (date) rows = rows.filter((r) => r.date === date);
      if (status) rows = rows.filter((r) => r.status === status);
      if (q) {
        const s = q.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.phone.includes(s));
      }
      return ok(rows);
    },
    async setReservationStatus(id, status) {
      const r = db.reservations.find((x) => x.id === id);
      if (!r) return fail('NOT_FOUND', 'Reservation not found.');
      if (!['pending', 'confirmed', 'cancelled'].includes(status)) return fail('VALIDATION', 'Unknown reservation status.');
      r.status = status;
      return ok(r);
    },

    async listFeedback(filters = {}) {
      const { type = '', unread = false, q = '' } = filters;
      let rows = db.feedback.slice();
      if (type) rows = rows.filter((f) => f.type === type);
      if (unread) rows = rows.filter((f) => !f.is_read);
      if (q) rows = rows.filter((f) => f.message.toLowerCase().includes(q.toLowerCase()) || f.name.toLowerCase().includes(q.toLowerCase()));
      return ok(rows);
    },
    async setFeedbackRead(id, is_read) {
      const f = db.feedback.find((x) => x.id === id);
      if (!f) return fail('NOT_FOUND', 'Feedback not found.');
      f.is_read = is_read;
      return ok(f);
    },
    async approveFeedback(id) {
      const f = db.feedback.find((x) => x.id === id);
      if (!f) return fail('NOT_FOUND', 'Feedback not found.');
      if (f.type !== 'review') return fail('WRONG_TYPE', 'Only reviews can be approved.');
      f.is_approved = true;
      f.is_read = true;
      return ok(f);
    },
    async deleteFeedback(id) {
      const i = db.feedback.findIndex((f) => f.id === id);
      if (i < 0) return fail('NOT_FOUND', 'Feedback not found.');
      const [removed] = db.feedback.splice(i, 1);
      return ok(removed);
    },

    async listGallery() {
      return ok(db.gallery_images.slice().sort((a, b) => a.sort_order - b.sort_order));
    },
    async addGalleryImage({ caption = '', image_url }) {
      if (!image_url) return fail('NO_FILE', 'Choose an image first.');
      const g = {
        id: `gal_${Date.now()}`,
        image_url,
        caption: String(caption).trim(),
        sort_order: db.gallery_images.length + 1,
        created_at: new Date().toISOString(),
      };
      db.gallery_images.push(g);
      return ok(g);
    },
    async updateGalleryCaption(id, caption) {
      const g = db.gallery_images.find((x) => x.id === id);
      if (!g) return fail('NOT_FOUND', 'Image not found.');
      g.caption = String(caption).trim();
      return ok(g);
    },
    async deleteGalleryImage(id) {
      const i = db.gallery_images.findIndex((g) => g.id === id);
      if (i < 0) return fail('NOT_FOUND', 'Image not found.');
      const [removed] = db.gallery_images.splice(i, 1);
      return ok(removed);
    },

    async updateSettings(patch) {
      await delay(420);
      Object.assign(db.settings, patch);
      return ok(db.settings);
    },
  },

  /* ---------------------------- reports ----------------------------- */
  reports: {
    async revenueSummary() {
      return ok(db.revenueSummary(), 260);
    },
    async salesReport(params = {}) {
      return ok(db.salesReport(params), 300);
    },
    async topItems(limit = 8) {
      const s = db.revenueSummary();
      return ok(s.topItems.slice(0, limit));
    },
    async salesByType(params = {}) {
      const r = db.salesReport(params);
      return ok({ byType: r.byType, delivery_fee_total: r.delivery_fee_total });
    },
  },
};

function validateItem(p) {
  if (!String(p.name || '').trim()) return 'Item name is required.';
  if (!p.category_id) return 'Choose a category.';
  const price = Number(p.price);
  if (!Number.isFinite(price) || price < 0) return 'Price must be a valid amount.';
  return null;
}

/* ------------------------- realtime (from the shared store) ------------------------- */
const handlers = new Set();
const lastStatus = new Map();
let primed = false;
let ticker = null;

/* Looks at the shared store every few seconds. New orders and status changes go to the admin's pages. */
function syncOrders() {
  const fresh = reloadStore().orders || [];
  let changed = false;
  fresh.forEach((o) => {
    const prev = lastStatus.get(o.id);
    if (prev === undefined) {
      if (primed) handlers.forEach((h) => h({ type: 'INSERT', new: clone(o) }));
      changed = true;
    } else if (prev !== o.status) {
      handlers.forEach((h) => h({ type: 'UPDATE', new: clone(o) }));
      changed = true;
    }
    lastStatus.set(o.id, o.status);
  });
  if (changed || !primed) {
    const sorted = fresh.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    db.orders.splice(0, db.orders.length, ...clone(sorted));
  }
  primed = true;
}

export const mockRealtime = {
  subscribe(cb) {
    handlers.add(cb);
    if (!ticker) {
      syncOrders();
      ticker = setInterval(syncOrders, 6000);
    }
    return () => {
      handlers.delete(cb);
      if (!handlers.size && ticker) {
        clearInterval(ticker);
        ticker = null;
      }
    };
  },
  /** force an immediate check (used by demo controls) */
  poke() {
    syncOrders();
  },
};