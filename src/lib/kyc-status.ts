const STORAGE_KEY = 'sipsave-kyc-status';

export type KycStatus = 'under_review' | 'approved' | 'rejected' | 'user_approved';

export type KycStatusData = {
  status: KycStatus;
  barId?: number;
  rejectionReason?: string;
  timestamp?: string;
};

export function saveKycStatus(data: KycStatusData): void {
  if (typeof window === 'undefined') return;
  const payload = { ...data, timestamp: new Date().toISOString() };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadKycStatus(): KycStatusData | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KycStatusData;
  } catch {
    return null;
  }
}

export function clearKycStatus(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function parseKycStatusFromApi(
  kycStatus: string | null | undefined,
  rejectionReason?: string | null,
): KycStatusData | null {
  if (!kycStatus) return null;

  const normalized = kycStatus.toLowerCase();

  if (normalized.includes('user_approved') || normalized === 'user_approved') {
    return {
      status: 'user_approved',
      rejectionReason: rejectionReason || undefined,
    };
  }

  if (normalized.includes('reject') || normalized.includes('failed')) {
    return {
      status: 'rejected',
      rejectionReason: rejectionReason || undefined,
    };
  }

  if (normalized.includes('approved') || normalized.includes('verified')) {
    return { status: 'approved' };
  }

  if (
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('submitted')
  ) {
    return { status: 'under_review' };
  }

  return null;
}