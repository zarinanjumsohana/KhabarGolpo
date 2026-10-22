// js/pages/tables.js — tables, QR codes and printable QR sheets.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listTables, createTable, updateTable, deleteTable } from '../api/adminContent.js';
import { tableLink, qrUrl } from '../utils/qr.js';
import { printArea } from '../utils/receipt.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { openModal, confirmDialog, toast, emptyState, esc, buttonLoading, stagger, reveal } from '../utils/ui.js';

const $ = (id) => document.getElementById(id);

let tables = [];

function render() {
  const host = $('tableGrid');
  if (!tables.length) {
    host.innerHTML = emptyState({ icon: 'table', title: 'No tables yet', hint: 'Add your first table to generate its QR code.' });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = tables
    .map(
      (t) => `
    <article class="t-card ${t.is_active ? '' : 'off'}" data-table="${t.id}">
      <span class="t-no">${t.table_number}</span>
      <span class="t-seats">${icon('user')} ${t.seats} seats</span>
      <span class="t-status"><span class="badge ${t.is_active ? 'st-ready' : 'st-cancelled'} plain">${t.is_active ? 'Active' : 'Deactivated'}</span></span>
      <div class="t-actions">
        <button class="btn btn-dark btn-xs" data-qr="${t.id}">${icon('qr')}<span>QR code</span></button>
        <button class="btn btn-ghost btn-xs" data-print="${t.id}">${icon('printer')}<span>Print</span></button>
        <button class="btn btn-ghost btn-xs" data-toggle="${t.id}">${icon(t.is_active ? 'pause' : 'play')}<span>${t.is_active ? 'Deactivate' : 'Activate'}</span></button>
      </div>
    </article>`
    )
    .join('');
  hydrateIcons(host);
  stagger(host, 50);
}

function qrCells(list) {
  return list
    .map(
      (t) => `
    <div class="qr-cell">
      <img src="${qrUrl(tableLink(t.table_number), 360)}" alt="QR code for table ${t.table_number}" />
      <div class="qr-table">Table ${t.table_number}</div>
      <div class="qr-link">Scan to view the menu &amp; order</div>
    </div>`
    )
    .join('');
}

function printQRs(list) {
  if (!list.length) {
    toast({ type: 'warning', title: 'Nothing to print', message: 'There are no active tables yet.' });
    return;
  }
  const sheet = $('qrSheet');
  sheet.innerHTML = `<div class="qr-grid">${qrCells(list)}</div>`;
  sheet.classList.add('print-area');
  printArea(sheet);
  setTimeout(() => sheet.classList.remove('print-area'), 1500);
}

function qrModal(t) {
  openModal({
    title: `Table ${t.table_number} QR code`,
    content: `
      <div style="text-align:center;display:grid;gap:14px;place-items:center">
        <div style="background:#fff;border:1px dashed var(--line);border-radius:18px;padding:20px">
          <img src="${qrUrl(tableLink(t.table_number), 360)}" alt="QR code for table ${t.table_number}" style="width:230px;height:230px;margin:0 auto" />
        </div>
        <p class="small muted" style="word-break:break-all;max-width:340px">${esc(tableLink(t.table_number))}</p>
      </div>`,
    actions: [
      { label: 'Close', className: 'btn-ghost', value: null },
      { label: 'Copy link', className: 'btn-soft', icon: 'copy', value: 'copy' },
      { label: 'Print this QR', className: 'btn-primary', icon: 'printer', value: 'print' },
    ],
  }).result.then((val) => {
    if (val === 'copy') {
      navigator.clipboard
        ?.writeText(tableLink(t.table_number))
        .then(() => toast({ type: 'success', title: 'Link copied', message: tableLink(t.table_number) }))
        .catch(() => toast({ type: 'warning', title: 'Could not copy' }));
    }
    if (val === 'print') setTimeout(() => printQRs([t]), 260);
  });
}

function addTableModal() {
  openModal({
    title: 'Add a table',
    content: `
      <div class="field-row">
        <div class="field" id="fTNo">
          <label for="tNo">Table number</label>
          <input id="tNo" type="number" min="1" placeholder="${nextNumber()}" />
          <span class="err"></span>
        </div>
        <div class="field">
          <label for="tSeats">Seats</label>
          <input id="tSeats" type="number" min="1" value="4" />
        </div>
      </div>
      <p class="hint" style="margin-top:12px">A QR code is generated automatically once the table exists.</p>`,
    actions: [
      { label: 'Cancel', className: 'btn-ghost', value: null },
      {
        label: 'Create table',
        className: 'btn-primary',
        value: 'save',
        onClick: async ({ btn }) => {
          const f = $('fTNo');
          const n = Number($('tNo').value);
          f.classList.remove('has-error');
          if (!n) {
            f.classList.add('has-error');
            f.querySelector('.err').textContent = 'Enter a table number.';
            return false;
          }
          buttonLoading(btn, true);
          const res = await createTable({ table_number: n, seats: Number($('tSeats').value) || 4 });
          buttonLoading(btn, false);
          if (res.error) {
            f.classList.add('has-error');
            f.querySelector('.err').textContent = res.error.message;
            return false;
          }
          return true;
        },
      },
    ],
  }).result.then((val) => {
    if (val === 'save') {
      toast({ type: 'success', title: 'Table added', message: 'Its QR code is ready to print.' });
      load();
    }
  });
}

function nextNumber() {
  return tables.reduce((a, t) => Math.max(a, t.table_number), 0) + 1;
}

async function load() {
  const res = await listTables();
  if (res.error) {
    toast({ type: 'error', title: 'Could not load tables', message: res.error.message });
    return;
  }
  tables = res.data;
  render();
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('tables', session);
  hydrateIcons($('page'));
  reveal();
  await load();

  $('btnAddTable').addEventListener('click', addTableModal);
  $('btnPrintAll').addEventListener('click', () => printQRs(tables.filter((t) => t.is_active)));

  $('tableGrid').addEventListener('click', async (e) => {
    const qr = e.target.closest('[data-qr]');
    if (qr) return qrModal(tables.find((t) => t.id === qr.dataset.qr));

    const print = e.target.closest('[data-print]');
    if (print) return printQRs([tables.find((t) => t.id === print.dataset.print)]);

    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      const t = tables.find((x) => x.id === tog.dataset.toggle);
      const res = await updateTable(t.id, { is_active: !t.is_active });
      if (res.error) return toast({ type: 'error', title: 'Could not update', message: res.error.message });
      toast({
        type: 'success',
        title: t.is_active ? `Table ${t.table_number} deactivated` : `Table ${t.table_number} activated`,
        message: t.is_active ? 'Customers can no longer order from it.' : 'The QR code works again.',
      });
      load();
    }
  });
}

init();
