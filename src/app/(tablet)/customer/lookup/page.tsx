'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTabletState, TabletState } from '@/lib/tablet-state';

export default function CustomerLookupPage() {
  const router = useRouter();
  const [state, setState] = useState<TabletState | null>(null);
  const [lookupMode, setLookupMode] = useState<'qr' | 'mobile'>('qr');
  const [showProfile, setShowProfile] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);
  const [mobileValue, setMobileValue] = useState('');

  useEffect(() => {
    setState(getTabletState());
  }, []);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading customer lookup...</div>;
  }

  const handleToggle = (mode: 'qr' | 'mobile') => {
    setLookupMode(mode);
    setShowNotFound(false);
  };

  const handleScanClick = () => {
    setShowNotFound(false);
    setShowProfile(true);
    if ((window as any).toast) {
      (window as any).toast('✅ QR scanned — Arjun Mehta loaded', 's');
    }
  };

  const handleMobileSearch = (val: string) => {
    setMobileValue(val);
    if (val.includes('000000')) {
      setShowNotFound(true);
      setShowProfile(false);
    } else if (val.replace(/\D/g, '').length >= 10) {
      setShowNotFound(false);
      setShowProfile(true);
      if ((window as any).toast) {
        (window as any).toast('✅ Mobile search match — Arjun Mehta loaded', 's');
      }
    }
  };

  const handleServeWallet = (walletId: number) => {
    // Find if there is a pending pour request for Table 2 (Arjun Mehta)
    const pour = state.pourQueue.find(q => q.customer === 'Arjun M.' && q.id === 5002);
    if (pour) {
      router.push(`/serve/${pour.id}`);
    } else {
      router.push(`/serve/5002`);
    }
  };

  const handleGoDirectlyToServe = () => {
    router.push('/serve/5002');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      {/* Header Bar */}
      <header className="mb-8 flex justify-between items-center bg-slate-50 border border-slate-200 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <Link href="/floor" className="btn-tablet btn-tablet-s !py-2 !px-4 !text-xs">
            ← Floor Plan
          </Link>
          <div>
            <h1 className="text-2xl font-black text-ink tracking-tighter">Customer Lookup</h1>
            <p className="text-xs text-muted font-bold uppercase tracking-wider mt-0.5">
              Verify KYC and wallet access
            </p>
          </div>
        </div>
        <Link href="/queue" className="btn-tablet btn-tablet-r !py-2.5 !px-5 !text-xs relative">
          🔔 Pour Queue
          <span className="ml-1 bg-white text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black">
            {state.pourQueue.length}
          </span>
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Search Form */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Verification Method</h3>
          
          {/* Toggle buttons */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => handleToggle('qr')}
              className={`btn-tablet justify-center py-4 rounded-2xl ${lookupMode === 'qr' ? 'btn-tablet-p shadow-glow' : 'btn-tablet-s'}`}
            >
              📷 Scan Customer QR
            </button>
            <button
              onClick={() => handleToggle('mobile')}
              className={`btn-tablet justify-center py-4 rounded-2xl ${lookupMode === 'mobile' ? 'btn-tablet-p shadow-glow' : 'btn-tablet-s'}`}
            >
              📱 Mobile Search
            </button>
          </div>

          {/* QR Scan Area */}
          {lookupMode === 'qr' && (
            <div
              onClick={handleScanClick}
              className="panel border-dashed border-2 border-indigo-400 bg-indigo-50/20 p-10 h-64 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-indigo-50/40 transition-colors group rounded-[32px] mb-8"
            >
              <div className="text-5xl group-hover:scale-110 transition-transform">📷</div>
              <div className="text-center">
                <p className="text-indigo-900 font-black uppercase tracking-widest text-[11px] mb-1">Simulate Camera Scan</p>
                <p className="text-slate-500 text-xs font-bold leading-relaxed">Tap this box to scan the customer's app QR code</p>
              </div>
            </div>
          )}

          {/* Mobile Search Area */}
          {lookupMode === 'mobile' && (
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer Mobile Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={mobileValue}
                  onChange={(e) => handleMobileSearch(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-base font-bold focus:border-indigo-500 outline-none transition-all shadow-sm"
                />
              </div>
              <button
                onClick={() => handleMobileSearch(mobileValue)}
                className="btn-tablet btn-tablet-p w-full justify-center py-4 rounded-2xl"
              >
                Search Customer
              </button>
            </div>
          )}

          {/* Not Found Alert */}
          {showNotFound && (
            <div className="panel bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8 flex gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-amber-800 text-sm mb-1 uppercase tracking-tight">Customer Not Found</p>
                <p className="text-xs text-amber-700 font-bold leading-relaxed uppercase">
                  No customer found with this mobile number. They may not have a SipSave account. Use manual POS for walk-in orders.
                </p>
              </div>
            </div>
          )}

          {/* QA Test Note Box */}
          <div className="panel bg-slate-50 border border-slate-200 p-6 rounded-[24px]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">QA Terminal Testing Options</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
              Skip scanning or searching by jumping directly to the Arjun Mehta Serve & Deduct screen:
            </p>
            <button
              onClick={handleGoDirectlyToServe}
              className="btn-tablet btn-tablet-s w-full justify-center py-3 border-indigo-200 text-indigo-700 font-black text-xs uppercase"
            >
              🧪 Go directly to Serve screen
            </button>
          </div>
        </div>

        {/* Right Column: Profile details */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Customer Profile</h3>

          {showProfile && state.customerProfile ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-indigo-950 text-white rounded-[32px] p-8 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-600 rounded-[24px] flex items-center justify-center text-3xl font-black shadow-glow border border-indigo-500/30">
                    A
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter">{state.customerProfile.name}</h2>
                    <p className="text-indigo-300 text-sm font-bold mt-0.5">{state.customerProfile.mobile}</p>
                    
                    <div className="flex gap-2 mt-4">
                      <span className="badge-tablet bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✅ KYC Verified · 18+
                      </span>
                      <span className="badge-tablet bg-white/10 text-white border border-white/20">
                        {state.customerProfile.table}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallets section */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                  Active Wallets at Sky Lounge ({state.customerProfile.wallets.length})
                </h4>

                <div className="space-y-4">
                  {state.customerProfile.wallets.map((wallet) => {
                    const pct = (wallet.balance / wallet.total) * 100;
                    const isLow = wallet.balance < 200 || wallet.warning;
                    const borderClass = isLow ? 'border-amber-400 bg-amber-50/10 hover:bg-amber-50/20' : 'border-slate-200 bg-white hover:border-indigo-400';
                    const barColor = isLow ? 'bg-amber-500' : 'bg-indigo-600';

                    return (
                      <div
                        key={wallet.id}
                        onClick={() => handleServeWallet(wallet.id)}
                        className={`panel p-6 border-2 cursor-pointer transition-all ${borderClass}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-black text-slate-900 text-lg tracking-tight">{wallet.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                              / {wallet.total}ml · Last served: {wallet.lastServed}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black text-indigo-950 tracking-tighter">
                              {wallet.balance}<span className="text-xs ml-1 text-slate-300">ml</span>
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            {wallet.warning && (
                              <span className="text-[10px] text-amber-600 font-black uppercase tracking-wider">
                                ⚠️ {wallet.warning}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServeWallet(wallet.id);
                            }}
                            className="btn-tablet btn-tablet-g !py-2 !px-4 !text-[10px] font-black uppercase tracking-widest"
                          >
                            Serve →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-24 text-center">
              <div className="text-6xl mb-4 grayscale opacity-20">👤</div>
              <p className="text-slate-900 font-bold text-lg">No customer loaded yet</p>
              <p className="text-slate-400 text-sm mt-1 font-medium leading-relaxed">
                Scan customer QR code or search by mobile number to load their KYC profile and spirits wallet balance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
