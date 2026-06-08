'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RegistrationStepper } from '@/components/ui/RegistrationStepper';
import { ApiError, getBarDetails, getSubscriptionPlans, subscribeToPlan, type SubscriptionPlanDto } from '@/lib/api-client';
import { getActiveBarId } from '@/lib/active-bar';
import { clearKycStatus, loadKycStatus } from '@/lib/kyc-status';

const DEFAULT_PLANS: SubscriptionPlanDto[] = [
  {
    id: 1,
    name: 'Starter',
    monthlyPriceInPaise: 299900,
    annualPriceInPaise: 2999000,
    trialDays: 14,
    maxStaffAccounts: 5,
    maxBottleInventoryItems: 20,
    maxActiveOffers: 5,
    includesAdvancedAnalytics: false,
    includesFeaturedListing: false,
    includesWhatsappBot: false,
  },
  {
    id: 2,
    name: 'Growth',
    badge: 'Most Popular',
    monthlyPriceInPaise: 699900,
    annualPriceInPaise: 6999000,
    trialDays: 14,
    maxStaffAccounts: 10,
    maxBottleInventoryItems: 100,
    maxActiveOffers: 5,
    includesAdvancedAnalytics: true,
    includesFeaturedListing: true,
    includesWhatsappBot: true,
  },
  {
    id: 3,
    name: 'Enterprise',
    monthlyPriceInPaise: null,
    annualPriceInPaise: null,
    trialDays: 50,
    maxStaffAccounts: null,
    maxBottleInventoryItems: null,
    maxActiveOffers: null,
    includesAdvancedAnalytics: true,
    includesFeaturedListing: true,
    includesWhatsappBot: true,
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>(DEFAULT_PLANS);
  const [selected, setSelected] = useState('Growth');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [activeBarId, setActiveBarId] = useState<number | null>(() => getActiveBarId() ?? loadKycStatus()?.barId ?? null);
  const [resolvingBarId, setResolvingBarId] = useState(activeBarId === null);

  // Load subscription plans
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const fetchedPlans = await getSubscriptionPlans();
        if (!canceled && Array.isArray(fetchedPlans) && fetchedPlans.length > 0) {
          setPlans(fetchedPlans);
          setSelected(fetchedPlans[0].name);
        }
      } catch (err) {
        setPlansError(err instanceof ApiError ? err.message : 'Failed to load subscription plans');
      } finally {
        if (!canceled) setLoadingPlans(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const bar = await getBarDetails();
        if (canceled) return;

        setIsEmailVerified(bar.isEmailVerified);
        if (!bar.isEmailVerified) {
          setSubscriptionError(
            'Your bar email is not verified yet. Please check your inbox and verify the email before choosing a plan.',
          );
        }
      } catch {
        if (!canceled) setIsEmailVerified(null);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  // Resolve bar ID if not found
  useEffect(() => {
    if (activeBarId !== null) {
      setResolvingBarId(false);
      return;
    }

    let canceled = false;
    setResolvingBarId(true);

    (async () => {
      try {
        const bar = await getBarDetails();
        if (!canceled) setActiveBarId(bar.barId);
      } catch (err) {
        // Bar not found (204 No Content) - check if user KYC is approved
        if (!canceled) {
          const kycData = loadKycStatus();
          if (kycData && kycData.status === 'user_approved') {
            // User approved but no bar - redirect to KYC status page
            router.replace('/register/kyc-status');
            return;
          }
        }
      } finally {
        if (!canceled) setResolvingBarId(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [activeBarId, router]);

  const effectivePlans = plans.length > 0 ? plans : DEFAULT_PLANS;

  const formatPaise = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const getPlanFeatures = (plan: SubscriptionPlanDto) => {
    const features: string[] = [];

    if (typeof plan.trialDays === 'number') {
      features.push(`${plan.trialDays}-day free trial`);
    }
    if (typeof plan.maxStaffAccounts === 'number') {
      features.push(`Up to ${plan.maxStaffAccounts} staff accounts`);
    }
    if (typeof plan.maxBottleInventoryItems === 'number') {
      features.push(`Up to ${plan.maxBottleInventoryItems} inventory items`);
    }
    if (typeof plan.maxActiveOffers === 'number') {
      features.push(`Up to ${plan.maxActiveOffers} offers`);
    }
    if (plan.includesAdvancedAnalytics) {
      features.push('Advanced analytics');
    }
    if (plan.includesFeaturedListing) {
      features.push('Featured listing');
    }
    if (plan.includesWhatsappBot) {
      features.push('WhatsApp support');
    }
    if (features.length === 0 && plan.features?.length) {
      features.push(...plan.features);
    }

    return features;
  };

  const calculateSavings = () => {
    const plansWithPrices = effectivePlans.filter(
      (p) => p.monthlyPriceInPaise && p.annualPriceInPaise,
    );
    if (plansWithPrices.length === 0) return 16;

    const totalMonthly = plansWithPrices.reduce(
      (sum, p) => sum + (p.monthlyPriceInPaise || 0),
      0,
    );
    const totalAnnual = plansWithPrices.reduce(
      (sum, p) => sum + (p.annualPriceInPaise || 0),
      0,
    );

    if (totalMonthly === 0) return 16;

    const monthlyYearlyCost = totalMonthly * 12;
    const savings = ((monthlyYearlyCost - totalAnnual) / monthlyYearlyCost) * 100;
    return Math.round(savings);
  };

  const savingsPercent = calculateSavings();

  const performSubscription = async (plan: SubscriptionPlanDto) => {
    if (resolvingBarId) {
      setSubscriptionError('Please wait while we locate your active bar account.');
      return;
    }

    if (isEmailVerified === false) {
      setSubscriptionError(
        'Your bar email is not verified yet. Please verify the email before choosing a plan.',
      );
      return;
    }

    const barId = activeBarId;
    if (!barId) {
      setSubscriptionError(
        'No active bar found. Please complete registration first. If you are here as part of registration, make sure your KYC status is still available.',
      );
      return;
    }

    setSubscribing(true);
    setSubscriptionError(null);

    try {
      const response = await subscribeToPlan(barId, {
        planCode: plan.code ?? plan.name,
        billingCycle: billing === 'monthly' ? 'Monthly' : 'Annual',
      });

      clearKycStatus();

      console.log('Subscription successful:', response);
      router.replace('/inventory');

    } catch (err) {
      setSubscriptionError(err instanceof ApiError ? err.message : 'Failed to subscribe to plan');
    } finally {
      setSubscribing(false);
    }
  };

  const handleSubscribe = async () => {
    const selectedPlan = effectivePlans.find(plan => plan.name === selected);
    if (!selectedPlan) {
      setSubscriptionError('Please select a plan');
      return;
    }
    await performSubscription(selectedPlan);
  };

  const handleDirectSubscribe = async (plan: SubscriptionPlanDto) => {
    await performSubscription(plan);
  };

  return (
    <div className="auth-fit auth-compact w-full max-w-5xl">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-accent-lo">Final step</p>
        <h1 className="mt-1 font-display text-2xl leading-tight text-ink">Choose Your Plan</h1>
        <span className="gold-rule mb-1 mt-1.5" aria-hidden="true" />
        <p className="text-xs text-muted">30-day free trial included. Cancel anytime with 30 days&apos; notice.</p>
      </div>

      <RegistrationStepper current="Subscription" />

      <div className="mb-3 flex items-center justify-center gap-3 text-sm text-muted">
        <span className={billing === 'monthly' ? 'font-semibold text-ink' : ''}>Monthly</span>
        <button type="button" onClick={() => setBilling((b) => (b === 'monthly' ? 'annual' : 'monthly'))} className="relative h-7 w-12 rounded-full bg-[color:var(--color-success)] p-1" aria-label="Toggle billing cycle">
          <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${billing === 'annual' ? 'translate-x-5' : ''}`} />
        </button>
        <span className={billing === 'annual' ? 'font-semibold text-ink' : ''}>Annual</span>
        <span className="badge badge-success">Save {savingsPercent}%</span>
      </div>

      {plansError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-200">
          {plansError}
        </div>
      )}

      {subscriptionError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-200">
          {subscriptionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {loadingPlans ? (
          <div className="col-span-3 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading plans…
          </div>
        ) : (
          effectivePlans.map((plan) => {
            const active = selected === plan.name;

            const monthlyPrice = plan.monthlyPriceInPaise || plan.annualPriceInPaise || 0;
            const annualPrice = plan.annualPriceInPaise || plan.monthlyPriceInPaise || 0;
            const currentPrice = billing === 'monthly' ? monthlyPrice : annualPrice;
            const displayPrice = currentPrice > 0 ? formatPaise(currentPrice) : (plan.price || 'N/A');
            const displaySuffix = plan.suffix || (billing === 'monthly' ? 'per month' : 'per year');
            const displayFeatures = getPlanFeatures(plan);
            const isDisabled = billing === 'monthly' ? plan.monthlyDisable : plan.annuallyDisable;

            return (
              <button
                key={plan.name}
                type="button"
                onClick={() => {
                  setSelected(plan.name);
                }}
                disabled={isDisabled || subscribing || isEmailVerified === false}
                className={`card-raised p-3.5 text-left ${active ? 'border-accent shadow-[var(--shadow-md)]' : 'hover:border-accent'} ${isDisabled || isEmailVerified === false ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="mb-3 text-center">
                  <span className="badge badge-neutral">{plan.badge || plan.name}</span>
                  <div className="mt-2 font-display text-2xl font-semibold text-accent-hi">{displayPrice}</div>
                  <p className="mt-1 text-xs text-muted">{displaySuffix}</p>
                  {(isDisabled || isEmailVerified === false) && <p className="mt-1 text-xs text-rose-600">Not available</p>}
                </div>
                <ul className="space-y-1 text-[13px]">
                  {displayFeatures.length > 0 ? (
                    displayFeatures.map((feature, idx) => {
                      const disabled = typeof plan.disabledFrom === 'number' && idx >= plan.disabledFrom;
                      return <li key={`${plan.name}-${idx}`} className={disabled ? 'text-soft' : 'text-ink'}>{disabled ? '×' : '✓'} {feature}</li>;
                    })
                  ) : (
                    <li className="text-soft">No features listed</li>
                  )}
                </ul>
                <div className={`mt-3 rounded-md px-4 py-2 text-center text-sm font-semibold ${active ? 'bg-ink text-ivory' : 'border border-strong text-ink'} ${isDisabled || isEmailVerified === false ? 'bg-slate-200 text-slate-500' : ''}`}>
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Select'}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={subscribing || resolvingBarId || isEmailVerified === false}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {subscribing ? 'Subscribing...' : 'Start 30-Day Free Trial →'}
        </button>
      </div>
    </div>
  );
}
