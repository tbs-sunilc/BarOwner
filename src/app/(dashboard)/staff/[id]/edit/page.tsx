'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  getStaffById,
  type StaffRowDto,
  type UpdateStaffPayload,
  updateStaff,
} from '@/lib/api-client';

export default function EditStaffPage() {
  const params = useParams() as { id?: string };
  const router = useRouter();
  const staffId = Number(params.id);

  const [staff, setStaff] = useState<StaffRowDto | null>(null);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRowDto['role']>('Bartender');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    setLoading(true);
    setError(null);

    getStaffById(staffId)
      .then((row) => {
        setStaff(row);
        setFullName(row.fullName);
        setMobile(row.mobileNumber);
        setEmail(row.email ?? '');
        setRole(row.role);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load staff');
      })
      .finally(() => setLoading(false));
  }, [params.id, staffId]);

  const warning = useMemo(() => {
    if (!fullName.trim()) return 'Enter the staff member\'s full name.';
    if (!/^[\+]?\d{10,15}$/.test(mobile.replace(/\s/g, ''))) return 'Enter a valid mobile number.';
    if (sendEmail && !email.trim()) return 'Enter the staff member\'s email to send the notification.';
    if (sendEmail && !password.trim()) return 'Enter a password to send login details by email.';
    if (password && password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }, [fullName, mobile, email, password, sendEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (warning) { setError(warning); return; }
    if (Number.isNaN(staffId) || staffId <= 0) { setError('Invalid staff identifier.'); return; }

    const payload: UpdateStaffPayload = {
      fullName: fullName.trim(),
      mobileNumber: mobile.trim(),
      email: email.trim() || null,
      role,
      password: password.trim() || undefined,
      sendEmail,
    };

    setSubmitting(true);
    setError(null);

    try {
      await updateStaff(staffId, payload);
      router.push('/staff');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update staff');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <Link href="/staff" className="text-sm text-slate-500 hover:text-slate-700">← Back to staff</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Edit staff account</h1>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {!loading && staff && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={150}
                className="w-full rounded-lg border-slate-300 text-sm"
              />
            </Field>

            <Field label="Mobile number (tablet login)">
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full rounded-lg border-slate-300 text-sm"
              />
            </Field>

            <Field label="Email (optional)">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg border-slate-300 text-sm"
              />
              <div className="mt-3 flex items-center gap-3">
                <input
                  id="sendEmail"
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600"
                />
                <label htmlFor="sendEmail" className="text-sm text-slate-700">
                  Send staff login details by email
                </label>
              </div>
            </Field>

            <Field label="Role">
              <div className="grid grid-cols-2 gap-2">
                {(['Bartender', 'Manager'] as StaffRowDto['role'][]).map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setRole(option)}
                    className={
                      'px-4 py-3 rounded-lg border text-sm font-medium text-left transition ' +
                      (role === option
                        ? 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Reset password (optional)">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="w-full rounded-lg border-slate-300 text-sm font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave blank to keep the current password, or enter a new one to reset it immediately.
              </p>
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !!warning}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
              <Link href="/staff" className="px-5 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      )}
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
