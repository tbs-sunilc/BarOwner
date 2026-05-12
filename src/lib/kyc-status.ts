/**
 * Stores and retrieves KYC verification status for the bar owner.
 * Used to persist KYC state across sessions.
 */

export type KycStatusType = 'under_review' | 'approved' | 'rejected';

export type KycStatusData = {
  status: KycStatusType;
  rejectionReason?: string;
  userId?: number;
  barId?: number;
  createdAt?: string;
};

const KYC_STATUS_STORAGE_KEY = 'sipsave-barowner-kyc-status';

export function saveKycStatus(data: KycStatusData): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(KYC_STATUS_STORAGE_KEY, JSON.stringify(data));
}

export function loadKycStatus(): KycStatusData | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(KYC_STATUS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KycStatusData;
  } catch {
    return null;
  }
}

export function clearKycStatus(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(KYC_STATUS_STORAGE_KEY);
}

/**
 * Parse the KYC status from the AuthUser response.
 * Maps API status values to our internal enum.
 */
export function parseKycStatusFromApi(
  apiStatus: string | null,
  rejectionReason: string | null
): KycStatusData | null {
  if (!apiStatus) return null;

  const status = apiStatus.toLowerCase();
  
  if (status === 'approved' || status === 'verified') {
    return { status: 'approved' };
  } else if (status === 'rejected' || status === 'permanently_rejected') {
    return {
      status: 'rejected',
      rejectionReason: rejectionReason || 'Your documents did not meet our verification requirements.',
    };
  } else if (status === 'under_review' || status === 'pending') {
    return { status: 'under_review' };
  }

  return null;
}
