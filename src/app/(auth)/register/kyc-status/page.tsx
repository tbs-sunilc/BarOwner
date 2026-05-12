/*'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadKycStatus, type KycStatusData } from '@/lib/kyc-status';

export default function KycStatusPage() {
  const router = useRouter();
  const [kycData, setKycData] = useState<KycStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const status = loadKycStatus();
    if (!status) {
      router.replace('/register');
      return;
    }
    setKycData(status);
    setIsLoading(false);
  }, [router]);

  if (isLoading || !kycData) return null;

  return (
    <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
      {kycData.status === 'under_review' && (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">⏳</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Verification in progress
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Documents Under Review
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Our team is verifying your documents. This usually takes up to 48 hours. You will be
            notified by email and SMS when the review is complete.
          </p>

          <div className="card-raised mt-5 p-4 text-left">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
                <span className="text-sm text-ink">Documents received</span>
                <span className="badge badge-success">✓ Done</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
                <span className="text-sm text-ink">Liquor licence verification</span>
                <span className="badge badge-warn">In progress</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
                <span className="text-sm text-ink">GSTIN & FSSAI validation</span>
                <span className="badge badge-warn">In progress</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">Account activation</span>
                <span className="badge badge-neutral">Awaiting approval</span>
              </div>
            </div>
          </div>

          <p className="mt-5 text-xs text-muted">
            Once approved, you can log in and choose your subscription plan.
          </p>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="btn btn-primary mt-6 w-full"
          >
            Back to Login
          </button>
        </>
      )}

      {kycData.status === 'rejected' && (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">❌</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Verification failed
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Application Rejected
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />

          <div className="card-raised mt-5 border-l-4 border-error bg-error-tint p-4">
            <p className="text-left text-sm leading-relaxed text-error">
              {kycData.rejectionReason ||
                'Your documents did not meet our verification requirements.'}
            </p>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-muted">
            Please review the reason above and resubmit your documents with the correct information.
          </p>

          <button
            type="button"
            onClick={() => router.push('/register/documents?resubmit=true')}
            className="btn btn-primary mt-6 w-full"
          >
            Resubmit Documents
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="btn btn-ghost mt-3 w-full"
          >
            Back to Login
          </button>
        </>
      )}

      {kycData.status === 'approved' && (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">✅</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Verification complete
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Application Approved!
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Congratulations! Your documents have been verified. Now select a subscription plan to
            activate your bar account.
          </p>

          <button
            type="button"
            onClick={() => router.push('/register/subscription')}
            className="btn btn-primary mt-6 w-full"
          >
            Choose Subscription Plan
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="btn btn-ghost mt-3 w-full"
          >
            Back to Login
          </button>
        </>
      )}
    </div>
  );
}
*/
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadKycStatus, type KycStatusData } from '@/lib/kyc-status';
import { getBarDetails, getDashboard, type BarDetails } from '@/lib/api-client';

export default function KycStatusPage() {
  const router = useRouter();
  const [kycData, setKycData] = useState<KycStatusData | null>(null);
  const [barDetails, setBarDetails] = useState<BarDetails | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isUserOnly, setIsUserOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const status = loadKycStatus();
      if (!status) {
        router.replace('/register');
        return;
      }
      setKycData(status);

      try {
        const bar = await getBarDetails();
        console.log('Bar details:', bar);
        if (bar) {
          setBarDetails(bar);
          setIsUserOnly(false);
          try {
            const dashboard = await getDashboard(bar.barId);
            if (dashboard.subscription) {
              setHasSubscription(true);
            }
          } catch (dashErr) {
            console.log('Dashboard/Subscription check failed:', dashErr);
          }
        }
      } catch (err) {
        console.log('No bar details found (likely 204):', err);
        // If user_approved but no bar → they need to register bar
        if (status.status === 'user_approved') {
          setIsUserOnly(true);
        }
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [router]);

  if (isLoading || !kycData) return null;

  // CRITICAL CONDITION: User KYC approved but no bar registered
  if (kycData.status === 'user_approved' && isUserOnly) {
    return (
      <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
        <div className="mb-3 text-4xl" aria-hidden="true">👤✅</div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
          User Verification Complete
        </p>
        <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
          Identity Verified
        </h1>
        <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted">
          Your personal identity has been verified successfully. To start using SipSave, you now need to register your bar and provide business documents.
        </p>

        <button
          type="button"
          onClick={() => router.push('/register/documents')}
          className="btn btn-primary mt-6 w-full"
        >
          Register Your Bar →
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

  // isVerified === true and isActive === false and no subscription → Choose Plan
  const showChoosePlan = barDetails?.isVerified === true && barDetails?.isActive === false && !hasSubscription;

  return (
    <div className="auth-fit auth-compact mx-auto w-full max-w-md text-center">
      {showChoosePlan ? (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">✅</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Bar Verification Complete
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Bar Approved!
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Congratulations! Your bar has been verified. Now select a subscription plan to
            activate your bar account and access the dashboard.
          </p>

          <button
            type="button"
            onClick={() => router.push('/register/subscription')}
            className="btn btn-primary mt-6 w-full"
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
        </>
      ) : kycData.status === 'under_review' ? (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">⏳</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Verification in progress
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Documents Under Review
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Our team is verifying your documents. This usually takes up to 48 hours. You will be
            notified by email and SMS when the review is complete.
          </p>

          <div className="card-raised mt-5 p-4 text-left">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
                <span className="text-sm text-ink">Documents received</span>
                <span className="badge badge-success">✓ Done</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
                <span className="text-sm text-ink">Liquor licence verification</span>
                <span className="badge badge-warn">In progress</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-hairline">
                <span className="text-sm text-ink">GSTIN & FSSAI validation</span>
                <span className="badge badge-warn">In progress</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">Account activation</span>
                <span className="badge badge-neutral">Awaiting approval</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="btn btn-primary mt-6 w-full"
          >
            Back to Login
          </button>
        </>
      ) : kycData.status === 'rejected' ? (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">❌</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
            Verification failed
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Application Rejected
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />

          <div className="card-raised mt-5 border-l-4 border-error bg-error-tint p-4">
            <p className="text-left text-sm leading-relaxed text-error">
              {kycData.rejectionReason ||
                'Your documents did not meet our verification requirements.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/register/documents?resubmit=true')}
            className="btn btn-primary mt-6 w-full"
          >
            Resubmit Documents
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="btn btn-ghost mt-3 w-full"
          >
            Back to Login
          </button>
        </>
      ) : (
        <>
          <div className="mb-3 text-4xl" aria-hidden="true">✅</div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
           User Kyc Verification complete
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
            Account Approved!
          </h1>
          <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Congratulations! Your account has been verified. You can now Register your Bar..
          </p>

          <button
            type="button"
            onClick={() => router.push('/register')}
            className="btn btn-primary mt-6 w-full"
          >
            Regiseter your bar first
          </button>
        </>
      )}
    </div>
  );
}

