'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ErrorBanner } from '@/components/ui';
import {
  ApiError,
  getBarDetails,
  getDashboard,
  requestOwnerOtp,
  verifyOwnerOtp,
  loginStaff,
  type BarDetails,
  type RegisterOtpResponse,
  type VerifyOtpResponse,
  type StaffLoginResponse,
} from '@/lib/api-client';
import { clearActiveBarId, setActiveBarDetails, setActiveBarId } from '@/lib/active-bar';
import { saveKycStatus, parseKycStatusFromApi } from '@/lib/kyc-status';

const MOBILE_REGEX = /^[6-9]\d{9}$/;

type Step = 'details' | 'otp';

export default function BarOwnerLoginPage() {
  const router = useRouter();
  const [isFlipped, setIsFlipped] = useState(false);
  const [step, setStep] = useState<Step>('details');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMeta, setOtpMeta] = useState<RegisterOtpResponse | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const normalizedMobile = mobileNumber.replace(/\D/g, '').slice(0, 10);
  const otpLength = otpMeta && otpMeta.otpLength >= 4 && otpMeta.otpLength <= 8 ? otpMeta.otpLength : 6;

  const detailsValid = useMemo(
    () => fullName.trim().length >= 2 && MOBILE_REGEX.test(normalizedMobile),
    [fullName, normalizedMobile],
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleRequestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setNotice(null);

    if (!detailsValid) {
      setError('Enter your full name and a valid 10-digit registered mobile number.');
      return;
    }

    setBusy(true);
    try {
      const response = await requestOwnerOtp({
        fullName: fullName.trim(),
        mobileNumber: normalizedMobile,
      });

      if (!response.isExistingAccount) {
        setNotice('This mobile number is not registered as a bar owner. Please register your bar first.');
        setStep('details');
        return;
      }

      setOtpMeta(response);
      setOtp('');
      setCooldown(response.resendCooldownSeconds || 30);
      setStep('otp');
    } catch (err) {
      setError(readApiMessage(err, 'Could not send OTP. Please check the mobile number and try again.'));
    } finally {
      setBusy(false);
    }
  }

  /*async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (otp.length !== otpLength) {
      setError(`Enter the ${otpLength}-digit OTP sent to your registered mobile number.`);
      return;
    }

    setBusy(true);
    try {
      const response = await verifyOwnerOtp({ mobileNumber: normalizedMobile, otp });
      persistOwnerSession(response);

      // Check KYC status
      const kycData = parseKycStatusFromApi(response.user.kycStatus, response.user.kycRejectionReason);
      if (kycData) {
        saveKycStatus(kycData);
        // Redirect to KYC status page (user cannot proceed without KYC approval)
        router.replace('/register/kyc-status');
        return;
      }

      let bar: BarDetails;
      try {
        bar = await getBarDetails();
      } catch (err) {
        setError(readApiMessage(err, 'OTP verified, but we could not load your bar details. Please try again.'));
        return;
      }

      if (!bar.isVerified || !bar.isActive) {
        clearActiveBarId();
        setNotice(getBarAccessMessage(bar));
        return;
      }

      persistBarDetails(bar);
      router.replace('/inventory');
    } catch (err) {
      setError(readApiMessage(err, 'Invalid or expired OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  }
*/

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (otp.length !== otpLength) {
      setError(`Enter the ${otpLength}-digit OTP sent to your registered mobile number.`);
      return;
    }

    setBusy(true);
    try {
      const response = await verifyOwnerOtp({ mobileNumber: normalizedMobile, otp });
      persistOwnerSession(response);

      // Check KYC status from API response
      const kycData = parseKycStatusFromApi(response.user.kycStatus, response.user.kycRejectionReason);

      if (kycData) {
        saveKycStatus(kycData);

        // Try to get bar details
        try {
          const bar = await getBarDetails();
          persistBarDetails(bar);

          // If bar exists, check subscription
          const dashboard = await getDashboard(bar.barId);
          if (dashboard.subscription) {
            router.replace('/dashboard');
            return;
          }
        } catch (barErr) {
          // No bar found (204 No Content) - check if user KYC is approved
          if (kycData.status === 'user_approved') {
            // User verified but no bar registered
            router.replace('/register/kyc-status');
            return;
          }
        }

        // Redirect to KYC status page
        router.replace('/register/kyc-status');
        return;
      }

      // Fallback: try to get bar details directly
      let bar: BarDetails;
      try {
        bar = await getBarDetails();
      } catch (err) {
        setError(readApiMessage(err, 'OTP verified, but we could not load your bar details. Please try again.'));
        return;
      }

      if (!bar.isVerified || !bar.isActive) {
        clearActiveBarId();
        setNotice(getBarAccessMessage(bar));
        return;
      }

      persistBarDetails(bar);
      router.replace('/inventory');
    } catch (err) {
      setError(readApiMessage(err, 'Invalid or expired OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  function backToDetails() {
    setStep('details');
    setOtp('');
    setError(null);
    setNotice(null);
  }

  return (
    <div className="flip-container w-full max-w-md">
      <div className={`flip-card ${isFlipped ? 'flipped' : ''}`}>
        {/* FRONT: Bar Owner Login */}
        <div className="flip-card-front">
          <div className="w-full">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display font-semibold text-accent">
                  S
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">SipSave</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent-lo">Noir Console</p>
                </div>
              </div>
            </div>

            <header className="mb-6">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
                Secure OTP sign-in
              </p>
              <h1 className="mt-2 font-display text-4xl leading-tight text-ink">Welcome back.</h1>
              <span className="gold-rule mb-3 mt-3" aria-hidden="true" />
              <p className="text-sm text-muted">
                Verify your registered owner mobile number to access the dashboard.
              </p>
            </header>

            {step === 'details' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="fullName" className="field-label">Full name</label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoFocus
                    className="input"
                    placeholder="Anita Kumar"
                  />
                </div>

                <div>
                  <label htmlFor="mobileNumber" className="field-label">Registered mobile number</label>
                  <input
                    id="mobileNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    className="input"
                    placeholder="9876543210"
                  />
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}
                {notice && <NoticeCard title="Mobile number not registered" message={notice} actionHref="/register" actionText="Register your bar" />}

                <button type="submit" disabled={busy || !detailsValid} className="btn btn-primary w-full">
                  {busy ? 'Sending OTP...' : 'Send OTP'}
                </button>

                <div className="pt-2 text-center">
                  <p className="mb-2 text-xs text-soft">New bar owner?</p>
                  <Link href="/register" className="btn btn-ghost btn-sm">
                    Register your bar
                  </Link>
                </div>

                <p className="pt-2 text-center text-xs text-soft">Trouble signing in? Contact support.</p>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
                <div className="rounded-lg border border-strong bg-accent-tint/50 px-4 py-3 text-sm text-muted">
                  OTP sent to <span className="font-semibold text-ink">{maskMobile(normalizedMobile)}</span>
                </div>

                <div>
                  <label htmlFor="otp" className="field-label">Enter OTP</label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, otpLength))}
                    required
                    autoFocus
                    className="input text-center font-numeric text-xl tracking-[0.35em]"
                    placeholder="000000"
                  />
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}
                {notice && <NoticeCard title="Bar access pending" message={notice} />}

                <button type="submit" disabled={busy || otp.length !== otpLength} className="btn btn-primary w-full">
                  {busy ? 'Verifying...' : 'Verify & Continue'}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                  <button type="button" onClick={backToDetails} className="btn btn-ghost btn-sm">
                    Change number
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestOtp()}
                    disabled={busy || cooldown > 0}
                    className="btn btn-ghost btn-sm"
                  >
                    {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-strong/30 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-soft mb-3">Shift Personnel?</p>
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="btn btn-secondary w-full"
              >
                Staff Login
              </button>
            </div>
          </div>
        </div>

        {/* BACK: Staff Login */}
        <div className="flip-card-back">
          <StaffLoginForm onBack={() => setIsFlipped(false)} />
        </div>
      </div>
    </div>
  );
}

function StaffLoginForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // Normalize mobile number
    let finalMobile = mobile.trim().replace(/\s/g, '');
    // If it's a simple 10-digit number, prepend +91 to match how staff are stored in the DB
    if (/^[6-9]\d{9}$/.test(finalMobile)) {
      finalMobile = `+91${finalMobile}`;
    }

    if (finalMobile.length < 10 || password.length < 4) {
      setError('Please enter a valid mobile number and password.');
      setBusy(false);
      return;
    }

    try {
      const response = await loginStaff({ mobileNumber: finalMobile, password });
      persistStaffSession(response);
      router.push('/floor');
    } catch (err) {
      setError(readApiMessage(err, 'Invalid mobile number or password.'));
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display font-semibold text-accent">
            S
          </div>
          <div>
            <p className="font-display text-lg leading-tight">SipSave</p>
            <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent-lo">Noir Console</p>
          </div>
        </div>
      </div>

      <header className="mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
          Staff Terminal Access
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-ink">Staff Login.</h1>
        <span className="gold-rule mb-3 mt-3" aria-hidden="true" />
        <p className="text-sm text-muted">
          Enter your registered mobile number and password to begin your shift.
        </p>
      </header>

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div>
          <label htmlFor="staffMobile" className="field-label">Mobile number</label>
          <input
            id="staffMobile"
            type="tel"
            inputMode="numeric"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            className="input"
            placeholder="+91 9876543210"
          />
        </div>

        <div>
          <label htmlFor="staffPassword" className="field-label">Password</label>
          <input
            id="staffPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? 'Verifying...' : 'Login to Terminal'}
        </button>

        <div className="pt-2 text-center">
          <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
            ← Back to Owner Login
          </button>
        </div>
      </form>
    </div>
  );
}

