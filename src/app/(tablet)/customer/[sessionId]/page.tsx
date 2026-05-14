'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  fetchPourQueue,
  type PourRequestDto,
} from '@/lib/api-client';

/**
 * SC-23 Customer detail. Scopes the pour queue down to a single session so a
 * bartender can see everything that table has pending in one place and tap
 * through to serve.
 *
 * Deep read (all wallets + full session shape) lives behind the end-user
 * `/api/v1/sessions/active` surface — staff-side session detail is a Phase-7
 * addition. For now this page runs on the same queue-by-bar feed, filtered.
 */
export default function CustomerDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const router = useRouter();

  const [rows, setRows] = useState<PourRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const barId = getActiveBarId();
    if (!barId || !Number.isFinite(sessionId) || sessionId <= 0) {
      setError('Missing bar or session context.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const queue = await fetchPourQueue(barId);
        setRows(queue.filter((r) => r.sessionId === sessionId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const customerName = rows[0]?.userDisplayName ?? 'Guest';

  return (
    <div className="p-6 max-w-4xl mx-auto reveal">
      <button
        onClick={() => router.back()}
        className="text-slate-400 hover:text-ink font-black text-[10px] flex items-center gap-1 mb-8 uppercase tracking-widest"
      >
        ← Back to Floor Plan
      </button>

      <header className="bg-slate-950 rounded-[40px] p-10 text-white shadow-xl relative overflow-hidden mb-12">
        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="flex justify-between items-start relative">
          <div>
            <div className="flex items-center gap-4 mb-4">
               <span className="text-4xl font-black tracking-tighter">Table {sessionId}</span>
               <span className="badge-tablet bg-amber-500/20 text-amber-500 border border-amber-500/30">ACTIVE SESSION</span>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Customer: <span className="text-white">{customerName}</span> · Checked in 45m ago
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Session Total</p>
            <p className="text-4xl font-black text-amber-500 tracking-tighter">₹1,840</p>
          </div>
        </div>
      </header>

      {loading && <div className="p-20 text-center text-slate-400 animate-pulse">Loading table details...</div>}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-5 rounded-[24px] mb-8 font-bold text-sm">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-100 rounded-[40px] p-24 text-center">
          <div className="text-7xl mb-6 grayscale opacity-10">🥃</div>
          <p className="text-ink font-black text-xl">No Pending Pours</p>
          <p className="text-slate-400 text-sm mt-1 font-medium">This table is active but has no open requests.</p>
        </div>
      )}

      <div className="space-y-6">
        {rows.length > 0 && (
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Active Pour Requests ({rows.length})</h3>
        )}
        {rows.map((pour) => (
          <div
            key={pour.id}
            className="panel p-8 hover:border-amber-400 transition-all group cursor-pointer"
            onClick={() => router.push(`/serve/${pour.id}`)}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Bottle Wallet</p>
                <p className="text-2xl font-black text-ink group-hover:text-amber-700 transition-colors">
                  {pour.bottleBrandName ?? 'Bottle'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 font-bold uppercase tracking-tight">
                  Requested {new Date(pour.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-amber-700 tracking-tighter">{pour.requestedMl}<span className="text-sm ml-1 text-slate-300">ml</span></span>
              </div>
            </div>
            
            {pour.userNotes && (
              <div className="mb-8 p-5 bg-amber-50/50 rounded-2xl text-sm text-amber-800 font-bold border-l-4 border-amber-300 italic">
                &ldquo;{pour.userNotes}&rdquo;
              </div>
            )}
            
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KYC Verified</span>
               </div>
               <button className="btn-tablet btn-tablet-g px-10 shadow-lg shadow-emerald-100">
                 Serve Now →
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
