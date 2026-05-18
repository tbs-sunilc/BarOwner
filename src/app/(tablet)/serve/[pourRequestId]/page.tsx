'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTabletState, TabletState, saveTabletState } from '@/lib/tablet-state';

export default function ServePourPage() {
  const params = useParams<{ pourRequestId: string }>();
  const pourRequestId = Number(params.pourRequestId);
  const router = useRouter();

  const [state, setState] = useState<TabletState | null>(null);
  const [actualAmount, setActualAmount] = useState<number>(60);
  const [selectedWalletId, setSelectedWalletId] = useState<number>(1);
  const [staffNotes, setStaffNotes] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Initial balance of selected wallet
  const currentBalance = selectedWalletId === 1 ? 338 : 168;
  const bottleName = selectedWalletId === 1 ? 'Johnnie Walker Black Label' : 'Absolut Vodka';

  useEffect(() => {
    setState(getTabletState());
  }, []);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading serve form...</div>;
  }

  // Find our pour request in queue
  const pourRequest = state.pourQueue.find(q => q.id === pourRequestId) || {
    id: 5002,
    tableId: 7,
    customer: 'Arjun Mehta',
    bottle: 'Johnnie Walker Black Label',
    walletBalance: 338,
    requestedAmount: 60,
    waitTime: '4 min'
  };

  const handleQuickAmountClick = (amount: number) => {
    setActualAmount(amount);
  };

  const handleConfirmServe = () => {
    if (actualAmount > currentBalance) {
      if ((window as any).toast) {
        (window as any).toast(`Cannot serve more than remaining balance (${currentBalance}ml)`, 'e');
      }
      return;
    }

    const updatedState = { ...state };
    
    // Deduct wallet balance from Arjun's profile
    if (updatedState.customerProfile) {
      updatedState.customerProfile.wallets = updatedState.customerProfile.wallets.map(w => {
        if (w.id === selectedWalletId) {
          return { ...w, balance: Math.max(0, w.balance - actualAmount) };
        }
        return w;
      });
    }

    // Also deduct balance from tables if any matches (Table 2 Arjun M. is 338ml)
    updatedState.tables = updatedState.tables.map(t => {
      // Once pour request is complete, change state to occupied if it was pour-pending
      if (t.id === pourRequest.tableId) {
        return { ...t, status: 'occupied' as const, sessionTime: '45 min' };
      }
      return t;
    });

    // Remove from pour request queue
    updatedState.pourQueue = updatedState.pourQueue.filter(q => q.id !== pourRequestId);

    // Format local time
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append to servedPours log
    const shortBottleName = selectedWalletId === 1 ? 'JW Black Label' : 'Absolut Vodka';
    updatedState.servedPours = [
      {
        time: timeStr,
        table: `T${pourRequest.tableId}`,
        customer: pourRequest.customer.replace(' Mehta', ' M.'),
        bottle: shortBottleName,
        amount: `${actualAmount}ml`
      },
      ...updatedState.servedPours
    ];

    // Update stats
    updatedState.shiftStats = {
      poursServed: updatedState.shiftStats.poursServed + 1,
      totalMlServed: updatedState.shiftStats.totalMlServed + actualAmount,
      uniqueCustomers: updatedState.shiftStats.uniqueCustomers,
      avgServiceTime: '2.1 min',
      walletDeductions: updatedState.shiftStats.walletDeductions + (actualAmount * 40) // Assume ₹40 per ml
    };

    saveTabletState(updatedState);

    if ((window as any).toast) {
      (window as any).toast(`✅ ${actualAmount}ml deducted. Arjun M. wallet updated in real time.`, 's');
    }

    // Route to success page
    const query = new URLSearchParams({
      customer: pourRequest.customer,
      amount: String(actualAmount),
      bottle: bottleName,
      balance: String(currentBalance - actualAmount)
    });
    router.push(`/serve/success?${query.toString()}`);
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) {
      if ((window as any).toast) {
        (window as any).toast('Please enter a cancellation reason', 'w');
      }
      return;
    }

    const updatedState = { ...state };

    // Remove from queue
    updatedState.pourQueue = updatedState.pourQueue.filter(q => q.id !== pourRequestId);

    // Reset table status from pour-pending to occupied or available
    updatedState.tables = updatedState.tables.map(t => {
      if (t.id === pourRequest.tableId) {
        return { ...t, status: 'occupied' as const, sessionTime: '30 min' };
      }
      return t;
    });

    saveTabletState(updatedState);

    if ((window as any).toast) {
      (window as any).toast('× Pour request cancelled successfully', 'e');
    }

    setShowCancelModal(false);
    router.push('/queue');
  };

  const remainingAfterDeduct = currentBalance - actualAmount;
  const isInsufficient = actualAmount > currentBalance;

  return (
    <div className="p-6 max-w-7xl mx-auto reveal relative">
      <header className="mb-8">
        <Link href="/customer/lookup" className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
          ← Customer Lookup
        </Link>
        <h1 className="text-3xl font-black text-ink tracking-tighter mt-2">Serve & Deduct</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Columns (Col Span 2): Pour Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info Card */}
          <div className="bg-indigo-950 text-white p-6 rounded-[28px] flex items-center justify-between shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-600 rounded-[18px] flex items-center justify-center font-black text-xl border border-indigo-500/30">
                A
              </div>
              <div>
                <p className="font-black text-lg leading-none">{pourRequest.customer}</p>
                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mt-1.5">
                  Table {pourRequest.tableId} · Pour request: {pourRequest.requestedAmount}ml
                </p>
              </div>
            </div>
            <span className="badge-tablet bg-rose-600 text-white font-black uppercase tracking-wider">
              ⚠️ {pourRequest.waitTime} wait
            </span>
          </div>

          {/* Form Panel */}
          <div className="panel p-8 bg-white border border-slate-200 rounded-[32px] space-y-6">
            {/* Wallet Dropdown */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Wallet / Bottle *</label>
              <select
                value={selectedWalletId}
                onChange={(e) => {
                  setSelectedWalletId(Number(e.target.value));
                  setActualAmount(Number(e.target.value) === 1 ? 60 : 30);
                }}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
              >
                <option value={1}>Johnnie Walker Black Label — 338ml remaining</option>
                <option value={2}>Absolut Vodka — 168ml remaining</option>
              </select>
            </div>

            {/* Info box */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex gap-3 text-xs">
              <span>⚡</span>
              <p className="font-bold text-indigo-900 uppercase">
                User requested: <span className="font-black text-indigo-600 underline">{pourRequest.requestedAmount} ml</span>. Confirm actual amount poured below.
              </p>
            </div>

            {/* Quick Amount Buttons */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Quick Select (ml)</label>
              <div className="grid grid-cols-4 gap-4">
                {[30, 60, 90, 120].map((amt) => {
                  const isActive = actualAmount === amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => handleQuickAmountClick(amt)}
                      className={`btn-tablet justify-center py-4 rounded-2xl font-black text-lg ${isActive ? 'btn-tablet-p shadow-glow' : 'btn-tablet-s border border-slate-200'}`}
                    >
                      {amt} {isActive ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actual Amount Input */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Actual Amount Served (ml) *</label>
              <input
                type="number"
                min={1}
                max={currentBalance}
                value={actualAmount}
                onChange={(e) => setActualAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-center font-black text-4xl focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
            </div>

            {/* Insufficient Balance Alert */}
            {isInsufficient && (
              <div className="panel bg-rose-50 border border-rose-200 p-5 rounded-2xl flex gap-4 text-xs">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-black text-rose-800 uppercase mb-1">Insufficient balance</p>
                  <p className="text-rose-700 font-bold leading-relaxed uppercase">
                    Customer only has {currentBalance}ml. Cannot serve more than remaining balance.
                  </p>
                </div>
              </div>
            )}

            {/* Balance Preview */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Current balance</span>
                <span>{currentBalance} ml</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-rose-600 uppercase tracking-wider">
                <span>Amount to deduct</span>
                <span>− {actualAmount} ml</span>
              </div>
              <div className="h-px bg-slate-200"></div>
              <div className="flex justify-between items-center text-sm font-black text-indigo-950 uppercase tracking-wider">
                <span>New balance</span>
                <span className="text-2xl font-black text-indigo-600">{Math.max(0, remainingAfterDeduct)} ml</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={handleConfirmServe}
                disabled={isInsufficient || actualAmount <= 0}
                className="btn-tablet btn-tablet-g w-full justify-center py-5 text-lg font-black uppercase shadow-lg shadow-emerald-100/50"
              >
                ✅ Confirm Served & Deduct Wallet
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="btn-tablet btn-tablet-r w-full justify-center py-4 text-sm font-bold uppercase"
              >
                × Cancel This Pour Request
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Confirmation Preview & Log */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Confirmation Preview</h3>

          {/* Preview Card */}
          <div className="panel p-6 bg-white border border-slate-200 rounded-[28px] space-y-4 shadow-sm">
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">Pour Summary</p>
            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-wider">
              <span>Customer</span>
              <span className="text-indigo-950 font-black">{pourRequest.customer}</span>
            </div>
            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-wider">
              <span>Table</span>
              <span className="text-indigo-950 font-black">Table {pourRequest.tableId}</span>
            </div>
            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-wider">
              <span>Bottle</span>
              <span className="text-indigo-950 font-black truncate max-w-[150px]">{bottleName}</span>
            </div>
            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-wider">
              <span>Amount to serve</span>
              <span className="text-indigo-600 font-black text-base">{actualAmount} ml</span>
            </div>
            <div className="h-px bg-slate-100"></div>
            <div className="flex justify-between items-baseline text-xs font-bold uppercase text-slate-500 tracking-wider">
              <span>New balance</span>
              <span className="text-lg font-black text-indigo-950">{Math.max(0, remainingAfterDeduct)} ml</span>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex gap-3 text-xs">
            <span>⚡</span>
            <p className="font-bold text-blue-800 leading-relaxed uppercase">
              Wallet deduction happens <strong>only after you tap "Confirm Served"</strong>. The user's app updates in real-time via WebSocket.
            </p>
          </div>

          {/* Past session activity */}
          <div className="panel p-6 bg-slate-50/50 rounded-[28px] space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Session Activity Tonight</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                <span>9:35 PM · 90ml JW Black</span>
                <span className="text-emerald-600">Served ✓</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                <span>9:18 PM · 60ml JW Black</span>
                <span className="text-emerald-600">Served ✓</span>
              </div>
              <div className="h-px bg-slate-200 my-2"></div>
              <p className="text-[10px] font-black text-indigo-900 uppercase">
                Total consumed tonight: <span className="underline">150ml</span>
              </p>
            </div>
          </div>

          {/* Bartender Service Notes */}
          <div className="panel p-6 bg-amber-50/20 border border-amber-100 rounded-[28px] space-y-3">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Bartender Service Notes</p>
            <textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              className="w-full bg-white border border-amber-100 rounded-2xl p-4 text-xs font-bold focus:border-amber-400 outline-none transition-all shadow-sm h-20"
              placeholder="e.g. Added extra ice, garnish..."
            />
          </div>
        </div>
      </div>

      {/* Cancel Modal Overlay */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🛑</span>
              <h3 className="text-xl font-black text-rose-600 tracking-tight">Cancel Pour Request</h3>
            </div>
            
            <p className="text-xs text-slate-500 font-bold mb-6 uppercase tracking-wide leading-relaxed">
              Are you sure you want to cancel the 60ml pour request for Arjun M. at Table {pourRequest.tableId}?
            </p>

            <div className="mb-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cancellation Reason *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer out of seat, order cancelled by guest..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-rose-400 outline-none transition-all h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleConfirmCancel}
                className="btn-tablet btn-tablet-r justify-center py-3 text-xs uppercase"
              >
                Confirm Cancel
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="btn-tablet btn-tablet-s justify-center py-3 text-xs uppercase"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
