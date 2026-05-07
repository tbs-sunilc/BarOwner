'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const REVIEW_STEPS = [
  { label: 'Documents received', status: 'Done', tone: 'success' },
  { label: 'Liquor licence verification', status: 'In progress', tone: 'warn' },
  { label: 'GSTIN & FSSAI check', status: 'In progress', tone: 'warn' },
  { label: 'Account activated', status: 'Awaiting approval', tone: 'neutral' },
];

export default function RegistrationSuccessPage() {
  const router = useRouter();
  const barId = useSearchParams().get('4');

  return (
    <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">⏳</div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
        Verification started
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">Registration Under Review</h1>
      <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-muted">
        Our team is verifying your documents. This takes up to 48 hours. You will be notified by
        email and SMS.
      </p>

      <div className="card-raised mt-5 p-4 text-left">
        {barId && (
          <div className="mb-3 rounded-md border border-accent/30 bg-accent-tint px-3 py-2 text-xs text-accent-lo">
            Registration ID: {barId}
          </div>
        )}
        {REVIEW_STEPS.map((step) => (
          <div key={step.label} className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
            <span className="text-sm text-ink">{step.label}</span>
            <span className={`badge badge-${step.tone}`}>{step.status}</span>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => router.push('/register/subscription')} className="btn btn-primary mt-5 w-full">
        Simulate Approval → Choose Plan
      </button>
      <button type="button" onClick={() => router.push('/register')} className="btn btn-ghost mt-3 w-full">
        Start Again
      </button>
    </div>
  );
}
