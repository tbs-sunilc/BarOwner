'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const customer = searchParams.get('customer') || 'Customer';
  const amount = searchParams.get('amount') || '0';
  const bottle = searchParams.get('bottle') || 'Bottle';
  const balance = searchParams.get('balance') || '--';

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-app-shell reveal">
      <div className="max-w-md w-full text-center">
        <div className="w-28 h-28 bg-emerald-600 text-white rounded-[40px] flex items-center justify-center text-6xl mx-auto mb-10 shadow-xl shadow-emerald-100 animate-in zoom-in duration-700">
          ✓
        </div>
        
        <h1 className="text-4xl font-black text-ink mb-3 tracking-tighter">Transaction Complete!</h1>
        <p className="text-sm text-muted font-bold mb-12 uppercase tracking-widest leading-relaxed">
          Served {amount}ml of {bottle} to <span className="text-ink font-black">{customer}</span>.
        </p>

        <div className="panel p-10 text-left mb-12 bg-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-50 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
          <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bottle Wallet</span>
              <span className="font-black text-ink">{bottle}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Served</span>
              <span className="text-emerald-600 font-black text-xl">{amount} ml ✓</span>
            </div>
            
            <div className="h-px bg-slate-100 my-4" />
            
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">New Balance</span>
                <span className="text-5xl font-black text-amber-700 tracking-tighter">{balance}<span className="text-sm ml-1 text-slate-300">ml</span></span>
              </div>
              <div className="text-right">
                <span className="badge-tablet badge-tablet-p">Sync Confirmed</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.push('/queue')}
            className="btn-tablet btn-tablet-p justify-center py-6 text-xl shadow-xl font-black"
          >
            ← Back to Pour Queue
          </button>
          <button
            onClick={() => router.push('/customer/lookup')}
            className="btn-tablet btn-tablet-s justify-center py-5 uppercase font-black tracking-widest text-[10px]"
          >
            Next Customer Lookup
          </button>
        </div>
        
        <p className="mt-16 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
          End-to-End Encrypted Transaction
        </p>
      </div>
    </div>
  );
}

export default function ServeSuccessPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">Loading result...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
