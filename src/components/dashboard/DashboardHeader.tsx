'use client';

import { useEffect, useState } from 'react';
import { getActiveBarDetails } from '@/lib/active-bar';
import Link from 'next/link';

export function DashboardHeader({ fallbackBarName }: { fallbackBarName: string }) {
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

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[rgb(255_255_255_/_0.86)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--color-ink)] sm:text-2xl">Dashboard</h1>
          <p className="mt-0.5 text-sm font-medium text-[var(--color-text-soft)]">
            Welcome back, {ownerName} · {barName}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-success/30 bg-success-tint text-success text-[11px] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
            Subscription Active
          </div>
          
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ivory-2 text-[var(--color-ink)] text-xs font-bold hover:bg-ivory transition-colors">
            <IconQrCode className="h-4 w-4" />
            <span className="hidden md:inline">View Bar QR Codes</span>
          </button>

          <Link href="/inventory/add" className="btn btn-primary btn-sm px-4 py-2 rounded-xl bg-[#5e5ce6] border-none shadow-sm flex items-center gap-2">
            <span className="text-lg font-normal">+</span>
            <span>Add Bottle</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function IconQrCode({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
      <line x1="7" y1="7" x2="7" y2="7"></line>
      <line x1="17" y1="7" x2="17" y2="7"></line>
      <line x1="17" y1="17" x2="17" y2="17"></line>
      <line x1="7" y1="17" x2="7" y2="17"></line>
    </svg>
  );
}
