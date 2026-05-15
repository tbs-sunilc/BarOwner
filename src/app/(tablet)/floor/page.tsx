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
    const loadFloor = async () => {
      try {
        const res = await fetch('/api/floor/tiles');
        if (!res.ok) throw new Error('Failed to load floor');
        const data = await res.json();
        setTiles(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadFloor();
  }, []);

  // Update tiles when real-time events arrive (optional, for demo)
  const [tiles, setTiles] = useState<FloorTile[]>([]);

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


  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-ink tracking-tighter">Sky Lounge Floor</h1>
        <p className="text-sm text-muted font-medium mt-1">Live table status and floor summary</p>
      </header>

      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-200"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pour Pending</span>
        </div>
      </div>

      {loading && <div className="p-20 text-center text-slate-400 animate-pulse">Loading floor plan...</div>}
      
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {tiles.map((tile) => (
            <FloorTileView key={tile.sessionId} tile={tile} />
          ))}
        </div>
      )}

      {/* Summary Cards aligned with Bar Owner KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
        <div className="panel p-6 border-t-4 border-info">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Tables Occupied</p>
          <p className="text-4xl font-bold text-ink">{tiles.length}</p>
          <p className="text-[10px] font-bold text-info mt-2">Active Sessions</p>
        </div>
        <div className="panel p-6 border-t-4 border-danger">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Pending Pours</p>
          <p className="text-4xl font-bold text-danger">{tiles.reduce((acc, t) => acc + t.pendingCount, 0)}</p>
          <p className="text-[10px] font-bold text-danger mt-2">Action Required</p>
        </div>
        <div className="panel p-6 border-t-4 border-success">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Pours Tonight</p>
          <p className="text-4xl font-bold text-success">14</p>
          <p className="text-[10px] font-bold text-success mt-2">840ml Total</p>
        </div>
        <div className="panel p-6 border-t-4 border-warning">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Estimated Revenue</p>
          <p className="text-4xl font-bold text-amber-700">₹{(14 * 450).toLocaleString()}</p>
          <p className="text-[10px] font-bold text-amber-600 mt-2">Wallet Sales</p>
        </div>
      </div>
    </div>
  );
}

function FloorTileView({ tile }: { tile: FloorTile }) {
  const state: 'active' | 'requested' | 'piled' =
    tile.pendingCount === 0 ? 'active'
      : tile.pendingCount === 1 ? 'requested'
      : 'piled';

  const toneClass =
    state === 'requested' ? 'border-rose-200 bg-rose-50/50 shadow-sm'
      : state === 'piled' ? 'border-rose-400 bg-rose-100/50 shadow-md'
      : 'border-slate-100 bg-white hover:border-amber-200';

  const href = tile.oldestPour
    ? `/serve/${tile.oldestPour.id}`
    : `/customer/${tile.sessionId}`;

  return (
    <Link
      href={href}
      className={`ftile flex flex-col items-center text-center p-6 ${toneClass}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
         <span className={`text-2xl font-black ${state === 'active' ? 'text-amber-600' : 'text-rose-600'}`}>
           {tile.sessionId}
         </span>
      </div>
      
      {tile.pendingCount > 0 ? (
        <>
          <span className="badge-tablet badge-tablet-r">🔔 POUR REQ</span>
          <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
            {tile.pendingCount} pending · 4m
          </p>
        </>
      ) : (
        <>
          <span className="badge-tablet badge-tablet-p">Occupied</span>
          <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
            {tile.userDisplayName?.split(' ')[0] ?? 'Guest'} · 45m
          </p>
        </>
      )}
    </Link>
  );
}
