'use client';

/**
 * SC-19 Bar settings + danger zone — profile edit, temporary close, soft-delete.
 */

import { useCallback, useEffect, useState } from 'react';
import { getActiveBarId, setActiveBarDetails } from '@/lib/active-bar';
import {
  ApiError,
  closeBarTemporarily,
  deleteBarAccount,
  getBarOwnerSettings,
  reopenBar,
  updateBarProfile,
  type BarOwnerSettings,
} from '@/lib/api-client';
import { CloseBarModal } from '@/components/modals/CloseBarModal';
import { DeleteBarModal } from '@/components/modals/DeleteBarModal';
import { clearOwnerSessionAndRedirect } from '@/lib/owner-session';
import { useRouter } from 'next/navigation';
export default function SettingsPage() {
  const router = useRouter();
  const [barId, setBarId] = useState<number | null>(null);
  const [settings, setSettings] = useState<BarOwnerSettings | null>(null);
  const [activeWallets, setActiveWallets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [closingBar, setClosingBar] = useState(false);
  const [reopeningBar, setReopeningBar] = useState(false);
  const [deletingBar, setDeletingBar] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [photoGalleryUrls, setPhotoGalleryUrls] = useState('');
  const [ambianceTags, setAmbianceTags] = useState('');
  const [openingHoursJson, setOpeningHoursJson] = useState('');

  const loadSettings = useCallback(async (id: number) => {
    setError(null);
    const data = await getBarOwnerSettings(id);
    setSettings(data);
    setBusinessName(data.businessName);
    setDescription(data.description ?? '');
    setContactMobile(data.contactMobile);
    setContactEmail(data.contactEmail ?? '');
    setLogoUrl(data.logoUrl ?? '');
    setPhotoGalleryUrls((data.photoGalleryUrls ?? []).join('\n'));
    setAmbianceTags((data.ambianceTags ?? []).join(', '));
    setOpeningHoursJson(data.openingHoursJson ?? '');
    setActiveBarDetails({
      barId: data.barId,
      businessName: data.businessName,
      city: data.city,
      stateCode: data.stateCode,
      isVerified: data.isVerified,
      isActive: data.isActive,
      verificationQueueMessage: data.verificationQueueMessage,
    });
    return data;
  }, []);

  useEffect(() => {
    const id = getActiveBarId();
    setBarId(id);
    if (id == null) {
      setLoading(false);
      setError('No bar selected. Sign in again or pick a bar from the dashboard.');
      return;
    }

    (async () => {
      try {
        await loadSettings(id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load bar settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSettings]);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        const { getDashboard } = await import('@/lib/api-client');
        const dash = await getDashboard(barId);
        setActiveWallets(dash.kpis.activeWalletCount);
      } catch {
        // Wallet guard falls back to 0; delete modal still double-checks on server.
      }
    })();
  }, [barId, settings?.isTemporarilyClosed]);

  async function handleSaveProfile() {
    if (barId == null) return;
    setNotice(null);
    setError(null);

    const name = businessName.trim();
    if (name.length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }
    const mobile = contactMobile.trim();
    if (mobile && !/^[0-9]{10}$/.test(mobile)) {
      setError('Contact mobile must be a 10-digit number.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateBarProfile(barId, {
        businessName: name,
        description: description.trim() || null,
        contactMobile: mobile || null,
        contactEmail: contactEmail.trim() || null,
        logoUrl: logoUrl.trim() || null,
        photoGalleryUrls: splitLines(photoGalleryUrls),
        ambianceTags: splitCsv(ambianceTags),
        openingHoursJson: openingHoursJson.trim() || null,
      });
      await loadSettings(barId);
      setNotice('Profile saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleCloseConfirm(reason: string, reopenOn: string | null) {
    if (barId == null) return;
    setClosingBar(true);
    setError(null);
    try {
      await closeBarTemporarily(barId, {
        reason,
        plannedReopenOn: reopenOn,
      });
      setShowClose(false);
      await loadSettings(barId);
      setNotice('Bar closed temporarily. Existing customer wallets still work.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close bar');
    } finally {
      setClosingBar(false);
    }
  }

  async function handleReopen() {
    if (barId == null) return;
    setReopeningBar(true);
    setError(null);
    setNotice(null);
    try {
      await reopenBar(barId);
      await loadSettings(barId);
      setNotice('Bar re-opened. You are accepting new wallet purchases again.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to re-open bar');
    } finally {
      setReopeningBar(false);
    }
  }

  async function handleDeleteConfirm() {
    if (barId == null) return;
    setDeletingBar(true);
    setError(null);
    try {
      await deleteBarAccount(barId);
      setShowDelete(false);
      clearOwnerSessionAndRedirect();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete bar account');
      setDeletingBar(false);
    }
  }

  const isTemporarilyClosed = settings?.isTemporarilyClosed ?? false;

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bar settings</h1>
        <p className="text-sm text-slate-500 mt-1">Profile details and account controls.</p>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {notice && (
        <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 mb-4">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {isTemporarilyClosed && settings && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-amber-900">Bar is temporarily closed</p>
          {settings.closureReason && (
            <p className="text-sm text-amber-800 mt-1">Message to customers: {settings.closureReason}</p>
          )}
          {settings.plannedReopenOn && (
            <p className="text-sm text-amber-700 mt-1">Planned re-open: {settings.plannedReopenOn}</p>
          )}
          <button
            type="button"
            onClick={handleReopen}
            disabled={reopeningBar}
            className="mt-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 rounded-lg"
          >
            {reopeningBar ? 'Re-opening…' : 'Re-open bar'}
          </button>
        </section>
      )}

      {!loading && barId != null && (
        <>
          <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Profile</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Business name">
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border-slate-300 text-sm"
                />
              </Field>
              <Field label="Contact mobile">
                <input
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full rounded-lg border-slate-300 text-sm"
                />
              </Field>
            </div>

            <Field label="Contact email">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm"
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm"
              />
            </Field>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Logo URL">
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full rounded-lg border-slate-300 text-sm"
                />
              </Field>
              <Field label="Ambiance tags">
                <input
                  value={ambianceTags}
                  onChange={(e) => setAmbianceTags(e.target.value)}
                  placeholder="Rooftop, Live music, Lounge"
                  className="w-full rounded-lg border-slate-300 text-sm"
                />
              </Field>
            </div>

            <Field label="Photo gallery URLs">
              <textarea
                rows={3}
                value={photoGalleryUrls}
                onChange={(e) => setPhotoGalleryUrls(e.target.value)}
                placeholder="One image URL per line"
                className="w-full rounded-lg border-slate-300 text-sm"
              />
            </Field>

            <Field label="Opening hours JSON">
              <textarea
                rows={4}
                value={openingHoursJson}
                onChange={(e) => setOpeningHoursJson(e.target.value)}
                placeholder='{"Mon":{"open":"17:00","close":"01:00"}}'
                className="w-full rounded-lg border-slate-300 text-sm font-mono"
              />
            </Field>

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="mt-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
            >
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </section>

          <section className="bg-white border border-rose-200 rounded-xl p-6">
            <h2 className="font-semibold text-rose-800 text-sm mb-4">Danger zone</h2>

            {!isTemporarilyClosed && (
              <div className="flex items-start justify-between py-3 border-b border-rose-100">
                <div>
                  <p className="font-semibold text-slate-900">Close bar temporarily</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Stop accepting new wallet purchases. Existing wallets keep working.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClose(true)}
                  className="text-sm font-semibold text-amber-700 hover:bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg"
                >
                  Close temporarily
                </button>
              </div>
            )}

            <div className={`flex items-start justify-between ${isTemporarilyClosed ? '' : 'pt-4'}`}>
              <div>
                <p className="font-semibold text-slate-900">Delete account</p>
                <p className="text-sm text-slate-600 mt-1">
                  Permanently removes your bar. You cannot do this while any customer wallet is active at your bar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="text-sm font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg"
              >
                Delete account
              </button>
            </div>
          </section>
        </>
      )}

      {showClose && (
        <CloseBarModal
          busy={closingBar}
          onCancel={() => setShowClose(false)}
          onConfirm={handleCloseConfirm}
        />
      )}
      {showDelete && (
        <DeleteBarModal
          activeWalletCount={activeWallets}
          barName={settings?.businessName ?? businessName}
          busy={deletingBar}
          onCancel={() => setShowDelete(false)}
          onConfirm={handleDeleteConfirm}
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

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}
