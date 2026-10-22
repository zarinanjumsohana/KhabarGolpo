// js/api/reports.js — revenue + sales reporting (computed in Postgres RPCs).

import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { fromSupabase, withMock } from './shared.js';

export const revenueSummary = () =>
  withMock(
    () => Mock.reports.revenueSummary(),
    async () => {
      const res = await supabase().then((c) => c.rpc('revenue_summary'));
      return fromSupabase(res, { code: 'SUMMARY_FAILED' });
    }
  );

export const salesReport = (params = {}) =>
  withMock(
    () => Mock.reports.salesReport(params),
    async () => {
      const res = await supabase().then((c) =>
        c.rpc('sales_report', {
          p_group: params.group || 'daily',
          p_from: params.from || null,
          p_to: params.to || null,
        })
      );
      return fromSupabase(res, { code: 'REPORT_FAILED' });
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
