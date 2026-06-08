'use client';

import { useCallback, useEffect, useState } from 'react';
import { getActiveBarId, setActiveBarDetails } from '@/lib/active-bar';
import {
  ApiError,
  closeBarTemporarily,
  deleteBarAccount,
  getBarOwnerSettings,
  reopenBar,
  updateBarProfile,
  uploadBarMedia,
  type BarOwnerSettings,
} from '@/lib/api-client';
import { CloseBarModal } from '@/components/modals/CloseBarModal';
import { DeleteBarModal } from '@/components/modals/DeleteBarModal';
import { clearOwnerSessionAndRedirect } from '@/lib/owner-session';
import { useRouter } from 'next/navigation';

const TABS = ['General', 'Location', 'Media & Vibe', 'Operating Hours', 'Legal & KYC', 'Danger Zone'] as const;
type TabName = typeof TABS[number];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SettingsPage() {
  const router = useRouter();
  const [barId, setBarId] = useState<number | null>(null);
  const [settings, setSettings] = useState<BarOwnerSettings | null>(null);
  const [activeWallets, setActiveWallets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabName>('General');

  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [closingBar, setClosingBar] = useState(false);
  const [reopeningBar, setReopeningBar] = useState(false);
  const [deletingBar, setDeletingBar] = useState(false);

  // Form states
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [ambianceTags, setAmbianceTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const [openingHours, setOpeningHours] = useState<Record<string, { open: string; close: string }>>({});

  const loadSettings = useCallback(async (id: number) => {
    setError(null);
    const data = await getBarOwnerSettings(id);
    setSettings(data);
    setBusinessName(data.businessName || '');
    setDescription(data.description || '');
    setContactMobile(data.contactMobile || '');
    setContactEmail(data.contactEmail || '');

    setAddressLine1(data.addressLine1 || '');
    setAddressLine2(data.addressLine2 || '');
    setLocality(data.locality || '');
    setPincode(data.pincode || '');
    setLatitude(data.latitude?.toString() || '');
    setLongitude(data.longitude?.toString() || '');

    try {
      if (data.ambianceTagsJson) {
        setAmbianceTags(JSON.parse(data.ambianceTagsJson));
      }
    } catch { setAmbianceTags([]); }

    try {
      if (data.openingHoursJson) {
        setOpeningHours(JSON.parse(data.openingHoursJson));
      } else {
        setOpeningHours({});
      }
    } catch { setOpeningHours({}); }

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
      } catch {}
    })();
  }, [barId, settings?.isTemporarilyClosed]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function handleSaveProfile() {
    if (barId == null) return;
    setNotice(null);
    setError(null);

    const name = businessName.trim();
    if (name.length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateBarProfile(barId, {
        businessName: name,
        description: description.trim() || null,
        contactMobile: contactMobile.trim() || null,
        contactEmail: contactEmail.trim() || null,
        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        locality: locality.trim() || null,
        pincode: pincode.trim() || null,
        latitude: parseFloat(latitude) || null,
        longitude: parseFloat(longitude) || null,
        ambianceTags: ambianceTags,
        openingHoursJson: JSON.stringify(openingHours),
      });

      if (logoFile || galleryFiles.length > 0) {
        const formData = new FormData();
        if (logoFile) formData.append('logo', logoFile);
        galleryFiles.forEach(file => formData.append('photoGallery', file));
        try {
          await uploadBarMedia(barId, formData);
        } catch (e) {
          console.warn('Media upload failed', e);
        }
      }

      await loadSettings(barId);
      setNotice('Settings saved.');
      setLogoFile(null);
      setGalleryFiles([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSavingProfile(false);
    }
  }

  // Tags logic
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!ambianceTags.includes(tagInput.trim())) {
        setAmbianceTags([...ambianceTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };
  const removeTag = (t: string) => setAmbianceTags(ambianceTags.filter(tag => tag !== t));

  // Danger handlers
  async function handleCloseConfirm(reason: string, reopenOn: string | null) {
    if (barId == null) return;
    setClosingBar(true);
    try {
      await closeBarTemporarily(barId, { reason, plannedReopenOn: reopenOn });
      setShowClose(false);
      await loadSettings(barId);
      setNotice('Bar closed temporarily.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close bar');
    } finally { setClosingBar(false); }
  }

  async function handleReopen() {
    if (barId == null) return;
    setReopeningBar(true);
    try {
      await reopenBar(barId);
      await loadSettings(barId);
      setNotice('Bar re-opened.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to re-open bar');
    } finally { setReopeningBar(false); }
  }

  async function handleDeleteConfirm() {
    if (barId == null) return;
    setDeletingBar(true);
    try {
      await deleteBarAccount(barId);
      clearOwnerSessionAndRedirect();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete bar');
      setDeletingBar(false);
    }
  }

  const isTemporarilyClosed = settings?.isTemporarilyClosed ?? false;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'General':
        return (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">General Profile</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Business name">
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
              <Field label="Contact mobile">
                <input value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} maxLength={10} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
            </div>
            <Field label="Contact email">
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
            </Field>
            <Field label="Description">
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
            </Field>
          </div>
        );

      case 'Location':
        return (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Physical Location</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="City (Read Only)">
                <input value={settings?.city || ''} readOnly className="w-full rounded-lg border-slate-200 bg-slate-50 text-slate-500 text-sm" />
              </Field>
              <Field label="State Code (Read Only)">
                <input value={settings?.stateCode || ''} readOnly className="w-full rounded-lg border-slate-200 bg-slate-50 text-slate-500 text-sm" />
              </Field>
            </div>
            <Field label="Address Line 1">
              <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
            </Field>
            <Field label="Address Line 2">
              <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Locality">
                <input value={locality} onChange={e => setLocality(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
              <Field label="Pincode">
                <input value={pincode} onChange={e => setPincode(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Latitude">
                <input type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
              <Field label="Longitude">
                <input type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
              </Field>
            </div>
          </div>
        );

      case 'Media & Vibe':
        return (
          <div className="space-y-6">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Media & Vibe</h2>
            <Field label="Ambiance Tags (Press Enter to add)">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="e.g. Cozy, Rooftop, Live Music"
                className="w-full rounded-lg border-slate-300 text-sm"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {ambianceTags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-violet-600 hover:text-violet-900">&times;</button>
                  </span>
                ))}
              </div>
            </Field>
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="Logo Upload">
                <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} className="text-sm w-full border border-slate-200 rounded-lg p-2" />
                {(logoPreviewUrl || settings?.logoUrl) && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img
                        src={logoPreviewUrl ?? settings?.logoUrl ?? undefined}
                        alt="Bar logo preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {logoPreviewUrl ? 'New logo selected. Save to upload.' : 'Current logo on server.'}
                    </p>
                  </div>
                )}
              </Field>
              <Field label="Photo Gallery">
                <input type="file" accept="image/*" multiple onChange={e => setGalleryFiles(Array.from(e.target.files || []))} className="text-sm w-full border border-slate-200 rounded-lg p-2" />
                {settings?.photoGalleryJson && galleryFiles.length === 0 && <p className="text-xs text-slate-500 mt-1">Current gallery exists on server.</p>}
              </Field>
            </div>
          </div>
        );

      case 'Operating Hours':
        return (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Operating Hours</h2>
            {DAYS.map(day => (
              <div key={day} className="flex flex-wrap items-center gap-4 mb-2">
                <span className="w-12 text-sm font-medium text-slate-700">{day}</span>
                <input
                  type="time"
                  value={openingHours[day]?.open || ''}
                  onChange={e => setOpeningHours({ ...openingHours, [day]: { ...openingHours[day], open: e.target.value } })}
                  className="rounded-lg border-slate-300 text-sm w-32"
                />
                <span className="text-sm text-slate-500">to</span>
                <input
                  type="time"
                  value={openingHours[day]?.close || ''}
                  onChange={e => setOpeningHours({ ...openingHours, [day]: { ...openingHours[day], close: e.target.value } })}
                  className="rounded-lg border-slate-300 text-sm w-32"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newHours = { ...openingHours };
                    delete newHours[day];
                    setOpeningHours(newHours);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        );

      case 'Legal & KYC':
        return (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Legal & KYC</h2>
            {settings?.rejectionReason && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg mb-6 flex flex-col gap-2">
                <p className="font-semibold text-rose-800 text-sm">KYC Rejected</p>
                <p className="text-sm text-rose-700">{settings.rejectionReason}</p>
                <p className="text-xs font-medium text-rose-600 bg-rose-100 p-2 rounded-md self-start">Please contact support to re-upload documents.</p>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="GSTIN">
                <input value={settings?.gstin || ''} readOnly className="w-full rounded-lg border-slate-200 bg-slate-50 text-slate-500 text-sm" />
              </Field>
              <Field label="FSSAI Licence Number">
                <input value={settings?.fssaiLicenceNumber || ''} readOnly className="w-full rounded-lg border-slate-200 bg-slate-50 text-slate-500 text-sm" />
              </Field>
              <Field label="Liquor Licence Number">
                <input value={settings?.liquorLicenceNumber || ''} readOnly className="w-full rounded-lg border-slate-200 bg-slate-50 text-slate-500 text-sm" />
              </Field>
            </div>
            <div className="mt-4">
               <p className="text-xs text-slate-500">Note: Modifying Legal & KYC details requires admin approval.</p>
            </div>
          </div>
        );

      case 'Danger Zone':
        return (
          <section className="bg-white border border-rose-200 rounded-xl p-6">
            <h2 className="font-semibold text-rose-800 text-sm mb-4">Danger zone</h2>
            {!isTemporarilyClosed && (
              <div className="flex items-start justify-between py-3 border-b border-rose-100">
                <div>
                  <p className="font-semibold text-slate-900">Close bar temporarily</p>
                  <p className="text-sm text-slate-600 mt-1">Stop accepting new wallet purchases.</p>
                </div>
                <button onClick={() => setShowClose(true)} className="text-sm font-semibold text-amber-700 hover:bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">Close temporarily</button>
              </div>
            )}
            <div className={`flex items-start justify-between ${isTemporarilyClosed ? '' : 'pt-4'}`}>
              <div>
                <p className="font-semibold text-slate-900">Delete account</p>
                <p className="text-sm text-slate-600 mt-1">Permanently removes your bar. Cannot have active customer wallets.</p>
              </div>
              <button onClick={() => setShowDelete(true)} className="text-sm font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">Delete account</button>
            </div>
          </section>
        );
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bar settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile, media, hours, and legal details.</p>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {notice && <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 mb-4">{notice}</p>}
      {error && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">{error}</p>}

      {isTemporarilyClosed && settings && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-amber-900">Bar is temporarily closed</p>
          {settings.closureReason && <p className="text-sm text-amber-800 mt-1">Reason: {settings.closureReason}</p>}
          <button onClick={handleReopen} disabled={reopeningBar} className="mt-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg">
            {reopeningBar ? 'Re-opening…' : 'Re-open bar'}
          </button>
        </section>
      )}

      {!loading && barId != null && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Tabs Navigation */}
          <div className="w-full md:w-48 shrink-0 flex flex-col gap-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab 
                    ? 'bg-violet-50 text-violet-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1">
             <div className="bg-white border border-slate-200 rounded-xl p-6">
              {renderTabContent()}

              {activeTab !== 'Danger Zone' && activeTab !== 'Legal & KYC' && (
                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg disabled:opacity-60 transition-colors"
                  >
                    {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
             </div>
          </div>
        </div>
      )}

      {showClose && <CloseBarModal busy={closingBar} onCancel={() => setShowClose(false)} onConfirm={handleCloseConfirm} />}
      {showDelete && <DeleteBarModal activeWalletCount={activeWallets} barName={settings?.businessName ?? businessName} busy={deletingBar} onCancel={() => setShowDelete(false)} onConfirm={handleDeleteConfirm} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700 space-y-1.5 mb-4 w-full">
      <span>{label}</span>
      {children}
    </label>
  );
}
