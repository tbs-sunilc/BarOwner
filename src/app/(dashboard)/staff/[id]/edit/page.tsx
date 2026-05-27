'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, getStaff, resetStaffPassword, updateStaff, type StaffRowDto } from '@/lib/api-client';

export default function EditStaffPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const staffId = Number(params.id);

  const [row, setRow] = useState<StaffRowDto | null>(null);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Manager' | 'Bartender'>('Bartender');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getStaff(staffId);
        setRow(data);
        setFullName(data.fullName);
        setMobileNumber(data.mobileNumber);
        setEmail(data.email ?? '');
        setRole(data.role);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load staff');
      } finally {
        setLoading(false);
      }
    })();
  }, [staffId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (fullName.trim().length < 2) { setError('Enter the staff member name.'); return; }
    if (!/^\+?[0-9]{10,15}$/.test(mobileNumber.trim())) { setError('Enter a valid mobile number.'); return; }

    setSaving(true);
    try {
      const updated = await updateStaff(staffId, {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || null,
        role,
      });
      setRow(updated);
      setNotice('Staff profile saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save staff');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    setError(null);
    setNotice(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setResetting(true);
    try {
      const updated = await resetStaffPassword(staffId, password);
      setRow(updated);
      setPassword('');
      setNotice('Password reset. Staff must change it on next login.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/staff" className="text-sm text-slate-500 hover:text-slate-700">Back to staff</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Edit staff</h1>
      </header>

      {loading && <p className="text-slate-400">Loading...</p>}
      {notice && <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 mb-4">{notice}</p>}
      {error && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">{error}</p>}

      {!loading && row && (
        <div className="space-y-6">
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
              <Field label="Role">
                <select value={role} onChange={(e) => setRole(e.target.value as 'Manager' | 'Bartender')} className="w-full rounded-lg border-slate-300 text-sm">
                  <option value="Bartender">Bartender</option>
                  <option value="Manager">Manager</option>
                </select>
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Mobile">
                <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
            </div>
            <button disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
              {saving ? 'Saving...' : 'Save staff'}
            </button>
          </form>

          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Reset password</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New starter password"
                className="flex-1 rounded-lg border-slate-300 text-sm"
              />
              <button type="button" onClick={handlePasswordReset} disabled={resetting} className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                {resetting ? 'Resetting...' : 'Reset password'}
              </button>
            </div>
          </section>

          <button type="button" onClick={() => router.push('/staff')} className="text-sm text-slate-600 hover:text-slate-900">Done</button>
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
