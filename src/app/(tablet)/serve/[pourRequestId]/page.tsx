'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ApiError,
  fetchPourRequest,
  rejectPourRequest,
  servePourRequest,
  type PourRequestDto,
} from '@/lib/api-client';

export default function ServePourPage() {
  const params = useParams<{ pourRequestId: string }>();
  const pourRequestId = (() => {
    const raw = (params as unknown as { pourRequestId?: string | string[] })?.pourRequestId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? Number(value) : NaN;
  })();
  const router = useRouter();

  const [row, setRow] = useState<PourRequestDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [servedMl, setServedMl] = useState<number>(60);
  const [staffNotes, setStaffNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!Number.isFinite(pourRequestId) || pourRequestId <= 0) {
      setLoadError('Invalid pour request id.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const loaded = await fetchPourRequest(pourRequestId);
        if (cancelled) return;
        setRow(loaded);
        setServedMl(loaded.requestedMl || 60);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          const detail =
            err.body && typeof err.body === 'object' && 'detail' in (err.body as Record<string, unknown>)
              ? String((err.body as Record<string, unknown>).detail)
              : null;
          setLoadError(detail ? `${detail} (${err.status})` : `Failed to load pour request (${err.status}).`);
        }
        else setLoadError('Failed to load pour request.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pourRequestId]);

  const customerName = row?.userDisplayName?.trim() || 'Customer';
  const tableId = row?.barTableId ?? null;
  const requestedMl = row?.requestedMl ?? 0;
  const bottleName = useMemo(() => {
    const brand = row?.bottleBrandName?.trim();
    const product = row?.bottleProductName?.trim();
    return [brand, product].filter(Boolean).join(' ') || 'Bottle';
  }, [row?.bottleBrandName, row?.bottleProductName]);

  const onConfirmServe = async () => {
    if (!row) return;
    if (!Number.isFinite(servedMl) || servedMl <= 0) {
      (window as any).toast?.('Enter a valid served amount.', 'w');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const updated = await servePourRequest(row.id, Math.floor(servedMl), staffNotes.trim() || null);
      (window as any).toast?.('✅ Serve confirmed. Updating queue…', 's');

      const query = new URLSearchParams({
        customer: updated.userDisplayName ?? customerName,
        amount: String(updated.servedMl ?? servedMl),
        bottle: [updated.bottleBrandName, updated.bottleProductName].filter(Boolean).join(' ') || bottleName,
        balance: updated.remainingMlAfterServe != null ? String(updated.remainingMlAfterServe) : '',
      });
      router.push(`/serve/success?${query.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) (window as any).toast?.('Insufficient wallet balance for this pour.', 'e');
        else if (err.status === 401 || err.status === 403) (window as any).toast?.('Not authorized. Please login again.', 'e');
        else if (err.status === 404) (window as any).toast?.('Pour request not found.', 'e');
        else (window as any).toast?.(`Serve failed (${err.status}).`, 'e');
      } else {
        (window as any).toast?.('Serve failed. Please try again.', 'e');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onReject = async () => {
    if (!row) return;
    if (!rejectReason.trim()) {
      (window as any).toast?.('Please enter a reject reason.', 'w');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await rejectPourRequest(row.id, rejectReason.trim());
      (window as any).toast?.('⚠️ Pour rejected. Updating queue…', 'w');
      router.push('/queue');
    } catch (err) {
      if (err instanceof ApiError) (window as any).toast?.(`Reject failed (${err.status}).`, 'e');
      else (window as any).toast?.('Reject failed. Please try again.', 'e');
    } finally {
      setIsSubmitting(false);
      setShowRejectModal(false);
    }
  };

  if (isLoading) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading serve form...</div>;
  }

  if (loadError || !row) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className="panel p-8 bg-white border border-slate-200 rounded-[32px] text-center space-y-4">
          <p className="text-slate-900 font-black text-lg">Unable to load pour request</p>
          <p className="text-slate-500 text-sm font-semibold">{loadError ?? 'Unknown error.'}</p>
          <Link href="/queue" className="btn-tablet btn-tablet-p justify-center py-3 rounded-2xl text-sm font-black uppercase tracking-wider">
            ← Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto reveal">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Serve & Deduct</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Serving <span className="text-slate-900 font-bold">{bottleName}</span>
          </p>
        </div>
        <Link href="/queue" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="panel bg-indigo-900 text-white p-6 rounded-[32px] shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-600 rounded-[18px] flex items-center justify-center font-black text-xl border border-indigo-500/30">
                {customerName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-black text-lg leading-none">{customerName}</p>
                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mt-1.5">
                  {tableId != null ? `Table ${tableId}` : 'Table —'} · Requested: {requestedMl}ml
                </p>
              </div>
            </div>
            <span className="badge-tablet bg-rose-600 text-white font-black uppercase tracking-wider">
              Pending
            </span>
          </div>

          <div className="panel p-5 bg-white border border-slate-200 rounded-[32px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Staff Notes (optional)</label>
            <textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm min-h-[120px]"
              placeholder="Add notes for audit (optional)"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="panel p-8 bg-white border border-slate-200 rounded-[32px] space-y-6">
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex gap-3 text-xs">
              <span>⚡</span>
              <p className="font-bold text-indigo-900 uppercase">
                Confirm actual amount poured below. Wallet balance is validated by the server.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Quick Select (ml)</label>
              <div className="grid grid-cols-4 gap-4">
                {[30, 60, 90, 120].map((amt) => {
                  const isActive = servedMl === amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => setServedMl(amt)}
                      className={`btn-tablet justify-center py-4 rounded-2xl font-black text-lg ${isActive ? 'btn-tablet-p shadow-glow' : 'btn-tablet-s border border-slate-200'}`}
                      disabled={isSubmitting}
                    >
                      {amt} {isActive ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Actual Amount Served (ml) *</label>
              <input
                type="number"
                min={1}
                value={servedMl}
                onChange={(e) => setServedMl(Math.max(0, Number(e.target.value)))}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-center font-black text-4xl focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <button
                onClick={onConfirmServe}
                disabled={isSubmitting}
                className="btn-tablet btn-tablet-p justify-center py-5 rounded-[24px] font-black text-sm uppercase tracking-wider shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Working…' : '✅ Confirm Serve'}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isSubmitting}
                className="btn-tablet btn-tablet-s justify-center py-5 rounded-[24px] font-black text-sm uppercase tracking-wider border border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                ❌ Cancel / Reject
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl p-7 w-full max-w-lg space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-slate-900 font-black text-lg">Reject this pour?</p>
                <p className="text-slate-500 text-sm font-semibold mt-1">A reason is required and will be shown to the customer.</p>
              </div>
              <button
                className="text-slate-400 hover:text-slate-700 font-black"
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Reason *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-semibold outline-none focus:border-rose-500 transition-all shadow-sm min-h-[120px]"
                placeholder="e.g., Customer not present, bottle unavailable, etc."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="btn-tablet btn-tablet-s justify-center py-3 rounded-2xl text-sm font-black uppercase tracking-wider border border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                onClick={onReject}
                disabled={isSubmitting}
                className="btn-tablet justify-center py-3 rounded-2xl text-sm font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Working…' : 'Reject Pour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
