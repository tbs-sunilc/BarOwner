'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';

export default function TabletLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app-shell text-slate-900 font-sans selection:bg-accent-tint selection:text-accent-lo">
      <style jsx global>{`
        :root {
          --tablet-p: var(--color-accent);
          --tablet-p-hover: var(--color-accent-lo);
          --tablet-s: var(--color-surface);
          --tablet-g: var(--color-success);
          --tablet-r: var(--color-danger);
          --tablet-a: var(--color-info);
          --tablet-bg: var(--color-ivory);
          --tablet-panel: var(--color-surface);
          --tablet-border: var(--color-border);
        }

        .btn-tablet {
          @apply inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm;
        }
        .btn-tablet-p { @apply bg-slate-950 text-white hover:bg-slate-900 border border-amber-900/50 shadow-glow; }
        .btn-tablet-s { @apply bg-white text-slate-700 border border-slate-200 hover:bg-slate-50; }
        .btn-tablet-g { @apply bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100; }
        .btn-tablet-r { @apply bg-rose-600 text-white hover:bg-rose-700 shadow-rose-100; }
        .btn-tablet-a { @apply bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100; }

        .badge-tablet {
          @apply px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider;
        }
        .badge-tablet-p { @apply bg-amber-100 text-amber-700 border border-amber-200; }
        .badge-tablet-r { @apply bg-rose-100 text-rose-700 border border-rose-200; }
        .badge-tablet-a { @apply bg-blue-100 text-blue-700 border border-blue-200; }

        .ftile {
          @apply relative rounded-3xl border-2 transition-all duration-300;
        }
      `}</style>

      {/* Header aligned with Bar Owner Dashboard */}
      <header className="h-20 bg-slate-950 border-b border-amber-900/20 px-6 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white text-xl font-black shadow-glow">
              SS
            </div>
            <div>
              <p className="text-white font-black tracking-tighter leading-none">SIP SAVE</p>
              <p className="text-amber-500/80 text-[10px] font-bold tracking-widest uppercase">Bartender Terminal</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            {[
              { label: 'Pour Queue', href: '/queue', icon: '📋' },
              { label: 'Floor Plan', href: '/floor', icon: '📍' },
              { label: 'Lookup', href: '/customer/lookup', icon: '🔍' },
              { label: 'Orders', href: '/orders', icon: '🍔' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm font-bold flex items-center gap-2"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end mr-4">
            <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">Active Shift</p>
            <p className="text-white font-bold text-sm">6:00 PM — NOW</p>
          </div>
          <Link href="/shift" className="btn-tablet btn-tablet-p !py-2.5 !px-5 !text-xs border-amber-500/30">
            End Shift
          </Link>
        </div>
      </header>

      <main className="min-h-[calc(100vh-80px)]">
        {children}
      </main>
    </div>
  );
}
