// js/pages/menu.js — categories + menu item management.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  setAvailability,
  uploadImage,
} from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { openModal, confirmDialog, toast, emptyState, esc, buttonLoading, stagger, reveal } from '../utils/ui.js';
import { money, titleCase } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

let cats = [];
let items = [];
let activeCat = '';
let query = '';

const countIn = (catId) => items.filter((i) => i.category_id === catId).length;

/* ------------------------------ categories ------------------------------ */
function renderCats() {
  const host = $('catList');
  const all = [{ id: '', name: 'All items', __all: true }, ...cats];
  host.innerHTML = all
    .map(
      (c) => `
    <button class="cat-item ${activeCat === c.id ? 'on' : ''}" data-cat="${c.id}">
      <span>${esc(c.name)}</span>
      <span class="cat-count">${c.__all ? items.length : countIn(c.id)}</span>
    </button>`
    )
    .join('');
  if (cats.length) {
    host.insertAdjacentHTML(
      'beforeend',
      `<div style="border-top:1px dashed var(--line);margin-top:8px;padding-top:8px">
        ${cats
          .map(
            (c) => `<div class="cat-item" style="cursor:default;padding:8px 12px">
              <span class="muted" style="font-size:15px">${esc(c.name)}</span>
              <span style="margin-left:auto;display:flex;gap:4px">
                <button class="btn btn-ghost btn-xs" data-editcat="${c.id}" aria-label="Edit category">${icon('pencil')}</button>
                <button class="btn btn-ghost btn-xs" data-delcat="${c.id}" aria-label="Delete category">${icon('trash')}</button>
              </span>
            </div>`
          )
          .join('')}
      </div>`
    );
  }
}

function catModal(cat = null, opts = {}) {
  let saving = false;
  let imageUrl = cat?.image_url || '';
  let pendingFile = null;

  const m = openModal({
    title: cat ? 'Edit category' : 'New category',
    content: `
      <div class="field" id="fCatName">
        <label for="catName">Category name</label>
        <input id="catName" value="${esc(cat?.name || '')}" placeholder="e.g. Starters" maxlength="40" />
        <span class="err"></span>
      </div>
      <div class="field" style="margin-top:14px">
        <label for="catOrder">Sort order</label>
        <input id="catOrder" type="number" min="1" value="${cat?.sort_order ?? cats.length + 1}" />
      </div>
      <div class="field" style="margin-top:14px">
        <label for="catDesc">Description</label>
        <textarea id="catDesc" maxlength="180" placeholder="A short line about this category, shown on the website.">${esc(cat?.description || '')}</textarea>
        <span class="hint">Max 180 characters.</span>
      </div>
      <div class="field" style="margin-top:14px">
        <label>Photo</label>
        <div class="logo-drop">
          <div class="logo-preview" id="catPreview">${imageUrl ? `<img src="${esc(imageUrl)}" alt="" />` : esc((cat?.name || 'C')[0].toUpperCase())}</div>
          <div style="display:grid;gap:8px;flex:1">
            <label class="btn btn-soft btn-sm" style="width:max-content" for="catFile">${icon('upload')}<span>Upload photo</span></label>
            <input id="catFile" type="file" accept="image/*" class="sr-only" />
            <span class="hint">JPG or PNG · up to 500 KB for now.</span>
          </div>
        </div>
        <span class="err" id="eCatFile" style="display:none"></span>
      </div>`,
    actions: [
      ...(cat ? [{ label: 'Delete', className: 'btn-danger', icon: 'trash', value: 'delete' }] : []),
      { label: 'Cancel', className: 'btn-ghost', value: null },
      {
        label: cat ? 'Save changes' : 'Create category',
        className: 'btn-primary',
        value: 'save',
        onClick: async ({ btn }) => {
          const name = $('catName').value.trim();
          const field = $('fCatName');
          if (!name) {
            field.classList.add('has-error');
            field.querySelector('.err').textContent = 'Give the category a name.';
            return false;
          }
          buttonLoading(btn, true);
          if (pendingFile) {
            const up = await uploadImage(pendingFile);
            if (up.error) {
              buttonLoading(btn, false);
              const ef = $('eCatFile');
              ef.style.display = 'block';
              ef.textContent = up.error.message;
              return false;
            }
            imageUrl = up.data;
          }
          const payload = {
            name,
            sort_order: Number($('catOrder').value) || cats.length + 1,
            description: $('catDesc').value.trim(),
            image_url: imageUrl,
          };
          const res = cat ? await updateCategory(cat.id, payload) : await createCategory(payload);
          buttonLoading(btn, false);
          if (res.error) {
            field.classList.add('has-error');
            field.querySelector('.err').textContent = res.error.message;
            return false;
          }
          saving = true;
          return true;
        },
      },
    ],
  });

  $('catFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ef = $('eCatFile');
    if (file.size > 500 * 1024) {
      ef.style.display = 'block';
      ef.textContent = 'Keep category photos under 500 KB for now.';
      pendingFile = null;
      return;
    }
    ef.style.display = 'none';
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      $('catPreview').innerHTML = `<img src="${reader.result}" alt="" />`;
    };
    reader.readAsDataURL(file);
  });

  m.result.then(async (val) => {
    if (val === 'delete' && cat) {
      const yes = await confirmDialog({
        title: `Delete “${cat.name}”?`,
        message: 'Categories with dishes cannot be deleted — move the dishes first.',
        danger: true,
        confirmText: 'Delete',
      });
      if (yes) {
        const res = await deleteCategory(cat.id);
        res.error
          ? toast({ type: 'error', title: 'Cannot delete', message: res.error.message })
          : toast({ type: 'success', title: 'Category deleted' });
      }
    } else if (val === 'save' && saving) {
      toast({ type: 'success', title: cat ? 'Category updated' : 'Category created' });
    }
    await load();
    if (val === 'save' && saving && opts.thenAddItem) itemModal(null);
  });
}


