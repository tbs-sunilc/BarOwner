'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ErrorBanner } from '@/components/ui';
import { ApiError, verifyBarEmail, type BarEmailVerificationResponse } from '@/lib/api-client';

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<BarEmailVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This verification link is missing a token.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        setError(null);
        const response = await verifyBarEmail({ token: token! });
        if (!cancelled) setResult(response);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not verify your email. The link may have expired.',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
        Bar owner onboarding
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Email Verification
      </h1>
      <span className="gold-rule mb-2 mt-2 block" aria-hidden="true" />

      {isLoading && (
        <div className="card-raised mt-5 p-5 text-left">
          <p className="text-sm font-semibold text-ink">Verifying your email...</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Please wait while we confirm the verification link from your inbox.
          </p>
        </div>
      )}

      {!isLoading && error && (
        <>
          <div className="card-raised mt-5 border-l-4 border-error bg-error-tint p-4 text-left">
            <ErrorBanner>{error}</ErrorBanner>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            You can try the email link again, or continue back to the app to check your
            registration status.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => router.push('/register')} className="btn btn-primary">
              Back to Registration
            </button>
            <button type="button" onClick={() => router.push('/login')} className="btn btn-ghost">
              Go to Login
            </button>
          </div>
        </>
      )}

      {!isLoading && result && (
        <>
          <div className="card-raised mt-5 p-5 text-left">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-success-tint)] text-[color:var(--color-success)]"
                aria-hidden="true"
              >
                OK
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{result.message}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {result.businessName} can now use {result.contactEmail} for owner updates and
                  account communication.
                </p>
                {result.emailVerifiedAtUtc && (
                  <p className="mt-2 text-xs text-muted">
                    Verified at {new Date(result.emailVerifiedAtUtc).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted">
            If you are finishing registration on this device, continue to your status page to
            check document review progress.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => router.push('/register/kyc-status')} className="btn btn-primary">
              Continue to Status
            </button>
            <button type="button" onClick={() => router.push('/login')} className="btn btn-ghost">
              Go to Login
            </button>
          </div>
        </>
      )}
    </div>
  );
}
