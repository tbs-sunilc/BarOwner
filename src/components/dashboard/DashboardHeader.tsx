'use client';

import { useEffect, useState } from 'react';
import { getActiveBarDetails } from '@/lib/active-bar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DashboardHeader({ fallbackBarName }: { fallbackBarName: string }) {
  const pathname = usePathname();
  const [barName, setBarName] = useState(fallbackBarName);
  const [ownerName, setOwnerName] = useState('Owner');

  useEffect(() => {
    const details = getActiveBarDetails();
    if (details?.businessName) setBarName(details.businessName);

    if (typeof window !== 'undefined') {
      const storedName = window.sessionStorage.getItem('sipsave-barowner-full-name');
      if (storedName) setOwnerName(storedName);
    }
  }, []);

  if (pathname === '/') return null;

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[rgb(255_255_255_/_0.86)] backdrop-blur transition-all duration-300">
    {/*<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <span className="section-kicker">Owner Workspace</span>
          <p className="mt-2 text-lg font-semibold text-[var(--color-text)] sm:text-xl">
            Run service, stock, offers, and revenue from one console.
          </p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="status-pill status-success">Platform Live</span>
          <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-right shadow-[var(--shadow-xs)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
              Active Venue
            </p>
            <p className="text-sm font-semibold text-[var(--color-text)]">{barName}</p>
          </div>
        </div>
      </div>*/}
    </header>
  );
}
