// js/pages/gallery.js — photo library with upload, captions and lightbox.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listGallery, addGalleryImage, updateGalleryCaption, deleteGalleryImage, uploadImage } from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { openModal, toast, emptyState, esc, confirmDialog, stagger, reveal, skeleton } from '../utils/ui.js';
import { relTime } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

let photos = [];

function render() {
  const host = $('galGrid');
  $('galCount').textContent = photos.length;
  if (!photos.length) {
    host.innerHTML = emptyState({ icon: 'image', title: 'The gallery is empty', hint: 'Drop a photo above to fill it.' });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = photos
    .map(
      (g, i) => `
    <figure class="gal-card" style="--i:${i}" data-id="${g.id}">
      <div class="gal-media" data-open="${g.id}">
        <img src="${esc(g.image_url)}" alt="${esc(g.caption || 'Gallery photo')}" loading="lazy" />
      </div>
      <div class="gal-tools">
        <button class="btn btn-icon btn-xs" data-full="${g.id}" aria-label="View full size" data-icon="eye"></button>
        <button class="btn btn-icon btn-xs" data-del="${g.id}" aria-label="Delete" data-icon="trash"></button>
      </div>
      <figcaption class="gal-cap">
        <input value="${esc(g.caption || '')}" data-cap="${g.id}" placeholder="Add a caption…" maxlength="60" />
        <span class="xsmall muted nowrap">${esc(relTime(g.created_at))}</span>
      </figcaption>
    </figure>`
    )
    .join('');
  hydrateIcons(host);
  stagger(host, 50);
}

function lightbox(photo) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `
    <button class="ui-x" aria-label="Close" data-icon="x"></button>
    <div style="text-align:center">
      <img src="${esc(photo.image_url)}" alt="${esc(photo.caption || '')}" />
      ${photo.caption ? `<div class="lightbox-cap">${esc(photo.caption)}</div>` : ''}
    </div>`;
  document.body.appendChild(el);
  hydrateIcons(el);
  const close = () => {
    el.classList.remove('in');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => el.remove(), 260);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('.ui-x')) close();
  });
  requestAnimationFrame(() => el.classList.add('in'));
}

async function handleFiles(fileList) {
  const files = [...fileList].slice(0, 8);
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    const up = await uploadImage(file, 'gallery-images');
    if (up.error) {
      toast({ type: 'error', title: `${file.name} skipped`, message: up.error.message });
      continue;
    }
    const res = await addGalleryImage({ image_url: up.data, caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
    if (res.error) toast({ type: 'error', title: 'Upload failed', message: res.error.message });
    else added++;
  }
  if (added) toast({ type: 'success', title: `${added} photo${added === 1 ? '' : 's'} added`, message: 'Visible on the website gallery.' });
  load();
}

async function load() {
  const host = $('galGrid');
  host.innerHTML = skeleton(6);
  const res = await listGallery();
  if (res.error) {
    toast({ type: 'error', title: 'Could not load gallery', message: res.error.message });
    return;
  }
  photos = res.data;
  render();
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('gallery', session);
  hydrateIcons($('page'));
  reveal();

  const dz = $('dropzone');
  const input = $('fileInput');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && input.click());
  $('btnUpload').addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  $('galGrid').addEventListener('click', async (e) => {
    const open = e.target.closest('[data-open]');
    if (open) return lightbox(photos.find((p) => p.id === open.dataset.open));

    const full = e.target.closest('[data-full]');
    if (full) return lightbox(photos.find((p) => p.id === full.dataset.full));

    const del = e.target.closest('[data-del]');
    if (del) {
      const p = photos.find((x) => x.id === del.dataset.del);
      const yes = await confirmDialog({
        title: 'Delete this photo?',
        message: 'It disappears from the website gallery immediately.',
        danger: true,
        confirmText: 'Delete photo',
      });
      if (!yes) return;
      const res = await deleteGalleryImage(p.id);
      res.error
        ? toast({ type: 'error', title: 'Could not delete', message: res.error.message })
        : toast({ type: 'success', title: 'Photo deleted' });
      load();
    }
  });

  $('galGrid').addEventListener('change', async (e) => {
    const cap = e.target.closest('[data-cap]');
    if (!cap) return;
    const res = await updateGalleryCaption(cap.dataset.cap, cap.value);
    if (res.error) toast({ type: 'error', title: 'Could not save caption', message: res.error.message });
    else toast({ type: 'success', title: 'Caption saved', duration: 2400 });
  });

  await load();
}

init();
