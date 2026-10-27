// js/api/adminContent.js — menu, tables, reservations, feedback, gallery, settings.

import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { fromSupabase, withMock, fail, friendly } from './shared.js';

async function getSb() {
  const client = await supabase();
  if (!client) throw new Error('Supabase client unavailable while MOCK_MODE is off.');
  return client;
}

/* ----------------------------- categories ----------------------------- */
export const listCategories = () =>
  withMock(
    () => Mock.adminContent.listCategories(),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('categories').select('*').order('sort_order'), { code: 'LIST_FAILED' });
    }
  );

export const createCategory = (payload) =>
  withMock(
    () => Mock.adminContent.createCategory(payload),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('categories').insert(payload).select().single(), { code: 'CREATE_FAILED' });
    }
  );

export const updateCategory = (id, patch) =>
  withMock(
    () => Mock.adminContent.updateCategory(id, patch),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('categories').update(patch).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

export const deleteCategory = (id) =>
  withMock(
    () => Mock.adminContent.deleteCategory(id),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('categories').delete().eq('id', id), { code: 'DELETE_FAILED' });
    }
  );

/* ----------------------------- menu items ----------------------------- */
export const listMenuItems = () =>
  withMock(
    () => Mock.adminContent.listMenuItems(),
    async () => {
      const client = await getSb();
      const res = await client.from('menu_items').select('*').order('sort_order');
      return fromSupabase(res, { code: 'LIST_FAILED' });
    }
  );

export const createMenuItem = (payload) =>
  withMock(
    () => Mock.adminContent.createMenuItem(payload),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('menu_items').insert(payload).select().single(), { code: 'CREATE_FAILED' });
    }
  );

export const updateMenuItem = (id, patch) =>
  withMock(
    () => Mock.adminContent.updateMenuItem(id, patch),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('menu_items').update(patch).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

export const deleteMenuItem = (id) =>
  withMock(
    () => Mock.adminContent.deleteMenuItem(id),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('menu_items').delete().eq('id', id), { code: 'DELETE_FAILED' });
    }
  );

export const setAvailability = (id, is_available) =>
  withMock(
    () => Mock.adminContent.setAvailability(id, is_available),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('menu_items').update({ is_available }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

/** Uploads to Supabase Storage in live mode, returns a data URL in mock mode. */
export const uploadImage = (file) =>
  withMock(
    () => Mock.adminContent.uploadImage(file),
    async () => {
      if (!file) return fail('NO_FILE', 'No file selected.');
      if (!String(file.type || '').startsWith('image/')) return fail('BAD_TYPE', 'Only image files can be uploaded.');
      if (file.size > 2 * 1024 * 1024) return fail('TOO_LARGE', 'Images must be 2 MB or smaller.');
      const client = await getSb();
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
      const client = await getSb();
      const res = await client.from('tables').select('*').order('table_number');
      return fromSupabase(res, { code: 'LIST_FAILED' });
    }
  );

export const createTable = (payload) =>
  withMock(
    () => Mock.adminContent.createTable(payload),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('tables').insert(payload).select().single(), { code: 'CREATE_FAILED' });
    }
  );

export const updateTable = (id, patch) =>
  withMock(
    () => Mock.adminContent.updateTable(id, patch),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('tables').update(patch).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

export const deleteTable = (id) =>
  withMock(
    () => Mock.adminContent.deleteTable(id),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('tables').delete().eq('id', id), { code: 'DELETE_FAILED' });
    }
  );

/* ---------------------------- reservations ---------------------------- */
export const listReservations = (filters = {}) =>
  withMock(
    () => Mock.adminContent.listReservations(filters),
    async () => {
      const client = await getSb();
      let query = client.from('reservations').select('*').order('date').order('time');
      if (filters.date) query = query.eq('date', filters.date);
      if (filters.status) query = query.eq('status', filters.status);
      return fromSupabase(await query, { code: 'LIST_FAILED' });
    }
  );

export const setReservationStatus = (id, status) =>
  withMock(
    () => Mock.adminContent.setReservationStatus(id, status),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('reservations').update({ status }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

/* ------------------------------ feedback ------------------------------ */
export const listFeedback = (filters = {}) =>
  withMock(
    () => Mock.adminContent.listFeedback(filters),
    async () => {
      const client = await getSb();
      let query = client.from('feedback').select('*').order('created_at', { ascending: false });
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.unread) query = query.eq('is_read', false);
      return fromSupabase(await query, { code: 'LIST_FAILED' });
    }
  );

export const setFeedbackRead = (id, is_read) =>
  withMock(
    () => Mock.adminContent.setFeedbackRead(id, is_read),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('feedback').update({ is_read }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

export const approveFeedback = (id) =>
  withMock(
    () => Mock.adminContent.approveFeedback(id),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('feedback').update({ is_approved: true, is_read: true }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

export const deleteFeedback = (id) =>
  withMock(
    () => Mock.adminContent.deleteFeedback(id),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('feedback').delete().eq('id', id), { code: 'DELETE_FAILED' });
    }
  );

/* ------------------------------- gallery ------------------------------ */
export const listGallery = () =>
  withMock(
    () => Mock.adminContent.listGallery(),
    async () => {
      const client = await getSb();
      const res = await client.from('gallery_images').select('*').order('sort_order');
      return fromSupabase(res, { code: 'LIST_FAILED' });
    }
  );

export const addGalleryImage = (payload) =>
  withMock(
    () => Mock.adminContent.addGalleryImage(payload),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('gallery_images').insert(payload).select().single(), { code: 'CREATE_FAILED' });
    }
  );

export const updateGalleryCaption = (id, caption) =>
  withMock(
    () => Mock.adminContent.updateGalleryCaption(id, caption),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('gallery_images').update({ caption }).eq('id', id).select().single(), { code: 'UPDATE_FAILED' });
    }
  );

export const deleteGalleryImage = (id) =>
  withMock(
    () => Mock.adminContent.deleteGalleryImage(id),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('gallery_images').delete().eq('id', id), { code: 'DELETE_FAILED' });
    }
  );

/* ------------------------------ settings ------------------------------ */
export const updateSettings = (patch) =>
  withMock(
    () => Mock.adminContent.updateSettings(patch),
    async () => {
      const client = await getSb();
      return fromSupabase(await client.from('settings').update(patch).eq('id', 1).select().single(), { code: 'SAVE_FAILED' });
    }
  );
