'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTabletState, TabletState, resetTabletState } from '@/lib/tablet-state';
import { clearStaffSession } from '@/lib/staff-session';

export default function ShiftSummaryPage() {
  const router = useRouter();
  const [state, setState] = useState<TabletState | null>(null);
  const [notes, setNotes] = useState('');
  const [handoverTo, setHandoverTo] = useState('Sneha Patel');
  const [ending, setEnding] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    setState(getTabletState());
  }, []);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading shift summary...</div>;
  }

  const activeTablesCount = state.tables.filter(t => t.status !== 'available').length;

  const handleEndShift = () => {
    setEnding(true);
    
    if ((window as any).toast) {
      (window as any).toast('Shift ended. Log saved. Signed out.', 's');
    }

    setTimeout(() => {
      clearStaffSession();
      resetTabletState();
      router.push('/login?staff=1');
    }, 800);
  };

  const handleSkipNotes = () => {
    if ((window as any).toast) {
      (window as any).toast('ℹ️ Notes skipped. Preparing logout...', 'i');
    }
    setEnding(true);

    setTimeout(() => {
      clearStaffSession();
      resetTabletState();
      router.push('/login?staff=1');
    }, 800);
  };

  const displayedLogs = showAllLogs ? state.servedPours : state.servedPours.slice(0, 4);

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      {/* Header Bar */}
      <header className="mb-8 flex justify-between items-center bg-slate-50 border border-slate-200 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <Link href="/floor" className="btn-tablet btn-tablet-s !py-2 !px-4 !text-xs">
            ← Floor Plan
          </Link>
          <div>
            <h1 className="text-2xl font-black text-ink tracking-tighter">Shift Summary & Handover</h1>
            <p className="text-xs text-muted font-bold uppercase tracking-wider mt-0.5">
              Review stats and hand over terminal
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Stats & Log */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Shift Performance</h3>

          {/* Shift Info Card */}
          <div className="bg-indigo-950 text-white p-6 rounded-[28px] shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Logged Bartender</p>
            <h2 className="text-2xl text-white tracking-tighter">{state.currentBartender.name}</h2>
            <div className="flex gap-4 mt-4 text-xs font-bold text-indigo-200">
              <span className="bg-white/10 px-3 py-1 rounded-xl">Timeline: 6:00 PM - 11:41 PM</span>
              <span className="bg-white/10 px-3 py-1 rounded-xl">Duration: 5h 41m</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="panel p-5 bg-white border border-slate-200 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pours Served</p>
              <p className="text-3xl font-black text-indigo-950">{state.shiftStats.poursServed}</p>
            </div>
            <div className="panel p-5 bg-white border border-slate-200 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Volume</p>
              <p className="text-3xl font-black text-indigo-600">{state.shiftStats.totalMlServed} ml</p>
            </div>
            <div className="panel p-5 bg-white border border-slate-200 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Customers</p>
              <p className="text-3xl font-black text-amber-700">{state.shiftStats.uniqueCustomers}</p>
            </div>
            <div className="panel p-5 bg-white border border-slate-200 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Service Speed</p>
              <p className="text-3xl font-black text-emerald-600">{state.shiftStats.avgServiceTime}</p>
            </div>
          </div>

          {/* Activity Log Card */}
          <div className="panel p-6 bg-white border border-slate-200 rounded-[28px] space-y-4 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">Shift Activity Log</p>
            
            <div className="space-y-3">
              {displayedLogs.map((log, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span>{log.time} · {log.amount} {log.bottle}</span>
                  <span className="text-slate-400 uppercase">{log.customer} · {log.table}</span>
                </div>
              ))}
            </div>

            {state.servedPours.length > 4 && (
              <button
                onClick={() => setShowAllLogs(!showAllLogs)}
                className="w-full py-3 bg-slate-50 text-[10px] font-black text-indigo-600 uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-colors mt-2"
              >
                {showAllLogs ? 'Hide Log' : 'Full Log'}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Handover Form */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Shift Handover</h3>

          <div className="panel p-8 bg-white border border-slate-200 rounded-[32px] space-y-6">
            {/* Handover dropdown */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Handover To *</label>
              <select
                value={handoverTo}
                onChange={(e) => setHandoverTo(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
              >
                <option value="Sneha Patel">Sneha Patel (Bartender - Evening Shift)</option>
                <option value="Amit Kumar">Amit Kumar (Manager)</option>
              </select>
            </div>

            {/* Handover notes */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Handover Notes for Next Shift</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Table 4 asked for separate bills. Absolut Vodka needs restocking."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-sm font-bold focus:border-indigo-500 outline-none transition-all h-32 shadow-sm"
              />
            </div>

            {/* Warnings */}
            <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex gap-4 text-[11px] text-rose-600 font-bold uppercase leading-relaxed tracking-tight">
              <span className="text-2xl">⚠️</span>
              <p>
                <strong>{activeTablesCount} tables are currently active.</strong> Ending your shift will transfer these sessions to {handoverTo}.
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={handleEndShift}
                disabled={ending}
                className="btn-tablet btn-tablet-a w-full justify-center py-5 text-lg font-black uppercase shadow-glow"
              >
                {ending ? 'Signing Out...' : 'End Shift & Sign Out'}
              </button>
              <button
                onClick={handleSkipNotes}
                disabled={ending}
                className="btn-tablet btn-tablet-s w-full justify-center py-3 text-xs font-bold uppercase"
              >
                Skip Handover Note
              </button>
            </div>

            <p className="text-center text-[9px] text-slate-300 font-black uppercase mt-6 tracking-[0.2em]">
              Terminal ID: TERM-T10A · Server Confirmed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
