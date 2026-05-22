'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError, fetchPourRequest, type PourRequestDto } from '@/lib/api-client';
import { STAFF_NAME_KEY } from '@/lib/staff-session';

function formatBottle(brand: string | null, product: string | null): string {
  return [brand, product].filter(Boolean).join(' ').trim() || 'Bottle';
}

export default function ServeSuccessClient() {
  const params = useSearchParams();
  const pourId = Number(params.get('id') ?? params.get('pourRequestId') ?? '');

  const [row, setRow] = useState<PourRequestDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(pourId) || pourId <= 0) {
      setLoadError('Missing pour request. Return to the queue and try again.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const loaded = await fetchPourRequest(pourId);
        if (cancelled) return;
        if (loaded.status !== 'Served') {
          setLoadError('This pour has not been marked as served yet.');
          setRow(loaded);
        } else {
          setRow(loaded);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadError('Pour request not found. It may have been removed.');
        } else {
          setLoadError('Could not load serve confirmation. Check your connection.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pourId]);

  const servedBy = useMemo(() => {
    if (typeof window === 'undefined') return 'Staff';
    return window.sessionStorage.getItem(STAFF_NAME_KEY) ?? 'Staff';
  }, []);

  if (isLoading) {
    return (
      <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">
        Loading confirmation…
      </div>
    );
  }

  if (loadError && !row) {
    return (
      <div className="max-w-lg mx-auto py-8 text-center space-y-4">
        <p className="text-slate-900 font-black text-lg">Unable to load confirmation</p>
        <p className="text-sm font-semibold text-slate-500">{loadError}</p>
        <Link href="/queue" className="btn-tablet btn-tablet-p justify-center py-3 rounded-xl text-sm font-black inline-flex">
          ← Back to Queue
        </Link>
      </div>
    );
  }

  if (!row) return null;

  const customer = row.userDisplayName?.trim() || 'Guest';
  const amount = row.servedMl ?? 0;
  const bottle = formatBottle(row.bottleBrandName, row.bottleProductName);
  const balance = row.remainingMlAfterServe ?? 0;
  const tableLabel = row.barTableId != null ? `Table ${row.barTableId}` : null;
  const customerLine = tableLabel ? `${customer} · ${tableLabel}` : customer;
  const txnNote = row.walletTransactionId
    ? `WALLET_TRANSACTION #${row.walletTransactionId} logged.`
    : 'WALLET_TRANSACTION logged.';

  return (
    <div className="reveal max-w-lg mx-auto py-4">
      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {loadError}
        </div>
      )}

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[color:var(--color-success-tint)] mb-5">
          <div className="w-14 h-14 rounded-lg border-2 border-ink bg-white flex items-center justify-center text-3xl text-[color:var(--color-success)] font-black shadow-sm">
            ✓
          </div>
        </div>
        <h1 className="text-3xl font-black text-[color:var(--color-success)] tracking-tight">
          Wallet Deducted!
        </h1>
        <p className="text-sm font-semibold text-slate-500 mt-2">
          {amount}ml served to {customer}. Wallet updated in real-time.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-sm mb-5">
        <DetailRow label="Customer" value={customerLine} />
        <DetailRow label="Bottle" value={bottle} />
        <DetailRow
          label="Served"
          value={`${amount} ml ✓`}
          valueClass="text-[color:var(--color-success)] font-black"
        />
        <DetailRow label="Served by" value={servedBy} />
        <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
          <span className="font-bold text-slate-800">New Balance</span>
          <span className="text-2xl font-black text-indigo-700">{balance} ml</span>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-[color:var(--color-info)] rounded-r-xl px-4 py-3 mb-8 text-xs font-semibold text-slate-700 leading-relaxed">
        Customer&apos;s app has been updated via real-time sync. {txnNote}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/queue"
          className="btn-tablet btn-tablet-p justify-center py-4 rounded-xl font-black text-sm"
        >
          ← Back to Queue
        </Link>
        <Link
          href="/customer/lookup"
          className="btn-tablet btn-tablet-s justify-center py-4 rounded-xl font-black text-sm border border-slate-200"
        >
          Next Customer →
        </Link>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass = 'text-slate-900 font-bold',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-semibold text-slate-500 shrink-0">{label}</span>
      <span className={`text-right ${valueClass}`}>{value}</span>
    </div>
  );
}
