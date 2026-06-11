'use client';

/**
 * SC-13 Offers list.
 *
 * Tabs partition the full offer list on the client: an offer is "Active" when
 * it's flagged IsActive AND today ∈ [startsOn, endsOn]; everything else is
 * "Expired/Paused".  Driving the tabs off a single fetch (includeInactive=true)
 * keeps the switch snappy and avoids a second round-trip.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  listOffers,
  setOfferActive,
  deleteOffer,
  type OfferDto,
} from '@/lib/api-client';

type Tab = 'active' | 'expired';

export default function OffersPage() {
  const [barId, setBarId]         = useState<number | null>(null);
  const [rows, setRows]           = useState<OfferDto[]>([]);
  const [tab, setTab]             = useState<Tab>('active');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null); // confirm-pending
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toast, setToast]           = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        setError(null);
        setRows(await listOffers(barId, /* includeInactive */ true));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load offers');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  const today = new Date().toISOString().slice(0, 10);
  const { active, expired } = useMemo(() => {
    const a: OfferDto[] = [];
    const e: OfferDto[] = [];
    for (const o of rows) {
      if (o.isActive && o.startsOn <= today && o.endsOn >= today) a.push(o);
      else e.push(o);
    }
    return { active: a, expired: e };
  }, [rows, today]);

  const list = tab === 'active' ? active : expired;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleToggle(offer: OfferDto) {
    setTogglingId(offer.id);
    try {
      const updated = await setOfferActive(offer.id, !offer.isActive);
      setRows((prev) => prev.map((r) => (r.id === offer.id ? updated : r)));
      showToast(updated.isActive ? 'Offer activated.' : 'Offer paused.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update offer');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteOffer(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeletingId(null);
      showToast('Offer deleted.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete offer');
      setDeletingId(null);
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Success toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <span>✓</span> {toast}
        </div>
      )}

      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Happy Hours, brand promos, flash prices and referral rewards for this bar.
          </p>
        </div>
        <Link
          href="/offers/create"
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          + New offer
        </Link>
      </header>

      <div className="border-b border-slate-200 mb-6 flex gap-6 text-sm">
        <TabButton label={`Active (${active.length})`}         on={tab === 'active'}  onClick={() => setTab('active')} />
        <TabButton label={`Expired / Paused (${expired.length})`} on={tab === 'expired'} onClick={() => setTab('expired')} />
      </div>

      {loading && <p className="text-slate-400">Loading offers…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
          {tab === 'active' ? 'No live offers yet — create one to surface it to users.' : 'No expired or paused offers.'}
        </div>
      )}

      <ul className="grid gap-3">
        {list.map((o) => (
          <li key={o.id} className="bg-white border border-slate-200 rounded-xl p-5 transition hover:shadow-sm">
            <div className="flex items-start justify-between gap-4">
              {/* Left — offer info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={o.offerType} />
                  <h3 className="font-semibold text-slate-900 truncate">{o.title}</h3>
                </div>
                {o.description && (
                  <p className="text-sm text-slate-600 mb-2">{o.description}</p>
                )}
                <p className="text-xs text-slate-500">
                  {formatDiscount(o)} · {o.startsOn} → {o.endsOn}
                  {o.recurringStartTime && o.recurringEndTime &&
                    ` · ${o.recurringStartTime.slice(0, 5)}–${o.recurringEndTime.slice(0, 5)}`}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {o.redemptionCount} redemptions
                  {o.maxRedemptionsTotal ? ` of ${o.maxRedemptionsTotal}` : ''}
                </p>
              </div>

              {/* Right — action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Pause / Activate */}
                <button
                  onClick={() => handleToggle(o)}
                  disabled={togglingId === o.id}
                  className={[
                    'text-xs font-semibold px-3 py-1.5 rounded-md border transition',
                    o.isActive
                      ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
                      : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
                    togglingId === o.id ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {togglingId === o.id ? '…' : o.isActive ? 'Pause' : 'Activate'}
                </button>

                {/* Edit */}
                <Link
                  href={`/offers/edit/${o.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition"
                >
                  Edit
                </Link>

                {/* Delete — shows inline confirmation */}
                {deletingId === o.id ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-md px-2 py-1">
                    <span className="text-xs text-rose-700 font-medium">Delete?</span>
                    <button
                      onClick={() => handleDelete(o.id)}
                      className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-1 transition"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(o.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'pb-3 -mb-px border-b-2 transition font-medium',
        on ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function TypeBadge({ type }: { type: OfferDto['offerType'] }) {
  const tone =
    type === 'HappyHour'  ? 'bg-amber-100 text-amber-800' :
    type === 'BrandPromo' ? 'bg-violet-100 text-violet-800' :
    type === 'FlashPrice' ? 'bg-rose-100 text-rose-800' :
    'bg-slate-100 text-slate-700';
  return <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${tone}`}>{type}</span>;
}

function formatDiscount(o: OfferDto): string {
  if (o.discountType === 'Percent' && o.discountPercent != null) {
    const cap = o.maxDiscountAmountInPaise ? ` (up to ₹${o.maxDiscountAmountInPaise / 100})` : '';
    return `${o.discountPercent}% off${cap}`;
  }
  if (o.discountType === 'FlatAmount' && o.discountAmountInPaise != null) {
    return `₹${o.discountAmountInPaise / 100} off`;
  }
  if (o.discountType === 'BuyXGetY' && o.buyQuantity && o.getQuantity) {
    return `Buy ${o.buyQuantity} get ${o.getQuantity}`;
  }
  return o.discountType;
}
