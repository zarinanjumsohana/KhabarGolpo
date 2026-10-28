// js/pages/settings.js — restaurant configuration with sticky save bar.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { getSettings } from '../api/public.js';
import { updateSettings, uploadImage } from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, esc, buttonLoading, reveal } from '../utils/ui.js';

const $ = (id) => document.getElementById(id);

const FIELDS = [
  'name', 'tagline', 'address', 'phone', 'email',
  'hours_week', 'hours_weekend', 'pickup_hours',
  'tax_rate', 'timezone', 'pickup_enabled', 'delivery_enabled',
  'delivery_fee', 'min_delivery_order', 'delivery_note', 'prep_time_minutes',
];
const NUMS = ['tax_rate', 'delivery_fee', 'min_delivery_order', 'prep_time_minutes'];
const BOOLS = ['pickup_enabled', 'delivery_enabled'];

let saved = null;
let logoValue = null;
let dirty = false;

function setDirty(on) {
  if (dirty === on) return;
  dirty = on;
  $('saveBar').classList.toggle('show', on);
}

function renderLogo() {
  const box = $('logoBox');
  box.innerHTML = logoValue
    ? `<img src="${esc(logoValue)}" alt="Restaurant logo" />`
    : `<span>${icon('image')}</span><i>no logo</i>`;
  hydrateIcons(box);
}

function fill(s) {
  saved = s;
  for (const f of FIELDS) {
    const el = $(`s_${f}`);
    if (!el) continue;
    if (BOOLS.includes(f)) el.checked = Boolean(s[f]);
    else el.value = s[f] ?? '';
  }
  logoValue = s.logo || null;
  renderLogo();
}

function collect() {
  const patch = {};
  for (const f of FIELDS) {
    const el = $(`s_${f}`);
    if (!el) continue;
    if (BOOLS.includes(f)) patch[f] = el.checked;
    else if (NUMS.includes(f)) patch[f] = Number(el.value) || 0;
    else patch[f] = el.value.trim();
  }
  patch.logo = logoValue;
  return patch;
}

async function load() {
  const res = await getSettings();
  if (res.error) {
    toast({ type: 'error', title: 'Could not load settings', message: res.error.message });
    return;
  }
  fill(res.data);
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('settings', session);
  hydrateIcons($('page'));
  reveal();

  $('setForm').addEventListener('input', () => setDirty(true));
  $('setForm').addEventListener('change', () => setDirty(true));

  $('btnLogo').addEventListener('click', () => $('logoInput').click());
  $('btnLogoClear').addEventListener('click', () => {
    logoValue = null;
    renderLogo();
    setDirty(true);
  });
  $('logoInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ type: 'warning', title: 'Logo too large', message: 'Maximum size is 2 MB.' });
      return;
    }
    toast({ type: 'info', title: 'Uploading logo…', duration: 1600 });
    const up = await uploadImage(file, 'brand-assets');
    if (up.error) return toast({ type: 'error', title: 'Upload failed', message: up.error.message });
    logoValue = up.data;
    renderLogo();
    setDirty(true);
  });

  $('btnDiscard').addEventListener('click', () => {
    fill(saved);
    setDirty(false);
    toast({ type: 'info', title: 'Changes discarded', message: 'Back to the last saved values.', duration: 2400 });
  });

  $('btnSave').addEventListener('click', async () => {
    const name = $('s_name').value.trim();
    if (!name) {
      $('s_name').focus();
      return toast({ type: 'warning', title: 'Name required', message: 'The restaurant needs a name.' });
    }
    buttonLoading($('btnSave'), true);
    const res = await updateSettings(collect());
    buttonLoading($('btnSave'), false);
    if (res.error) return toast({ type: 'error', title: 'Could not save', message: res.error.message });
    fill(res.data);
    setDirty(false);
    toast({ type: 'success', title: 'Settings saved', message: 'The website picks this up immediately.' });
  });

  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  await load();
}

init();
