'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FormField, FormRow, FormSection, INPUT_CLASS } from '@/components/forms/FormField';
import {
  ApiError,
  getOffer,
  updateOffer,
  type DiscountType,
  type OfferDto,
  type OfferType,
  type UpdateOfferPayload,
} from '@/lib/api-client';

export default function EditOfferPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const offerId = Number(params.id);

  const [offer, setOffer] = useState<OfferDto | null>(null);
  const [offerType, setOfferType] = useState<OfferType>('HappyHour');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('Percent');
  const [discountPercent, setDiscountPercent] = useState(25);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [buyQty, setBuyQty] = useState(1);
  const [getQty, setGetQty] = useState(1);
  const [maxDiscountRupees, setMaxDiscountRupees] = useState<number | ''>('');
  const [minSpendRupees, setMinSpendRupees] = useState<number | ''>('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('19:00');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const row = await getOffer(offerId);
        setOffer(row);
        setOfferType(row.offerType);
        setTitle(row.title);
        setDescription(row.description ?? '');
        setDiscountType(row.discountType);
        setDiscountPercent(row.discountPercent ?? 25);
        setDiscountAmount((row.discountAmountInPaise ?? 0) / 100);
        setBuyQty(row.buyQuantity ?? 1);
        setGetQty(row.getQuantity ?? 1);
        setMaxDiscountRupees(row.maxDiscountAmountInPaise == null ? '' : row.maxDiscountAmountInPaise / 100);
        setMinSpendRupees(row.minSpendInPaise == null ? '' : row.minSpendInPaise / 100);
        setStartsOn(row.startsOn);
        setEndsOn(row.endsOn);
        setStartTime((row.recurringStartTime ?? '17:00').slice(0, 5));
        setEndTime((row.recurringEndTime ?? '19:00').slice(0, 5));
        setIsActive(row.isActive);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load offer');
      } finally {
        setLoading(false);
      }
    })();
  }, [offerId]);

  const showTimeWindow = offerType === 'HappyHour';
  const validationWarning = useMemo(() => {
    if (!title.trim()) return 'Give the offer a title.';
    if (offerType === 'HappyHour' && discountType === 'Percent' && discountPercent > 50) return 'Happy Hour discount cannot exceed 50%.';
    if (endsOn < startsOn) return 'End date must be on or after start date.';
    if (showTimeWindow && endTime <= startTime) return 'End time must be after start time.';
    return null;
  }, [discountPercent, discountType, endTime, endsOn, offerType, showTimeWindow, startTime, startsOn, title]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (validationWarning) { setError(validationWarning); return; }

    const payload: UpdateOfferPayload = {
      offerType,
      title: title.trim(),
      description: description.trim() || null,
      discountType,
      discountPercent: discountType === 'Percent' ? discountPercent : null,
      discountAmountInPaise: discountType === 'FlatAmount' ? Math.round(discountAmount * 100) : null,
      buyQuantity: discountType === 'BuyXGetY' ? buyQty : null,
      getQuantity: discountType === 'BuyXGetY' ? getQty : null,
      maxDiscountAmountInPaise: maxDiscountRupees === '' ? null : Math.round(Number(maxDiscountRupees) * 100),
      minSpendInPaise: minSpendRupees === '' ? null : Math.round(Number(minSpendRupees) * 100),
      startsOn,
      endsOn,
      recurringStartTime: showTimeWindow ? `${startTime}:00` : null,
      recurringEndTime: showTimeWindow ? `${endTime}:00` : null,
      priority: offer?.priority ?? 100,
      isActive,
    };

    setSaving(true);
    try {
      await updateOffer(offerId, payload);
      router.push('/offers');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update offer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/offers" className="text-sm text-slate-500 hover:text-slate-700">Back to offers</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Edit offer</h1>
      </header>

      {loading && <p className="text-slate-400">Loading offer...</p>}
      {error && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4 text-sm">{error}</p>}

      {!loading && offer && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection title="Offer type">
            <FormRow>
              <FormField label="Offer type">
                <select value={offerType} onChange={(e) => setOfferType(e.target.value as OfferType)} className={INPUT_CLASS}>
                  <option value="HappyHour">Happy Hour</option>
                  <option value="BrandPromo">Brand Promo</option>
                  <option value="FlashPrice">Flash Price</option>
                  <option value="Referral">Referral Reward</option>
                </select>
              </FormField>
              <FormField label="Status">
                <select value={isActive ? '1' : '0'} onChange={(e) => setIsActive(e.target.value === '1')} className={INPUT_CLASS}>
                  <option value="1">Active</option>
                  <option value="0">Paused</option>
                </select>
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Details">
            <FormField label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={INPUT_CLASS} />
            </FormField>
            <FormField label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={INPUT_CLASS} />
            </FormField>
          </FormSection>

          <FormSection title="Discount">
            <FormField label="Discount type">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className={INPUT_CLASS}>
                <option value="Percent">Percent off</option>
                <option value="FlatAmount">Flat rupee amount off</option>
                <option value="BuyXGetY">Buy X, get Y</option>
              </select>
            </FormField>
            {discountType === 'Percent' && (
              <FormField label="Percent off">
                <input type="number" min={1} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className={`${INPUT_CLASS} max-w-[10rem]`} />
              </FormField>
            )}
            {discountType === 'FlatAmount' && (
              <FormField label="Amount off (INR)">
                <input type="number" min={1} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} className={`${INPUT_CLASS} max-w-[10rem]`} />
              </FormField>
            )}
            {discountType === 'BuyXGetY' && (
              <FormRow>
                <FormField label="Buy">
                  <input type="number" min={1} value={buyQty} onChange={(e) => setBuyQty(Number(e.target.value))} className={INPUT_CLASS} />
                </FormField>
                <FormField label="Get">
                  <input type="number" min={1} value={getQty} onChange={(e) => setGetQty(Number(e.target.value))} className={INPUT_CLASS} />
                </FormField>
              </FormRow>
            )}
            <FormRow>
              <FormField label="Max discount cap (INR)">
                <input type="number" min={0} step="0.01" value={maxDiscountRupees} onChange={(e) => setMaxDiscountRupees(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Minimum spend (INR)">
                <input type="number" min={0} step="0.01" value={minSpendRupees} onChange={(e) => setMinSpendRupees(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT_CLASS} />
              </FormField>
            </FormRow>
          </FormSection>

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

          <div className="flex gap-3">
            <button type="submit" disabled={saving || !!validationWarning} className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">
              {saving ? 'Saving...' : 'Save offer'}
            </button>
            <Link href="/offers" className="px-5 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
