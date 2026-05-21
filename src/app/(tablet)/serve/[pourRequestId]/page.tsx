'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  fetchPourRequest,
  fetchServedTonight,
  rejectPourRequest,
  servePourRequest,
  type PourRequestDto,
} from '@/lib/api-client';

const QUICK_AMOUNTS = [30, 60, 90, 120] as const;

function toWaitLabel(createdAtUtc: string): string {
  const createdAt = Date.parse(createdAtUtc);
  if (Number.isNaN(createdAt)) return 'Just now';
  const diffMin = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min wait`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins === 0 ? `${hours}h wait` : `${hours}h ${mins}m wait`;
}

function isUrgentWait(waitLabel: string): boolean {
  const match = /^(\d+)\s+min wait$/.exec(waitLabel);
  return match ? Number(match[1]) >= 4 : false;
}

function formatClockLabel(utcIso: string): string {
  const dt = new Date(utcIso);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function shortBottle(brand: string | null, product: string | null): string {
  const full = [brand, product].filter(Boolean).join(' ').trim();
  if (!full) return 'Bottle';
  const words = full.split(/\s+/);
  if (words.length <= 2) return full;
  return `${words[0]} ${words[1]}`;
}

export default function ServePourPage() {
  const params = useParams<{ pourRequestId: string }>();
  const searchParams = useSearchParams();
  const pourRequestId = (() => {
    const raw = (params as unknown as { pourRequestId?: string | string[] })?.pourRequestId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? Number(value) : NaN;
  })();
  const router = useRouter();
  const balanceHint = Number(searchParams.get('balance') ?? '');

  const [row, setRow] = useState<PourRequestDto | null>(null);
  const [sessionServed, setSessionServed] = useState<PourRequestDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [servedMl, setServedMl] = useState<number>(60);
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

        const barId = getActiveBarId();
        if (barId) {
          const tonight = await fetchServedTonight(barId, 100);
          if (!cancelled) {
            setSessionServed(
              tonight.filter(
                p =>
                  p.sessionId === loaded.sessionId &&
                  p.userId === loaded.userId &&
                  p.status === 'Served',
              ),
            );
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          const detail =
            err.body && typeof err.body === 'object' && 'detail' in (err.body as Record<string, unknown>)
              ? String((err.body as Record<string, unknown>).detail)
              : null;
          setLoadError(detail ? `${detail} (${err.status})` : `Failed to load pour request (${err.status}).`);
        } else setLoadError('Failed to load pour request.');
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

  const currentBalanceMl = useMemo(() => {
    if (row?.remainingMlAfterServe != null && row.remainingMlAfterServe > 0) {
      return row.remainingMlAfterServe;
    }
    if (Number.isFinite(balanceHint) && balanceHint > 0) return balanceHint;
    return 0;
  }, [row?.remainingMlAfterServe, balanceHint]);

  const newBalanceMl = Math.max(0, currentBalanceMl - servedMl);
  const insufficient = currentBalanceMl > 0 && servedMl > currentBalanceMl;
  const waitLabel = row ? toWaitLabel(row.createdAtUtc) : '';
  const isUrgent = isUrgentWait(waitLabel);

  const quickOptions = useMemo(() => {
    const set = new Set<number>(QUICK_AMOUNTS);
    if (requestedMl > 0) set.add(requestedMl);
    return Array.from(set).sort((a, b) => a - b);
  }, [requestedMl]);

  const sessionTotalMl = sessionServed.reduce((sum, p) => sum + (p.servedMl ?? 0), 0);

  const onConfirmServe = async () => {
    if (!row) return;
    if (!Number.isFinite(servedMl) || servedMl <= 0) {
      (window as any).toast?.('Enter a valid served amount.', 'w');
      return;
    }
    if (insufficient) {
      (window as any).toast?.(`Cannot serve more than remaining balance (${currentBalanceMl}ml).`, 'e');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const updated = await servePourRequest(row.id, Math.floor(servedMl), null);
      (window as any).toast?.('✅ Serve confirmed. Wallet updated in real time.', 's');

      const query = new URLSearchParams({
        customer: updated.userDisplayName ?? customerName,
        amount: String(updated.servedMl ?? servedMl),
        bottle: [updated.bottleBrandName, updated.bottleProductName].filter(Boolean).join(' ') || bottleName,
        balance: updated.remainingMlAfterServe != null ? String(updated.remainingMlAfterServe) : String(newBalanceMl),
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
      (window as any).toast?.('Please enter a cancel reason.', 'w');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await rejectPourRequest(row.id, rejectReason.trim());
      (window as any).toast?.('Pour request cancelled.', 'w');
      router.push('/queue');
    } catch (err) {
      if (err instanceof ApiError) (window as any).toast?.(`Cancel failed (${err.status}).`, 'e');
      else (window as any).toast?.('Cancel failed. Please try again.', 'e');
    } finally {
      setIsSubmitting(false);
      setShowRejectModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">
        Loading serve form...
      </div>
    );
  }

  if (loadError || !row) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className="panel p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4">
          <p className="text-slate-900 font-black text-lg">Unable to load pour request</p>
          <p className="text-slate-500 text-sm font-semibold">{loadError ?? 'Unknown error.'}</p>
          <Link
            href="/queue"
            className="inline-flex btn-tablet btn-tablet-p justify-center py-3 rounded-xl text-sm font-black uppercase tracking-wider"
          >
            ← Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reveal max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/queue"
            className="text-sm font-bold text-slate-500 hover:text-indigo-700 transition-colors"
          >
            ← Queue
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Serve & Deduct</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left — pour form */}
        <div className="space-y-5">
          <div className="bg-[#eef2ff] border border-indigo-100 rounded-xl p-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0">
                {customerName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-black text-lg text-slate-900">{customerName}</p>
                <p className="text-sm font-semibold text-slate-600 mt-0.5">
                  {tableId != null ? `Table ${tableId}` : 'Table —'} · Pour request: {requestedMl}ml
                </p>
              </div>
            </div>
            {waitLabel !== 'Just now' && (
              <span
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-bold ${
                  isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isUrgent ? '⚠️ ' : ''}{waitLabel}
              </span>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Wallet / Bottle *
            </label>
            <select
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
              value={row.walletId}
              disabled
            >
              <option value={row.walletId}>
                {bottleName} — {currentBalanceMl}ml remaining
              </option>
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-600">
              User requested: <span className="font-black text-indigo-700 text-base">{requestedMl} ml</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Confirm actual amount poured below</p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
              Quick Select (ml)
            </label>
            <div className="grid grid-cols-4 gap-3">
              {quickOptions.map((amt) => {
                const isActive = servedMl === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setServedMl(amt)}
                    disabled={isSubmitting}
                    className={`py-3 rounded-lg font-black text-lg border transition-all ${
                      isActive
                        ? 'bg-[#312e81] text-white border-[#312e81] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {amt}{isActive ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Actual Amount Served (ml) *
            </label>
            <input
              type="number"
              min={1}
              max={currentBalanceMl > 0 ? currentBalanceMl : undefined}
              value={servedMl}
              onChange={(e) => setServedMl(Math.max(0, Number(e.target.value)))}
              className="w-full bg-white border-2 border-slate-200 rounded-xl p-5 text-center font-black text-4xl text-slate-900 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {insufficient && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm font-semibold text-rose-800">
              ❌ <span className="font-black">Insufficient balance.</span> Customer only has {currentBalanceMl}ml.
              Cannot serve more than remaining balance.
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between font-semibold text-slate-600">
              <span>Current balance</span>
              <span>{currentBalanceMl} ml</span>
            </div>
            <div className="flex justify-between font-semibold text-rose-600">
              <span>Amount to deduct</span>
              <span>− {servedMl} ml</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
              <span className="font-bold text-slate-700">New balance</span>
              <span className="text-2xl font-black text-indigo-700">{newBalanceMl} ml</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onConfirmServe}
            disabled={isSubmitting || insufficient || servedMl <= 0}
            className="w-full btn-tablet btn-tablet-g justify-center py-4 rounded-xl font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Working…' : '✅ Confirm Served & Deduct Wallet'}
          </button>
          <button
            type="button"
            onClick={() => setShowRejectModal(true)}
            disabled={isSubmitting}
            className="w-full btn-tablet btn-tablet-r justify-center py-4 rounded-xl font-black text-sm disabled:opacity-50"
          >
            × Cancel This Pour Request
          </button>
        </div>

        {/* Right — preview + session log */}
        <div className="space-y-5">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Confirmation Preview</h2>

          <div className="bg-[#eef2ff] border border-indigo-100 rounded-xl p-5 space-y-3 text-sm">
            <PreviewRow label="Customer" value={customerName} />
            <PreviewRow label="Table" value={tableId != null ? `Table ${tableId}` : '—'} />
            <PreviewRow label="Bottle" value={bottleName} />
            <PreviewRow label="Amount to serve" value={`${servedMl} ml`} highlight />
            <div className="border-t border-indigo-200 pt-3 flex justify-between items-baseline">
              <span className="font-bold text-slate-700">New wallet balance</span>
              <span className="text-2xl font-black text-indigo-700">{newBalanceMl} ml</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs font-semibold text-blue-900">
            <span>⚡</span>
            <p>
              Wallet deduction happens <span className="font-black">only</span> after you tap &quot;Confirm Served&quot;.
              The user&apos;s app updates in real time via WebSocket.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">
              Session Activity Tonight
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {sessionServed.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 font-medium">No prior serves this session tonight.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {sessionServed.map((pour) => (
                    <li
                      key={pour.id}
                      className="px-4 py-3 flex justify-between items-center text-sm font-medium text-slate-700"
                    >
                      <span>
                        {formatClockLabel(pour.servedAtUtc ?? pour.createdAtUtc)} · {pour.servedMl ?? 0}ml{' '}
                        {shortBottle(pour.bottleBrandName, pour.bottleProductName)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                        Served ✓
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm font-bold text-slate-800">
                Total consumed tonight: {sessionTotalMl}ml
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-7 w-full max-w-lg space-y-5">
            <div>
              <p className="text-slate-900 font-black text-lg">Cancel this pour request?</p>
              <p className="text-slate-500 text-sm font-semibold mt-1">A reason is required.</p>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white border-2 border-slate-100 rounded-xl p-4 text-sm font-semibold outline-none focus:border-rose-500 min-h-[100px]"
              placeholder="e.g., Customer not present, bottle unavailable…"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="btn-tablet btn-tablet-s justify-center py-3 rounded-xl text-sm font-black"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={isSubmitting}
                className="btn-tablet btn-tablet-r justify-center py-3 rounded-xl text-sm font-black"
              >
                {isSubmitting ? 'Working…' : 'Cancel Pour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={`font-bold text-right ${highlight ? 'text-indigo-700 text-base' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}
