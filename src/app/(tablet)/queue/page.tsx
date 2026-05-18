'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTabletState, TabletState } from '@/lib/tablet-state';

export default function PourQueuePage() {
  const router = useRouter();
  const [state, setState] = useState<TabletState | null>(null);

  useEffect(() => {
    setState(getTabletState());
  }, []);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading pour queue...</div>;
  }

  const handleServeNow = (requestId: number) => {
    router.push(`/serve/${requestId}`);
  };

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pour Requests Queue</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Real-time updates</p>
        </div>
      

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Pending Requests */}
        <div>
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            Pending Requests ({state.pourQueue.length})
            {state.pourQueue.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </h3>

          <div className="space-y-3">
            {state.pourQueue.map((req) => {
              const isUrgent = req.urgent || req.waitTime.includes('4');
              const cardClass = isUrgent
                ? 'border-2 border-[#e11d48] bg-[#fff1f2] hover:border-[#4338ca] hover:shadow-md'
                : 'border border-[#e2e8f0] bg-white hover:border-[#4338ca] hover:shadow-md';
              const badgeClass = isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500';

              return (
                <div
                  key={req.id}
                  onClick={() => handleServeNow(req.id)}
                  className={`rounded-xl p-4 cursor-pointer transition-all ${cardClass}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-bold text-slate-900">Table {req.tableId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${badgeClass}`}>
                          {isUrgent ? '⚠️ ' : ''}{req.waitTime}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-slate-800">{req.customer}</p>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        Wallet: {req.bottle} · {req.walletBalance}ml remaining
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Amount</p>
                      <p className="text-2xl font-black text-indigo-900">
                        {req.requestedAmount}<span className="text-sm ml-0.5 text-slate-500">ml</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServeNow(req.id);
                    }}
                    className="w-full bg-[#16a34a] hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                  >
                    ✅ Serve Now
                  </button>
                </div>
              );
            })}

            {state.pourQueue.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                <div className="text-4xl mb-4 grayscale opacity-40">🥃</div>
                <p className="text-slate-800 font-bold text-lg">Queue is empty</p>
                <p className="text-slate-500 text-sm mt-1">New requests will appear here in real-time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Served Tonight */}
        <div>
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Served Tonight ({state.shiftStats.poursServed})</h3>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Table</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bottle</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Served</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  {state.servedPours.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500">{row.time}</td>
                      <td className="px-4 py-3 text-slate-900 font-bold">{row.table}</td>
                      <td className="px-4 py-3 text-slate-700">{row.customer}</td>
                      <td className="px-4 py-3 text-slate-600">{row.bottle}</td>
                      <td className="px-4 py-3 text-[#16a34a] font-bold text-right">{row.amount} ✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Summary Card */}
          <div className="bg-[#312e81] text-white rounded-xl p-6 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">Tonight's Totals</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{state.shiftStats.poursServed}</span>
                <span className="text-sm font-medium text-indigo-200">pours served</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-indigo-200 font-medium tracking-wide">
                Total Volume: <span className="font-bold text-white text-lg ml-1">{state.shiftStats.totalMlServed} ml</span>
              </p>
              <p className="text-xs text-indigo-300 mt-1">Avg service time: {state.shiftStats.avgServiceTime}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