function persistOwnerSession(response: VerifyOtpResponse): void {
  window.sessionStorage.setItem('sipsave-barowner-access-token', response.tokens.accessToken);
  window.sessionStorage.setItem('sipsave-barowner-refresh-token', response.tokens.refreshToken);
  window.sessionStorage.setItem('sipsave-barowner-token-type', response.tokens.tokenType);
  window.sessionStorage.setItem('sipsave-barowner-access-token-expires-at', response.tokens.accessTokenExpiresAtUtc);
  window.sessionStorage.setItem('sipsave-barowner-user', JSON.stringify(response.user));

  if (response.user.email) window.sessionStorage.setItem('sipsave-barowner-email', response.user.email);
  if (response.user.fullName) window.sessionStorage.setItem('sipsave-barowner-full-name', response.user.fullName);
  if (response.user.barId && response.user.barId > 0) setActiveBarId(response.user.barId);
}

function persistStaffSession(response: StaffLoginResponse): void {
  window.sessionStorage.setItem('sipsave-staff-access-token', response.accessToken);
  window.sessionStorage.setItem('sipsave-staff-access-token-expires-at', response.expiresAtUtc);
  
  const userObj = {
    id: response.staffId,
    fullName: response.fullName,
    role: response.role,
    barId: response.barId
  };
  window.sessionStorage.setItem('sipsave-staff-user', JSON.stringify(userObj));

  if (response.fullName) window.sessionStorage.setItem('sipsave-staff-full-name', response.fullName);
  if (response.barId && response.barId > 0) setActiveBarId(response.barId);
}

function persistBarDetails(bar: BarDetails): void {
  setActiveBarDetails(bar);
}

function getBarAccessMessage(bar: BarDetails): string {
  const status = bar.verificationQueueMessage?.trim();
  if (!bar.isVerified) {
    return status || `${bar.businessName} is not verified yet. Please wait for verification before opening the owner dashboard.`;
  }
  if (!bar.isActive) {
    return status || `${bar.businessName} is not active right now. Please contact support to activate your bar.`;
  }
  return status || `${bar.businessName} is not ready for dashboard access yet.`;
}

function NoticeCard({
  title,
  message,
  actionHref,
  actionText,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionText?: string;
}) {
  return (
    <div
      role="alertdialog"
      className="rounded-lg border border-[color:rgb(184_134_11/0.35)] bg-accent-tint px-4 py-3 text-sm text-accent-lo"
    >
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1">{message}</p>
      {actionHref && actionText && (
        <Link href={actionHref} className="btn btn-ghost btn-sm mt-3">
          {actionText}
        </Link>
      )}
    </div>
  );
}

function readApiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const body = err.body;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === 'string') return record.detail;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.title === 'string') return record.title;
  }
  return err.message || fallback;
}

function maskMobile(mobile: string): string {
  if (mobile.length < 4) return mobile;
  return `+91 XXXXX${mobile.slice(-5)}`;
}
