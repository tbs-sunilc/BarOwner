import { clearActiveBarId } from '@/lib/active-bar';

/** Clears bar-owner session keys and redirects to login. */
export function clearOwnerSessionAndRedirect(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('sipsave-barowner-access-token');
  window.sessionStorage.removeItem('sipsave-barowner-refresh-token');
  window.sessionStorage.removeItem('sipsave-barowner-token-type');
  window.sessionStorage.removeItem('sipsave-barowner-access-token-expires-at');
  window.sessionStorage.removeItem('sipsave-barowner-user');
  window.sessionStorage.removeItem('sipsave-barowner-email');
  window.sessionStorage.removeItem('sipsave-barowner-full-name');
  clearActiveBarId();
  window.location.href = '/login';
}
