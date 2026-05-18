'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ServeSuccessPage() {
  const searchParams = useSearchParams();
  
  const customer = searchParams.get('customer') || 'Arjun Mehta';
  const amount = searchParams.get('amount') || '60';
  const bottle = searchParams.get('bottle') || 'Johnnie Walker Black Label';
  const balance = searchParams.get('balance') || '278';

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-slate-50/50 reveal">
      <div className="bg-white rounded-[36px] border border-slate-200 shadow-2xl p-10 max-w-xl w-full text-center space-y-8">
        {/* Large Green Checkmark */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-4xl shadow-lg shadow-emerald-100 animate-bounce">
            ✅
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black text-emerald-600 tracking-tighter">Wallet Deducted!</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2">
            Transaction logged successfully
          </p>
        </div>

        {/* Summary Box */}
        <div className="bg-slate-50 border border-slate-100 rounded-[28px] p-6 text-left space-y-4">
          <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-500 tracking-wider">
            <span>Customer</span>
            <span className="text-indigo-950 font-black">{customer}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-500 tracking-wider">
            <span>Bottle</span>
            <span className="text-indigo-950 font-black">{bottle}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-500 tracking-wider">
            <span>Served</span>
            <span className="text-indigo-600 font-black text-base">{amount} ml</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-500 tracking-wider">
            <span>Served By</span>
            <span className="text-indigo-950 font-black">Rahul Sharma</span>
          </div>
          <div className="h-px bg-slate-200"></div>
          <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-500 tracking-wider">
            <span>New Wallet Balance</span>
            <span className="text-xl font-black text-indigo-600">{balance} ml</span>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex gap-3 text-[11px] text-emerald-800 text-left font-bold uppercase leading-relaxed">
          <span>⚡</span>
          <p>
            Customer's app has been updated with the new wallet balance. A confirmation push notification was dispatched.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/queue" className="btn-tablet btn-tablet-p justify-center py-4 rounded-2xl text-sm font-black uppercase tracking-wider">
            ← Back to Queue
          </Link>
          <Link href="/customer/lookup" className="btn-tablet btn-tablet-s justify-center py-4 rounded-2xl text-sm font-bold uppercase tracking-wider">
            Next Customer →
          </Link>
        </div>
      </div>
    </div>
  );
}
