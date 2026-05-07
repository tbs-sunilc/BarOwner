/**
 * Tracks which Bar the owner is currently managing in the dashboard. Phase 8
 * (owner login) will populate this on successful sign-in; Phase 3 reads it from
 * a `?barId=` query param so screenshots/demos work without owner auth.
 */

const STORAGE_KEY = 'sipsave-barowner-active-bar-id';
const DETAILS_STORAGE_KEY = 'sipsave-barowner-active-bar-details';

const DEFAULT_ACTIVE_BAR_ID = Number(process.env.NEXT_PUBLIC_ACTIVE_BAR_ID ?? '');

export type ActiveBarDetails = {
  barId: number;
  businessName: string;
  city: string;
  stateCode: string;
  isVerified: boolean;
  isActive: boolean;
  verificationQueueMessage: string;
};

export function setActiveBarId(barId: number): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, String(barId));
}

export function setActiveBarDetails(details: ActiveBarDetails): void {
  if (typeof window === 'undefined') return;
  setActiveBarId(details.barId);
  window.sessionStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(details));
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

export function getActiveBarDetails(): ActiveBarDetails | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(DETAILS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveBarDetails>;
    if (typeof parsed.barId === 'number' && parsed.barId > 0) {
      return {
        barId: parsed.barId,
        businessName: parsed.businessName || 'Your Bar',
        city: parsed.city || '',
        stateCode: parsed.stateCode || '',
        isVerified: Boolean(parsed.isVerified),
        isActive: Boolean(parsed.isActive),
        verificationQueueMessage: parsed.verificationQueueMessage || '',
      };
    }
  } catch {
    window.sessionStorage.removeItem(DETAILS_STORAGE_KEY);
  }
  return null;
}

export function clearActiveBarId(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(DETAILS_STORAGE_KEY);
}
