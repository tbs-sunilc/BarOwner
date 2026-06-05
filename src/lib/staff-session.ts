/** Staff tablet session keys and helpers (Phase 8 bartender login). */

export const STAFF_TOKEN_KEY = 'sipsave-staff-access-token';
export const STAFF_TOKEN_EXPIRES_KEY = 'sipsave-staff-access-token-expires-at';
export const STAFF_USER_KEY = 'sipsave-staff-user';
export const STAFF_NAME_KEY = 'sipsave-staff-full-name';

/** Buffer before JWT expiry to redirect proactively (ms). */
const EXPIRY_BUFFER_MS = 30_000;

export function getStaffAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(STAFF_TOKEN_KEY);
}

export function isStaffSessionValid(): boolean {
  const token = getStaffAccessToken();
  if (!token) return false;

  if (typeof window === 'undefined') return true;

  const expiresAtRaw = window.sessionStorage.getItem(STAFF_TOKEN_EXPIRES_KEY);
  if (!expiresAtRaw) return true;

  const expiresAt = Date.parse(expiresAtRaw);
  if (Number.isNaN(expiresAt)) return true;

  return Date.now() < expiresAt - EXPIRY_BUFFER_MS;
}

export function clearStaffSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STAFF_TOKEN_KEY);
  window.sessionStorage.removeItem(STAFF_TOKEN_EXPIRES_KEY);
  window.sessionStorage.removeItem(STAFF_USER_KEY);
  window.sessionStorage.removeItem(STAFF_NAME_KEY);
  window.sessionStorage.removeItem('sipsave-staff-role');
}

export type StaffLogoutReason = 'expired' | 'unauthorized';

/**
 * Clears staff session and navigates to login with staff form visible.
 * Uses full navigation so in-flight API/SignalR state is reset.
 */
export function redirectToStaffLogin(reason?: StaffLogoutReason): void {
  if (typeof window === 'undefined') return;

  clearStaffSession();

  const path = window.location.pathname;
  if (path.startsWith('/login')) return;

  const qs = new URLSearchParams({ staff: '1' });
  if (reason) qs.set('reason', reason);
  window.location.replace(`/login?${qs.toString()}`);
}
