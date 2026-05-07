'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  fetchPourQueue,
  type PourRequestDto,
} from '@/lib/api-client';
import { usePourHub } from '@/hooks/usePourHub';

/**
 * SC-22 Live Pour Queue. Renders every Pending pour at the bar, sorted by
 * wait time. Tiles that have been waiting &gt; 3 minutes flip to an "urgent"
 * amber state so the bartender's eye catches them before the SLA breaks.
 *
 * Data flow:
 *   - Initial fetch: GET /api/v1/pour-requests/queue?barId=…
 *   - Live updates: PourHub NewPourRequest / PourConfirmed / PourCancelled
 *   - A `nowTick` state drives a 15-second re-render so wait-time + urgency
 *     recalculate without the tile list having to re-mount.
 */
export default function QueuePage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [rows, setRows] = useState<PourRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    const active = getActiveBarId();
    setBarId(active);
  }, []);

  const reload = useCallback(async (id: number) => {
    try {
      setError(null);
      const queue = await fetchPourQueue(id);
      setRows(queue);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load queue';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (barId == null) return;
    void reload(barId);
  }, [barId, reload]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const { connectionState } = usePourHub(barId, {
    onNewPourRequest: (evt) => {
      setRows((prev) => {
        if (prev.some((r) => r.id === evt.pourRequestId)) return prev;
        const next: PourRequestDto = {
          id: evt.pourRequestId,
          sessionId: evt.sessionId,
          walletId: evt.walletId,
          userId: evt.userId,
          barId: evt.barId,
          requestedMl: evt.requestedMl,
          servedMl: null,
          status: 'Pending',
          userNotes: evt.userNotes,
          cancellationReason: null,
          createdAtUtc: evt.createdAtUtc,
          servedAtUtc: null,
          cancelledAtUtc: null,
          walletTransactionId: null,
          remainingMlAfterServe: null,
          userDisplayName: evt.userDisplayName,
          bottleBrandName: evt.bottleBrandName,
          bottleProductName: evt.bottleProductName,
        };
        return [...prev, next];
      });
    },
    onPourConfirmed: (evt) => {
      setRows((prev) => prev.filter((r) => r.id !== evt.pourRequestId));
    },
    onPourCancelled: (evt) => {
      setRows((prev) => prev.filter((r) => r.id !== evt.pourRequestId));
    },
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime()),
    [rows],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Live pour queue</h1>
          <p className="text-slate-400 text-sm">
            {sorted.length} pending · sorted oldest first.
          </p>
        </div>
        <ConnectionBadge state={connectionState} />
      </header>

      {loading && <p className="text-slate-400">Loading queue…</p>}
      {error && (
        <p className="text-rose-400 bg-rose-950/40 border border-rose-900 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center text-slate-400">
          <p className="text-lg">All caught up.</p>
          <p className="text-sm mt-1">New pour requests land here the moment they arrive.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((pour) => (
          <QueueTile key={pour.id} pour={pour} nowMs={nowTick} />
        ))}
      </div>
    </div>
  );
}

function QueueTile({ pour, nowMs }: { pour: PourRequestDto; nowMs: number }) {
  const waitedMs = nowMs - new Date(pour.createdAtUtc).getTime();
  const waitedMin = Math.max(0, Math.floor(waitedMs / 60_000));
  const urgent = waitedMs > 3 * 60_000;

  const base = 'block rounded-xl p-5 border transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900';
  const toneClass = urgent
    ? 'bg-amber-500/15 border-amber-500/60 hover:bg-amber-500/20 focus:ring-amber-400'
    : 'bg-slate-800 border-slate-700 hover:bg-slate-700/60 focus:ring-violet-400';

  return (
    <Link href={`/serve/${pour.id}`} className={`${base} ${toneClass}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-slate-400">
          Table · Session #{pour.sessionId}
        </span>
        <span
          className={
            urgent
              ? 'text-amber-300 text-xs font-semibold'
              : 'text-slate-400 text-xs'
          }
        >
          {waitedMin < 1 ? 'Just now' : `${waitedMin} min`}
          {urgent && ' · urgent'}
        </span>
      </div>
      <p className="text-lg font-semibold text-white">
        {pour.userDisplayName ?? `Guest #${pour.userId}`}
      </p>
      <p className="text-slate-300 text-sm mt-0.5">
        {pour.bottleBrandName ? `${pour.bottleBrandName} ${pour.bottleProductName ?? ''}` : 'Bottle'}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-2xl font-bold text-violet-300">{pour.requestedMl} ml</span>
        <span className="text-xs text-slate-400">Tap to serve →</span>
      </div>
      {pour.userNotes && (
        <p className="mt-3 text-xs text-slate-400 italic line-clamp-2">
          &ldquo;{pour.userNotes}&rdquo;
        </p>
      )}
    </Link>
  );
}

function ConnectionBadge({ state }: { state: string }) {
  const map: Record<string, { color: string; label: string }> = {
    Connected:    { color: 'bg-emerald-500', label: 'Live' },
    Connecting:   { color: 'bg-amber-500',   label: 'Connecting…' },
    Reconnecting: { color: 'bg-amber-500',   label: 'Reconnecting…' },
    Disconnected: { color: 'bg-rose-500',    label: 'Offline' },
    Disconnecting:{ color: 'bg-rose-500',    label: 'Disconnecting…' },
  };
  const tone = map[state] ?? { color: 'bg-slate-500', label: state };
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-300">
      <span className={`w-2.5 h-2.5 rounded-full ${tone.color}`} />
      {tone.label}
    </span>
  );
}
