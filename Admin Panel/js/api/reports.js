// js/api/reports.js — revenue + sales reporting.
// revenue_summary is a live RPC. The full sales report is assembled in the
// browser from the orders table so the page works no matter which version of
// the sales_report RPC a database was set up with.

import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { fromSupabase, withMock, ok, fail } from './shared.js';
import { listOrders } from './adminOrders.js';

export const revenueSummary = () =>
  withMock(
    () => Mock.reports.revenueSummary(),
    async () => {
      const res = await supabase().then((c) => c.rpc('revenue_summary'));
      return fromSupabase(res, { code: 'SUMMARY_FAILED' });
    }
  );

const MODES = {
  daily: 'day',
  day: 'day',
  weekly: 'week',
  week: 'week',
  monthly: 'month',
  month: 'month',
  yearly: 'year',
  year: 'year',
};

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function bucketKey(date, mode) {
  if (mode === 'year') return String(date.getFullYear());
  if (mode === 'month') return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  if (mode === 'week') {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = (d.getDay() + 6) % 7; // Monday is the first day of the week
    d.setDate(d.getDate() - dow);
    return dayKey(d);
  }
  return dayKey(date);
}

function labelOf(key, mode) {
  if (mode === 'year') return key;
  if (mode === 'month') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Sensible default date window for a grouping — also used to prefill the inputs. */
export function reportRange(group = 'daily') {
  const mode = MODES[group] || 'day';
  const to = new Date();
  const from = new Date();
  if (mode === 'year') {
    from.setFullYear(from.getFullYear() - 4, 0, 1);
  } else if (mode === 'month') {
    from.setMonth(from.getMonth() - 11, 1);
  } else if (mode === 'week') {
    from.setDate(from.getDate() - 7 * 11);
  } else {
    from.setDate(from.getDate() - 13);
  }
  return { from: dayKey(from), to: dayKey(to) };
}

/** Shape raw orders into the structure the reports page renders. */
export function buildSalesReport(orders = [], params = {}) {
  const mode = MODES[params.group] || 'day';
  const fallback = reportRange(params.group);
  const from = params.from || fallback.from;
  const to = params.to || fallback.to;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);

  const inRange = orders.filter((o) => {
    const at = new Date(o.created_at);
    return at >= start && at <= end && o.status !== 'cancelled';
  });
  // Money is only "earned" once an order is paid or completed.
  const realized = (o) => o.payment_status === 'paid' || o.status === 'completed';
  const paid = inRange.filter(realized);

  const buckets = new Map();
  inRange.forEach((o) => {
    const key = bucketKey(new Date(o.created_at), mode);
    if (!buckets.has(key)) buckets.set(key, { key, label: labelOf(key, mode), orders: 0, revenue: 0, delivery_fees: 0, tax: 0 });
    buckets.get(key).orders += 1;
  });
  paid.forEach((o) => {
    const b = buckets.get(bucketKey(new Date(o.created_at), mode));
    if (!b) return;
    b.revenue += Number(o.total) || 0;
    b.delivery_fees += Number(o.delivery_fee) || 0;
    b.tax += Number(o.tax) || 0;
  });

  const rows = [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({ ...r, revenue: Math.round(r.revenue), delivery_fees: Math.round(r.delivery_fees), tax: Math.round(r.tax) }));

  const tally = new Map();
  paid.forEach((o) =>
    (o.items || []).forEach((it) => {
      const name = it.name || 'Item';
      const entry = tally.get(name) || { name, qty: 0, revenue: 0 };
      entry.qty += Number(it.qty) || 0;
      entry.revenue += Number(it.line_total) || 0;
      tally.set(name, entry);
    })
  );
  const topItems = [...tally.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

  const byType = { dine_in: 0, pickup: 0, delivery: 0 };
  paid.forEach((o) => {
    const key = o.order_type === 'dine-in' ? 'dine_in' : o.order_type;
    if (byType[key] == null) byType[key] = 0;
    byType[key] += Number(o.total) || 0;
  });

  const revenue = paid.reduce((a, o) => a + (Number(o.total) || 0), 0);
  const deliveryFees = paid.reduce((a, o) => a + (Number(o.delivery_fee) || 0), 0);

  return {
    group: params.group || 'daily',
    from,
    to,
    rows,
    chart: rows.map((r) => ({ label: r.label, value: r.revenue })),
    topItems,
    byType,
    delivery_fee_total: Math.round(deliveryFees),
    totals: {
      orders: inRange.length,
      paid_orders: paid.length,
      revenue: Math.round(revenue),
      delivery_fees: Math.round(deliveryFees),
      tax: Math.round(paid.reduce((a, o) => a + (Number(o.tax) || 0), 0)),
      avg_ticket: paid.length ? Math.round(revenue / paid.length) : 0,
    },
  };
}

export const salesReport = (params = {}) =>
  withMock(
    () => Mock.reports.salesReport(params),
    async () => {
      const res = await listOrders({
        page: 1,
        perPage: 1000,
        from: params.from || undefined,
        to: params.to || undefined,
      });
      if (res.error) return fail('REPORT_FAILED', res.error.message);
      return ok(buildSalesReport(res.data.rows || [], params));
    }
  );

export const topItems = (limit = 8) =>
  withMock(
    () => Mock.reports.topItems(limit),
    async () => fromSupabase(await supabase().then((c) => c.rpc('top_items', { p_limit: limit })), { code: 'TOP_ITEMS_FAILED' })
  );

export const salesByType = (params = {}) =>
  withMock(
    () => Mock.reports.salesByType(params),
    async () =>
      fromSupabase(
        await supabase().then((c) =>
          c.rpc('sales_by_type', { p_from: params.from || null, p_to: params.to || null })
        ),
        { code: 'BY_TYPE_FAILED' }
      )
  );
