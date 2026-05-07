'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RegistrationStepper } from '@/components/ui/RegistrationStepper';

const PLANS = [
  { name: 'Starter', price: '₹2,999', suffix: 'per month', features: ['1 outlet listing', 'Wallet purchase system', 'Inventory management', 'Up to 5 staff accounts', 'Offers engine', 'Revenue analytics'], disabledFrom: 4 },
  { name: 'Growth', price: '₹6,999', suffix: 'per month', badge: 'Most Popular', features: ['Up to 3 outlets', 'Everything in Starter', 'Offers & promotions engine', 'Full revenue analytics', 'Priority search placement', 'Re-engagement campaigns'] },
  { name: 'Enterprise', price: 'Custom', suffix: 'contact sales', features: ['Unlimited outlets', 'Everything in Growth', 'White-label option', 'API access', 'Dedicated account manager', 'SLA guarantee'] },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [selected, setSelected] = useState('Growth');

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
        <span className="badge badge-success">Save 16%</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const active = selected === plan.name;
          return (
            <button key={plan.name} type="button" onClick={() => setSelected(plan.name)} className={`card-raised p-3.5 text-left ${active ? 'border-accent shadow-[var(--shadow-md)]' : 'hover:border-accent'}`}>
              <div className="mb-3 text-center">
                <span className="badge badge-neutral">{plan.badge || plan.name}</span>
                <div className="mt-2 font-display text-2xl font-semibold text-accent-hi">{plan.price}</div>
                <p className="mt-1 text-xs text-muted">{plan.suffix}</p>
              </div>
              <ul className="space-y-1 text-[13px]">
                {plan.features.map((feature, idx) => {
                  const disabled = typeof plan.disabledFrom === 'number' && idx >= plan.disabledFrom;
                  return <li key={feature} className={disabled ? 'text-soft' : 'text-ink'}>{disabled ? '×' : '✓'} {feature}</li>;
                })}
              </ul>
              <div className={`mt-3 rounded-md px-4 py-2 text-center text-sm font-semibold ${active ? 'bg-ink text-ivory' : 'border border-strong text-ink'}`}>
                {plan.name === 'Enterprise' ? 'Contact Sales' : 'Select'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <button type="button" onClick={() => router.replace('/login')} className="btn btn-primary">
          Start 30-Day Free Trial →
        </button>
      </div>
    </div>
  );
}
