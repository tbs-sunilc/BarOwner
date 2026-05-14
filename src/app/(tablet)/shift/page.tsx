'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShiftSummaryPage() {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [ending, setEnding] = useState(false);
  const [startTime] = useState(new Date(Date.now() - 5.5 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch('/api/shift/stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const handleEndShift = () => {
    setEnding(true);
    setTimeout(() => {
      router.push('/login');
    }, 1500);
  };

  if (loading || !stats) return <div className="p-20 text-center text-muted animate-pulse">Loading shift stats...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-ink tracking-tighter">Shift Summary</h1>
        <p className="text-sm text-muted font-medium mt-1">Review activity before ending your session</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="panel p-6 border-t-4 border-info">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Shift Timing</p>
          <p className="text-2xl font-black text-ink">
            {new Date(stats.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — NOW
          </p>
          <div className="flex mt-3">
             <span className="badge-tablet badge-tablet-p">Active Shift</span>
          </div>
        </div>
        <div className="panel p-6 border-t-4 border-warning">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Pours Served</p>
          <p className="text-5xl font-black text-amber-700">{stats.poursServed}</p>
          <p className="text-[10px] text-amber-600 mt-2 font-black uppercase">{stats.totalVolumeMl} ml total</p>
        </div>
        <div className="panel p-6 border-t-4 border-success">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Service Speed</p>
          <p className="text-5xl font-black text-emerald-600">{stats.avgResponseTime}</p>
          <p className="text-[10px] text-emerald-600 mt-2 font-black uppercase">min avg wait</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Activity Log */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tonight's Activity Log</h3>
          <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Time</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Table</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Served</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold">
                  {stats.recentActivity.map((log: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-slate-400">{log.time}</td>
                      <td className="px-5 py-4 text-ink">{log.user}</td>
                      <td className="px-5 py-4 text-slate-600">{log.table}</td>
                      <td className="px-5 py-4 text-amber-700 text-right">{log.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="w-full py-4 bg-amber-50 text-[10px] font-black text-amber-600 uppercase tracking-widest border-t border-amber-100 hover:bg-amber-100 transition-colors">
              📄 Download Detailed Report (PDF)
            </button>
          </div>
        </div>

        {/* Right: Handover */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Handover Notes</h3>
          <div className="panel p-8 bg-white">
            <div className="mb-8">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Notes for Next Shift</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Table 4 asked for separate bills. Absolut Vodka needs restocking."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold focus:border-amber-400 outline-none transition-all min-h-[140px]"
              />
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 mb-10 flex gap-4">
              <span className="text-2xl">⚠️</span>
              <p className="text-[11px] text-rose-600 font-bold leading-relaxed uppercase tracking-tight">
                <strong>5 tables are currently active.</strong> Ending your shift will transfer these sessions to the next staff member.
              </p>
            </div>

            <button
              onClick={handleEndShift}
              disabled={ending}
              className="btn-tablet btn-tablet-r w-full justify-center py-6 text-xl shadow-xl shadow-rose-100 font-black"
            >
              {ending ? '...' : 'End Shift & Logout'}
            </button>
            <p className="text-center text-[10px] text-slate-300 font-black uppercase mt-6 tracking-[0.2em]">
              Session ID: SHFT-2024-X91 · Server Confirmed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
