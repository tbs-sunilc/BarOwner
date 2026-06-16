'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTabletState, TabletState, TableState, saveTabletState, fetchLiveTableStatus } from '@/lib/tablet-state';
import { getActiveBarId } from '@/lib/active-bar';
import { fetchPourQueue, fetchServedTonight } from '@/lib/api-client';
import { applyPourApiToState, applyQueueUpdatedToState } from '@/lib/pour-dashboard';
import { HubConnectionState } from '@microsoft/signalr';
import { usePourHub, type QueueUpdatedEvent, type TableStatusChangedEvent } from '@/hooks/usePourHub';

// ─── refresh strategy ───────────────────────────────────────────────────────
// * Table availability  — API (`fetchLiveTableStatus`); partial SignalR via
//   `TableStatusChanged` (backend rarely emits today); full API on pour events.
// * Pour queue + stats  — SignalR `QueueUpdated` (instant); API on poll/refresh.
// * Polling             — fallback only; real-time path is SignalR when connected.
const POLL_INTERVAL_MS = 120_000; // 120 s HTTP heartbeat / offline fallback

type TableStatusFilter = 'occupied' | 'pour-pending' | 'reserved' | 'available';

const FILTER_OPTIONS: {
  key: TableStatusFilter;
  label: string;
  swatchClass: string;
}[] = [
  { key: 'occupied', label: 'Occupied', swatchClass: 'bg-[#eef2ff] border-2 border-[#4338ca]' },
  { key: 'reserved', label: 'Reserved', swatchClass: 'bg-[#fffbeb] border-2 border-[#d97706]' },
  { key: 'available', label: 'Available', swatchClass: 'bg-[#f8fafc] border-2 border-[#e2e8f0]' },
  { key: 'pour-pending', label: 'Pour Pending', swatchClass: 'bg-[#fff1f2] border-2 border-[#e11d48]' },
];

function tableMatchesFilter(status: TableState['status'], filters: Set<TableStatusFilter>) {
  if (filters.size === 0) return true;
  return filters.has(status);
}

