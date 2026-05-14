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
      const result = await servePourRequest(pour.id, servedMl, staffNotes.trim() || null);
      
      const query = new URLSearchParams({
        customer: result.userDisplayName || `Guest #${result.userId}`,
        amount: String(result.servedMl),
        bottle: result.bottleBrandName || 'Bottle',
        balance: String(result.remainingMlAfterServe ?? 0),
      });

      router.push(`/serve/success?${query.toString()}`);
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
    <div className="p-6 max-w-2xl mx-auto reveal">
      <button onClick={() => router.back()} className="text-slate-400 hover:text-ink font-black text-[10px] flex items-center gap-1 mb-8 uppercase tracking-widest">
        ← Back to Queue
      </button>

      <div className="panel p-10 shadow-lg bg-white">
        <header className="text-center mb-10">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Service Validation</p>
          <h1 className="text-4xl font-black text-ink tracking-tighter">
            Table {pour.sessionId % 20} · {pour.userDisplayName ?? `Guest #${pour.userId}`}
          </h1>
        </header>

        {/* Bottle Card */}
        <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-100 mb-10">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 bg-white rounded-[24px] flex items-center justify-center text-4xl shadow-sm border border-slate-100">
               🍾
            </div>
            <div className="flex-1">
              <p className="font-black text-2xl text-ink tracking-tight">{pour.bottleBrandName ?? 'Bottle'}</p>
              <p className="text-xs text-muted font-bold uppercase tracking-wider">SipSave Digital Wallet</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-amber-700 tracking-tighter">338<span className="text-sm ml-1 text-slate-300">ml</span></p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Balance</p>
            </div>
          </div>
          <div className="w-full h-3 bg-white border border-slate-100 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-amber-500 shadow-glow transition-all duration-1000" 
              style={{ width: `${(338 / 750) * 100}%` }}
            ></div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Original: 750ml</p>
        </div>

        {/* Amount Selector */}
        <div className="mb-12 text-center">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-6">Amount to Serve</label>
          <div className="flex justify-center gap-4 mb-8">
            {[30, 60, 90, 120].map((ml) => (
              <button
                key={ml}
                onClick={() => setServedMl(ml)}
                className={`w-16 h-16 rounded-2xl font-black text-lg transition-all border-2 ${servedMl === ml ? 'bg-slate-950 text-white border-slate-950 shadow-glow scale-110' : 'bg-white text-slate-400 border-slate-100 hover:border-amber-300'}`}
              >
                {ml}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
             <span className="text-6xl font-black text-ink tracking-tighter">{servedMl}</span>
             <span className="text-xl font-black text-slate-200">ML</span>
          </div>
          <p className="text-[10px] text-amber-600 mt-3 font-black uppercase tracking-widest">Customer requested {pour.requestedMl}ml</p>
        </div>

        {fieldError && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[11px] font-black text-center uppercase tracking-widest">
            ⚠️ {fieldError}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleServe}
            disabled={submitting}
            className="btn-tablet btn-tablet-g w-full justify-center py-6 text-xl shadow-xl shadow-emerald-100 font-black"
          >
            {submitting ? '...' : `Confirm & Deduct Wallet`}
          </button>
          
          <div className="flex gap-4">
            <button
              onClick={() => setShowReject(!showReject)}
              disabled={submitting}
              className="flex-1 btn-tablet btn-tablet-s !text-rose-600 !bg-white !border-rose-100 justify-center font-bold"
            >
              Cancel Request
            </button>
            <button
               onClick={() => router.back()}
              className="flex-1 btn-tablet btn-tablet-s !text-slate-400 !bg-white justify-center font-bold"
            >
              Go Back
            </button>
          </div>
        </div>

        {showReject && (
          <div className="mt-8 pt-8 border-t border-slate-100 animate-in slide-in-from-top-4">
            <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-3">Cancellation Reason</label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold focus:border-rose-300 outline-none transition-all mb-4"
              placeholder="e.g. Out of stock, customer not at table"
            />
            <button
              onClick={handleReject}
              disabled={submitting}
              className="btn-tablet btn-tablet-r w-full justify-center py-4 font-black"
            >
              {submitting ? '...' : 'Confirm Cancellation'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-10 panel p-8 bg-amber-50/30 border-amber-100">
         <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4">Bartender Service Notes</p>
         <textarea
            value={staffNotes}
            onChange={(e) => setStaffNotes(e.target.value)}
            className="w-full bg-white border border-amber-200 rounded-2xl p-5 text-sm font-bold focus:border-amber-400 outline-none transition-all shadow-sm"
            placeholder="Optional notes about this service (e.g. Added extra ice, garnish)..."
         />
      </div>
    </div>
  );
}
