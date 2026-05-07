'use client';

/**
 * SC-19 Bar settings + danger zone.
 *
 * Profile edits + the two danger modals are wired to client-only handlers for
 * now — the bar-profile update and close/delete endpoints land in Phase 8.
 * The wallet-balance guard in the delete modal uses the dashboard's
 * activeWalletCount as its truth source.
 */

import { useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import { ApiError, getDashboard } from '@/lib/api-client';
import { CloseBarModal } from '@/components/modals/CloseBarModal';
import { DeleteBarModal } from '@/components/modals/DeleteBarModal';

export default function SettingsPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [activeWallets, setActiveWallets] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Profile form — placeholder state; Phase 8 will hydrate from a bars endpoint.
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        const dash = await getDashboard(barId);
        setActiveWallets(dash.kpis.activeWalletCount);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load bar info');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bar settings</h1>
        <p className="text-sm text-slate-500 mt-1">Profile details and account controls.</p>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {/* ── Profile ─────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-slate-800 text-sm mb-4">Profile</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Business name">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                   className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
          <Field label="Contact mobile">
            <input value={contactMobile} onChange={(e) => setContactMobile(e.target.value)}
                   className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
        </div>

        <Field label="Contact email">
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                 className="w-full rounded-lg border-slate-300 text-sm" />
        </Field>

        <Field label="Description">
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border-slate-300 text-sm" />
        </Field>

        <button
          className="mt-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
          disabled
          title="Profile edit endpoint lands in Phase 8"
        >
          Save profile
        </button>
      </section>

      {/* ── Danger zone ─────────────────────────── */}
      <section className="bg-white border border-rose-200 rounded-xl p-6">
        <h2 className="font-semibold text-rose-800 text-sm mb-4">Danger zone</h2>

        <div className="flex items-start justify-between py-3 border-b border-rose-100">
          <div>
            <p className="font-semibold text-slate-900">Close bar temporarily</p>
            <p className="text-sm text-slate-600 mt-1">
              Stop accepting new wallet purchases. Existing wallets keep working.
            </p>
          </div>
          <button
            onClick={() => setShowClose(true)}
            className="text-sm font-semibold text-amber-700 hover:bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg"
          >
            Close temporarily
          </button>
        </div>

        <div className="flex items-start justify-between pt-4">
          <div>
            <p className="font-semibold text-slate-900">Delete account</p>
            <p className="text-sm text-slate-600 mt-1">
              Permanently removes your bar. You cannot do this while any customer wallet is active at your bar.
            </p>
          </div>
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg"
          >
            Delete account
          </button>
        </div>
      </section>

      {showClose && (
        <CloseBarModal
          onCancel={() => setShowClose(false)}
          onConfirm={() => {
            setShowClose(false);
            alert('Close-temporarily endpoint lands in Phase 8.');
          }}
        />
      )}
      {showDelete && (
        <DeleteBarModal
          activeWalletCount={activeWallets}
          onCancel={() => setShowDelete(false)}
          onConfirm={() => {
            setShowDelete(false);
            alert('Delete-bar endpoint lands in Phase 8.');
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600 space-y-1 mb-4">
      <span>{label}</span>
      {children}
    </label>
  );
}
