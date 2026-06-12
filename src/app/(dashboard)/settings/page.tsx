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

type ToneKey = 'violet' | 'sky' | 'amber' | 'emerald' | 'rose' | 'red';

const TAB_META: Record<TabName, { eyebrow: string; description: string; tone: ToneKey }> = {
  General: {
    eyebrow: 'Brand identity',
    description: 'Update the bar name, contact details, and the short description customers see first.',
    tone: 'violet',
  },
  Location: {
    eyebrow: 'Location details',
    description: 'Keep the address and coordinates accurate for staff, maps, and discovery.',
    tone: 'sky',
  },
  'Media & Vibe': {
    eyebrow: 'Visual story',
    description: 'Upload your logo, photo gallery, and ambiance tags so the bar feels alive and inviting.',
    tone: 'amber',
  },
  'Operating Hours': {
    eyebrow: 'Service window',
    description: 'Set weekly opening times so customers and staff always know when you are open.',
    tone: 'emerald',
  },
  'Legal & KYC': {
    eyebrow: 'Compliance',
    description: 'Review legal identifiers and KYC status before changes go live.',
    tone: 'rose',
  },
  'Danger Zone': {
    eyebrow: 'High impact',
    description: 'Temporarily close or permanently remove the bar with clear guardrails.',
    tone: 'red',
  },
};

const TONE_STYLES: Record<
  ToneKey,
  {
    buttonActive: string;
    buttonAccent: string;
    buttonDot: string;
    buttonIndex: string;
    headerBg: string;
    headerText: string;
    accentBar: string;
    badge: string;
  }
