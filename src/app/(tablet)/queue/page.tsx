'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePourHub } from '@/hooks/usePourHub';
import { fetchPourQueue, type PourRequestDto } from '@/lib/api-client';
import { getActiveBarId } from '@/lib/active-bar';

export default function PourQueuePage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [rows, setRows] = useState<PourRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    setBarId(getActiveBarId());
  }, []);

  // Fetch initial queue
  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        const initial = await fetchPourQueue(barId);
        setRows(initial);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  // Subscribe to real-time updates
  const { connectionState } = usePourHub(barId, {
    onNewPourRequest: (evt) => {
      setRows((prev) => {
        if (prev.some(r => r.id === evt.pourRequestId)) return prev;
        const newPour: PourRequestDto = {
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
        return [...prev, newPour];
      });
    },
    onPourConfirmed: (evt) => {
      setRows((prev) => prev.filter(r => r.id !== evt.pourRequestId));
    },
    onPourCancelled: (evt) => {
      setRows((prev) => prev.filter(r => r.id !== evt.pourRequestId));
    },
  });

  // Local clock tick to refresh 'minutes ago' labels
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => 
      new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime()
    );
  }, [rows]);

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-ink tracking-tighter">Pour Requests Queue</h1>
          <p className="text-sm text-muted font-medium mt-1">
            {sorted.length} pending · Real-time service monitor
          </p>
        </div>
        <ConnectionBadge state={connectionState} />
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Pending Requests */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            Active Pours ({sorted.length}) <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          </h3>
          
          <div className="space-y-4">
            {sorted.map((request) => {
              const waitedMs = nowTick - new Date(request.createdAtUtc).getTime();
              const waitedMin = Math.max(0, Math.floor(waitedMs / 60_000));
              const urgent = waitedMin > 3;

              return (
                <div 
                  key={request.id} 
                  className={`panel p-6 hover:border-amber-300 transition-all cursor-pointer group ${urgent ? 'border-rose-200 bg-rose-50/20' : ''}`}
                  onClick={() => router.push(`/serve/${request.id}`)}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-black text-ink">Table {request.sessionId % 20}</span>
                        <span className={`badge-tablet ${urgent ? 'badge-tablet-r' : 'badge-tablet-p'}`}>
                          {urgent ? '⚠️ Urgent' : 'Waiting'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{request.userDisplayName ?? 'Guest'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">{request.bottleBrandName} · 338ml left</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</p>
                      <p className={`font-black text-xl ${urgent ? 'text-rose-600' : 'text-slate-900'}`}>{waitedMin} min</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Requested</p>
                        <p className="text-3xl font-black text-amber-700">{request.requestedMl}<span className="text-xs ml-1 text-slate-300 uppercase">ml</span></p>
                     </div>
                     <button className="btn-tablet btn-tablet-g px-10 shadow-lg shadow-emerald-100">
                        Serve Now →
                     </button>
                  </div>
                </div>
              );
            })}

            {sorted.length === 0 && !loading && (
              <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-20 text-center">
                <div className="text-6xl mb-6 grayscale opacity-20">🥃</div>
                <p className="text-slate-900 font-bold text-lg">Queue is empty</p>
                <p className="text-slate-400 text-sm mt-1 font-medium">New requests will appear here in real-time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Served Tonight */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Activity Log (14 Served)</h3>
          
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Time</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Table</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Served</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold">
                  {[
                    { t: '9:41 PM', tbl: 'T2', name: 'Arjun M.', ml: '60ml' },
                    { t: '9:35 PM', tbl: 'T7', name: 'Arjun M.', ml: '90ml' },
                    { t: '9:28 PM', tbl: 'T4', name: 'Meena R.', ml: '60ml' },
                    { t: '9:22 PM', tbl: 'T6', name: 'Priya S.', ml: '120ml' },
                    { t: '9:15 PM', tbl: 'T1', name: 'Kiran B.', ml: '60ml' },
                    { t: '9:08 PM', tbl: 'T4', name: 'Meena R.', ml: '30ml' },
                    { t: '8:55 PM', tbl: 'T3', name: 'Rahul V.', ml: '60ml' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-slate-400">{row.t}</td>
                      <td className="px-5 py-4 text-slate-900 font-black">{row.tbl}</td>
                      <td className="px-5 py-4 text-slate-600">{row.name}</td>
                      <td className="px-5 py-4 text-emerald-600 text-right">{row.ml} ✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="w-full py-4 text-[10px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 hover:bg-amber-100 transition-colors border-t border-amber-100">
              Download Full Shift Log (PDF)
            </button>
          </div>

          <div className="mt-8 bg-slate-950 rounded-[32px] p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            
            <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest mb-2">Shift Summary</p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-black text-white">840</span>
              <span className="text-sm font-bold text-amber-500/80 uppercase">ml served total</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              14 pours completed successfully · 2.1 min avg response
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionBadge({ state }: { state: any }) {
  const isConnected = state === 'Connected' || state === 1;
  const isConnecting = state === 'Connecting' || state === 'Reconnecting' || state === 0 || state === 3;
  
  if (isConnected) return <span className="badge-tablet badge-tablet-p">● Live</span>;
  if (isConnecting) return <span className="badge-tablet badge-tablet-a">Connecting…</span>;
  return <span className="badge-tablet badge-tablet-r">Offline</span>;
}
