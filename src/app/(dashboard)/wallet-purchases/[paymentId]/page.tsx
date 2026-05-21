'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  getWalletPurchaseDetail,
  type BarWalletPurchaseDetailDto,
} from '@/lib/api-client';

export default function WalletPurchaseDetailPage() {
  const params = useParams<{ paymentId: string }>();
  const [barId, setBarId] = useState<number | null>(null);
  const [data, setData] = useState<BarWalletPurchaseDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    const paymentId = Number(params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      setError('Invalid payment id');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setData(await getWalletPurchaseDetail(barId, paymentId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load wallet purchase');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId, params.paymentId]);

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/wallet-purchases" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
            Back to wallet purchases
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Wallet purchase detail</h1>
        </div>
        {data && <StatusBadge status={data.summary.status} />}
      </header>

      {loading && <p className="text-slate-400">Loading purchase...</p>}
      {error && (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <Metric label="Payment" value={`#${data.summary.paymentId}`} />
            <Metric label="Amount" value={formatInr(data.summary.amountInPaise)} />
            <Metric label="Volume" value={data.summary.volumeMl == null ? '-' : `${data.summary.volumeMl}ml`} />
            <Metric label="Remaining" value={data.summary.remainingVolumeMl == null ? '-' : `${data.summary.remainingVolumeMl}ml`} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <InfoPanel title="Customer">
              <InfoRow label="Name" value={data.customer.name} />
              <InfoRow label="Mobile" value={data.customer.mobileNumber || '-'} />
              <InfoRow label="Email" value={data.customer.email || '-'} />
            </InfoPanel>

            <InfoPanel title="Bottle">
              <InfoRow label="Name" value={data.bottle.name} />
              <InfoRow label="Category" value={data.bottle.category || '-'} />
              <InfoRow label="Bottle ID" value={data.bottle.bottleCatalogueId == null ? '-' : `#${data.bottle.bottleCatalogueId}`} />
            </InfoPanel>

            <InfoPanel title="Wallet">
              {data.wallet ? (
                <>
                  <InfoRow label="Wallet ID" value={`#${data.wallet.walletId}`} />
                  <InfoRow label="Status" value={data.wallet.status} />
                  <InfoRow label="Consumed" value={`${data.wallet.consumedVolumeMl}ml`} />
                  <InfoRow label="Expires" value={data.wallet.expiresOn || '-'} />
                </>
              ) : (
                <p className="text-sm text-slate-500">No wallet was created for this payment.</p>
              )}
            </InfoPanel>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Wallet ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Delta</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(tx.createdAtUtc)}</td>
                      <td className="px-4 py-3 font-medium">{tx.transactionType}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{tx.volumeMlDelta}ml</td>
                      <td className="px-4 py-3 text-right tabular-nums">{tx.balanceAfterMl}ml</td>
                      <td className="px-4 py-3 text-slate-500">{tx.notes || '-'}</td>
                    </tr>
                  ))}
                  {data.transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm italic text-slate-500">
                        No wallet ledger entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Pour history</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Request</th>
                    <th className="px-4 py-3 text-right">Requested</th>
                    <th className="px-4 py-3 text-right">Served</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Served at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.pourHistory.map((pour) => (
                    <tr key={pour.pourRequestId}>
                      <td className="px-4 py-3 font-medium">#{pour.pourRequestId}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pour.requestedMl}ml</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pour.servedMl == null ? '-' : `${pour.servedMl}ml`}</td>
                      <td className="px-4 py-3">{pour.status}</td>
                      <td className="px-4 py-3 text-slate-600">{pour.servedAtUtc ? formatDateTime(pour.servedAtUtc) : '-'}</td>
                    </tr>
                  ))}
                  {data.pourHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm italic text-slate-500">
                        No pours served from this wallet yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 font-semibold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Captured'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  return <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-bold uppercase ${cls}`}>{status}</span>;
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