/* ------------------------------ items ------------------------------ */
function itemCard(it) {
  return `
  <article class="item-card ${it.is_available ? '' : 'sold'}" data-item="${it.id}">
    <div class="item-media">
      <img src="${esc(it.image_url)}" alt="${esc(it.name)}" loading="lazy" />
      <div class="item-flags">
        ${it.is_veg ? '<span class="flag flag-veg">Veg</span>' : ''}
        ${it.is_featured ? '<span class="flag flag-feat">Featured</span>' : ''}
        ${!it.is_available ? '<span class="flag flag-sold">Sold out</span>' : ''}
      </div>
    </div>
    <div class="item-body">
      <div class="item-top">
        <h3 class="item-name">${esc(it.name)}</h3>
        <span class="item-price">${money(it.price)}</span>
      </div>
      <p class="item-desc">${esc(it.description || 'No description yet.')}</p>
      <div class="item-foot">
        <button class="check" data-toggle="${it.id}" role="switch" aria-checked="${it.is_available}">
          <span class="box">${icon('check')}</span>
          <span class="small">${it.is_available ? 'Available' : 'Sold out'}</span>
        </button>
        <span class="item-actions">
          <button class="btn btn-ghost btn-xs" data-edit="${it.id}" aria-label="Edit">${icon('pencil')}</button>
          <button class="btn btn-ghost btn-xs" data-del="${it.id}" aria-label="Delete">${icon('trash')}</button>
        </span>
      </div>
    </div>
  </article>`;
}

