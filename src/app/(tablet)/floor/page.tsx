'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTabletState, TabletState, saveTabletState, fetchLiveTableStatus } from '@/lib/tablet-state';
import { getActiveBarId } from '@/lib/active-bar';
import { HubConnectionState } from '@microsoft/signalr';
import { usePourHub } from '@/hooks/usePourHub';

export default function FloorPage() {
  const router = useRouter();
  const [state, setState] = useState<TabletState | null>(null);
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(false);
  const refreshInFlightRef = useRef(false);

  const refreshTables = useCallback(async () => {
    const barId = getActiveBarId();
    if (!barId || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const liveTables = await fetchLiveTableStatus(barId);
      setState(prev => {
        if (!prev) return prev;
        const next = { ...prev, tables: liveTables };
        saveTabletState(next);
        return next;
      });
    } catch (error) {
      console.error('Error refreshing table status:', error);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  const { connectionState } = usePourHub(getActiveBarId(), {
    onNewPourRequest: () => { void refreshTables(); },
    onPourConfirmed: () => { void refreshTables(); },
    onPourCancelled: () => { void refreshTables(); },
  });

  useEffect(() => {
    const loadData = async () => {
      // Get initial state from localStorage
      const initialState = getTabletState();
      setState(initialState);

      // Try to fetch live table data from API
      setIsLoadingLiveData(true);
      try {
        await refreshTables();
      } catch (error) {
        console.error('Error loading live table status:', error);
        // State already set to initialState above
      } finally {
        setIsLoadingLiveData(false);
      }
    };

    void loadData();
  }, [refreshTables]);

  useEffect(() => {
    if (connectionState === HubConnectionState.Connected) return;
    const interval = setInterval(() => {
      void refreshTables();
    }, 30000);
    return () => clearInterval(interval);
  }, [connectionState, refreshTables]);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading floor plan...</div>;
  }

  // Calculate dynamic stats
  const occupiedCount = state.tables.filter(t => t.status === 'occupied' || t.status === 'pour-pending').length;
  const pendingCount = state.pourQueue.length;

  const handleTableClick = (tableId: number) => {
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.status === 'available') {
      if ((window as any).toast) {
        (window as any).toast(`Table ${tableId} is available`, 'i');
      }
    } else if (table.status === 'reserved') {
      if ((window as any).toast) {
        (window as any).toast(`Table ${tableId}: Reserved for ${table.details || 'Guest'} at ${table.sessionTime}`, 'w');
      }
    } else if (table.status === 'pour-pending') {
      router.push('/queue');
    } else if (table.status === 'occupied') {
      router.push('/customer/lookup');
    }
  };

  return (
    <div className="reveal">
      {/* Legend Row */}
      <div className="flex flex-wrap gap-4 mb-8 items-center bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mr-2">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#eef2ff] border-2 border-[#4338ca]"></div>
          <span className="text-sm font-semibold text-slate-700">Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#fffbeb] border-2 border-[#d97706]"></div>
          <span className="text-sm font-semibold text-slate-700">Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#f8fafc] border-2 border-[#e2e8f0]"></div>
          <span className="text-sm font-semibold text-slate-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#fff1f2] border-2 border-[#e11d48]"></div>
          <span className="text-sm font-semibold text-slate-700">Pour Pending</span>
        </div>
      </div>

      {/* Floor Plan Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        {state.tables.map((table) => {
          let toneClass = '';
          let badgeText = '';
          let badgeClass = '';
          let subText = '';

          if (table.status === 'occupied') {
            toneClass = 'border-[#4338ca] bg-[#eef2ff] text-indigo-900';
            badgeClass = 'bg-indigo-200 text-indigo-800';
            badgeText = `${table.guests} guests`;
            subText = `Session: ${table.sessionTime}`;
          } else if (table.status === 'pour-pending') {
            toneClass = 'border-[#e11d48] bg-[#fff1f2] text-rose-900 ring-2 ring-rose-200';
            badgeClass = 'bg-rose-200 text-rose-800';
            badgeText = '🔔 Pour req!';
            subText = `${table.guests} guest · ${table.sessionTime}`;
          } else if (table.status === 'reserved') {
            toneClass = 'border-[#d97706] bg-[#fffbeb] text-amber-900';
            badgeClass = 'bg-amber-200 text-amber-800';
            badgeText = `Reserved ${table.sessionTime}`;
            subText = table.details || 'Reservation';
          } else {
            toneClass = 'border-[#e2e8f0] bg-[#f8fafc] text-slate-600';
            badgeClass = 'bg-slate-200 text-slate-600';
            badgeText = 'Available';
            subText = 'Tap to host';
          }

          // Special case for Table 7 display name as requested in specs
          if (table.id === 7) {
            subText = `Arjun M. · 26 min`;
          }

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`ftile flex flex-col items-center justify-center min-h-[140px] ${toneClass}`}
            >
              <div className="font-bold text-2xl mb-2">Table {table.id}</div>
              <span className={`badge-tablet ${badgeClass} mb-2 inline-block`}>{badgeText}</span>
              <p className="text-xs font-semibold opacity-80">{subText}</p>
            </div>
          );
        })}
      </div>

      {/* Bottom Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
        <div className="panel p-6 border-t-4 border-indigo-600 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tables Occupied</p>
          <p className="text-4xl font-black text-indigo-950">{occupiedCount}</p>
          <p className="text-[10px] font-bold text-indigo-600 mt-2">Active Sessions</p>
        </div>
        <div className="panel p-6 border-t-4 border-rose-500 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pour Requests</p>
          <p className="text-4xl font-black text-rose-600">{pendingCount}</p>
          <p className="text-[10px] font-bold text-rose-500 mt-2">Action Required</p>
        </div>
        <div className="panel p-6 border-t-4 border-emerald-500 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pours Served</p>
          <p className="text-4xl font-black text-emerald-600">{state.shiftStats.poursServed}</p>
          <p className="text-[10px] font-bold text-emerald-600 mt-2">{state.shiftStats.totalMlServed}ml Served Tonight</p>
        </div>
        <div className="panel p-6 border-t-4 border-amber-500 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Wallet Deductions</p>
          <p className="text-4xl font-black text-amber-700">₹{state.shiftStats.walletDeductions.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-amber-600 mt-2">Transactions Logged</p>
        </div>
      </div>
    </div>
  );
}
