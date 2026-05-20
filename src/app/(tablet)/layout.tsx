'use client';
import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';

type ToastType = {
  id: string;
  message: string;
  type: 's' | 'e' | 'i' | 'w';
};

export default function TabletLayout({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [bartenderName, setBartenderName] = useState('Rahul Sharma');

  useEffect(() => {
    // Read logged-in staff name if available
    if (typeof window !== 'undefined') {
      const staffName = window.sessionStorage.getItem('sipsave-staff-full-name');
      if (staffName) {
        setBartenderName(staffName);
      }
    }

    // Set up global toast helper
    (window as any).toast = (message: string, type: 's' | 'e' | 'i' | 'w' = 's') => {
      const id = Math.random().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <style jsx global>{`
        /* Clean Professional Buttons */
        .btn-tablet {
          @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-95;
        }
        .btn-tablet-p { @apply bg-indigo-600 text-white hover:bg-indigo-700; }
        .btn-tablet-s { @apply bg-white text-slate-700 border border-slate-200 hover:bg-slate-50; }
        .btn-tablet-g { @apply bg-emerald-600 text-white hover:bg-emerald-700; }
        .btn-tablet-r { @apply bg-rose-600 text-white hover:bg-rose-700; }
        .btn-tablet-a { @apply bg-amber-500 text-white hover:bg-amber-600; }

        .badge-tablet {
          @apply px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide;
        }

        /* Clean Floor Tiles */
        .ftile {
          @apply bg-white border-2 border-slate-200 rounded-xl p-4 cursor-pointer transition-all text-center hover:-translate-y-0.5 hover:shadow-md;
        }

        /* Toast animation */
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast-animate {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header exactly matching myconfusion.txt specs */}
      <header className="h-[64px] bg-[#312e81] px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <Link href="/floor" className="flex items-center gap-3">
            <span className="text-2xl"></span>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Sky Lounge</p>
              <p className="text-[#a5b4fc] text-xs font-medium">{bartenderName} · Shift started 6:00 PM</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/queue" className="btn-tablet bg-white/10 text-white hover:bg-white/20 border border-white/10 !py-1.5 !px-4">
            Pour Queue
          </Link>
          <Link href="/floor" className="btn-tablet bg-white/10 text-white hover:bg-white/20 border border-white/10 !py-1.5 !px-4">
            Floor Plan
          </Link>
          <Link href="/customer/lookup" className="btn-tablet bg-white/10 text-white hover:bg-white/20 border border-white/10 !py-1.5 !px-4">
            Lookup
          </Link>
          <Link href="/orders" className="btn-tablet bg-white/10 text-white hover:bg-white/20 border border-white/10 !py-1.5 !px-4">
            Orders
          </Link>
          <div className="w-px h-6 bg-white/20 mx-2"></div>
          <Link href="/shift" className="btn-tablet bg-rose-600 hover:bg-rose-700 text-white border-none !py-1.5 !px-4">
            End Shift
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {children}
      </main>

      {/* Global Toast Render Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const bgClass =
            t.type === 's' ? 'bg-[#16a34a]' :
            t.type === 'e' ? 'bg-[#e11d48]' :
            t.type === 'w' ? 'bg-[#d97706]' :
            'bg-[#0369a1]';

          return (
            <div
              key={t.id}
              className={`toast-animate ${bgClass} text-white px-5 py-3.5 rounded-lg shadow-lg flex items-center gap-3 text-sm font-semibold pointer-events-auto max-w-sm`}
            >
              <span>{t.type === 's' ? '✅' : t.type === 'e' ? '❌' : t.type === 'w' ? '⚠️' : 'ℹ️'}</span>
              <p className="leading-snug">{t.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

