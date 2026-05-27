'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBanner } from '@/components/ui';
import { RegistrationStepper } from '@/components/ui/RegistrationStepper';
import { ApiError, registerBar, submitBarDocumentsForm, type RegisterBarPayload } from '@/lib/api-client';
import { clearRegistrationStep1, loadRegistrationStep1, type BarRegistrationStep1 } from '@/lib/registration-storage';
import { saveKycStatus } from '@/lib/kyc-status';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const FSSAI_REGEX = /^[0-9]{14}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_PHOTOS = 3;

type SingleDocSlot = 'liquor' | 'fssai' | 'gstin';
type DocsState = { liquor: File | null; fssai: File | null; gstin: File | null; photos: File[] };

const EMPTY_DOCS: DocsState = { liquor: null, fssai: null, gstin: null, photos: [] };

export default function DocumentsPage() {
  const router = useRouter();
  const [step1, setStep1] = useState<BarRegistrationStep1 | null>(null);
  const [docs, setDocs] = useState<DocsState>(EMPTY_DOCS);
  const [gstin, setGstin] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [liquorNumber, setLiquorNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const liquorRef = useRef<HTMLInputElement>(null);
  const fssaiRef = useRef<HTMLInputElement>(null);
  const gstinRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const restored = loadRegistrationStep1();
    if (!restored) {
      router.replace('/register');
      return;
    }
    setStep1(restored);
  }, [router]);

  const gstinValid = GSTIN_REGEX.test(gstin);
  const fssaiValid = FSSAI_REGEX.test(fssaiNumber);
  const liquorValid = liquorNumber.trim().length > 0;
  const docsComplete = !!docs.liquor && !!docs.fssai && !!docs.gstin && docs.photos.length >= MIN_PHOTOS;
  const canSubmit = gstinValid && fssaiValid && liquorValid && docsComplete && !submitting;
  const photoCountLabel = useMemo(() => `${docs.photos.length} photo${docs.photos.length === 1 ? '' : 's'}`, [docs.photos.length]);

  function pickSingle(slot: SingleDocSlot, file: File | null) {
    setErrorBanner(null);
    if (file && file.size > MAX_FILE_BYTES) {
      setErrorBanner(`File "${file.name}" exceeds the 5 MB limit.`);
      return;
    }
    setDocs((d) => ({ ...d, [slot]: file }));
  }

  function pickPhotos(files: FileList | null) {
    setErrorBanner(null);
    if (!files?.length) return;
    const arr = Array.from(files);
    const tooBig = arr.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setErrorBanner(`File "${tooBig.name}" exceeds the 5 MB limit.`);
      return;
    }
    setDocs((d) => ({ ...d, photos: [...d.photos, ...arr] }));
  }

  async function onSubmit() {
    if (!step1 || !canSubmit) return;
    setSubmitting(true);
    setErrorBanner(null);
    try {
        const created = await registerBar(buildRegisterPayload(step1, gstin, fssaiNumber, liquorNumber));
      const formData = new FormData();
      formData.append('gstinDocument', docs.gstin!);
      formData.append('fssaiDocument', docs.fssai!);
      formData.append('liquorLicenceDocument', docs.liquor!);
      docs.photos.forEach((photo) => formData.append('photoGallery', photo));
      await submitBarDocumentsForm(created.barId, formData);
      clearRegistrationStep1();
      // Save KYC status as "under_review"
      saveKycStatus({
        status: 'under_review',
        barId: created.barId,
      });
      router.replace('/register/kyc-status');
    } catch (ex) {
      setErrorBanner(ex instanceof ApiError ? ex.message : 'Network error. Please check API/CORS and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!step1) return null;

  return (
    <div className="auth-fit auth-compact w-full max-w-3xl">
      <header className="mb-1.5">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-accent-lo">Verification docs</p>
        <h1 className="mt-1 font-display text-2xl leading-tight text-ink">Upload Documents</h1>
        <span className="gold-rule mb-1 mt-1.5" aria-hidden="true" />
        <p className="text-xs text-muted">All documents are required before your bar can go live.</p>
      </header>

      <RegistrationStepper current="Documents" />

      <div className="mb-2 rounded-md border border-accent/30 bg-accent-tint px-3 py-1.5 text-xs text-accent-lo">
        All documents required for verification. Your bar goes live within 48 hours of admin approval.
      </div>
      {errorBanner && <div className="mb-4"><ErrorBanner>{errorBanner}</ErrorBanner></div>}

      <div className="card-raised p-3">
        <div className="mb-1">
          <h2 className="font-display text-base text-ink">Required Documents</h2>
        </div>
        <DocRow title="State Liquor Licence *" subtitle="Valid, current licence to serve alcohol" value={docs.liquor?.name ?? null} onUploadClick={() => liquorRef.current?.click()} onClear={() => pickSingle('liquor', null)} />
        <input ref={liquorRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => pickSingle('liquor', e.target.files?.[0] ?? null)} />
        <DocRow title="FSSAI Certificate *" subtitle="Food safety registration" value={docs.fssai?.name ?? null} onUploadClick={() => fssaiRef.current?.click()} onClear={() => pickSingle('fssai', null)} />
        <input ref={fssaiRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => pickSingle('fssai', e.target.files?.[0] ?? null)} />
        <DocRow title="GSTIN Certificate *" subtitle="GST registration document" value={docs.gstin?.name ?? null} onUploadClick={() => gstinRef.current?.click()} onClear={() => pickSingle('gstin', null)} />
        <input ref={gstinRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => pickSingle('gstin', e.target.files?.[0] ?? null)} />
        <DocRow title="Bar Photos *" subtitle={`Minimum ${MIN_PHOTOS} photos of your bar`} value={photoCountLabel} onUploadClick={() => photosRef.current?.click()} uploadButtonLabel="Upload Photos" complete={docs.photos.length >= MIN_PHOTOS} hideClear />
        <input ref={photosRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(e) => pickPhotos(e.target.files)} />
      </div>

      <div className="card-raised mt-2 grid grid-cols-1 gap-2.5 p-3 md:grid-cols-3">
        <RegulatoryNumberField label="GSTIN Number *" placeholder="27AAPFU0939F1ZV" value={gstin} onChange={(v) => setGstin(v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))} valid={gstinValid} maxLength={15} />
        <RegulatoryNumberField label="FSSAI Licence Number *" placeholder="14-digit number" value={fssaiNumber} onChange={(v) => setFssaiNumber(v.replace(/\D/g, '').slice(0, 14))} valid={fssaiValid} maxLength={14} />
        <RegulatoryNumberField label="Liquor Licence Number *" placeholder="Licence number" value={liquorNumber} onChange={(v) => setLiquorNumber(v.slice(0, 50))} valid={liquorValid} maxLength={50} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
        <button type="button" onClick={() => router.push('/register')} className="btn btn-ghost">← Back</button>
        <button type="button" onClick={onSubmit} disabled={!canSubmit} className="btn btn-primary">
          {submitting ? 'Submitting...' : 'Submit for Verification →'}
        </button>
      </div>
    </div>
  );
}

function DocRow({ title, subtitle, value, onUploadClick, onClear, uploadButtonLabel = 'Upload', complete, hideClear = false }: { title: string; subtitle: string; value: string | null; onUploadClick: () => void; onClear?: () => void; uploadButtonLabel?: string; complete?: boolean; hideClear?: boolean }) {
  const done = complete ?? Boolean(value);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline py-1.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-ink">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`max-w-[9rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${done ? 'bg-[color:var(--color-success-tint)] text-[color:var(--color-success)]' : 'bg-ivory-2 text-muted'}`}>{value ?? 'Not uploaded'}</span>
        {value && !hideClear && <button type="button" onClick={onClear} className="text-soft hover:text-[color:var(--color-danger)]">x</button>}
        <button type="button" onClick={onUploadClick} className="btn btn-ghost btn-sm">{uploadButtonLabel}</button>
      </div>
    </div>
  );
}

function RegulatoryNumberField({ label, placeholder, value, onChange, valid, maxLength }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; valid: boolean; maxLength: number }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="input" type="text" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} aria-invalid={value.length > 0 && !valid ? 'true' : undefined} />
    </label>
  );
}

function buildRegisterPayload(step1: BarRegistrationStep1, gstin: string, fssai: string, liquor: string): RegisterBarPayload {
  const hours: Record<string, { open: string; close: string }> = {};
  for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) hours[d] = { open: step1.openingTime, close: step1.closingTime };
  return { businessName: step1.businessName, contactMobile: normalizeIndianMobile(step1.mobileNumber), contactEmail: step1.email, addressLine1: step1.addressLine1, city: step1.city, stateCode: step1.stateCode, pincode: step1.pincode, latitude: step1.latitude, longitude: step1.longitude, gstin, fssaiLicenceNumber: fssai, liquorLicenceNumber: liquor, ambianceTags: step1.ambianceTags, openingHoursJson: JSON.stringify(hours) };
}

function normalizeIndianMobile(mobile: string): string {
  return mobile.replace(/\D/g, '');
}
