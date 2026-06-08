'use client';

/**
 * SC-12 Add staff.
 *
 * The right-rail role info panel rerenders against the selected role so the
 * owner sees exactly what capabilities they're granting before they submit.
 * The starter password is stamped with MustResetPassword=true server-side —
 * the staff member rotates it on first login (Phase 8 auth flow).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  createStaff,
  type CreateStaffPayload,
} from '@/lib/api-client';

type Role = 'Bartender' | 'Manager';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_INFO: Record<Role, { label: string; copy: string; capabilities: string[] }> = {
  Bartender: {
    label: 'Bartender',
    copy: 'Can serve pours on the tablet, accept food orders, and handle customer sessions.',
    capabilities: [
      'Scan customer QR and view session',
      'Serve pour requests (SC-22 → SC-23)',
      'Accept + serve food orders',
      'View today\'s shift summary',
    ],
  },
  Manager: {
    label: 'Manager',
    copy: 'Everything a bartender can do, plus inventory adjustments and day-close.',
    capabilities: [
      'Everything bartenders can do',
      'Adjust stock on the inventory screen',
      'Void / refund pour requests',
      'Close the day + run shift report',
      'Temporarily close the bar',
    ],
  },
};

export default function AddStaffPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Bartender');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warning = useMemo(() => {
    if (!fullName.trim()) return 'Enter the staff member\'s full name.';
    if (!/^[\+]?[0-9]{10,15}$/.test(mobile.replace(/\s/g, ''))) return 'Enter a valid mobile number.';
    if (!EMAIL_REGEX.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }, [email, fullName, mobile, password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (warning) { setError(warning); return; }
    const barId = getActiveBarId();
    if (barId == null) { setError('No active bar.'); return; }

    const payload: CreateStaffPayload = {
      fullName: fullName.trim(),
      mobileNumber: mobile.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    };

    setSubmitting(true);
    setError(null);
    try {
      await createStaff(barId, payload);
      router.push('/staff');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  }

  const info = ROLE_INFO[role];

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <Link href="/staff" className="text-sm text-slate-500 hover:text-slate-700">← Back to staff</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Add staff</h1>
      </header>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-6">
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <Field label="Full name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={150}
                   className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>

          <Field label="Mobile number">
            <input value={mobile} onChange={(e) => setMobile(e.target.value)}
                   placeholder="+91 9876543210"
                   className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>

          <Field label="Email address (used for login)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200}
                   required
                   autoComplete="email"
                   placeholder="staff@bar.com"
                   className="w-full rounded-lg border-slate-300 text-sm" />
            <p className="text-xs text-slate-500 mt-1">
              This is the tablet login ID and the address used for password resets.
            </p>
          </Field>

          <Field label="Starter password">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8}
                   className="w-full rounded-lg border-slate-300 text-sm font-mono" />
            <p className="text-xs text-slate-500 mt-1">
              They&apos;ll be forced to change it on first tablet login.
            </p>
          </Field>

          <Field label="Role">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={[
                    'px-4 py-3 rounded-lg border text-sm font-medium transition text-left',
                    role === r
                      ? 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  {ROLE_INFO[r].label}
                </button>
              ))}
            </div>
          </Field>

          {error && (
            <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 text-sm">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !!warning}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
            >
              {submitting ? 'Creating…' : 'Create staff account'}
            </button>
            <Link href="/staff" className="px-5 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="bg-slate-50 border border-slate-200 rounded-xl p-5 h-fit">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Role info</p>
          <h3 className="font-semibold text-slate-900">{info.label}</h3>
          <p className="text-sm text-slate-600 mt-1">{info.copy}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {info.capabilities.map((cap) => (
              <li key={cap} className="flex gap-2 text-slate-700">
                <span className="text-emerald-600">✓</span>
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  );
}
