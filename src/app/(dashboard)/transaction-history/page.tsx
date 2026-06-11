'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ApiError,
  listTransactionHistory,
  type WalletTransactionHistoryItemDto,
} from '@/lib/api-client';

type HistoryFilter = 'all' | 'pending' | 'captured' | 'failed' | 'refunded' | 'partially-refunded';

const FILTERS: ReadonlyArray<{ label: string; value: HistoryFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Captured', value: 'captured' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Partial refund', value: 'partially-refunded' },
];

export default function TransactionHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [rows, setRows] = useState<WalletTransactionHistoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const status = statusFilter === 'all' ? null : statusFilter;
        const items = await listTransactionHistory(status, 0, 50);
        if (!cancelled) setRows(items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load transaction history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Payments</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Transaction history</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Review wallet top-ups and purchases made by the authenticated user, with live payment status from Razorpay.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
          }}
          className="btn btn-secondary self-start sm:self-auto"
        >
          Reset filter
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100',
                ].join(' ')}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading transactions...
        </div>
      )}

      {error && !loading && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {rows.length} transaction{rows.length === 1 ? '' : 's'}
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Filter: {FILTERS.find((filter) => filter.value === statusFilter)?.label}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
              <p className="text-lg font-semibold text-slate-900">No transactions found</p>
              <p className="mt-2 text-sm text-slate-500">
                Try a different status filter or check back after the next captured payment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => (
                <article
                  key={row.paymentId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex gap-4">
                    <TransactionGlyph row={row} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-semibold text-slate-900">
                              {row.displayTitle}
                            </h2>
                            <StatusBadge status={row.status} label={row.statusLabel} />
                          </div>

                          <p className="mt-1 text-sm font-medium text-slate-600">
                            {row.barName}
                          </p>
                          <p className="text-sm text-slate-500">
                            {row.barCity}
                            {row.paymentMethod ? ` - ${row.paymentMethod}` : ''}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            {formatDateTime(row.occurredAtUtc)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            {formatAmount(row.amountInPaise)}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {row.currency}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p>{row.statusMessage || fallbackMessage(row)}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <MetaPill>Payment #{row.paymentId}</MetaPill>
                          {row.walletId != null && <MetaPill>Wallet #{row.walletId}</MetaPill>}
                          {row.bottleBrandName || row.bottleProductName ? (
                            <MetaPill>
                              {formatBottleName(row.bottleBrandName, row.bottleProductName)}
                            </MetaPill>
                          ) : null}
                          {row.volumeMl != null && <MetaPill>{row.volumeMl} ml</MetaPill>}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string | null }) {
  const tone =
    status === 'Captured'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'Created'
        ? 'bg-amber-100 text-amber-800'
        : status === 'Failed'
          ? 'bg-rose-100 text-rose-800'
          : status === 'Refunded'
            ? 'bg-slate-100 text-slate-700'
            : 'bg-orange-100 text-orange-800';

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone}`}>
      {label || status}
    </span>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600">
      {children}
    </span>
  );
}

function TransactionGlyph({ row }: { row: WalletTransactionHistoryItemDto }) {
  const isFailed = row.status === 'Failed';
  const isRefunded = row.status === 'Refunded' || row.status === 'PartiallyRefunded';
  const isTopUp = row.purpose === 'WalletTopup';
  const isPurchase = row.purpose === 'WalletPurchase';

  const wrapperTone = isFailed
    ? 'bg-rose-50 text-rose-600'
    : isRefunded
      ? 'bg-slate-100 text-slate-600'
      : isTopUp
        ? 'bg-emerald-50 text-emerald-600'
        : isPurchase
          ? 'bg-violet-50 text-violet-600'
          : 'bg-slate-100 text-slate-600';

  return (
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${wrapperTone}`}>
      <TransactionIcon row={row} />
    </div>
  );
}

function TransactionIcon({ row }: { row: WalletTransactionHistoryItemDto }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (row.status === 'Failed') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-6 6" />
        <path d="M9 9l6 6" />
      </svg>
    );
  }

  if (row.status === 'Refunded' || row.status === 'PartiallyRefunded') {
    return (
      <svg {...common}>
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h6" />
        <path d="M11 5 7 7l4 2" />
      </svg>
    );
  }

  if (row.purpose === 'WalletTopup') {
    return (
      <svg {...common}>
        <rect x="4" y="6" width="16" height="12" rx="2" />
        <path d="M4 10h16" />
        <path d="M12 13v4" />
        <path d="M10 15h4" />
      </svg>
    );
  }

  if (row.purpose === 'WalletPurchase') {
    return (
      <svg {...common}>
        <path d="M7 9h10l-1 11H8L7 9Z" />
        <path d="M9 9a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 7h16v10H4z" />
      <path d="M4 11h16" />
    </svg>
  );
}

function formatAmount(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatBottleName(brandName: string | null, productName: string | null): string {
  return [brandName, productName].filter(Boolean).join(' ').trim() || 'Bottle';
}

function fallbackMessage(row: WalletTransactionHistoryItemDto): string {
  if (row.status === 'Created') return 'Payment pending';
  if (row.status === 'Failed') return 'Payment failed before capture';
  if (row.status === 'Refunded') return 'Refund issued to the original payment method';
  if (row.status === 'PartiallyRefunded') return 'Part of this payment was refunded';
  return 'Transaction recorded successfully';
}
