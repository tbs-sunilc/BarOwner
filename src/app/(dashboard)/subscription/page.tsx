'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  cancelSubscription,
  changeSubscriptionPlan,
  getDashboard,
  getSubscriptionPlans,
  getSubscriptionStatus,
  type BarSubscriptionStatusDto,
  type SubscriptionPlanDto,
} from '@/lib/api-client';
import { CancelSubscriptionModal } from '@/components/modals/CancelSubscriptionModal';
import { ChangeSubscriptionPlanModal } from '@/components/modals/ChangeSubscriptionPlanModal';

export default function SubscriptionPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<BarSubscriptionStatusDto | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [activeWallets, setActiveWallets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changePlanBusy, setChangePlanBusy] = useState(false);
  const [changePlanError, setChangePlanError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const resolvedBarId = getActiveBarId();
    setBarId(resolvedBarId);

    if (resolvedBarId === null) {
      setLoading(false);
      setError('No active bar selected. Please log in again.');
    }
  }, []);

  const loadSubscription = useCallback(async (activeBarId: number) => {
    setLoading(true);
    setError(null);

    try {
      const [dashboard, subscriptionResult, planList] = await Promise.all([
        getDashboard(activeBarId),
        getSubscriptionStatus(activeBarId).catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
        getSubscriptionPlans(),
      ]);

      setSubscription(subscriptionResult);
      setPlans(planList);
      setActiveWallets(dashboard.kpis.activeWalletCount);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (barId == null) return;
    void loadSubscription(barId);
  }, [barId, loadSubscription]);

  const currentPlan = subscription
    ? plans.find((plan) => plan.id === subscription.subscriptionPlanId) ?? null
    : null;
  const billingCycle = subscription?.billingCycle === 'Annual' ? 'Annual' : 'Monthly';
  const currentPlanLabel = currentPlan?.badge || currentPlan?.tier || subscription?.planName || 'Current plan';

  async function handleChangePlan(plan: SubscriptionPlanDto) {
    if (!barId || !subscription || changePlanBusy) return;

    setChangePlanBusy(true);
    setChangePlanError(null);

    try {
      const updated = await changeSubscriptionPlan(barId, {
        planCode: plan.code ?? plan.name.toUpperCase(),
        billingCycle: subscription.billingCycle === 'Annual' ? 'Annual' : 'Monthly',
      });

      setSubscription(updated);
      setShowChangePlan(false);
    } catch (err) {
      setChangePlanError(err instanceof ApiError ? err.message : 'Failed to change plan');
    } finally {
      setChangePlanBusy(false);
    }
  }

  async function handleCancelSubscription(reason?: string, detail?: string) {
    if (!barId || !subscription || cancelBusy) return;

    setCancelBusy(true);
    setCancelError(null);

    try {
      const updated = await cancelSubscription(barId, {
        reason: reason?.trim() || 'Other',
        detail: detail?.trim() || undefined,
      });

      setSubscription(updated);
      setShowCancel(false);
      setShowChangePlan(false);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="max-w-4xl p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your active plan, switch to another plan, and keep an eye on payment health.
        </p>
      </header>

      {subscription?.isFailing && (
        <div className="mb-5 rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Payment failed</p>
          <p className="mt-1 text-sm text-amber-800">
            {subscription.lastFailureReason ? `Reason: ${subscription.lastFailureReason}. ` : ''}
            {typeof subscription.daysUntilDelisted === 'number' &&
              `Your bar will be de-listed in ${subscription.daysUntilDelisted} day${subscription.daysUntilDelisted === 1 ? '' : 's'} if not resolved.`}
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Update payment method
          </button>
        </div>
      )}

      {loading && <p className="text-slate-400">Loading subscription...</p>}

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Current plan</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {subscription ? subscription.planName : 'No active plan'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {subscription ? (
                    <>
                      Status: <StatusBadge status={subscription.status} />
                    </>
                  ) : (
                    'Pick a plan to activate your bar subscription.'
                  )}
                </p>
                {subscription && !subscription.autoRenew && subscription.status !== 'Cancelled' && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Cancellation scheduled. Access continues until{' '}
                    {formatDateTime(subscription.currentPeriodEnd)}.
                  </p>
                )}
                {subscription?.gracePeriodEndsAtUtc && (
                  <p className="mt-1 text-xs text-amber-700">
                    Grace period ends {formatDateTime(subscription.gracePeriodEndsAtUtc)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {subscription ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChangePlanError(null);
                      setShowChangePlan(true);
                    }}
                    disabled={plans.length === 0}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
                  >
                    Change plan
                  </button>
                ) : (
                  <Link
                    href="/register/subscription"
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Choose plan
                  </Link>
                )}

                {subscription && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelError(null);
                      setShowCancel(true);
                    }}
                    className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Cancel plan
                  </button>
                )}
              </div>
            </div>

            {subscription && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailTile label="Plan label" value={currentPlanLabel} />
                <DetailTile
                  label="Billing cycle"
                  value={subscription.billingCycle}
                  subtext={subscription.priceInRupees > 0 ? formatRupees(subscription.priceInRupees) : 'Free'}
                />
                <DetailTile
                  label="Next billing"
                  value={subscription.nextBillingAtUtc ? formatDateTime(subscription.nextBillingAtUtc) : 'Not set'}
                />
                <DetailTile
                  label="Trial ends"
                  value={subscription.trialEndsAtUtc ? formatDateTime(subscription.trialEndsAtUtc) : 'Not available'}
                />
              </div>
            )}
          </section>

          {!subscription && (
            <section className="mb-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <h2 className="text-lg font-semibold text-slate-900">No active subscription</h2>
              <p className="mt-2 text-sm text-slate-500">
                You can start a plan from the registration flow and return here to manage it later.
              </p>
              <Link
                href="/register/subscription"
                className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Choose a plan
              </Link>
            </section>
          )}

          <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Billing history</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {subscription?.lastFailureReason && (
                  <tr className="bg-rose-50 text-rose-900">
                    <td className="px-3 py-2 tabular-nums">Most recent</td>
                    <td className="px-3 py-2">INV-PENDING</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-rose-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-900">
                        Failed
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">-</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                    Detailed billing history lands with Phase 8 (subscription management).
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}

      {showChangePlan && subscription && (
        <ChangeSubscriptionPlanModal
          plans={plans}
          billingCycle={billingCycle}
          currentPlanId={subscription.subscriptionPlanId}
          busy={changePlanBusy}
          error={changePlanError}
          onCancel={() => {
            if (changePlanBusy) return;
            setShowChangePlan(false);
            setChangePlanError(null);
          }}
          onSelectPlan={(plan) => {
            void handleChangePlan(plan);
          }}
        />
      )}

      {showCancel && subscription && (
        <CancelSubscriptionModal
          activeWalletCount={activeWallets}
          busy={cancelBusy}
          error={cancelError}
          onCancel={() => {
            if (cancelBusy) return;
            setShowCancel(false);
            setCancelError(null);
          }}
          onConfirm={(reason, detail) => {
            void handleCancelSubscription(reason, detail);
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'Active'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'Trial'
        ? 'bg-violet-100 text-violet-800'
        : status === 'GracePeriod' || status === 'PastDue'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-200 text-slate-700';

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}

function DetailTile({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}

function formatRupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN');
}
