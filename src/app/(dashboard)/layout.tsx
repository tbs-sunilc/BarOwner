import type { ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';

/**
 * Dashboard shell — sidebar + main content area.
 * Bar name is a placeholder until Phase 8 wires the owner-session DTO.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell lg:flex">
      <Sidebar barName="Sky Lounge" />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[rgb(255_255_255_/_0.86)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
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
                <p className="text-sm font-semibold text-[var(--color-text)]">{'Sky Lounge'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
