/**
 * Tracks which Bar the owner is currently managing in the dashboard. Phase 8
 * (owner login) will populate this on successful sign-in; Phase 3 reads it from
 * a `?barId=` query param so screenshots/demos work without owner auth.
 */

const STORAGE_KEY = 'sipsave-barowner-active-bar-id';

const DEFAULT_ACTIVE_BAR_ID = Number(process.env.NEXT_PUBLIC_ACTIVE_BAR_ID ?? '');

export function setActiveBarId(barId: number): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, String(barId));
}

export function getActiveBarId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(DEFAULT_ACTIVE_BAR_ID) && DEFAULT_ACTIVE_BAR_ID > 0) {
    return DEFAULT_ACTIVE_BAR_ID;
  }
  return null;
}

export function clearActiveBarId(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
