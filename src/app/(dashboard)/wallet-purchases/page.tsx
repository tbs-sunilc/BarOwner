'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  listWalletPurchases,
  type BarWalletPurchaseListItemDto,
} from '@/lib/api-client';

export default function WalletPurchasesPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [rows, setRows] = useState<BarWalletPurchaseListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setRows(await listWalletPurchases(barId, 0, 50));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load wallet purchases');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Wallet purchases</h1>
      </header>

      {loading && <p className="text-slate-400">Loading purchases...</p>}
      {error && (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="panel overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-bold text-ink">Wallet purchases</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1e1e26] text-[12px] font-bold uppercase tracking-wider text-[rgb(248_243_234_/_0.5)]">
                <tr>
                  <th className="px-6 py-4 text-left">CUSTOMER</th>
                  <th className="px-6 py-4 text-left">BOTTLE</th>
                  <th className="px-6 py-4 text-left">VOLUME</th>
                  <th className="px-6 py-4 text-right">AMOUNT</th>
                  <th className="px-6 py-4 text-left">METHOD</th>
                  <th className="px-6 py-4 text-left">CAPTURED</th>
                  <th className="px-6 py-4 text-left">STATUS</th>
                  <th className="px-6 py-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-900/10 bg-white">
                {rows.map((row) => (
                  <tr key={row.paymentId} className="hover:bg-white/5 transition-colors border-b border-orange-900/10">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{row.customerName}</p>
                      <p className="text-[11px] text-slate-500">{row.customerMobile || 'No mobile'}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.bottleName}</td>
                    <td className="px-6 py-4 text-slate-600">{row.volumeMl == null ? '-' : `${row.volumeMl}ml`}</td>
                    <td className="px-6 py-4 text-right font-bold tabular-nums text-slate-900">
                      {formatInr(row.amountInPaise)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.paymentMethod || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{row.capturedAtUtc ? formatDateTime(row.capturedAtUtc) : '-'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link href={`/wallet-purchases/${row.paymentId}`} className="btn btn-sm btn-secondary bg-white border-border text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm italic text-slate-500">
                      No wallet purchases found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Captured'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'Consumed'
      ? 'bg-slate-100 text-slate-700 border-slate-200'
      : status === 'Payment Pending'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${cls}`}>{status}</span>;
}

function formatInr(paise: number): string {
  return 'Rs ' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
