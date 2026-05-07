/**
 * Cross-step storage for the bar-owner registration wizard. Step 1 (SC-02)
 * persists business info here so step 2 (SC-03) can submit one consolidated
 * POST /api/v1/bars + POST /api/v1/bars/:id/documents.
 *
 * Uses sessionStorage so the data is wiped when the tab closes — we never want
 * stale GSTIN entries leaking across owners on a shared kiosk.
 */

export type BarRegistrationStep1 = {
  businessName: string;
  ownerFullName: string;
  email: string;
  mobileNumber: string;
  addressLine1: string;
  city: string;
  stateCode: string;
  pincode: string;
  openingTime: string;
  closingTime: string;
  ambianceTags: string[];
};

const STORAGE_KEY = 'sipsave-barowner-registration-step1';

export function saveRegistrationStep1(data: BarRegistrationStep1): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadRegistrationStep1(): BarRegistrationStep1 | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BarRegistrationStep1;
  } catch {
    return null;
  }
}

export function clearRegistrationStep1(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
