// js/api/adminContent.js — menu, tables, reservations, feedback, gallery, settings.

import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { fromSupabase, withMock, fail, friendly } from './shared.js';

/* ----------------------------- categories ----------------------------- */
export const listCategories = () =>
  withMock(
    () => Mock.adminContent.listCategories(),
    async () => {
      const sb = await supabase();
      return fromSupabase(await sb.from('categories').select('*').order('sort_order'), { code: 'LIST_FAILED' });
    }
  );

export const createCategory = (payload) =>
  withMock(
    () => Mock.adminContent.createCategory(payload),
    async () => fromSupabase(await sb().from('categories').insert(payload).select().single(), { code: 'CREATE_FAILED' })
  );

export const updateCategory = (id, patch) =>
  withMock(
    () => Mock.adminContent.updateCategory(id, patch),
    async () => fromSupabase(await sb().from('categories').update(patch).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

export const deleteCategory = (id) =>
  withMock(
    () => Mock.adminContent.deleteCategory(id),
    async () => fromSupabase(await sb().from('categories').delete().eq('id', id), { code: 'DELETE_FAILED' })
  );

/* ----------------------------- menu items ----------------------------- */
export const listMenuItems = () =>
  withMock(
    () => Mock.adminContent.listMenuItems(),
    async () => {
      const res = await sb().from('menu_items').select('*').order('sort_order');
      return fromSupabase(res, { code: 'LIST_FAILED' });
    }
  );

export const createMenuItem = (payload) =>
  withMock(
    () => Mock.adminContent.createMenuItem(payload),
    async () => fromSupabase(await sb().from('menu_items').insert(payload).select().single(), { code: 'CREATE_FAILED' })
  );

export const updateMenuItem = (id, patch) =>
  withMock(
    () => Mock.adminContent.updateMenuItem(id, patch),
    async () => fromSupabase(await sb().from('menu_items').update(patch).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

export const deleteMenuItem = (id) =>
  withMock(
    () => Mock.adminContent.deleteMenuItem(id),
    async () => fromSupabase(await sb().from('menu_items').delete().eq('id', id), { code: 'DELETE_FAILED' })
  );

export const setAvailability = (id, is_available) =>
  withMock(
    () => Mock.adminContent.setAvailability(id, is_available),
    async () => fromSupabase(await sb().from('menu_items').update({ is_available }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

/** Uploads to Supabase Storage in live mode, returns a data URL in mock mode. */
export const uploadImage = (file) =>
  withMock(
    () => Mock.adminContent.uploadImage(file),
    async () => {
      if (!file) return fail('NO_FILE', 'No file selected.');
      if (!String(file.type || '').startsWith('image/')) return fail('BAD_TYPE', 'Only image files can be uploaded.');
      if (file.size > 2 * 1024 * 1024) return fail('TOO_LARGE', 'Images must be 2 MB or smaller.');
      const client = await supabase();
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
      const res = await client.storage.from('menu-images').upload(path, file, { upsert: false });
      if (res.error) return fail('UPLOAD_FAILED', friendly(res.error.message));
      const { data } = client.storage.from('menu-images').getPublicUrl(res.data.path);
      return { data: data.publicUrl, error: null };
    }
  );

/* ------------------------------- tables ------------------------------- */
export const listTables = () =>
  withMock(
    () => Mock.adminContent.listTables(),
    async () => {
      const res = await sb().from('tables').select('*').order('table_number');
      return fromSupabase(res, { code: 'LIST_FAILED' });
    }
  );

export const createTable = (payload) =>
  withMock(
    () => Mock.adminContent.createTable(payload),
    async () => fromSupabase(await sb().from('tables').insert(payload).select().single(), { code: 'CREATE_FAILED' })
  );

export const updateTable = (id, patch) =>
  withMock(
    () => Mock.adminContent.updateTable(id, patch),
    async () => fromSupabase(await sb().from('tables').update(patch).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

export const deleteTable = (id) =>
  withMock(
    () => Mock.adminContent.deleteTable(id),
    async () => fromSupabase(await sb().from('tables').delete().eq('id', id), { code: 'DELETE_FAILED' })
  );

/* ---------------------------- reservations ---------------------------- */
export const listReservations = (filters = {}) =>
  withMock(
    () => Mock.adminContent.listReservations(filters),
    async () => {
      let query = sb().from('reservations').select('*').order('date').order('time');
      if (filters.date) query = query.eq('date', filters.date);
      if (filters.status) query = query.eq('status', filters.status);
      return fromSupabase(await query, { code: 'LIST_FAILED' });
    }
  );

export const setReservationStatus = (id, status) =>
  withMock(
    () => Mock.adminContent.setReservationStatus(id, status),
    async () => fromSupabase(await sb().from('reservations').update({ status }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

/* ------------------------------ feedback ------------------------------ */
export const listFeedback = (filters = {}) =>
  withMock(
    () => Mock.adminContent.listFeedback(filters),
    async () => {
      let query = sb().from('feedback').select('*').order('created_at', { ascending: false });
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.unread) query = query.eq('is_read', false);
      return fromSupabase(await query, { code: 'LIST_FAILED' });
    }
  );

export const setFeedbackRead = (id, is_read) =>
  withMock(
    () => Mock.adminContent.setFeedbackRead(id, is_read),
    async () => fromSupabase(await sb().from('feedback').update({ is_read }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

export const approveFeedback = (id) =>
  withMock(
    () => Mock.adminContent.approveFeedback(id),
    async () => fromSupabase(await sb().from('feedback').update({ is_approved: true, is_read: true }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

export const deleteFeedback = (id) =>
  withMock(
    () => Mock.adminContent.deleteFeedback(id),
    async () => fromSupabase(await sb().from('feedback').delete().eq('id', id), { code: 'DELETE_FAILED' })
  );

/* ------------------------------- gallery ------------------------------ */
export const listGallery = () =>
  withMock(
    () => Mock.adminContent.listGallery(),
    async () => {
      const res = await sb().from('gallery_images').select('*').order('sort_order');
      return fromSupabase(res, { code: 'LIST_FAILED' });
    }
  );

export const addGalleryImage = (payload) =>
  withMock(
    () => Mock.adminContent.addGalleryImage(payload),
    async () => fromSupabase(await sb().from('gallery_images').insert(payload).select().single(), { code: 'CREATE_FAILED' })
  );

export const updateGalleryCaption = (id, caption) =>
  withMock(
    () => Mock.adminContent.updateGalleryCaption(id, caption),
    async () => fromSupabase(await sb().from('gallery_images').update({ caption }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' })
  );

export const deleteGalleryImage = (id) =>
  withMock(
    () => Mock.adminContent.deleteGalleryImage(id),
    async () => fromSupabase(await sb().from('gallery_images').delete().eq('id', id), { code: 'DELETE_FAILED' })
  );

/* ------------------------------ settings ------------------------------ */
export const updateSettings = (patch) =>
  withMock(
    () => Mock.adminContent.updateSettings(patch),
    async () => fromSupabase(await sb().from('settings').update(patch).eq('id', 1).select().single(), { code: 'SAVE_FAILED' })
  );

async function sb() {
  const client = await supabase();
  if (!client) throw new Error('Supabase client unavailable while MOCK_MODE is off.');
  return client;
}