export default function FloorPage() {
  const router = useRouter();
  const [state, setState] = useState<TabletState | null>(null);
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<TableStatusFilter>>(new Set());

  // Guard against concurrent in-flight requests
  const refreshInFlightRef = useRef(false);
  // Track last successful fetch so we can skip redundant polls
  const lastFetchedAtRef = useRef<number>(0);

  // ─── core refresh (tables + pour queue + shift stats) ─────────────────────
  const refreshDashboard = useCallback(async (force = false) => {
    const barId = getActiveBarId();
    if (!barId) return;
    if (refreshInFlightRef.current) return;

    // Skip if fetched within last 5 s (unless forced)
    if (!force && Date.now() - lastFetchedAtRef.current < 5_000) return;

    refreshInFlightRef.current = true;
    try {
      const [liveTables, pendingRows, servedRows] = await Promise.all([
        fetchLiveTableStatus(barId),
        fetchPourQueue(barId),
        fetchServedTonight(barId, 100),
      ]);
      lastFetchedAtRef.current = Date.now();
      setState(prev => {
        if (!prev) return prev;
        const next = applyPourApiToState(
          { ...prev, tables: liveTables },
          pendingRows,
          servedRows,
        );
        saveTabletState(next);
        return next;
      });
    } catch (error) {
      console.error('[FloorPage] Error refreshing dashboard:', error);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  // ─── SignalR: surgical per-table update ────────────────────────────────────
  const handleTableStatusChanged = useCallback((evt: TableStatusChangedEvent) => {
    setState(prev => {
      if (!prev) return prev;

      let tableStatus: 'occupied' | 'pour-pending' | 'available' | 'reserved' = 'available';
      switch (evt.status.toLowerCase()) {
        case 'occupied':     tableStatus = 'occupied';     break;
        case 'pourpending':  tableStatus = 'pour-pending'; break;
        case 'reserved':     tableStatus = 'reserved';     break;
        default:             tableStatus = 'available';
      }

      const updatedTables = prev.tables.map(table =>
        table.id === evt.tableId
          ? {
              ...table,
              status: tableStatus,
              guests: evt.guestCount,
              sessionTime: evt.sessionTimeLabel,
              customerName: evt.customerName || undefined,
              details: evt.reservationDetails || undefined,
            }
          : table
      );

      const next = { ...prev, tables: updatedTables };
      saveTabletState(next);
      return next;
    });
  }, []);

  const handleQueueUpdated = useCallback((evt: QueueUpdatedEvent) => {
    setState(prev => {
      if (!prev) return prev;
      const next = applyQueueUpdatedToState(prev, evt);
      saveTabletState(next);
      return next;
    });
  }, []);

  // ─── SignalR hook ──────────────────────────────────────────────────────────
  const { connectionState } = usePourHub(getActiveBarId(), {
    onNewPourRequest:      () => { void refreshDashboard(true); },
    onPourConfirmed:       () => { void refreshDashboard(true); },
    onPourCancelled:       () => { void refreshDashboard(true); },
    onQueueUpdated:        handleQueueUpdated,
    onTableStatusChanged:  handleTableStatusChanged,
  });

  // ─── initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      // Show cached state immediately so UI isn't blank
      const cached = getTabletState();
      setState(cached);

      setIsLoadingLiveData(true);
      try {
        await refreshDashboard(true);
      } catch (error) {
        console.error('[FloorPage] Initial load failed:', error);
      } finally {
        setIsLoadingLiveData(false);
      }
    };

    void loadData();
  }, [refreshDashboard]);

  // ─── visibility-based refresh (tab regains focus) ─────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshDashboard]);

  // ─── polling fallback (120 s) — does not replace SignalR real-time updates ─
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshDashboard();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  // ─── connection-state change: immediately re-fetch when SignalR reconnects ─
  const prevConnectionStateRef = useRef<HubConnectionState | null>(null);
  useEffect(() => {
    if (
      prevConnectionStateRef.current !== HubConnectionState.Connected &&
      connectionState === HubConnectionState.Connected
    ) {
      // Just reconnected — data may be stale, force a full refresh
      void refreshDashboard(true);
    }
    prevConnectionStateRef.current = connectionState;
  }, [connectionState, refreshDashboard]);

  // ─── render guard ──────────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">
        Loading floor plan...
      </div>
    );
  }

  const occupiedCount = state.tables.filter(
    t => t.status === 'occupied' || t.status === 'pour-pending'
  ).length;
  const pendingCount = state.pourQueue.length;

  const visibleTables = state.tables.filter(t => tableMatchesFilter(t.status, activeFilters));
  const filtersActive = activeFilters.size > 0;

  const toggleFilter = (key: TableStatusFilter) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearFilters = () => setActiveFilters(new Set());

  // ─── table click + quick actions ───────────────────────────────────────────
  const handleTableClick = (tableId: number) => {
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;

    const toast = (window as any).toast;
    if (table.status === 'available') {
      toast?.(`Table ${tableId} is available`, 'i');
    } else if (table.status === 'reserved') {
      toast?.(`Table ${tableId}: Reserved for ${table.details || 'Guest'} at ${table.sessionTime}`, 'w');
    } else if (table.status === 'pour-pending') {
      router.push('/queue');
    } else if (table.status === 'occupied') {
      router.push('/customer/lookup');
    }
  };

  const handleServe = (tableId: number, e?: any) => {
    e?.stopPropagation();
    // Quick action: jump to queue with table context (placeholder)
    router.push(`/queue?tableId=${tableId}`);
  };

  const handleLookup = (tableId: number, e?: any) => {
    e?.stopPropagation();
    router.push(`/customer/lookup?tableId=${tableId}`);
  };

  // ─── connection badge ──────────────────────────────────────────────────────
  const connectionLabel = (() => {
    switch (connectionState) {
      case HubConnectionState.Connected:     return '🟢 Real-time';
      case HubConnectionState.Connecting:
      case HubConnectionState.Reconnecting:  return '🟡 Connecting…';
      default:                               return '🔄 Polling (120 s)';
    }
  })();

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="reveal">
      {/* Status filters + connection */}
      <div className="flex flex-wrap gap-4 mb-8 items-center bg-white border border-slate-200 p-4 rounded-lg shadow-sm justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mr-1">Filter:</span>
          {FILTER_OPTIONS.map(({ key, label, swatchClass }) => {
            const isOn = activeFilters.has(key);
            const count = state.tables.filter(t => t.status === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
                aria-pressed={isOn}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
                  isOn
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`w-4 h-4 rounded shrink-0 ${swatchClass}`} aria-hidden />
                {label}
                <span className={`text-xs font-bold tabular-nums ${isOn ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline ml-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLoadingLiveData && (
            <span className="text-xs text-slate-400 animate-pulse">Refreshing…</span>
          )}
          {/* Manual refresh button */}
          <button
            onClick={() => void refreshDashboard(true)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-2 py-1 transition-colors"
            title="Force refresh table data"
          >
            ↻ Refresh
          </button>
          <span className="text-sm font-semibold text-slate-500">{connectionLabel}</span>
        </div>
      </div>

      {filtersActive && (
        <p className="text-xs font-semibold text-slate-500 mb-4 -mt-4">
          Showing {visibleTables.length} of {state.tables.length} tables
        </p>
      )}

      {/* Floor Plan Grid (auto-fit, denser, action-oriented) */}
      <div className="grid gap-6 justify-center items-start [grid-template-columns:repeat(auto-fit,minmax(160px,220px))]">
        {visibleTables.length === 0 && (
          <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
            <p className="text-slate-700 font-bold">No tables match this filter</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Show all tables
            </button>
          </div>
        )}

        {visibleTables.map((table) => {
          console.log(table)
          const displayNumber = table.tableNumber ?? table.id;
          const isOccupied = table.status === 'occupied';
          const isPending = table.status === 'pour-pending';
          const isReserved = table.status === 'reserved';

          const statusClass = isOccupied
            ? 'ftile--occupied'
            : isPending
              ? 'ftile--pour-pending'
              : isReserved
                ? 'ftile--reserved'
                : 'ftile--available';

          const badgeClass = isOccupied
            ? 'ftile-badge--occupied'
            : isPending
              ? 'ftile-badge--pending'
              : isReserved
                ? 'ftile-badge--reserved'
                : 'ftile-badge--available';

          const badgeText = isOccupied
            ? `${table.guests ?? 1} guests`
            : isPending
              ? '🔔 Pour req!'
              : isReserved
                ? `Reserved ${table.sessionTime ?? ''}`
                : 'Available';

          let subText = 'Tap to host';
          if (table.customerName && table.status !== 'available') {
            subText = table.sessionTime
              ? `${table.customerName} · ${table.sessionTime}`
              : table.customerName;
          } else if (isPending) {
            subText = `${table.guests ?? 1} guest · ${table.sessionTime ?? ''}`;
          } else if (isOccupied) {
            subText = `Session: ${table.sessionTime ?? '-'} `;
          }

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`ftile ${statusClass}`}
            >
                  <div className="w-full flex flex-col items-center justify-center">
                    <div className="text-[11px] font-semibold text-slate-400">Table</div>
                    <div className={`badge-tablet ${badgeClass} mt-1`}>{badgeText}</div>
                    <div className="font-bold text-2xl text-ink-2 mt-3">{displayNumber}</div>
                    <div className="mt-1 text-xs text-slate-500 truncate w-full text-center">{subText}</div>
                  </div>
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
          <p className="text-4xl font-black text-amber-700">{state.shiftStats.walletDeductions}</p>
          <p className="text-[10px] font-bold text-amber-600 mt-2">Transactions Logged</p>
        </div>
      </div>
    </div>
  );
}   