'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { RegistrationStepper } from '@/components/ui/RegistrationStepper';
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

const EMPTY: BarRegistrationStep1 = {
  businessName: '',
  ownerFullName: '',
  email: '',
  mobileNumber: '',
  addressLine1: '',
  city: '',
  stateCode: '',
  pincode: '',
  openingTime: '18:00',
  closingTime: '01:00',
  ambianceTags: ['Rooftop'],
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<BarRegistrationStep1>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const restored = loadRegistrationStep1();
    if (restored) setForm(restored);
  }, []);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(Object.keys(EMPTY).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    if (!isValid) return;
    saveRegistrationStep1(form);
    router.push('/register/documents');
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
                  {selected ? `${tag} ×` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
          <button type="button" onClick={() => router.push('/login')} className="btn btn-ghost">
            ← Back to Login
          </button>
          <button type="submit" disabled={!isValid} className="btn btn-primary">
            Next: Upload Documents →
          </button>
        </div>
      </form>
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
  return errors;
}
