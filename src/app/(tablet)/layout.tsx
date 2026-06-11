'use client';
import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/auth/AuthGuard';

type ToastType = {
  id: string;
  message: string;
  type: 's' | 'e' | 'i' | 'w';
};

export default function TabletLayout({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [bartenderName, setBartenderName] = useState('Rahul Sharma');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const staffName = window.sessionStorage.getItem('sipsave-staff-full-name');
      if (staffName) setBartenderName(staffName);
    }

    (window as any).toast = (message: string, type: 's' | 'e' | 'i' | 'w' = 's') => {
      const id = Math.random().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };
  }, []);

  return (
    <AuthGuard allowedTokens={['sipsave-staff-access-token']}>
      <div className="min-h-screen bg-ivory text-ink font-sans">
        <style jsx global>{`
          .btn-tablet {
          @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-95 border;
        }
        .btn-tablet-p { @apply bg-ink text-ivory border-[color:var(--color-accent-lo)] hover:bg-ink-2; box-shadow: var(--shadow-glow); }
        .btn-tablet-s { @apply bg-white text-[color:var(--color-text)] border-[color:var(--color-border)] hover:bg-ivory-2; }
        .btn-tablet-g { @apply text-white border-transparent; background: var(--color-success); }
        .btn-tablet-g:hover { background: #2d5c45; }
        .btn-tablet-r { @apply text-white border-transparent; background: var(--color-danger); }
        .btn-tablet-r:hover { background: #7a2522; }
        .btn-tablet-a { @apply text-[color:var(--color-ink)] border-transparent; background: var(--color-accent); }
        .btn-tablet-a:hover { background: var(--color-accent-hi); }

        .badge-tablet {
          @apply px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide border;
          border-color: var(--color-border);
        }

        .ftile {
          @apply bg-white border rounded-xl p-4 cursor-pointer transition-all text-center hover:-translate-y-0.5 hover:shadow-md;
          border-color: var(--color-border);
        }

        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast-animate {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <header className="h-[64px] bg-ink px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm border-b border-[color:var(--color-ink-3)]">
        <div className="flex items-center gap-6">
          <Link href="/floor" className="flex items-center gap-3">
            <span className="text-2xl"></span>
            <div>
              <p className="text-[color:var(--color-text-invert)] font-bold text-lg leading-tight">Sky Lounge</p>
              <p className="text-[color:var(--color-text-soft)] text-xs font-medium">{bartenderName} · Shift started 6:00 PM</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/queue" className="btn-tablet btn-tablet-a !py-1.5 !px-4">
            Pour Queue
          </Link>
  

    <Link href="/floor" className="btn-tablet btn-tablet-a !py-1.5 !px-4">
      Floor Plan
    </Link>

    <Link href="/customer/lookup" className="btn-tablet btn-tablet-a !py-1.5 !px-4">
      Customer Lookup
    </Link>

    <Link href="/orders" className="btn-tablet btn-tablet-a !py-1.5 !px-4">
      Orders
    </Link>
          <div className="w-px h-6 bg-[color:var(--color-ink-3)] mx-2"></div>
          <Link
            href="/shift"
            className="btn-tablet btn-tablet-a !py-1.5 !px-4 shadow-glow hover:brightness-105"
          >
            End Shift
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {children}
      </main>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const bgClass =
            t.type === 's' ? 'bg-[color:var(--color-success)]' :
            t.type === 'e' ? 'bg-[color:var(--color-danger)]' :
            t.type === 'w' ? 'bg-[color:var(--color-accent-lo)]' :
            'bg-[color:var(--color-info)]';

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
    </AuthGuard>
  );
}
