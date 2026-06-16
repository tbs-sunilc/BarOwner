'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Sidebar } from '@/components/dashboard/Sidebar';
import AuthGuard from '@/components/auth/AuthGuard';

/**
 * Dashboard shell — sidebar + main content area.
 * Bar name is a placeholder until Phase 8 wires the owner-session DTO.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStaff = pathname?.startsWith('/staff') ?? false;

  return (
    <AuthGuard allowedTokens={["sipsave-barowner-access-token"]}>
      <div className={["page-shell lg:flex", isStaff ? 'staff-shell' : ''].join(' ')}>
        <Sidebar barName="Your Bar" />
        <div className="min-w-0 flex-1">
          <DashboardHeader fallbackBarName="Your Bar" />

          <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
