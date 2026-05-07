'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getActiveBarId } from '@/lib/active-bar';
import { fetchPourQueue, type PourRequestDto } from '@/lib/api-client';
import { usePourHub } from '@/hooks/usePourHub';

/**
 * SC-21 Floor Plan. This phase doesn't yet have a "tables & assigned staff"
 * read endpoint — that's a Phase-7 dashboard surface — so the floor here is
 * seeded from the live pour queue, grouping pending requests by session id.
 * One tile per active session with a state that mirrors the prototype:
 *
 *   • Empty          — grey, no pending pour
 *   • Active         — violet, session open, no pending pour
 *   • Pour requested — amber, exactly one pending pour
 *   • Multiple       — rose, two or more pending pours piled up
 *
 * Once Phase 7 lands a `GET /api/v1/bars/:id/floor` endpoint this page swaps
 * to that as its source of truth.
 */
type FloorTile = {
  sessionId: number;
  userDisplayName: string | null;
  pendingCount: number;
  oldestPour: PourRequestDto | null;
};

export default function FloorPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [rows, setRows] = useState<PourRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        setRows(await fetchPourQueue(barId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load floor');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  usePourHub(barId, {
    onNewPourRequest: (evt) => setRows((prev) => {
      if (prev.some((r) => r.id === evt.pourRequestId)) return prev;
      return [...prev, {
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
      }];
    }),
    onPourConfirmed: (evt) => setRows((prev) => prev.filter((r) => r.id !== evt.pourRequestId)),
    onPourCancelled: (evt) => setRows((prev) => prev.filter((r) => r.id !== evt.pourRequestId)),
  });

  const tiles = useMemo<FloorTile[]>(() => {
    const bySession = new Map<number, FloorTile>();
    for (const pour of rows) {
      const existing = bySession.get(pour.sessionId);
      if (existing) {
        existing.pendingCount += 1;
        if (!existing.oldestPour || new Date(pour.createdAtUtc) < new Date(existing.oldestPour.createdAtUtc)) {
          existing.oldestPour = pour;
        }
      } else {
        bySession.set(pour.sessionId, {
          sessionId: pour.sessionId,
          userDisplayName: pour.userDisplayName,
          pendingCount: 1,
          oldestPour: pour,
        });
      }
    }
    return Array.from(bySession.values()).sort((a, b) => a.sessionId - b.sessionId);
  }, [rows]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Floor plan</h1>
        <p className="text-slate-400 text-sm">
          Tap a table to see the customer&apos;s session and open pour requests.
        </p>
      </header>

      <Legend />

      {loading && <p className="text-slate-400 mt-6">Loading floor…</p>}
      {error && (
        <p className="text-rose-400 bg-rose-950/40 border border-rose-900 rounded-md px-4 py-3 mt-6">
          {error}
        </p>
      )}

      {!loading && !error && tiles.length === 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center text-slate-400 mt-6">
          <p className="text-lg">No live sessions.</p>
          <p className="text-sm mt-1">Tables light up here as customers check in via QR.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        {tiles.map((tile) => (
          <FloorTileView key={tile.sessionId} tile={tile} />
        ))}
      </div>
    </div>
  );
}

function Legend() {
  const dot = 'inline-block w-3 h-3 rounded-full align-middle mr-1.5';
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
      <span><span className={`${dot} bg-slate-600`} /> Empty</span>
      <span><span className={`${dot} bg-violet-500`} /> Active session</span>
      <span><span className={`${dot} bg-amber-400`} /> Pour requested</span>
      <span><span className={`${dot} bg-rose-500`} /> Multiple pending</span>
    </div>
  );
}

function FloorTileView({ tile }: { tile: FloorTile }) {
  const state: 'active' | 'requested' | 'piled' =
    tile.pendingCount === 0 ? 'active'
      : tile.pendingCount === 1 ? 'requested'
      : 'piled';

  const toneClass =
    state === 'requested' ? 'bg-amber-500/15 border-amber-500/60 hover:bg-amber-500/25'
      : state === 'piled' ? 'bg-rose-500/15 border-rose-500/60 hover:bg-rose-500/25'
      : 'bg-violet-500/10 border-violet-500/40 hover:bg-violet-500/20';

  const href = tile.oldestPour
    ? `/serve/${tile.oldestPour.id}`
    : `/customer/${tile.sessionId}`;

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-400 ${toneClass}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-white">Session #{tile.sessionId}</span>
        {tile.pendingCount > 0 && (
          <span
            className={
              state === 'piled'
                ? 'text-rose-200 text-xs font-bold bg-rose-500/40 rounded-full px-2 py-0.5'
                : 'text-amber-100 text-xs font-bold bg-amber-500/40 rounded-full px-2 py-0.5'
            }
          >
            {tile.pendingCount} pending
          </span>
        )}
      </div>
      <p className="mt-2 text-base text-white/90">
        {tile.userDisplayName ?? 'Guest'}
      </p>
      {tile.oldestPour && (
        <p className="mt-1 text-xs text-slate-300">
          Next: {tile.oldestPour.requestedMl} ml · tap to serve
        </p>
      )}
    </Link>
  );
}
