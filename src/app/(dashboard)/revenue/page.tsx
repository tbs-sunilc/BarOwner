'use client';

/**
 * SC-15 Revenue Analytics.
 *
 * The range picker drives a fresh fetch.  Exports stream from the server and
 * trigger a browser download through the api-client helper; the UI never
 * sees the bytes, just the click-to-save.
 */

import { useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  downloadRevenueExport,
  getRevenueReport,
  type RevenueRangePreset,
  type RevenueReportDto,
} from '@/lib/api-client';

export default function RevenuePage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [preset, setPreset] = useState<RevenueRangePreset>('ThisMonth');
  const [data, setData] = useState<RevenueReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setData(await getRevenueReport(barId, preset));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load revenue');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId, preset]);

  async function handleExport(format: 'pdf' | 'csv') {
    if (barId == null) return;
    setExporting(format);
    setError(null);
    try {
      await downloadRevenueExport(barId, format, preset);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Wallet vs walk-in performance comparison.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RevenueRangePreset)}
            className="rounded-lg border-slate-300 text-sm"
          >
            <option value="ThisMonth">This Month</option>
            <option value="LastMonth">Last Month</option>
            <option value="Last3Months">Last 3 Months</option>
          </select>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null || loading}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null || loading}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

      {loading && <p className="text-slate-400">Loading report…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {data && (
        <>
          <p className="text-xs text-slate-500 mb-4">
            {data.rangeLabel} · {data.fromDate} → {data.toDate}
          </p>

          {/* ── KPIs ───────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Tile border="border-l-indigo-500" label="Total Wallet Revenue" value={formatInr(data.kpis.totalWalletRevenueInPaise)} />
            <Tile border="border-l-teal-500" label="Avg Wallet Customer Spend" value={formatInr(data.kpis.averageWalletCustomerSpendInPaise)} />
            <Tile border="border-l-amber-500" label="Repeat Visit Rate" value={`${data.kpis.repeatVisitRatePct.toFixed(1)}%`} />
            <Tile border="border-l-emerald-500" label="Additional Food Revenue" value={formatInr(data.kpis.additionalFoodRevenueInPaise)} hint="From wallet customer visits" />
          </div>

          {/* ── Wallet vs walk-in ─────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Wallet Customers vs Walk-In</h2>
            <ComparisonChart
              walletPct={data.comparison.walletRepeatRatePct}
              walkInPct={data.comparison.walkInRepeatRatePct}
            />
            {data.comparison.insightCopy && (
              <p className="mt-4 text-sm text-slate-600 bg-emerald-50 border-l-4 border-emerald-500 px-3 py-2 rounded-md">
                {data.comparison.insightCopy}
              </p>
            )}
          </div>

          {/* ── GST summary ───────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">
                GST-Ready Revenue Summary ({data.gst.gstPercent.toFixed(0)}%)
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Revenue (excl. GST)</th>
                  <th className="px-3 py-2 text-right">GST</th>
                  <th className="px-3 py-2 text-right">Total (incl. GST)</th>
                </tr>
              </thead>
              <tbody>
                <GstRow label="Wallet Purchases" row={data.gst.walletPurchases} />
                <GstRow label="Food Orders (wallet customers)" row={data.gst.foodOrders} />
                <GstRow label="Total" row={data.gst.total} total />
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ border, label, value, hint }: { border: string; label: string; value: string; hint?: string }) {
  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${border} rounded-xl p-4 shadow-sm`}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function ComparisonChart({ walletPct, walkInPct }: { walletPct: number; walkInPct: number | null }) {
  const max = Math.max(100, walletPct, walkInPct ?? 0);
  const walletH = (walletPct / max) * 140;
  const walkInH = walkInPct == null ? 0 : (walkInPct / max) * 140;
  return (
    <div className="flex items-end gap-6 h-40 max-w-md">
      <ComparisonBar label="Wallet customers" pct={walletPct} heightPx={walletH} tone="violet" />
      {walkInPct == null ? (
        <div className="flex-1 text-center text-xs text-slate-400 self-center">
          Walk-in data requires POS integration.
        </div>
      ) : (
        <ComparisonBar label="Walk-in customers" pct={walkInPct} heightPx={walkInH} tone="slate" />
      )}
    </div>
  );
}

function ComparisonBar({ label, pct, heightPx, tone }: { label: string; pct: number; heightPx: number; tone: 'violet' | 'slate' }) {
  const bg = tone === 'violet'
    ? 'bg-gradient-to-t from-violet-700 to-violet-500'
    : 'bg-gradient-to-t from-slate-500 to-slate-300';
  const labelColor = tone === 'violet' ? 'text-violet-700' : 'text-slate-500';
  return (
    <div className="flex-1 flex flex-col items-center">
      <div
        className={`${bg} rounded-t-md w-full flex items-end justify-center pb-1`}
        style={{ height: `${Math.max(30, heightPx)}px` }}
      >
        <span className="text-white text-xs font-bold">{pct.toFixed(0)}%</span>
      </div>
      <p className={`text-xs font-semibold mt-1 ${labelColor}`}>Repeat visit</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function GstRow({ label, row, total = false }: { label: string; row: { exGstInPaise: number; gstInPaise: number; inclGstInPaise: number }; total?: boolean }) {
  const cellClass = total ? 'font-bold' : '';
  const rowClass = total ? 'bg-slate-50' : '';
  return (
    <tr className={rowClass}>
      <td className={`px-3 py-2 ${cellClass}`}>{label}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${cellClass}`}>{formatInr(row.exGstInPaise)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${cellClass}`}>{formatInr(row.gstInPaise)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${cellClass} ${total ? 'text-violet-700' : ''}`}>{formatInr(row.inclGstInPaise)}</td>
    </tr>
  );
}

function formatInr(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