> = {
  violet: {
    buttonActive: 'border-violet-200 bg-violet-50 shadow-[0_10px_30px_rgba(139,92,246,0.08)]',
    buttonAccent: 'border-violet-200 bg-violet-100',
    buttonDot: 'bg-violet-500',
    buttonIndex: 'text-violet-700',
    headerBg: 'bg-gradient-to-r from-violet-50 to-white',
    headerText: 'text-violet-700',
    accentBar: 'bg-violet-500',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  sky: {
    buttonActive: 'border-sky-200 bg-sky-50 shadow-[0_10px_30px_rgba(14,165,233,0.08)]',
    buttonAccent: 'border-sky-200 bg-sky-100',
    buttonDot: 'bg-sky-500',
    buttonIndex: 'text-sky-700',
    headerBg: 'bg-gradient-to-r from-sky-50 to-white',
    headerText: 'text-sky-700',
    accentBar: 'bg-sky-500',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  amber: {
    buttonActive: 'border-amber-200 bg-amber-50 shadow-[0_10px_30px_rgba(245,158,11,0.08)]',
    buttonAccent: 'border-amber-200 bg-amber-100',
    buttonDot: 'bg-amber-500',
    buttonIndex: 'text-amber-700',
    headerBg: 'bg-gradient-to-r from-amber-50 to-white',
    headerText: 'text-amber-700',
    accentBar: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  emerald: {
    buttonActive: 'border-emerald-200 bg-emerald-50 shadow-[0_10px_30px_rgba(16,185,129,0.08)]',
    buttonAccent: 'border-emerald-200 bg-emerald-100',
    buttonDot: 'bg-emerald-500',
    buttonIndex: 'text-emerald-700',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-white',
    headerText: 'text-emerald-700',
    accentBar: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rose: {
    buttonActive: 'border-rose-200 bg-rose-50 shadow-[0_10px_30px_rgba(244,63,94,0.08)]',
    buttonAccent: 'border-rose-200 bg-rose-100',
    buttonDot: 'bg-rose-500',
    buttonIndex: 'text-rose-700',
    headerBg: 'bg-gradient-to-r from-rose-50 to-white',
    headerText: 'text-rose-700',
    accentBar: 'bg-rose-500',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  red: {
    buttonActive: 'border-red-200 bg-red-50 shadow-[0_10px_30px_rgba(239,68,68,0.10)]',
    buttonAccent: 'border-red-200 bg-red-100',
    buttonDot: 'bg-red-500',
    buttonIndex: 'text-red-700',
    headerBg: 'bg-gradient-to-r from-red-50 to-white',
    headerText: 'text-red-700',
    accentBar: 'bg-red-500',
    badge: 'border-red-200 bg-red-50 text-red-700',
  },
};

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
      logoUrl: data.logoUrl,
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
  const activeTabMeta = TAB_META[activeTab];
  const activeTabTone = TONE_STYLES[activeTabMeta.tone];
  const activeTabIndex = TABS.indexOf(activeTab) + 1;
  const headerStats = [
    {
      label: 'Active wallets',
      value: String(activeWallets),
      note: 'Live customer balances',
    },
    {
      label: 'Current section',
      value: String(activeTabIndex).padStart(2, '0'),
      note: activeTabMeta.eyebrow,
    },
    {
      label: 'Workspace',
      value: isTemporarilyClosed ? 'Closed' : 'Live',
      note: 'Owner controls ready',
    },
  ];

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

  const displayBusinessName = settings?.businessName?.trim() || businessName.trim() || 'your bar';
  const displayLocation = [settings?.city, settings?.stateCode].filter((value) => Boolean(value)).join(', ');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.10),_transparent_24%),linear-gradient(180deg,_#fffdfa_0%,_#faf7f2_100%)] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className={`h-1 ${activeTabTone.accentBar}`} />
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)] lg:px-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${isTemporarilyClosed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    Bar owner workspace
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Bar settings</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Keep your venue profile, media, operating hours, and legal details polished from one place.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${isTemporarilyClosed ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                    <span className={`h-2 w-2 rounded-full ${isTemporarilyClosed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {isTemporarilyClosed ? 'Temporarily closed' : 'Live workspace'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    Wallets: {activeWallets}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${activeTabTone.badge}`}>
                    Section {String(activeTabIndex).padStart(2, '0')} of {String(TABS.length).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {headerStats.map((stat) => (
                  <article key={stat.label} className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{stat.label}</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                      <span className={`h-2.5 w-2.5 rounded-full ${activeTabTone.buttonDot}`} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[26px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/50">Currently editing</p>
              <div className="mt-4 flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold ${activeTabTone.buttonAccent} ${activeTabTone.buttonIndex}`}>
                  {String(activeTabIndex).padStart(2, '0')}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-white">{activeTab}</h2>
                  <p className="mt-1 text-sm leading-6 text-white/70">{activeTabMeta.description}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Bar</p>
                  <p className="mt-1 text-sm font-semibold text-white">{displayBusinessName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Location</p>
                  <p className="mt-1 text-sm font-semibold text-white">{displayLocation || 'Not set yet'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Status</p>
                  <p className="mt-1 text-sm font-semibold text-white">{isTemporarilyClosed ? 'Closed for now' : 'Accepting updates'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Tone</p>
                  <p className="mt-1 text-sm font-semibold text-white">{activeTabMeta.eyebrow}</p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {loading && (
          <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white/85 p-6 shadow-sm lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-[22px] bg-slate-100" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-16 animate-pulse rounded-[26px] bg-slate-100" />
              <div className="h-72 animate-pulse rounded-[28px] bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[24px] bg-slate-100" />
            </div>
          </section>
        )}

        {notice && (
          <section className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900 shadow-sm">
            {notice}
          </section>
        )}

        {error && (
          <section className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-900 shadow-sm">
            {error}
          </section>
        )}

        {isTemporarilyClosed && settings && (
          <section className="rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
                  Temporary closure active
                </div>
                <p className="text-lg font-semibold text-amber-950">Bar is temporarily closed</p>
                {settings.closureReason && <p className="max-w-3xl text-sm leading-6 text-amber-900/80">Reason: {settings.closureReason}</p>}
              </div>
              <button
                type="button"
                onClick={handleReopen}
                disabled={reopeningBar}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reopeningBar ? 'Re-opening...' : 'Re-open bar'}
              </button>
            </div>
          </section>
        )}

        {!loading && barId != null && (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <section className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-1 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">Sections</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Move across every setting area without losing context.</p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                    {String(TABS.length).padStart(2, '0')}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {TABS.map((tab, index) => {
                    const meta = TAB_META[tab];
                    const tone = TONE_STYLES[meta.tone];
                    const isActive = activeTab === tab;

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        aria-pressed={isActive}
                        className={`group flex w-full items-start gap-4 rounded-[22px] border px-4 py-4 text-left transition-all duration-200 ${
                          isActive
                            ? `${tone.buttonActive} border-transparent`
                            : 'border-slate-200 bg-white/80 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold transition-colors ${
                            isActive ? `${tone.buttonAccent} ${tone.buttonIndex}` : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className={`text-sm font-semibold ${isActive ? 'text-slate-950' : 'text-slate-700'}`}>{tab}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                                isActive ? tone.badge : 'border-slate-200 bg-slate-50 text-slate-500'
                              }`}
                            >
                              {meta.eyebrow}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{meta.description}</span>
                        </span>

                        <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${isActive ? tone.buttonDot : 'bg-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/50">Workspace snapshot</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Bar</span>
                    <span className="text-sm font-semibold text-white">{displayBusinessName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Section</span>
                    <span className="text-sm font-semibold text-white">
                      {String(activeTabIndex).padStart(2, '0')} / {String(TABS.length).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Wallets</span>
                    <span className="text-sm font-semibold text-white">{activeWallets}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Mode</span>
                    <span className="text-sm font-semibold text-white">{isTemporarilyClosed ? 'Closed' : 'Live'}</span>
                  </div>
                </div>
              </section>
            </aside>

            <main className="space-y-4">
              <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className={`border-b border-slate-200/80 px-6 py-5 sm:px-8 ${activeTabTone.headerBg}`}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${activeTabTone.badge}`}>
                          Section {String(activeTabIndex).padStart(2, '0')}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {activeTabMeta.eyebrow}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{activeTab}</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{activeTabMeta.description}</p>
                      </div>
                    </div>

                    <div className="grid min-w-[240px] gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Primary focus</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{displayBusinessName}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Location</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{displayLocation || 'Not set yet'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8">
                  <div className="space-y-6">{renderTabContent()}</div>

                  {activeTab !== 'Danger Zone' && activeTab !== 'Legal & KYC' && (
                    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-2xl text-sm leading-6 text-slate-500">
                        Save once to push updates across the owner dashboard and customer-facing profile.
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${activeTabTone.accentBar}`}
                      >
                        {savingProfile ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </main>
          </div>
        )}

        {showClose && <CloseBarModal busy={closingBar} onCancel={() => setShowClose(false)} onConfirm={handleCloseConfirm} />}
        {showDelete && <DeleteBarModal activeWalletCount={activeWallets} barName={settings?.businessName ?? businessName} busy={deletingBar} onCancel={() => setShowDelete(false)} onConfirm={handleDeleteConfirm} />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block w-full space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
