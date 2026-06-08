'use client';

/**
 * SC-18 Subscription Management.
 *
 * Source of truth for the current-plan card + status banner is the
 * dashboard payload (it already carries a subscription block).  The
 * billing-history table runs off a future Phase 8 endpoint; we render a
 * "coming soon" placeholder until it lands so the layout matches the
 * prototype.
 */

import { useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  getDashboard,
  type SubscriptionStatusDto,
} from '@/lib/api-client';
import { CancelSubscriptionModal } from '@/components/modals/CancelSubscriptionModal';

export default function SubscriptionPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [sub, setSub] = useState<SubscriptionStatusDto | null>(null);
  const [activeWallets, setActiveWallets] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        const dash = await getDashboard(barId);
        setSub(dash.subscription);
        setActiveWallets(dash.kpis.activeWalletCount);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load subscription');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your SipSave platform plan, billing history and payment method.
        </p>
      </header>

      {sub?.isFailing && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-lg">
          <p className="font-semibold text-amber-900">⚠️ Payment failed</p>
          <p className="text-sm text-amber-800 mt-1">
            {sub.lastFailureReason ? `Reason: ${sub.lastFailureReason}. ` : ''}
            {typeof sub.daysUntilDelisted === 'number' &&
              `Your bar will be de-listed in ${sub.daysUntilDelisted} day${sub.daysUntilDelisted === 1 ? '' : 's'} if not resolved.`}
          </p>
          <button className="mt-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-3 py-2 rounded-lg">
            Update payment method
          </button>
        </div>
      )}

      {loading && <p className="text-slate-400">Loading subscription…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      {!loading && (
        <>
          <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Current plan</p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {sub ? 'Growth' : 'No active plan'}
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  {sub ? (
                    <>Status: <StatusBadge status={sub.status} /></>
                  ) : (
                    'Sign up for a plan to unlock the bartender tablet, loyalty, and campaigns.'
                  )}
                </p>
                {sub?.gracePeriodEndsAtUtc && (
                  <p className="text-xs text-amber-700 mt-1">
                    Grace period ends {new Date(sub.gracePeriodEndsAtUtc).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                  disabled
                  title="Available in Phase 8"
                >
                  Change plan
                </button>
                {sub && (
                  <button
                    onClick={() => setShowCancel(true)}
                    className="text-sm font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg"
                  >
                    Cancel plan
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Billing history</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sub?.lastFailureReason && (
                  <tr className="bg-rose-50 text-rose-900">
                    <td className="px-3 py-2 tabular-nums">Most recent</td>
                    <td className="px-3 py-2">INV-PENDING</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                        Failed
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">—</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500 text-sm">
                    Detailed billing history lands with Phase 8 (subscription management).
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}

      {showCancel && (
        <CancelSubscriptionModal
          activeWalletCount={activeWallets}
          onCancel={() => setShowCancel(false)}
          onConfirm={() => {
            setShowCancel(false);
            // Phase 8: POST /api/v1/bars/:barId/subscription/cancel
            alert('Cancel-subscription endpoint lands in Phase 8.');
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'Active' ? 'bg-emerald-100 text-emerald-800'
    : status === 'Trial' ? 'bg-violet-100 text-violet-800'
    : status === 'GracePeriod' || status === 'PastDue' ? 'bg-amber-100 text-amber-800'
    : 'bg-slate-200 text-slate-700';
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}>
      {status}
    </span>
  );
}
