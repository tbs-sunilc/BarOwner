import { Suspense } from 'react';
import VerifyEmailClient from './verify-email-client';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Bar owner onboarding
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Email Verification
          </h1>
          <span className="gold-rule mb-2 mt-2 block" aria-hidden="true" />
          <div className="card-raised mt-5 p-5 text-left">
            <p className="text-sm font-semibold text-ink">Verifying your email...</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Please wait while we confirm the verification link from your inbox.
            </p>
          </div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
