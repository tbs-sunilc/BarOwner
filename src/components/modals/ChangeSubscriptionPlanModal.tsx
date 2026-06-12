'use client';

import { useEffect, type ReactNode } from 'react';
import { type SubscriptionPlanDto } from '@/lib/api-client';

type Props = {
  plans: SubscriptionPlanDto[];
  billingCycle: 'Monthly' | 'Annual';
  currentPlanId: number | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSelectPlan: (plan: SubscriptionPlanDto) => void;
};

export function ChangeSubscriptionPlanModal({
  plans,
  billingCycle,
  currentPlanId,
  busy = false,
  error,
  onCancel,
  onSelectPlan,
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  const eligiblePlans = plans.filter((plan) => {
    const price = getPlanPrice(plan, billingCycle);
    return price > 0 || plan.id === currentPlanId;
  });

  return (
    <Backdrop onDismiss={busy ? undefined : onCancel}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
              Subscription change
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Change plan</h3>
            <p className="mt-1 text-sm text-slate-500">
              Pick a new plan for the current {billingCycle.toLowerCase()} billing cycle.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-2 py-1 text-xl leading-none text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            x
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {eligiblePlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No plans are available for the current billing cycle.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {eligiblePlans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const price = getPlanPrice(plan, billingCycle);
                const unavailable = isPlanDisabled(plan, billingCycle) && !isCurrent;
                const features = buildPlanHighlights(plan);

                return (
                  <article
                    key={plan.id}
                    className={`rounded-2xl border p-4 shadow-sm transition ${
                      isCurrent
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {plan.badge || plan.tier || 'Plan'}
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-slate-900">{plan.name}</h4>
                      </div>
                      {isCurrent && (
                        <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-3xl font-bold text-slate-900">{formatRupees(price)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {billingCycle === 'Annual' ? 'Per year' : 'Per month'}
                      </p>
                      {unavailable && (
                        <p className="mt-2 text-xs font-semibold text-rose-600">
                          Not available for the current billing cycle
                        </p>
                      )}
                    </div>

                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      {features.length > 0 ? (
                        features.map((feature) => (
                          <li key={feature} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
                            <span>{feature}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-500">No extra feature summary available.</li>
                      )}
                    </ul>

                    <button
                      type="button"
                      onClick={() => onSelectPlan(plan)}
                      disabled={busy || isCurrent || unavailable}
                      className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        isCurrent
                          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
                          : unavailable
                            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                          : 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300'
                      }`}
                    >
                      {isCurrent
                        ? 'Current plan'
                        : unavailable
                          ? 'Unavailable'
                          : busy
                            ? 'Switching...'
                            : 'Switch to this plan'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

function getPlanPrice(plan: SubscriptionPlanDto, billingCycle: 'Monthly' | 'Annual'): number {
  const paise =
    billingCycle === 'Annual'
      ? plan.annualPriceInPaise ?? plan.monthlyPriceInPaise
      : plan.monthlyPriceInPaise ?? plan.annualPriceInPaise;

  return typeof paise === 'number' && paise > 0 ? paise : 0;
}

function isPlanDisabled(plan: SubscriptionPlanDto, billingCycle: 'Monthly' | 'Annual'): boolean {
  return billingCycle === 'Annual' ? Boolean(plan.annuallyDisable) : Boolean(plan.monthlyDisable);
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function buildPlanHighlights(plan: SubscriptionPlanDto): string[] {
  const features: string[] = [];

  if (typeof plan.trialDays === 'number' && plan.trialDays > 0) {
    features.push(`${plan.trialDays}-day free trial`);
  }
  if (typeof plan.maxStaffAccounts === 'number') {
    features.push(`Up to ${plan.maxStaffAccounts} staff accounts`);
  }
  if (typeof plan.maxBottleInventoryItems === 'number') {
    features.push(`Up to ${plan.maxBottleInventoryItems} inventory items`);
  }
  if (typeof plan.maxActiveOffers === 'number') {
    features.push(`Up to ${plan.maxActiveOffers} active offers`);
  }
  if (plan.includesAdvancedAnalytics) {
    features.push('Advanced analytics');
  }
  if (plan.includesFeaturedListing) {
    features.push('Featured listing');
  }
  if (plan.includesWhatsappBot) {
    features.push('WhatsApp bot support');
  }
  if (features.length === 0 && plan.features?.length) {
    features.push(...plan.features);
  }

  return features.slice(0, 4);
}

function Backdrop({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(event) => {
        if (onDismiss && event.target === event.currentTarget) onDismiss();
      }}
    >
      {children}
    </div>
  );
}
