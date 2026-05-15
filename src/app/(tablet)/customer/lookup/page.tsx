'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPourRequest } from '@/lib/api-client';

export default function CustomerLookupPage() {
  const router = useRouter();
  const [lookupMode, setLookupMode] = useState<'qr' | 'mobile'>('qr');
  const [customer, setCustomer] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [initiating, setInitiating] = useState(false);

  const handleInitiatePour = async (walletId: number) => {
    setInitiating(true);
    try {
      const res = await createPourRequest({
        walletId,
        requestedMl: 60, // Default to 60ml, can be adjusted on the serve page
      });
      router.push(`/serve/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate pour');
    } finally {
      setInitiating(false);
    }
  };

  const handleSearch = async (val?: string) => {
    const mobile = val || mobileNumber;
    if (!mobile && lookupMode === 'mobile') return;
    
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/customer/lookup?mobile=${encodeURIComponent(mobile)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Customer not found');
      setCustomer(data);
    } catch (err: any) {
      setCustomer(null);
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const simulateScan = () => {
    handleSearch('+91 98765 43210');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-ink tracking-tighter">Customer Lookup</h1>
        <p className="text-sm text-muted font-medium mt-1">Verify KYC and manage customer wallets</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Find a Customer */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Verification Method</h3>
          <div className="flex gap-3 mb-8">
            <button 
              onClick={() => { setLookupMode('qr'); setCustomer(null); setError(null); }}
              className={`flex-1 btn-tablet ${lookupMode === 'qr' ? 'btn-tablet-p' : 'btn-tablet-s'}`}
            >
              📷 App QR Scan
            </button>
            <button 
              onClick={() => { setLookupMode('mobile'); setCustomer(null); setError(null); }}
              className={`flex-1 btn-tablet ${lookupMode === 'mobile' ? 'btn-tablet-p' : 'btn-tablet-s'}`}
            >
              📱 Mobile Number
            </button>
          </div>

          {lookupMode === 'qr' ? (
            <div 
              onClick={simulateScan}
              className="panel border-dashed border-2 border-amber-200 bg-amber-50/20 h-64 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-amber-50/40 transition-colors group"
            >
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-sm group-hover:scale-110 transition-transform">📷</div>
              <div className="text-center">
                <p className="text-amber-700 font-black uppercase tracking-widest text-[10px]">Simulate Scan</p>
                <p className="text-slate-500 text-sm mt-1 font-bold">Tap here to simulate camera scan</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="tel"
                  placeholder="+91 00000 00000"
                  className="flex-1 bg-white border-2 border-slate-100 rounded-xl px-6 py-4 text-sm font-bold focus:border-amber-500 outline-none transition-all shadow-sm"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button 
                  onClick={() => handleSearch()}
                  className="btn-tablet btn-tablet-p px-10"
                  disabled={searching}
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[11px] font-bold">
              ⚠️ {error}
            </div>
          )}

          <div className="mt-12 panel p-6 bg-slate-50/50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Staff Guidance</p>
            <ul className="text-[11px] text-slate-500 space-y-3 font-bold">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] shrink-0">1</span>
                Scan QR or enter mobile number to load customer wallet.
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] shrink-0">2</span>
                Always verify the user's display name matches their ID.
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Customer Profile */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Customer Details</h3>
          
          {customer ? (
            <div className="space-y-8">
              <div className="bg-slate-950 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-40 h-40 bg-amber-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-amber-500 rounded-[24px] flex items-center justify-center text-3xl font-black shadow-glow">
                    {customer.name[0]}
                  </div>
                  <div>
                    <p className="text-2xl font-black tracking-tighter">{customer.name}</p>
                    <p className="text-amber-500/80 text-sm font-bold tracking-wide mt-1">{customer.mobile}</p>
                    <div className="flex gap-2 mt-4">
                      <span className="badge-tablet bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✅ KYC VERIFIED</span>
                      <span className="badge-tablet bg-white/10 text-white border border-white/20">Table 7</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active Spirit Wallets ({customer.wallets?.length || 0})</h4>
                <div className="space-y-4">
                  {customer.wallets?.map((wallet: any, i: number) => (
                    <div 
                      key={i} 
                      className={`panel p-6 hover:border-amber-300 transition-all cursor-pointer group ${initiating ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => handleInitiatePour(wallet.walletId || wallet.id)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                           <p className="font-black text-ink text-lg">{wallet.name}</p>
                           <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${wallet.balance < 100 ? 'text-amber-600' : 'text-slate-400'}`}>
                             {wallet.balance < 100 ? '⚠️ Low Balance alert' : `Last served: ${wallet.lastServed || 'N/A'}`}
                           </p>
                        </div>
                        <p className="text-3xl font-black text-amber-700">{wallet.balance}<span className="text-xs ml-1 text-slate-300">ml</span></p>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-amber-500 rounded-full shadow-glow" 
                          style={{ width: `${(wallet.balance / wallet.total) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">
                        <span>Original: {wallet.total}ml</span>
                        <span className="text-amber-600">Tap to serve →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-100 rounded-[40px] p-24 text-center">
              <div className="text-7xl mb-6 grayscale opacity-10">👤</div>
              <p className="text-ink font-black text-xl">No Profile Loaded</p>
              <p className="text-slate-400 text-sm mt-1 font-medium italic">Please search for a customer to view active wallets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
