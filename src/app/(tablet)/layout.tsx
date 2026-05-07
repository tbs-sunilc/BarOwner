import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Bartender-tablet shell. No sidebar — the tablet UI is full-bleed so a 10"
 * landscape screen gets every pixel.  The top bar swaps between Floor / Queue
 * so a bartender can pivot without hunting through a menu.
 */
export default function TabletLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-semibold tracking-tight">🍾 SipSave · Bartender</span>
        <nav className="flex gap-1 text-sm">
          <TabletNavLink href="/floor" label="Floor" />
          <TabletNavLink href="/queue" label="Live queue" />
        </nav>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function TabletNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition"
    >
      {label}
    </Link>
  );
}
