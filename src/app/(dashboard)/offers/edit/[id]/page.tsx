'use client';

/**
 * SC-14 Edit Offer.
 *
 * Fetches the existing offer by ID, pre-populates every field,
 * then PUTs the updated payload. Redirects to /offers on success.
 */

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FormField, FormRow, FormSection, INPUT_CLASS } from '@/components/forms/FormField';
import {
  ApiError,
  getOfferById,
  updateOffer,
  type CreateOfferPayload,
  type DiscountType,
  type OfferType,
} from '@/lib/api-client';

const OFFER_TYPES: { value: OfferType; label: string; hint: string }[] = [
  { value: 'HappyHour',  label: 'Happy Hour',      hint: 'Discounted pours in a recurring time window. Max 50% off.' },
  { value: 'BrandPromo', label: 'Brand Promo',     hint: 'Tied to a specific bottle in the catalogue.' },
  { value: 'FlashPrice', label: 'Flash Price',     hint: 'Short-window flat discount across the menu.' },
  { value: 'Referral',   label: 'Referral Reward', hint: 'Reward users who invite a friend to the bar.' },
];

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const offerId = Number(params.id);

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);

  // ── form fields ──
  const [offerType, setOfferType]               = useState<OfferType>('HappyHour');
  const [title, setTitle]                       = useState('');
  const [description, setDescription]           = useState('');
  const [discountType, setDiscountType]         = useState<DiscountType>('Percent');
  const [discountPercent, setDiscountPercent]   = useState<number>(25);
  const [discountAmount, setDiscountAmount]     = useState<number>(0);
  const [buyQty, setBuyQty]                     = useState<number>(1);
  const [getQty, setGetQty]                     = useState<number>(1);
  const [maxDiscountRupees, setMaxDiscountRupees] = useState<number | ''>('');
  const [minSpendRupees, setMinSpendRupees]     = useState<number | ''>('');
  const [startsOn, setStartsOn]                 = useState('');
  const [endsOn, setEndsOn]                     = useState('');
  const [startTime, setStartTime]               = useState('17:00');
  const [endTime, setEndTime]                   = useState('19:00');

  const [submitting, setSubmitting]           = useState(false);
  const [conflictBanner, setConflictBanner]   = useState<string | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [successToast, setSuccessToast]       = useState(false);

  // ── load existing offer ──
  useEffect(() => {
    if (!offerId) return;
    (async () => {
      try {
        const o = await getOfferById(offerId);
        setOfferType(o.offerType);
        setTitle(o.title);
        setDescription(o.description ?? '');
        setDiscountType(o.discountType);
        setDiscountPercent(o.discountPercent ?? 25);
        setDiscountAmount(o.discountAmountInPaise != null ? o.discountAmountInPaise / 100 : 0);
        setBuyQty(o.buyQuantity ?? 1);
        setGetQty(o.getQuantity ?? 1);
        setMaxDiscountRupees(o.maxDiscountAmountInPaise != null ? o.maxDiscountAmountInPaise / 100 : '');
        setMinSpendRupees(o.minSpendInPaise != null ? o.minSpendInPaise / 100 : '');
        setStartsOn(o.startsOn);
        setEndsOn(o.endsOn);
        if (o.recurringStartTime) setStartTime(o.recurringStartTime.slice(0, 5));
        if (o.recurringEndTime)   setEndTime(o.recurringEndTime.slice(0, 5));
      } catch (err) {
        setPageError(err instanceof ApiError ? err.message : 'Failed to load offer');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [offerId]);

  const showTimeWindow = offerType === 'HappyHour';
  const happyHourPercentCap = offerType === 'HappyHour' && discountType === 'Percent' && discountPercent > 50;

  const validationWarning = useMemo(() => {
    if (happyHourPercentCap) return 'Happy Hour discount cannot exceed 50%.';
    if (endsOn < startsOn)   return 'End date must be on or after start date.';
    if (showTimeWindow && endTime <= startTime) return 'End time must be after start time.';
    if (!title.trim())       return 'Give the offer a title.';
    return null;
  }, [happyHourPercentCap, endsOn, startsOn, showTimeWindow, endTime, startTime, title]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflictBanner(null);
    if (validationWarning) { setError(validationWarning); return; }

    const payload: CreateOfferPayload = {
      offerType,
      title: title.trim(),
      description: description.trim() || null,
      discountType,
      discountPercent:           discountType === 'Percent'    ? discountPercent : null,
      discountAmountInPaise:     discountType === 'FlatAmount' ? Math.round(discountAmount * 100) : null,
      buyQuantity:               discountType === 'BuyXGetY'   ? buyQty : null,
      getQuantity:               discountType === 'BuyXGetY'   ? getQty : null,
      maxDiscountAmountInPaise:  maxDiscountRupees === '' ? null : Math.round(Number(maxDiscountRupees) * 100),
      minSpendInPaise:           minSpendRupees   === '' ? null : Math.round(Number(minSpendRupees)   * 100),
      startsOn,
      endsOn,
      recurringStartTime: showTimeWindow ? `${startTime}:00` : null,
      recurringEndTime:   showTimeWindow ? `${endTime}:00`   : null,
      priority: 100,
    };

    setSubmitting(true);
    try {
      await updateOffer(offerId, payload);
      setSuccessToast(true);
      setTimeout(() => router.push('/offers'), 1200);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const msg = err.message;
        if (/happy hour/i.test(msg) && /window|overlap|already runs/i.test(msg)) {
          setConflictBanner(msg);
        } else {
          setError(msg);
        }
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to update offer');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── loading / error states ──
  if (pageLoading) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-32" />
          <div className="h-10 bg-slate-200 rounded w-64" />
          <div className="h-40 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="p-8 max-w-3xl">
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3">{pageError}</p>
        <Link href="/offers" className="mt-4 inline-block text-sm text-violet-600 hover:underline">← Back to offers</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Success toast */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
          <span>✓</span> Offer updated successfully!
        </div>
      )}

      <header className="mb-6">
        <Link href="/offers" className="text-sm text-slate-500 hover:text-slate-700 transition">← Back to offers</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Edit offer</h1>
        <p className="text-sm text-slate-500 mt-1">All changes are saved immediately on submit.</p>
      </header>

      {conflictBanner && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
          <span aria-hidden>⚠️</span>
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Time window conflict</p>
            <p className="text-amber-800 mt-1">{conflictBanner}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Offer type */}
        <FormSection title="Offer type">
          <FormField label="Offer type">
            <select value={offerType} onChange={(e) => setOfferType(e.target.value as OfferType)} className={INPUT_CLASS}>
              {OFFER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <p className="text-xs text-slate-500 -mt-2">
            {OFFER_TYPES.find((t) => t.value === offerType)?.hint}
          </p>
        </FormSection>

        {/* Details */}
        <FormSection title="Details">
          <FormField label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={INPUT_CLASS} />
          </FormField>
          <FormField label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={INPUT_CLASS} />
          </FormField>
        </FormSection>

        {/* Discount */}
        <FormSection title="Discount">
          <FormField label="Discount type">
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className={INPUT_CLASS}>
              <option value="Percent">Percent off</option>
              <option value="FlatAmount">Flat rupee amount off</option>
              <option value="BuyXGetY">Buy X, get Y</option>
            </select>
          </FormField>

          {discountType === 'Percent' && (
            <FormField label={offerType === 'HappyHour' ? 'Percent off (max 50% for Happy Hour)' : 'Percent off'}>
              <input type="number" min={1} max={100} value={discountPercent}
                     onChange={(e) => setDiscountPercent(Number(e.target.value))}
                     className={`${INPUT_CLASS} max-w-[10rem] ${happyHourPercentCap ? 'border-rose-400' : ''}`} />
            </FormField>
          )}
          {discountType === 'FlatAmount' && (
            <FormField label="Amount off (₹)">
              <input type="number" min={1} step="0.01" value={discountAmount}
                     onChange={(e) => setDiscountAmount(Number(e.target.value))}
                     className={`${INPUT_CLASS} max-w-[10rem]`} />
            </FormField>
          )}
          {discountType === 'BuyXGetY' && (
            <FormRow>
              <FormField label="Buy (count)">
                <input type="number" min={1} value={buyQty} onChange={(e) => setBuyQty(Number(e.target.value))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Get (count)">
                <input type="number" min={1} value={getQty} onChange={(e) => setGetQty(Number(e.target.value))} className={INPUT_CLASS} />
              </FormField>
            </FormRow>
          )}

          <FormRow>
            <FormField label="Max discount cap (₹, optional)">
              <input type="number" min={0} step="0.01" value={maxDiscountRupees}
                     onChange={(e) => setMaxDiscountRupees(e.target.value === '' ? '' : Number(e.target.value))}
                     className={INPUT_CLASS} />
            </FormField>
            <FormField label="Minimum spend (₹, optional)">
              <input type="number" min={0} step="0.01" value={minSpendRupees}
                     onChange={(e) => setMinSpendRupees(e.target.value === '' ? '' : Number(e.target.value))}
                     className={INPUT_CLASS} />
            </FormField>
          </FormRow>
        </FormSection>

        {/* Dates */}
        <FormSection title="Runs">
          <FormRow>
            <FormField label="Starts on">
              <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={INPUT_CLASS} />
            </FormField>
            <FormField label="Ends on">
              <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={INPUT_CLASS} />
            </FormField>
          </FormRow>

          {showTimeWindow && (
            <FormRow>
              <FormField label="Starts at">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Ends at">
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={INPUT_CLASS} />
              </FormField>
            </FormRow>
          )}
        </FormSection>

        {error && (
          <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 text-sm">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !!validationWarning}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
          <Link href="/offers" className="px-5 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