function renderItems() {
  const host = $('itemsHost');
  const q = query.toLowerCase();
  const filtered = items.filter(
    (i) => (!activeCat || i.category_id === activeCat) && (!q || i.name.toLowerCase().includes(q) || String(i.description || '').toLowerCase().includes(q))
  );
  if (!filtered.length) {
    host.innerHTML = emptyState({ icon: 'kitchen', title: 'No dishes here yet', hint: 'Add your first item — or clear the search box.' });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = `<div class="item-grid">${filtered.map(itemCard).join('')}</div>`;
  hydrateIcons(host);
  stagger(host.firstElementChild, 45);
}

function fieldErr(id, message) {
  const f = $(id);
  if (!f) return;
  f.classList.toggle('has-error', !!message);
  const e = f.querySelector('.err');
  if (e) e.textContent = message || '';
}

function itemModal(item = null) {
  const editing = !!item;
  let imageUrl = item?.image_url || '';
  let pendingFile = null;

  const content = `
    <div class="field-row">
      <div class="field" id="fName">
        <label for="itName">Item name</label>
        <input id="itName" maxlength="60" value="${esc(item?.name || '')}" placeholder="Chicken Chaap" />
        <span class="err"></span>
      </div>
      <div class="field" id="fPrice">
        <label for="itPrice">Price (${money(0).replace('0', '')} BDT)</label>
        <input id="itPrice" type="number" min="0" step="1" value="${item?.price ?? ''}" placeholder="320" />
        <span class="err"></span>
      </div>
    </div>

    <div class="field-row" style="margin-top:14px">
      <div class="field" id="fCat">
        <label for="itCat">Category</label>
        <select id="itCat">
          <option value="">Choose…</option>
          ${cats.map((c) => `<option value="${c.id}" ${item?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <span class="err"></span>
      </div>
      <div class="field">
        <label for="itOrder">Sort order</label>
        <input id="itOrder" type="number" min="1" value="${item?.sort_order ?? items.length + 1}" />
      </div>
    </div>

    <div class="field" style="margin-top:14px">
      <label for="itDesc">Description</label>
      <textarea id="itDesc" maxlength="180" placeholder="Slow-cooked chicken in a rich, silky mustard gravy.">${esc(item?.description || '')}</textarea>
      <span class="hint">Max 180 characters · shown under the dish photo.</span>
    </div>

    <div class="field" style="margin-top:14px">
      <label>Photo</label>
      <div class="logo-drop">
        <div class="logo-preview" id="itPreview">${imageUrl ? `<img src="${esc(imageUrl)}" alt="" />` : esc((item?.name || 'K')[0].toUpperCase())}</div>
        <div style="display:grid;gap:8px;flex:1">
          <label class="btn btn-soft btn-sm" style="width:max-content" for="itFile">${icon('upload')}<span>Upload image</span></label>
          <input id="itFile" type="file" accept="image/*" class="sr-only" />
          <span class="hint">JPG or PNG · 2 MB max.</span>
        </div>
      </div>
      <span class="err" id="eFile" style="display:none"></span>
    </div>

    <div class="field-row" style="margin-top:16px">
      <label class="check"><input type="checkbox" id="itVeg" ${item?.is_veg ? 'checked' : ''} /><span class="box">${icon('check')}</span><span>Vegetarian</span></label>
      <label class="check"><input type="checkbox" id="itFeat" ${item?.is_featured ? 'checked' : ''} /><span class="box">${icon('check')}</span><span>Featured dish</span></label>
      <label class="check"><input type="checkbox" id="itAvail" ${item ? (item.is_available ? 'checked' : '') : 'checked'} /><span class="box">${icon('check')}</span><span>Available now</span></label>
    </div>`;

  const m = openModal({
    title: editing ? `Edit ${item.name}` : 'Add a dish',
    wide: true,
    content,
    actions: [
      { label: 'Cancel', className: 'btn-ghost', value: null },
      {
        label: editing ? 'Save changes' : 'Add to menu',
        className: 'btn-primary',
        value: 'save',
        onClick: async ({ btn }) => {
          fieldErr('fName', '');
          fieldErr('fPrice', '');
          fieldErr('fCat', '');

          const name = $('itName').value.trim();
          const price = $('itPrice').value;
          const category_id = $('itCat').value;
          let bad = false;
          if (!name) { fieldErr('fName', 'Item name is required.'); bad = true; }
          if (price === '' || Number(price) < 0) { fieldErr('fPrice', 'Enter a valid price.'); bad = true; }
          if (!category_id) { fieldErr('fCat', 'Choose a category.'); bad = true; }
          if (bad) return false;

          buttonLoading(btn, true);
          if (pendingFile) {
            const up = await uploadImage(pendingFile);
            if (up.error) {
              buttonLoading(btn, false);
              const ef = $('eFile');
              ef.style.display = 'block';
              ef.textContent = up.error.message;
              return false;
            }
            imageUrl = up.data;
          }
          buttonLoading(btn, false);

          const payload = {
            name,
            price: Number(price),
            category_id,
            description: $('itDesc').value.trim(),
            sort_order: Number($('itOrder').value) || items.length + 1,
            is_veg: $('itVeg').checked,
            is_featured: $('itFeat').checked,
            is_available: $('itAvail').checked,
            image_url: imageUrl || undefined,
          };
          const res = editing ? await updateMenuItem(item.id, payload) : await createMenuItem(payload);
          if (res.error) {
            toast({ type: 'error', title: 'Could not save', message: res.error.message });
            return false;
          }
          return true;
        },
      },
    ],
  });

  $('itFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      const ef = $('eFile');
      ef.style.display = 'block';
      ef.textContent = 'Images must be 2 MB or smaller.';
      return;
    }
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      $('itPreview').innerHTML = `<img src="${reader.result}" alt="" />`;
    };
    reader.readAsDataURL(file);
  });

  m.result.then((val) => {
    if (val === 'save') {
      toast({ type: 'success', title: editing ? 'Item updated' : 'Item added', message: 'Customers see the change on their next page load.' });
      load();
    }
  });
}

/* ------------------------------ loading ------------------------------ */
async function load() {
  const [c, i] = await Promise.all([listCategories(), listMenuItems()]);
  if (c.error || i.error) {
    toast({ type: 'error', title: 'Could not load the menu', message: (c.error || i.error).message });
    return;
  }
  cats = c.data;
  items = i.data;
  if (activeCat && !cats.some((x) => x.id === activeCat)) activeCat = '';
  renderCats();
  renderItems();
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('menu', session);
  hydrateIcons($('page'));
  reveal();

  await load();

  $('btnAddCat').addEventListener('click', () => catModal(null));
  $('btnAddItem').addEventListener('click', () => {
    if (!cats.length) {
      toast({ type: 'warning', title: 'Create a category first', message: 'Every dish belongs to a category.' });
      catModal(null, { thenAddItem: true });
      return;
    }
    itemModal(null);
  });

  $('catList').addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      activeCat = cat.dataset.cat;
      renderCats();
      renderItems();
      return;
    }
    const edit = e.target.closest('[data-editcat]');
    if (edit) return catModal(cats.find((c) => c.id === edit.dataset.editcat));
    const del = e.target.closest('[data-delcat]');
    if (del) return catModal(cats.find((c) => c.id === del.dataset.delcat));
  });

  let t;
  $('mSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      query = e.target.value.trim();
      renderItems();
    }, 160);
  });

  $('itemsHost').addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const it = items.find((x) => x.id === toggle.dataset.toggle);
      const res = await setAvailability(it.id, !it.is_available);
      if (res.error) return toast({ type: 'error', title: 'Could not update', message: res.error.message });
      toast({
        type: 'success',
        title: res.data.is_available ? `${it.name} is back on the menu` : `${it.name} marked sold out`,
      });
      await load();
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) return itemModal(items.find((x) => x.id === edit.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) {
      const it = items.find((x) => x.id === del.dataset.del);
      const yes = await confirmDialog({
        title: `Delete “${it.name}”?`,
        message: 'Old receipts keep their own copy of the name and price, so history stays safe.',
        danger: true,
        confirmText: 'Delete item',
      });
      if (!yes) return;
      const res = await deleteMenuItem(it.id);
      res.error
        ? toast({ type: 'error', title: 'Could not delete', message: res.error.message })
        : toast({ type: 'success', title: 'Item deleted' });
      load();
    }
  });
}

init();
