'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ApiError,
  fetchPourRequest,
  rejectPourRequest,
  servePourRequest,
  type PourRequestDto,
} from '@/lib/api-client';

/**
 * SC-23 bartender serve screen. Two CTAs —
 *   * Serve  → PUT /api/v1/pour-requests/:id/serve   (runs sp_DeductWallet)
 *   * Reject → PUT /api/v1/pour-requests/:id/cancel  (staff-initiated)
 *
 * The "Serve" path pre-fills the served-ml field with the user-requested
 * volume but lets the bartender short-pour (e.g., remaining = 40 ml on a
 * 50 ml request). BR-005 is re-checked on the server so we don't need to
 * re-validate against the wallet balance here.
 */
export default function ServePourPage() {
  const params = useParams<{ pourRequestId: string }>();
  const pourRequestId = Number(params.pourRequestId);
  const router = useRouter();

  const [pour, setPour] = useState<PourRequestDto | null>(null);
  const [servedMl, setServedMl] = useState<number>(0);
  const [staffNotes, setStaffNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(pourRequestId) || pourRequestId <= 0) {
      setError('Invalid pour request id.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const row = await fetchPourRequest(pourRequestId);
        setPour(row);
        setServedMl(row.requestedMl);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load pour request');
      } finally {
        setLoading(false);
      }
    })();
  }, [pourRequestId]);

  const handleServe = async () => {
    if (!pour) return;
    if (servedMl <= 0) {
      setFieldError('Served volume must be greater than zero.');
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await servePourRequest(pour.id, servedMl, staffNotes.trim() || null);
      router.push('/queue');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldError('Wallet balance has changed — refresh and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not serve pour');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!pour) return;
    if (rejectReason.trim().length === 0) {
      setFieldError('Reason is required.');
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await rejectPourRequest(pour.id, rejectReason.trim());
      router.push('/queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject pour');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-slate-400">Loading pour request…</p>;
  }

  if (error || !pour) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm mb-4">
          ← Back
        </button>
        <p className="text-rose-400 bg-rose-950/40 border border-rose-900 rounded-md px-4 py-3">
          {error ?? 'Pour request not found.'}
        </p>
      </div>
    );
  }

  if (pour.status !== 'Pending') {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <button onClick={() => router.push('/queue')} className="text-slate-400 hover:text-white text-sm mb-4">
          ← Back to queue
        </button>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-lg">This pour is already {pour.status.toLowerCase()}.</p>
          <p className="text-sm text-slate-400 mt-1">No further action needed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm mb-4">
        ← Back
      </button>

      <header className="mb-6">
        <p className="text-sm text-slate-400">Session #{pour.sessionId}</p>
        <h1 className="text-2xl font-semibold">
          {pour.userDisplayName ?? `Guest #${pour.userId}`}
        </h1>
        <p className="text-slate-400">
          {pour.bottleBrandName ?? 'Bottle'} {pour.bottleProductName ?? ''}
        </p>
      </header>

      {pour.userNotes && (
        <p className="mb-6 p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 italic">
          &ldquo;{pour.userNotes}&rdquo;
        </p>
      )}

      <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <label htmlFor="ml" className="block text-sm text-slate-300 mb-2">
          Volume to serve (ml)
        </label>
        <input
          id="ml"
          type="number"
          min={1}
          max={1000}
          value={servedMl}
          onChange={(e) => setServedMl(Number(e.target.value))}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <p className="text-xs text-slate-400 mt-2">
          Customer requested {pour.requestedMl} ml. Lower this value if short-pouring.
        </p>

        <label htmlFor="notes" className="block text-sm text-slate-300 mt-4 mb-2">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={staffNotes}
          onChange={(e) => setStaffNotes(e.target.value)}
          rows={2}
          maxLength={500}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </section>

      {fieldError && (
        <p className="text-amber-300 bg-amber-950/40 border border-amber-900 rounded-md px-4 py-3 mb-4 text-sm">
          {fieldError}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleServe}
          disabled={submitting}
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-semibold rounded-xl py-4 text-lg transition"
        >
          {submitting ? 'Serving…' : `Serve ${servedMl} ml`}
        </button>
        <button
          onClick={() => setShowReject((v) => !v)}
          disabled={submitting}
          className="px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-rose-300"
        >
          Reject
        </button>
      </div>

      {showReject && (
        <section className="mt-4 bg-slate-800 border border-rose-900/60 rounded-xl p-5">
          <label htmlFor="reason" className="block text-sm text-slate-300 mb-2">
            Reason (shown to customer)
          </label>
          <textarea
            id="reason"
            rows={2}
            maxLength={500}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            onClick={handleReject}
            disabled={submitting}
            className="mt-3 w-full bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/50 text-white font-semibold rounded-xl py-3 transition"
          >
            {submitting ? 'Rejecting…' : 'Confirm reject'}
          </button>
        </section>
      )}
    </div>
  );
}
