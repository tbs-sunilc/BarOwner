'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ErrorBanner } from '@/components/ui';
import {
  ApiError,
  requestOwnerOtp,
  verifyOwnerOtp,
  type RegisterOtpResponse,
  type VerifyOtpResponse,
} from '@/lib/api-client';
import { setActiveBarId } from '@/lib/active-bar';

const MOBILE_REGEX = /^[6-9]\d{9}$/;

type Step = 'details' | 'otp';

export default function BarOwnerLoginPage() {
  const router = useRouter();
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
    <div className="w-full max-w-md">
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
          {notice && <NotRegisteredNotice message={notice} />}

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

function NotRegisteredNotice({ message }: { message: string }) {
  return (
    <div
      role="alertdialog"
      className="rounded-lg border border-[color:rgb(184_134_11/0.35)] bg-accent-tint px-4 py-3 text-sm text-accent-lo"
    >
      <p className="font-semibold text-ink">Mobile number not registered</p>
      <p className="mt-1">{message}</p>
      <Link href="/register" className="btn btn-ghost btn-sm mt-3">
        Register your bar
      </Link>
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
