'use client';

/**
 * SC-14 Create Offer.
 *
 * One form, four offer types — the visible fields morph with the selected
 * type.  Server-side conflict detection: when the user picks HappyHour, we
 * render the submit button's banner from the 400 response ("A Happy Hour 'X'
 * already runs in that time window.") rather than trying to duplicate the
 * overlap query on the client.
 * created mew branch sc-14-create-offer and added the file page.tsx with the above content
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FormField, FormRow, FormSection, INPUT_CLASS } from '@/components/forms/FormField';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  createOffer,
  type CreateOfferPayload,
  type DiscountType,
  type OfferType,
} from '@/lib/api-client';

const OFFER_TYPES: { value: OfferType; label: string; hint: string }[] = [
  { value: 'HappyHour',  label: 'Happy Hour',       hint: 'Discounted pours in a recurring time window. Max 50% off.' },
  { value: 'BrandPromo', label: 'Brand Promo',      hint: 'Tied to a specific bottle in the catalogue.' },
  { value: 'FlashPrice', label: 'Flash Price',      hint: 'Short-window flat discount across the menu.' },
  { value: 'Referral',   label: 'Referral Reward',  hint: 'Reward users who invite a friend to the bar.' },
];

export default function CreateOfferPage() {
  const router = useRouter();

  const [offerType, setOfferType] = useState<OfferType>('HappyHour');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('Percent');
  const [discountPercent, setDiscountPercent] = useState<number>(25);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [buyQty, setBuyQty] = useState<number>(1);
  const [getQty, setGetQty] = useState<number>(1);
  const [maxDiscountRupees, setMaxDiscountRupees] = useState<number | ''>('');
  const [minSpendRupees, setMinSpendRupees] = useState<number | ''>('');
  const [startsOn, setStartsOn] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('19:00');

  const [submitting, setSubmitting] = useState(false);
  const [conflictBanner, setConflictBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showTimeWindow = offerType === 'HappyHour';
  const happyHourPercentCap = offerType === 'HappyHour' && discountType === 'Percent' && discountPercent > 50;

  const validationWarning = useMemo(() => {
    if (happyHourPercentCap) return 'Happy Hour discount cannot exceed 50%.';
    if (endsOn < startsOn) return 'End date must be on or after start date.';
    if (showTimeWindow && endTime <= startTime) return 'End time must be after start time.';
    if (!title.trim()) return 'Give the offer a title.';
    return null;
  }, [happyHourPercentCap, endsOn, startsOn, showTimeWindow, endTime, startTime, title]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflictBanner(null);
    if (validationWarning) { setError(validationWarning); return; }

    const barId = getActiveBarId();
    if (barId == null) { setError('No active bar in session.'); return; }

    const payload: CreateOfferPayload = {
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
      priority: 100,
    };

    setSubmitting(true);
    try {
      await createOffer(barId, payload);
      router.push('/offers');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // The service sends the conflict copy as the problem title — route
        // HappyHour-overlap messages to the inline banner, everything else
        // stays in the generic error slot.
        const msg = err.message;
        if (/happy hour/i.test(msg) && /window|overlap|already runs/i.test(msg)) {
          setConflictBanner(msg);
        } else {
          setError(msg);
        }
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to create offer');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/offers" className="text-sm text-slate-500 hover:text-slate-700">← Back to offers</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">New offer</h1>
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
        <FormSection title="Offer type">
          <FormField label="Offer type">
            <select
              value={offerType}
              onChange={(e) => setOfferType(e.target.value as OfferType)}
              className={INPUT_CLASS}
            >
              {OFFER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <p className="text-xs text-slate-500 -mt-2">
            {OFFER_TYPES.find((t) => t.value === offerType)?.hint}
          </p>
        </FormSection>

        <FormSection title="Details">
          <FormField label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                   className={INPUT_CLASS} />
          </FormField>
          <FormField label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2}
                      className={INPUT_CLASS} />
          </FormField>
        </FormSection>

        <FormSection title="Discount">
          <FormField label="Discount type">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as DiscountType)}
              className={INPUT_CLASS}
            >
              <option value="Percent">Percent off</option>
              <option value="FlatAmount">Flat rupee amount off</option>
              <option value="BuyXGetY">Buy X, get Y</option>
            </select>
          </FormField>

          {discountType === 'Percent' && (
            <FormField
              label={offerType === 'HappyHour' ? 'Percent off (max 50% for Happy Hour)' : 'Percent off'}
            >
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
                <input type="number" min={1} value={buyQty} onChange={(e) => setBuyQty(Number(e.target.value))}
                       className={INPUT_CLASS} />
              </FormField>
              <FormField label="Get (count)">
                <input type="number" min={1} value={getQty} onChange={(e) => setGetQty(Number(e.target.value))}
                       className={INPUT_CLASS} />
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

        <FormSection title="Runs">
          <FormRow>
            <FormField label="Starts on">
              <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
                     className={INPUT_CLASS} />
            </FormField>
            <FormField label="Ends on">
              <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)}
                     className={INPUT_CLASS} />
            </FormField>
          </FormRow>

          {showTimeWindow && (
            <FormRow>
              <FormField label="Starts at">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                       className={INPUT_CLASS} />
              </FormField>
              <FormField label="Ends at">
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                       className={INPUT_CLASS} />
              </FormField>
            </FormRow>
          )}
        </FormSection>

        {error && (
          <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !!validationWarning}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
          >
            {submitting ? 'Saving…' : 'Create offer'}
          </button>
          <Link href="/offers" className="px-5 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

