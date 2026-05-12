'use client';

import { useRouter } from 'next/navigation';

export default function RegistrationSuccessPage() {
  const router = useRouter();

  return (
    <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">✅</div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
        Registration complete
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">Account Activated!</h1>
      <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-muted">
        Your bar account has been verified and is ready to use. Choose a subscription plan to activate all features.
      </p>

      <div className="card-raised mt-5 p-4 text-left">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
            <span className="text-sm text-ink">Documents verified</span>
            <span className="badge badge-success">✓ Done</span>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
            <span className="text-sm text-ink">Liquor licence verified</span>
            <span className="badge badge-success">✓ Done</span>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
            <span className="text-sm text-ink">GSTIN & FSSAI validated</span>
            <span className="badge badge-success">✓ Done</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink">Ready for subscription</span>
            <span className="badge badge-success">✓ Ready</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push('/register/subscription')}
        className="btn btn-primary mt-5 w-full"
      >
        Choose Subscription Plan →
      </button>
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="btn btn-ghost mt-3 w-full"
      >
        Back to Login
      </button>
    </div>
  );
}
