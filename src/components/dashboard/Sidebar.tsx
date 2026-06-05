'use client';

/**
 * Bar-owner dashboard sidebar (matches the SC-08 left-rail layout).
 * Pure-link nav — no role-based hiding yet (Phase 8 will gate by claim).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearActiveBarId, getActiveBarDetails } from '@/lib/active-bar';

const NAV: ReadonlyArray<{ href: string; icon: ReactNode; label: string; exact?: boolean; group: 'core' | 'growth' | 'account' }> = [
  { href: '/dashboard', icon: <IconDashboard />, label: 'Dashboard', exact: true, group: 'core' },
  { href: '/inventory', icon: <IconBottle />, label: 'Inventory', group: 'core' },
  { href: '/wallet-purchases', icon: <IconWallet />, label: 'Wallet Purchases', group: 'core' },
  { href: '/tables', icon: <IconTable />, label: 'Tables & QR Codes', group: 'core' },
  { href: '/staff', icon: <IconUsers />, label: 'Staff Accounts', group: 'core' },
  { href: '/revenue', icon: <IconRevenue />, label: 'Revenue', group: 'core' },
  { href: '/offers', icon: <IconGift />, label: 'Offers', group: 'growth' },
  { href: '/loyalty', icon: <IconSpark />, label: 'Loyalty', group: 'growth' },
  { href: '/campaigns', icon: <IconMegaphone />, label: 'Campaigns', group: 'growth' },
  { href: '/subscription', icon: <IconCard />, label: 'Subscription', group: 'account' },
  { href: '/settings', icon: <IconGear />, label: 'Settings', group: 'account' },
];

type Props = { barName: string };

export function Sidebar({ barName }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayBarName, setDisplayBarName] = useState(barName);
  const initials = useMemo(() => getInitials(displayBarName), [displayBarName]);
  const groups: Array<{ key: 'core' | 'growth' | 'account'; label: string }> = [
    { key: 'core', label: 'Operations' },
    { key: 'growth', label: 'Growth' },
    { key: 'account', label: 'Account' },
  ];

  useEffect(() => {
    const details = getActiveBarDetails();
    if (details?.businessName) setDisplayBarName(details.businessName);
  }, []);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[rgb(220_207_184_/_0.7)] bg-[rgb(255_251_245_/_0.92)] px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-text-soft)] uppercase">
            SipSave
          </p>
          <p className="text-base font-semibold text-[var(--color-text)]">{displayBarName}</p>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMobileOpen((open) => !open)}
          className="btn btn-secondary px-3 py-2"
        >
          <IconMenu />
        </button>
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[rgb(10_17_23_/_0.42)] lg:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-[18.5rem] max-w-[88vw] lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-[18rem]',
          'flex shrink-0 flex-col border-r border-[var(--color-ink-3)] bg-[var(--color-ink)] text-[var(--color-text-invert)] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.55)]',
          'transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="border-b border-[var(--color-ink-3)] px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-[var(--color-ink)] shadow-[0_12px_30px_-18px_rgba(184,134,11,0.95)]">
              <IconBottle />
            </div>
            <div className="min-w-0">
              <p className="font-semibold tracking-[0.22em] text-[0.7rem] uppercase text-[rgb(248_243_234_/_0.56)]">
                SipSave Owner
              </p>
              <h1 className="truncate text-xl font-semibold text-white">{displayBarName}</h1>
            </div>
          </div>


        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {groups.map((group) => (
            <div key={group.key} className="mb-6">
              <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[rgb(248_243_234_/_0.38)]">
                {group.label}
              </p>
              <div className="mt-2 space-y-1">
                {NAV.filter((item) => item.group === group.key).map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname?.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        'group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm',
                        active
                          ? 'bg-[var(--color-ink-3)] text-white'
                          : 'text-[rgb(248_243_234_/_0.72)] hover:bg-[var(--color-ink-2)] hover:text-white',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                    >
                      {active && (
                        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[var(--color-accent)]" />
                      )}
                      <span className={active ? 'text-[var(--color-accent)]' : 'text-[rgb(248_243_234_/_0.48)] group-hover:text-[var(--color-accent)]'}>
                        {item.icon}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-ink-3)] p-4">
          <div className="rounded-2xl border border-[var(--color-ink-3)] bg-[var(--color-ink-2)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-ink-3)] text-sm font-semibold text-[var(--color-accent)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{displayBarName}</p>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[rgb(248_243_234_/_0.46)]">
                  Owner Access
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                window.sessionStorage.removeItem('sipsave-barowner-access-token');
                window.sessionStorage.removeItem('sipsave-barowner-refresh-token');
                window.sessionStorage.removeItem('sipsave-barowner-token-type');
                window.sessionStorage.removeItem('sipsave-barowner-access-token-expires-at');
                window.sessionStorage.removeItem('sipsave-barowner-user');
                window.sessionStorage.removeItem('sipsave-barowner-email');
                window.sessionStorage.removeItem('sipsave-barowner-full-name');
                clearActiveBarId();
                window.location.href = '/login';
              }}
              className="mt-4 w-full flex items-center justify-between rounded-xl border border-[var(--color-ink-3)] bg-transparent px-3 py-2.5 text-sm font-medium text-[rgb(255_219_214)] hover:border-[var(--color-accent)] hover:bg-[var(--color-ink-3)] cursor-pointer"
            >
              <span>Sign Out</span>
              <IconArrow />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SB';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function BaseIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconDashboard() {
  return <BaseIcon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="18" width="7" height="3" rx="1.5" /></BaseIcon>;
}

function IconBottle() {
  return <BaseIcon><path d="M10 3h4" /><path d="M11 3v4l-4.6 6.1a5 5 0 0 0 4 7.9h3.2a5 5 0 0 0 4-7.9L13 7V3" /><path d="M9 14h6" /></BaseIcon>;
}

function IconTable() {
  return <BaseIcon><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /></BaseIcon>;
}

function IconUsers() {
  return <BaseIcon><circle cx="9" cy="8" r="3" /><path d="M3.5 19a6 6 0 0 1 11 0" /><circle cx="17.5" cy="8.5" r="2.5" /><path d="M15 18.5a5 5 0 0 1 5-4" /></BaseIcon>;
}

function IconRevenue() {
  return <BaseIcon><path d="M4 19h16" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-7" /></BaseIcon>;
}

function IconWallet() {
  return <BaseIcon><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 8h14" /><path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" /><path d="M18 14h.01" /></BaseIcon>;
}

function IconGift() {
  return <BaseIcon><path d="M20 12v8H4v-8" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H8.8A2.8 2.8 0 1 1 12 3.4z" /><path d="M12 7h3.2A2.8 2.8 0 1 0 12 3.4z" /></BaseIcon>;
}

function IconSpark() {
  return <BaseIcon><path d="m12 3 1.8 4.7L19 9l-4 3.1 1.3 5L12 14.5 7.7 17 9 12 5 9l5.2-1.3L12 3Z" /></BaseIcon>;
}

function IconMegaphone() {
  return <BaseIcon><path d="M3 11v2a2 2 0 0 0 2 2h2l4 4V5L7 9H5a2 2 0 0 0-2 2Z" /><path d="M15 8.5a5 5 0 0 1 0 7" /><path d="M17.5 6a8 8 0 0 1 0 12" /></BaseIcon>;
}

function IconCard() {
  return <BaseIcon><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></BaseIcon>;
}

function IconGear() {
  return <BaseIcon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></BaseIcon>;
}

function IconMenu() {
  return <BaseIcon><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></BaseIcon>;
}

function IconArrow() {
  return <BaseIcon><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></BaseIcon>;
}
