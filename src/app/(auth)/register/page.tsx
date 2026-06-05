'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ErrorBanner } from '@/components/ui';
import { RegistrationStepper } from '@/components/ui/RegistrationStepper';
import {
  ApiError,
  requestOwnerOtp,
  verifyOwnerOtp,
  type RegisterOtpResponse,
  type VerifyOtpResponse,
} from '@/lib/api-client';
import { INDIAN_STATES } from '@/lib/indian-states';
import {
  loadRegistrationStep1,
  saveRegistrationStep1,
  type BarRegistrationStep1,
} from '@/lib/registration-storage';

const MOBILE_REGEX = /^[0-9]{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_REGEX = /^[0-9]{6}$/;
const AVAILABLE_TAGS = ['Rooftop', 'DJ / Live', 'Garden', 'Sports Bar', 'Wine Bar', 'City View', 'Lounge'];

type RegistrationStage = 'business' | 'otp';

const EMPTY: BarRegistrationStep1 = {
  businessName: '',
  ownerFullName: '',
  email: '',
  mobileNumber: '',
  addressLine1: '',
  city: '',
  stateCode: '',
  pincode: '',
  latitude: null,
  longitude: null,
  openingTime: '18:00',
  closingTime: '01:00',
  ambianceTags: ['Rooftop'],
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<BarRegistrationStep1>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<RegistrationStage>('business');
  const [otp, setOtp] = useState('');
  const [otpMeta, setOtpMeta] = useState<RegisterOtpResponse | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useEffect(() => {
    const restored = loadRegistrationStep1();
    if (restored) setForm({ ...EMPTY, ...restored });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;
  const normalizedMobile = form.mobileNumber.replace(/\D/g, '').slice(0, 10);
  const otpLength = otpMeta && otpMeta.otpLength >= 4 && otpMeta.otpLength <= 8 ? otpMeta.otpLength : 6;

  function update<K extends keyof BarRegistrationStep1>(key: K, value: BarRegistrationStep1[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      ambianceTags: f.ambianceTags.includes(tag)
        ? f.ambianceTags.filter((t) => t !== tag)
        : [...f.ambianceTags, tag],
    }));
  }

  function captureCurrentLocation() {
    setError(null);
    setLocationMessage(null);

    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update('latitude', Number(position.coords.latitude.toFixed(6)));
        update('longitude', Number(position.coords.longitude.toFixed(6)));
        setTouched((t) => ({ ...t, latitude: true, longitude: true }));
        setLocationMessage('Location captured for this bar.');
        setLocating(false);
      },
      (geoError) => {
        const message =
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Allow location access to continue with bar registration.'
            : 'Could not read your current location. Please try again.';
        setLocationMessage(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(Object.keys(EMPTY).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    setError(null);
    if (!isValid) return;

    setBusy(true);
    try {
      saveRegistrationStep1(form);
      const response = await requestOwnerOtp({
        fullName: form.ownerFullName.trim(),
        mobileNumber: normalizedMobile,
      });
      setOtpMeta(response);
      setOtp(response.otpLength.toString());
      setCooldown(response.resendCooldownSeconds || 30);
      setStage('otp');
    } catch (err) {
      setError(readApiMessage(err, 'Could not send OTP. Please check the mobile number and try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (otp.length !== otpLength) {
      setError(`Enter the ${otpLength}-digit OTP sent to your mobile number.`);
      return;
    }

    setBusy(true);
    try {
      const response = await verifyOwnerOtp({ mobileNumber: normalizedMobile, otp , test:false });
      persistOwnerSession(response);
      saveRegistrationStep1(form);
      router.push('/register/documents');
    } catch (err) {
      setError(readApiMessage(err, 'Invalid or expired OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (!isValid || cooldown > 0) return;
    setError(null);
    setBusy(true);
    try {
      const response = await requestOwnerOtp({
        fullName: form.ownerFullName.trim(),
        mobileNumber: normalizedMobile,
      });
      setOtpMeta(response);
      setOtp('');
      setCooldown(response.resendCooldownSeconds || 30);
    } catch (err) {
      setError(readApiMessage(err, 'Could not resend OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  function backToBusinessInfo() {
    setStage('business');
    setOtp('');
    setError(null);
    saveRegistrationStep1(form);
  }

  function showError(field: keyof BarRegistrationStep1): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  return (
    <div className="auth-fit auth-compact w-full max-w-3xl">
      <div className="mb-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display font-semibold text-accent">S</div>
          <div>
            <p className="font-display text-lg leading-tight">SipSave</p>
            <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent-lo">Noir Console</p>
          </div>
        </div>
      </div>

      <header className="mb-1.5">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-accent-lo">
          Bar owner onboarding
        </p>
        <h1 className="mt-1 font-display text-2xl leading-tight text-ink">Register Your Bar</h1>
        <span className="gold-rule mb-1 mt-1.5" aria-hidden="true" />
        <p className="text-xs text-muted">Complete your bar registration in 3 simple steps.</p>
      </header>

      <RegistrationStepper current="BusinessInfo" />

      {stage === 'business' ? (
        <form onSubmit={onSubmit} className="card-raised p-3" noValidate>
          <div className="mb-2">
            <h2 className="font-display text-base text-ink">Business Information</h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <Field label="Bar / Restaurant Name" error={showError('businessName')} required>
              <input className="input" placeholder="e.g. Sky Lounge" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, businessName: true }))} />
            </Field>
            <Field label="Owner Full Name" error={showError('ownerFullName')} required>
              <input className="input" placeholder="e.g. Vikram Shah" value={form.ownerFullName} onChange={(e) => update('ownerFullName', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, ownerFullName: true }))} />
            </Field>
            <Field label="Email Address" error={showError('email')} required>
              <input className="input" type="email" placeholder="owner@bar.com" value={form.email} onChange={(e) => update('email', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
            </Field>
            <Field label="Mobile Number" error={showError('mobileNumber')} required>
              <input className="input" type="tel" placeholder="9876543210" value={form.mobileNumber} onChange={(e) => update('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} onBlur={() => setTouched((t) => ({ ...t, mobileNumber: true }))} />
            </Field>
          </div>

          <div className="mt-2.5">
            <Field label="Full Address" error={showError('addressLine1')} required>
              <input className="input" placeholder="3rd Floor, Tower-1, SG Highway, Ahmedabad" value={form.addressLine1} onChange={(e) => update('addressLine1', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, addressLine1: true }))} />
            </Field>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <Field label="City" error={showError('city')} required>
              <input className="input" placeholder="Ahmedabad" value={form.city} onChange={(e) => update('city', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, city: true }))} />
            </Field>
            <Field label="State" error={showError('stateCode')} required>
              <select className="select" value={form.stateCode} onChange={(e) => update('stateCode', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, stateCode: true }))}>
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Pincode" error={showError('pincode')} required>
              <input className="input" placeholder="380015" value={form.pincode} onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} onBlur={() => setTouched((t) => ({ ...t, pincode: true }))} />
            </Field>
          </div>

          <div className="mt-2.5 rounded-md border border-hairline bg-ivory px-2.5 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="field-label">Bar Location <span className="text-[color:var(--color-danger)]">*</span></span>
                <p className="text-xs text-muted">
                  {form.latitude !== null && form.longitude !== null
                    ? `${form.latitude}, ${form.longitude}`
                    : 'Capture coordinates before verification.'}
                </p>
              </div>
              <button type="button" onClick={captureCurrentLocation} disabled={locating} className="btn btn-ghost btn-sm">
                {locating ? 'Locating...' : form.latitude !== null && form.longitude !== null ? 'Update Location' : 'Use Current Location'}
              </button>
            </div>
            {(showError('latitude') || locationMessage) && (
              <p className={`mt-1 text-xs ${showError('latitude') ? 'text-[color:var(--color-danger)]' : 'text-muted'}`}>
                {showError('latitude') ?? locationMessage}
              </p>
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <Field label="Opening Time" required>
              <input className="input" type="time" value={form.openingTime} onChange={(e) => update('openingTime', e.target.value)} />
            </Field>
            <Field label="Closing Time" required>
              <input className="input" type="time" value={form.closingTime} onChange={(e) => update('closingTime', e.target.value)} />
            </Field>
          </div>

          <div className="mt-2.5">
            <span className="field-label">Bar Ambiance / Vibe Tags</span>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-hairline bg-ivory px-2.5 py-1.5">
              {AVAILABLE_TAGS.map((tag) => {
                const selected = form.ambianceTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${selected ? 'bg-accent-tint text-accent-lo' : 'bg-ivory-2 text-muted hover:text-accent-lo'}`}
                  >
                    {selected ? `${tag} x` : `+ ${tag}`}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div className="mt-2.5"><ErrorBanner>{error}</ErrorBanner></div>}

          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
            <button type="button" onClick={() => router.push('/login')} className="btn btn-ghost">
              Back to Login
            </button>
            <button type="submit" disabled={!isValid || busy} className="btn btn-primary">
              {busy ? 'Sending OTP...' : 'Verify Mobile'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onVerifyOtp} className="card-raised p-3" noValidate>
          <div className="mb-2">
            <h2 className="font-display text-base text-ink">Verify Owner Mobile</h2>
            <p className="mt-1 text-xs text-muted">
              Enter the OTP sent to {maskMobile(normalizedMobile)} before uploading verification documents.
            </p>
          </div>

          <label className="block">
            <span className="field-label">Enter OTP</span>
            <input
              className="input text-center font-numeric text-xl tracking-[0.35em]"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              placeholder="000000"
              maxLength={otpLength}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, otpLength))}
              autoFocus
            />
          </label>

          {error && <div className="mt-2.5"><ErrorBanner>{error}</ErrorBanner></div>}

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-2.5">
            <button type="button" onClick={backToBusinessInfo} className="btn btn-ghost">
              Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={resendOtp} disabled={busy || cooldown > 0} className="btn btn-ghost btn-sm">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
              <button type="submit" disabled={busy || otp.length !== otpLength} className="btn btn-primary">
                {busy ? 'Verifying...' : 'Next: Upload Documents'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label} {required && <span className="text-[color:var(--color-danger)]">*</span>}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[color:var(--color-danger)]">{error}</span>}
    </label>
  );
}

function validate(form: BarRegistrationStep1): Partial<Record<keyof BarRegistrationStep1, string>> {
  const errors: Partial<Record<keyof BarRegistrationStep1, string>> = {};
  if (form.businessName.trim().length < 2) errors.businessName = 'Bar name is required.';
  if (form.ownerFullName.trim().length < 2) errors.ownerFullName = 'Owner name is required.';
  if (!EMAIL_REGEX.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!MOBILE_REGEX.test(form.mobileNumber)) errors.mobileNumber = 'Enter a 10-digit mobile number.';
  if (form.addressLine1.trim().length < 5) errors.addressLine1 = 'Address is required.';
  if (form.city.trim().length === 0) errors.city = 'City is required.';
  if (form.stateCode === '') errors.stateCode = 'State is required.';
  if (!PINCODE_REGEX.test(form.pincode)) errors.pincode = 'Pincode must be 6 digits.';
  if (form.latitude === null || form.longitude === null) errors.latitude = 'Capture the bar location.';
  return errors;
}

function persistOwnerSession(response: VerifyOtpResponse): void {
  window.sessionStorage.setItem('sipsave-barowner-access-token', response.tokens.accessToken);
  window.sessionStorage.setItem('sipsave-barowner-refresh-token', response.tokens.refreshToken);
  window.sessionStorage.setItem('sipsave-barowner-token-type', response.tokens.tokenType);
  window.sessionStorage.setItem('sipsave-barowner-access-token-expires-at', response.tokens.accessTokenExpiresAtUtc);
  window.sessionStorage.setItem('sipsave-barowner-user', JSON.stringify(response.user));

  if (response.user.email) window.sessionStorage.setItem('sipsave-barowner-email', response.user.email);
  if (response.user.fullName) window.sessionStorage.setItem('sipsave-barowner-full-name', response.user.fullName);
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
