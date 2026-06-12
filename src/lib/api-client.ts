/**
 * Thin SipSave API client. Reads `NEXT_PUBLIC_API_URL` (default http://192.168.1.239:5000)
 * and forwards an Authorization header from sessionStorage when present (the bar-owner
 * login flow lands the JWT there in Phase 8). Throws an `ApiError` with the parsed
 * problem+json body so callers can render the right banner.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://192.168.1.231:5000";
const PUBLIC_AUTH_PATHS = [
  "/staff/auth/login",
  "/staff/auth/forgot-password",
  "/staff/auth/reset-password",
  "/auth/login",
  "/auth/register",
  "/auth/verify",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isPublicAuthPath(path: string): boolean {
  return PUBLIC_AUTH_PATHS.some((segment) => path.includes(segment));
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");

  if (typeof window !== "undefined" && !isPublicAuthPath(path)) {
    const ownerToken = window.sessionStorage.getItem(
      "sipsave-barowner-access-token",
    );
    const staffToken = window.sessionStorage.getItem(
      "sipsave-staff-access-token",
    );
    const token = staffToken || ownerToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  const body = text ? safeParse(text) : null;
  if (!res.ok) {
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !isPublicAuthPath(path) &&
      headers.get("Authorization")?.startsWith("Bearer ") &&
      window.sessionStorage.getItem("sipsave-barowner-refresh-token")
    ) {
      const expiresAt = window.sessionStorage.getItem(
        "sipsave-barowner-access-token-expires-at",
      );
      const isExpired = expiresAt ? new Date() >= new Date(expiresAt) : false;
      if (isExpired) {
        window.dispatchEvent(
          new CustomEvent("sipsave-owner-session-expired", {
            detail: { path, status: res.status },
          }),
        );
      }
    }

    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !isPublicAuthPath(path) &&
      headers.get("Authorization")?.startsWith("Bearer ") &&
      window.sessionStorage.getItem("sipsave-staff-access-token")
    ) {
      const { redirectToStaffLogin } = await import("./staff-session");
      redirectToStaffLogin("unauthorized");
    }

    const message =
      (body &&
      typeof body === "object" &&
      "title" in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).title)
        : null) ?? res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function assertValidBarId(barId: number): void {
  if (!Number.isInteger(barId) || barId <= 0) {
    throw new Error(`Invalid barId: ${barId}`);
  }
}

// ---------------------------------------------------------------------------
//  Auth endpoints (bar-owner sign-in)
// ---------------------------------------------------------------------------

export type RegisterOtpPayload = {
  fullName: string;
  mobileNumber: string;
};

export type RegisterOtpResponse = {
  mobileNumber: string;
  otpExpiresAtUtc: string;
  resendCooldownSeconds: number;
  otpLength: number;
  lockedUntilUtc: string | null;
  isExistingAccount: boolean;
};

export const requestOwnerOtp = (payload: RegisterOtpPayload) =>
  request<RegisterOtpResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type VerifyOtpPayload = {
  mobileNumber: string;
  otp: string;
  test: boolean;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  tokenType: string;
};

export type AuthUser = {
  id: number;
  mobileNumber: string;
  fullName: string | null;
  email: string | null;
  profilePhotoUrl: string | null;
  kycStatus: string | null;
  kycRejectionReason: string | null;
  isPermanentlyRejected: boolean;
  authProvider: string;
  mustResetPassword: boolean;
  barId?: number | null;
};

export type VerifyOtpResponse = {
  tokens: AuthTokens;
  user: AuthUser;
  isNewAccount: boolean;
};

export const verifyOwnerOtp = (payload: VerifyOtpPayload) =>
  request<VerifyOtpResponse>("/api/v1/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type OwnerLoginPayload = {
  email: string;
  password: string;
};

export const loginOwner = (payload: OwnerLoginPayload) =>
  request<VerifyOtpResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type ChangeOwnerPasswordPayload = {
  newPassword: string;
};

export const changeOwnerPassword = (payload: ChangeOwnerPasswordPayload) =>
  request<void>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type RequestOwnerPasswordResetPayload = {
  email: string;
};

export const requestOwnerPasswordReset = (
  payload: RequestOwnerPasswordResetPayload,
) =>
  request<void>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type ResetOwnerPasswordPayload = {
  token: string;
  newPassword: string;
};

export const resetOwnerPassword = (payload: ResetOwnerPasswordPayload) =>
  request<void>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });


export type CustomerLookupWalletDto = {
  id: number;
  name: string;
  balance: number;
  total: number;
  lastServed: string;
  warning?: string | null;
};

export type CustomerLookupResponse = {
  name: string;
  mobile: string;
  kycStatus: string;
  currentTable: string | null;
  activeSessionId?: number | null;
  wallets: CustomerLookupWalletDto[];
};

export const fetchCustomerLookup = (mobileNumber: string, barId: number) =>
  request<CustomerLookupResponse>(
    `/api/v1/sessions/customer-lookup?mobileNumber=${encodeURIComponent(mobileNumber)}&barId=${encodeURIComponent(barId)}`,
  );

export type UserDetailDto = {
  id: number;
  mobileNumber: string;
  countryCode: string;
  fullName: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactMobile: string | null;
  healthConditions: string | null;
  allergies: string | null;
  authProvider: string;
  kycStatus: string;
  kycDocType: string | null;
  kycDocUrl: string | null;
  kycSubmittedAtUtc: string | null;
  kycReviewedAtUtc: string | null;
  kycRejectionReason: string | null;
  lastLoginAtUtc: string | null;
  isActive: boolean;
  isBanned: boolean;
  mustResetPassword: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
};

export type UpdateUserProfilePayload = {
  fullName?: string | null;
  email?: string | null;
  profilePhotoUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactMobile?: string | null;
  healthConditions?: string | null;
  allergies?: string | null;
};

export const getUserDetailById = (userId: number) =>
  request<UserDetailDto>(`/api/v1/users/${userId}`);

export const updateUserProfileById = (
  userId: number,
  payload: UpdateUserProfilePayload,
) =>
  request<UserDetailDto>(`/api/v1/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });


export const refreshAuthToken = async (
  refreshToken: string,
): Promise<{ tokens: AuthTokens; user?: AuthUser }> => {
  const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken, test: false }),
  });

  const text = await res.text();
  const body = text ? safeParse(text) : null;
  if (!res.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "title" in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).title)
        : res.statusText;
    throw new ApiError(res.status, message, body);
  }

  return body as { tokens: AuthTokens; user?: AuthUser };
};


// ---------------------------------------------------------------------------
//  Staff auth endpoints
// ---------------------------------------------------------------------------

export type StaffLoginPayload = {
  email: string;
  password: string;
};

export type StaffLoginResponse = {
  accessToken: string;
  expiresAtUtc: string;
  staffId: number;
  fullName: string;
  role: string;
  barId: number;
  email?: string | null;
  mustResetPassword: boolean;
};

export const loginStaff = (payload: StaffLoginPayload) =>
  request<StaffLoginResponse>("/api/v1/staff/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type StaffChangePasswordPayload = {
  newPassword: string;
};

export const changeStaffPassword = (payload: StaffChangePasswordPayload) =>
  request<void>("/api/v1/staff/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type StaffForgotPasswordPayload = {
  email: string;
};

export const requestStaffPasswordReset = (payload: StaffForgotPasswordPayload) =>
  request<void>("/api/v1/staff/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type StaffResetPasswordPayload = {
  token: string;
  newPassword: string;
};

export const resetStaffPassword = (payload: StaffResetPasswordPayload) =>
  request<void>("/api/v1/staff/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------------------------
//  Subscription plans
// ---------------------------------------------------------------------------

export type SubscriptionPlanDto = {
  id: number;
  code?: string | null;
  name: string;
  tier?: string | null;
  price?: string | null;
  monthlyPriceInPaise?: number | null;
  annualPriceInPaise?: number | null;
  trialDays?: number | null;
  maxStaffAccounts?: number | null;
  //maxBarTables?: number | null;
  maxBottleInventoryItems?: number | null;
  maxActiveOffers?: number | null;
  includesAdvancedAnalytics?: boolean;
  includesFeaturedListing?: boolean;
  includesWhatsappBot?: boolean;
  monthlyDisable?: boolean;
  annuallyDisable?: boolean;
  badge?: string | null;
  suffix?: string | null;
  features?: string[] | null;
  disabledFrom?: number | null;
};

export const getSubscriptionPlans = () =>
  request<SubscriptionPlanDto[]>("/api/v1/subscriptions/plans");

export type SubscribeToPlanPayload = {
  planCode: string;
  billingCycle: "Monthly" | "Annual";
};

export type SubscribeToPlanResponse = {
  subscriptionId: number;
  planId: number;
  billingCycle: string;
  status: string;
  trialEndsAtUtc?: string | null;
  nextBillingDateUtc?: string | null;
};

export const subscribeToPlan = (
  barId: number,
  payload: SubscribeToPlanPayload,
) =>
  request<SubscribeToPlanResponse>(`/api/v1/bars/${barId}/subscription`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type BarSubscriptionStatusDto = {
  id: number;
  subscriptionPlanId: number;
  planName: string;
  status: string;
  billingCycle: string;
  priceInRupees: number;
  autoRenew: boolean;
  startedAt: string;
  currentPeriodEnd: string;
  nextBillingAtUtc: string | null;
  trialEndsAtUtc: string | null;
  gracePeriodEndsAtUtc: string | null;
  isFailing: boolean;
  daysUntilDelisted: number | null;
  failedPaymentCount: number;
  lastFailureReason: string | null;
};

export type SubscriptionStatusDto = Pick<
  BarSubscriptionStatusDto,
  | "status"
  | "gracePeriodEndsAtUtc"
  | "daysUntilDelisted"
  | "isFailing"
  | "lastFailureReason"
>;

export const getSubscriptionStatus = (barId: number) => {
  assertValidBarId(barId);
  return request<BarSubscriptionStatusDto>(`/api/v1/bars/${barId}/subscription`);
};

export const changeSubscriptionPlan = (
  barId: number,
  payload: SubscribeToPlanPayload,
) => {
  assertValidBarId(barId);
  return request<BarSubscriptionStatusDto>(
    `/api/v1/bars/${barId}/subscription/change-plan`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};

export type CancelSubscriptionPayload = {
  reason: string;
  detail?: string | null;
};

export const cancelSubscription = (
  barId: number,
  payload: CancelSubscriptionPayload,
) => {
  assertValidBarId(barId);
  return request<BarSubscriptionStatusDto>(`/api/v1/bars/${barId}/subscription`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
};

export const simulateSubscriptionPaymentFailure = (barId: number) => {
  assertValidBarId(barId);
  return request<SubscriptionStatusDto>(
    `/api/v1/bars/${barId}/subscription/qa/payment-failure`,
    { method: "POST" },
  );
};

export const simulateSubscriptionRestore = (barId: number) => {
  assertValidBarId(barId);
  return request<SubscriptionStatusDto>(
    `/api/v1/bars/${barId}/subscription/qa/restore`,
    { method: "POST" },
  );
};

// ---------------------------------------------------------------------------
//  Bar registration endpoints
// ---------------------------------------------------------------------------

export type RegisterBarPayload = {
  businessName: string;
  description?: string | null;
  contactMobile: string;
  contactEmail?: string | null;
  addressLine1: string;
  city: string;
  stateCode: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  gstin: string;
  fssaiLicenceNumber: string;
  liquorLicenceNumber: string;
  ambianceTags?: string[] | null;
  openingHoursJson?: string | null;
};

export type RegisterBarResponse = {
  barId: number;
  businessName: string;
  city: string;
  stateCode: string;
  isEmailVerified: boolean;
  isVerified: boolean;
  isActive: boolean;
  verificationQueueMessage: string;
};

export const registerBar = (payload: RegisterBarPayload) =>
  request<RegisterBarResponse>("/api/v1/bars", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type VerifyBarEmailPayload = {
  token: string;
};

export type BarEmailVerificationResponse = {
  barId: number;
  businessName: string;
  contactEmail: string;
  isEmailVerified: boolean;
  emailVerifiedAtUtc: string | null;
  message: string;
};

export const verifyBarEmail = (payload: VerifyBarEmailPayload) =>
  request<BarEmailVerificationResponse>("/api/v1/bars/verify-email", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type SubmitBarDocumentsPayload = {
  gstinDocKey: string;
  fssaiDocKey: string;
  liquorLicenceDocKey: string;
  photoGalleryKeys?: string[];
  logoUrl?: string | null;
};

export const submitBarDocuments = (
  barId: number,
  payload: SubmitBarDocumentsPayload,
) =>
  request<void>(`/api/v1/bars/${barId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const submitBarDocumentsForm = (
  barId: number,
  formData: FormData,
) =>
  request<void>(`/api/v1/bars/${barId}/documents`, {
    method: "POST",
    body: formData,
  });

export const uploadBarMedia = (barId: number, formData: FormData) =>
  request<void>(`/api/v1/bars/${barId}/media`, {
    method: "POST",
    body: formData,
  });

export type BarDetails = {
  barId: number;
  businessName: string;
  city: string;
  stateCode: string;
  isEmailVerified: boolean;
  isVerified: boolean;
  isActive: boolean;
  verificationQueueMessage: string;
};

export const getBarDetails = () => request<BarDetails>("/api/v1/bars/details");

export type BarOwnerSettings = {
  barId: number;
  businessName: string;
  description: string | null;
  contactMobile: string;
  contactEmail: string | null;
  city: string;
  stateCode: string;
  isVerified: boolean;
  isActive: boolean;
  isTemporarilyClosed: boolean;
  closureReason: string | null;
  plannedReopenOn: string | null;
  verificationQueueMessage: string;
  addressLine1: string | null;
  addressLine2: string | null;
  locality: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  ambianceTagsJson: string | null;
  openingHoursJson: string | null;
  logoUrl: string | null;
  photoGalleryJson: string | null;
  gstin: string | null;
  fssaiLicenceNumber: string | null;
  liquorLicenceNumber: string | null;
  gstinDocumentUrl: string | null;
  fssaiDocumentUrl: string | null;
  liquorLicenceDocumentUrl: string | null;
  rejectionReason: string | null;
};

export const getBarOwnerSettings = (barId: number) => {
  assertValidBarId(barId);
  return request<BarOwnerSettings>(`/api/v1/bars/${barId}/owner-settings`);
};

export type UpdateBarProfilePayload = {
  businessName: string;
  description?: string | null;
  contactMobile?: string | null;
  contactEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ambianceTags?: string[] | null;
  openingHoursJson?: string | null;
  logoUrl?: string | null;
  photoGalleryUrls?: string[] | null;
};

export const updateBarProfile = (barId: number, payload: UpdateBarProfilePayload) => {
  assertValidBarId(barId);
  return request<void>(`/api/v1/bars/${barId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const closeBarTemporarily = (
  barId: number,
  payload: { reason: string; plannedReopenOn?: string | null },
) => {
  assertValidBarId(barId);
  return request<void>(`/api/v1/bars/${barId}/temporary-close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const reopenBar = (barId: number) => {
  assertValidBarId(barId);
  return request<void>(`/api/v1/bars/${barId}/reopen`, {
    method: "POST",
  });
};

export const deleteBarAccount = (barId: number) => {
  assertValidBarId(barId);
  return request<void>(`/api/v1/bars/${barId}`, {
    method: "DELETE",
  });
};

export type BarTableDto = {
  id: number;
  barId: number;
  tableNumber: string;
  qrToken: string;
};

export type BarTableStatusDto = {
  id: number;
  barId: number;
  tableNumber: string;
  qrToken: string;
  capacity: number | null;
  floorSection: string | null;
  isActive: boolean;
  createdAtUtc: string;
  status: "Available" | "Occupied" | "Reserved" | "PourPending";
  sessionId: number | null;
  activeGuestCount: number | null;
  customerName: string | null;
  sessionTimeLabel: string | null;
  reservationDetails: string | null;
};

// ---------------------------------------------------------------------------
//  Inventory endpoints (mirrors InventoryItemDto on the server)
// ---------------------------------------------------------------------------

export type InventoryStockState =
  | "InStock"
  | "LowStock"
  | "OutOfStock"
  | "Unavailable";

export type MasterCategory = {
  id: number;
  name: string;
  isActive: boolean;
  catalogueItemCount: number;
};

export const listMasterCategories = (activeOnly = true) =>
  request<MasterCategory[]>(
    `/api/v1/master-categories?activeOnly=${activeOnly}`,
  );

export type InventoryItem = {
  id: number;
  barId: number;
  bottleCatalogueId: number;
  barInventoryCategoryId: number;
  masterCategoryId?: number | null;
  brandName: string;
  productName: string;
  /** Platform master category name (Whisky, Vodka, etc.). */
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  sellingPrice: number;
  costPrice?: number | null;
  sellingPriceUpdatedAt?: string | null;
  volume750MlAvailable: boolean;
  volume1000MlAvailable: boolean;
  bottlesInStock: number;
  bottlesCommitted: number;
  bottlesAvailableForPurchase: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  stockState: InventoryStockState;
  createdAtUtc: string;
};

export const listInventory = (barId: number, includeUnavailable = true) =>
  request<InventoryItem[]>(
    `/api/v1/bars/${barId}/inventory?includeUnavailable=${includeUnavailable}`,
  );

export const setInventoryAvailability = (
  inventoryId: number,
  isAvailable: boolean,
) =>
  request<InventoryItem>(`/api/v1/inventory/${inventoryId}/availability`, {
    method: "PUT",
    body: JSON.stringify({ isAvailable }),
  });

export type BottleFavoriteDto = {
  favoriteId: number;
  barId: number;
  barInventoryId: number;
  bottleCatalogueId: number;
  brandName: string;
  productName: string;
  category: string;
  subCategory?: string | null;
  originCountry?: string | null;
  alcoholContentPct?: number | null;
  defaultVolumeMl: number;
  imageUrl?: string | null;
  tastingNotes?: string | null;
  sellingPrice: number;
  costPrice?: number | null;
  volume750MlAvailable: boolean;
  volume1000MlAvailable: boolean;
  bottlesInStock: number;
  bottlesCommitted: number;
  bottlesAvailableForPurchase: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  stockState: InventoryStockState;
  favoritedAtUtc: string;
};

export const listBottleFavorites = (barId: number) => {
  assertValidBarId(barId);
  return request<BottleFavoriteDto[]>(`/api/v1/bars/${barId}/bottle-favorites`);
};

export const favoriteBottle = (barId: number, bottleCatalogueId: number) => {
  assertValidBarId(barId);
  if (!Number.isInteger(bottleCatalogueId) || bottleCatalogueId <= 0) {
    throw new Error(`Invalid bottleCatalogueId: ${bottleCatalogueId}`);
  }
  return request<BottleFavoriteDto>(
    `/api/v1/bars/${barId}/bottle-favorites/${bottleCatalogueId}`,
    { method: "POST" },
  );
};

export const unfavoriteBottle = (barId: number, bottleCatalogueId: number) => {
  assertValidBarId(barId);
  if (!Number.isInteger(bottleCatalogueId) || bottleCatalogueId <= 0) {
    throw new Error(`Invalid bottleCatalogueId: ${bottleCatalogueId}`);
  }
  return request<void>(`/api/v1/bars/${barId}/bottle-favorites/${bottleCatalogueId}`, {
    method: "DELETE",
  });
};

export type BottleCatalogueSearchHit = {
  id: number;
  brandName: string;
  productName: string;
  category: string;
  subCategory?: string | null;
  originCountry?: string | null;
  alcoholContentPct?: number | null;
  defaultVolumeMl: number;
  imageUrl?: string | null;
  alreadyInInventory: boolean;
};

export const searchBottleCatalogue = (
  barId: number,
  q: string,
  category?: string,
) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  return request<BottleCatalogueSearchHit[]>(
    `/api/v1/bars/${barId}/inventory/catalogue-search?${params.toString()}`,
  );
};

export type AddBottlePayload = {
  bottleCatalogueId: number;
  barInventoryCategoryId: number;
  sellingPrice: number;
  costPrice?: number | null;
  bottlesInStock: number;
  masterCategoryId?: number | null;
  lowStockThreshold?: number;
  volume750MlAvailable?: boolean;
  volume1000MlAvailable?: boolean;
  isAvailable?: boolean;
  customBrandName?: string;
  customProductName?: string;
  customDefaultVolumeMl?: number;
};

export const addBottleToInventory = (
  barId: number,
  payload: AddBottlePayload,
) =>
  request<InventoryItem>(`/api/v1/bars/${barId}/inventory`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type UpdateInventoryPayload = {
  barInventoryCategoryId: number;
  sellingPrice: number;
  costPrice?: number | null;
  bottlesInStock: number;
  lowStockThreshold: number;
  volume750MlAvailable: boolean;
  volume1000MlAvailable: boolean;
  isAvailable: boolean;
  stockChangeReason?: string | null;
};

export const updateInventoryItem = (
  id: number,
  payload: UpdateInventoryPayload,
) =>
  request<InventoryItem>(`/api/v1/inventory/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteInventoryItem = (id: number) =>
  request<void>(`/api/v1/inventory/${id}`, { method: "DELETE" });

export type BarInventoryCategory = {
  id: number;
  barId: number;
  name: string;
  displayOrder: number;
  bottleCount: number;
};

export const listInventoryCategories = (barId: number) =>
  request<BarInventoryCategory[]>(`/api/v1/bars/${barId}/inventory/categories`);

export const createInventoryCategory = (
  barId: number,
  payload: { name: string; displayOrder?: number },
) =>
  request<BarInventoryCategory>(`/api/v1/bars/${barId}/inventory/categories`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateInventoryCategory = (
  barId: number,
  categoryId: number,
  payload: { name: string; displayOrder?: number },
) =>
  request<BarInventoryCategory>(
    `/api/v1/bars/${barId}/inventory/categories/${categoryId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

export const deleteInventoryCategory = (barId: number, categoryId: number) =>
  request<void>(`/api/v1/bars/${barId}/inventory/categories/${categoryId}`, {
    method: "DELETE",
  });

// ---------------------------------------------------------------------------
//  Phase 5 — Sessions & Pour Requests (bartender-tablet surface)
// ---------------------------------------------------------------------------

export type PourRequestStatus = "Pending" | "Served" | "Cancelled" | "Rejected";

export type PourRequestDto = {
  id: number;
  sessionId: number;
  barTableId: number | null;
  walletId: number;
  userId: number;
  barId: number;
  requestedMl: number;
  servedMl: number | null;
  status: PourRequestStatus;
  userNotes: string | null;
  cancellationReason: string | null;
  createdAtUtc: string;
  servedAtUtc: string | null;
  cancelledAtUtc: string | null;
  walletTransactionId: number | null;
  remainingMlAfterServe: number | null;
  userDisplayName: string | null;
  bottleBrandName: string | null;
  bottleProductName: string | null;
};

export type CreatePourRequestPayload = {
  walletId: number;
  requestedMl: number;
};

export type SessionWalletDto = {
  walletId: number;
  bottleCatalogueId: number;
  brandName: string;
  productName: string;
  purchasedVolumeMl: number;
  remainingVolumeMl: number;
  expiresOn: string | null;
};

export type SessionDto = {
  id: number;
  userId: number;
  barId: number;
  barName: string;
  barTableId: number | null;
  tableNumber: string | null;
  status: "Active" | "Closed" | "AutoClosed";
  checkedInAtUtc: string;
  lastActivityAtUtc: string;
  activeWalletsAtBar: SessionWalletDto[];
};

export const createPourRequest = (payload: CreatePourRequestPayload) =>
  request<PourRequestDto>("/api/v1/pour-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchPourQueue = (barId: number) =>
  request<PourRequestDto[]>(`/api/v1/pour-requests/queue?barId=${barId}`);

export const fetchServedTonight = (barId: number, take = 50) =>
  request<PourRequestDto[]>(
    `/api/v1/pour-requests/served-tonight?barId=${barId}&take=${take}`,
  );

export const fetchPourRequest = (id: number) =>
  request<PourRequestDto>(`/api/v1/pour-requests/${id}`);

export type FoodOrderItemDto = {
  menuItemId?: number | null;
  name: string;
  qty: number;
  price: number; // rupees
  unitPriceInPaise?: number;
  lineTotalInPaise?: number;
  specialInstructions?: string | null;
};

export type FoodOrderDto = {
  id: number;
  barId?: number;
  tableId?: number | null;
  customer?: string | null;
  timeLabel: string;
  status: "Pending" | "In preparation" | "Served" | "Cancelled" | string;
  items: FoodOrderItemDto[];
  subtotal?: number;
  gst?: number;
  serviceCharge?: number;
  total: number; // rupees
  totalInPaise?: number;
  paymentStatus?: string;
};

export const fetchActiveFoodOrders = (barId: number) =>
  request<FoodOrderDto[]>(`/api/v1/bars/${barId}/food-orders`);

export type MenuItemDto = {
  id: number;
  barId: number;
  name: string;
  description?: string | null;
  category: string;
  priceInPaise: number;
  price: number;
  imageUrl?: string | null;
  isVeg: boolean;
  spiceLevel?: string | null;
  allergens?: string | null;
  isAvailable: boolean;
  isHighlighted: boolean;
  displayOrder: number;
};

export type UpsertMenuItemPayload = {
  name: string;
  description?: string | null;
  category: string;
  priceInPaise: number;
  imageUrl?: string | null;
  isVeg: boolean;
  spiceLevel?: string | null;
  allergens?: string | null;
  isAvailable: boolean;
  isHighlighted: boolean;
  displayOrder: number;
};

export type CreateFoodOrderPayload = {
  barId: number;
  tableId?: number | null;
  customer?: string | null;
  items: Array<{
    menuItemId?: number | null;
    name: string;
    qty: number;
    unitPriceInPaise: number;
    specialInstructions?: string | null;
  }>;
  gstPercent?: number;
  serviceChargePercent?: number;
  specialInstructions?: string | null;
};

export const listMenuItems = (barId: number, includeUnavailable = true) =>
  request<MenuItemDto[]>(
    `/api/v1/bars/${barId}/menu?includeUnavailable=${includeUnavailable}`,
  );

export const createMenuItem = (barId: number, payload: UpsertMenuItemPayload) =>
  request<MenuItemDto>(`/api/v1/bars/${barId}/menu`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateMenuItem = (id: number, payload: UpsertMenuItemPayload) =>
  request<MenuItemDto>(`/api/v1/menu-items/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const setMenuItemAvailability = (id: number, isAvailable: boolean) =>
  request<MenuItemDto>(`/api/v1/menu-items/${id}/availability`, {
    method: "PUT",
    body: JSON.stringify({ isAvailable }),
  });

export const deleteMenuItem = (id: number) =>
  request<void>(`/api/v1/menu-items/${id}`, { method: "DELETE" });

export const createFoodOrder = (payload: CreateFoodOrderPayload) =>
  request<FoodOrderDto>("/api/v1/food-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const acceptFoodOrder = (id: number) =>
  request<FoodOrderDto>(`/api/v1/food-orders/${id}/accept`, { method: "PUT" });

export const prepareFoodOrder = (id: number) =>
  request<FoodOrderDto>(`/api/v1/food-orders/${id}/preparing`, {
    method: "PUT",
  });

export const serveFoodOrder = (id: number) =>
  request<FoodOrderDto>(`/api/v1/food-orders/${id}/serve`, { method: "PUT" });

export const cancelFoodOrder = (id: number, reason?: string | null) =>
  request<FoodOrderDto>(`/api/v1/food-orders/${id}/cancel`, {
    method: "PUT",
    body: JSON.stringify({ reason: reason ?? null }),
  });

export const settleFoodOrder = (id: number) =>
  request<FoodOrderDto>(`/api/v1/food-orders/${id}/settle`, {
    method: "POST",
  });

export const servePourRequest = (
  id: number,
  servedMl: number,
  staffNotes?: string | null,
) =>
  request<PourRequestDto>(`/api/v1/pour-requests/${id}/serve`, {
    method: "PUT",
    body: JSON.stringify({ servedMl, staffNotes: staffNotes ?? null }),
  });

export const rejectPourRequest = (id: number, reason: string) =>
  request<PourRequestDto>(`/api/v1/pour-requests/${id}/cancel`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });

// ---------------------------------------------------------------------------
//  Phase 6 — Offers, Loyalty, Campaigns (bar-owner surface)
// ---------------------------------------------------------------------------

export type OfferType = "HappyHour" | "BrandPromo" | "FlashPrice" | "Referral";
export type DiscountType = "Percent" | "FlatAmount" | "BuyXGetY";

export type OfferDto = {
  id: number;
  barId: number;
  offerType: OfferType;
  title: string;
  description: string | null;
  bannerImageUrl: string | null;
  discountType: DiscountType;
  discountPercent: number | null;
  discountAmountInPaise: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  maxDiscountAmountInPaise: number | null;
  minSpendInPaise: number | null;
  applicableBottleCatalogueId: number | null;
  startsOn: string;
  endsOn: string;
  recurringDaysOfWeek: string | null;
  recurringStartTime: string | null;
  recurringEndTime: string | null;
  maxRedemptionsTotal: number | null;
  maxRedemptionsPerUser: number | null;
  redemptionCount: number;
  isActive: boolean;
  priority: number;
  createdAtUtc: string;
};

export type CreateOfferPayload = {
  offerType: OfferType;
  title: string;
  description?: string | null;
  bannerImageUrl?: string | null;
  discountType: DiscountType;
  discountPercent?: number | null;
  discountAmountInPaise?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  maxDiscountAmountInPaise?: number | null;
  minSpendInPaise?: number | null;
  applicableBottleCatalogueId?: number | null;
  startsOn: string;
  endsOn: string;
  recurringDaysOfWeek?: string | null;
  recurringStartTime?: string | null;
  recurringEndTime?: string | null;
  maxRedemptionsTotal?: number | null;
  maxRedemptionsPerUser?: number | null;
  priority?: number;
};

export const listOffers = (barId: number, includeInactive = false) =>
  request<OfferDto[]>(
    `/api/v1/bars/${barId}/offers?includeInactive=${includeInactive}`,
  );

export const createOffer = (barId: number, payload: CreateOfferPayload) =>
  request<OfferDto>(`/api/v1/bars/${barId}/offers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const setOfferActive = (offerId: number, isActive: boolean) =>
  request<OfferDto>(`/api/v1/offers/${offerId}/active`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });

export const getOfferById = (offerId: number) =>
  request<OfferDto>(`/api/v1/offers/${offerId}`);

export const updateOffer = (offerId: number, payload: CreateOfferPayload) =>
  request<OfferDto>(`/api/v1/offers/${offerId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteOffer = (offerId: number) =>
  request<void>(`/api/v1/offers/${offerId}`, { method: "DELETE" });

// ---- Loyalty programme (bar-owner) ----

export type ProgrammeDto = {
  id: number;
  barId: number;
  name: string;
  description: string | null;
  pointsPerRupeeSpent: number;
  pointsPerRedemption: number;
  redemptionValueInPaise: number;
  minPointsForRedemption: number;
  maxRedemptionPctOfPurchase: number;
  pointsExpiryDays: number | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
};

export type ConfigureProgrammePayload = Omit<ProgrammeDto, "id" | "barId">;

export type ProgrammeStatsDto = {
  memberCount: number;
  pointsEarnedThisMonth: number;
  pointsRedeemedThisMonth: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
};

export const getLoyaltyProgramme = (barId: number) =>
  request<ProgrammeDto | undefined>(`/api/v1/bars/${barId}/loyalty/programme`);

export const saveLoyaltyProgramme = (
  barId: number,
  payload: ConfigureProgrammePayload,
) =>
  request<ProgrammeDto>(`/api/v1/bars/${barId}/loyalty/programme`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getLoyaltyStats = (barId: number) =>
  request<ProgrammeStatsDto>(`/api/v1/bars/${barId}/loyalty/stats`);

// ---- Campaigns ----

export type DormantUserDto = {
  userId: number;
  fullName: string | null;
  mobileNumber: string;
  walletId: number;
  bottleCatalogueId: number;
  bottleBrandName: string;
  bottleProductName: string;
  purchasedVolumeMl: number;
  remainingVolumeMl: number;
  lastConsumedAtUtc: string | null;
  daysSinceLastActivity: number;
  atMonthlyCap: boolean;
};

export type CampaignResultDto = {
  campaignId: string;
  enqueuedCount: number;
  skippedCount: number;
  skipped: { userId: number; reason: string }[];
};

export type CampaignHistoryDto = {
  campaignId: string;
  subject: string | null;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAtUtc: string;
};

export const listDormantUsers = (barId: number, daysInactive = 30) =>
  request<DormantUserDto[]>(
    `/api/v1/bars/${barId}/campaigns/dormant-users?daysInactive=${daysInactive}`,
  );

export const createCampaign = (
  barId: number,
  payload: {
    subject: string;
    bodyTemplate: string;
    userIds: number[];
    channels?: ("Push" | "Whatsapp")[];
  },
) =>
  request<CampaignResultDto>(`/api/v1/bars/${barId}/campaigns`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listCampaigns = (barId: number, take = 25) =>
  request<CampaignHistoryDto[]>(`/api/v1/bars/${barId}/campaigns?take=${take}`);

// ---------------------------------------------------------------------------
//  Phase 7 — Dashboard, Revenue, Staff
// ---------------------------------------------------------------------------

export type DashboardKpisDto = {
  walletRevenueMtdInPaise: number;
  activeWalletCount: number;
  averageWalletSpendInPaise: number;
  expiryRiskCount: number;
};

export type RevenueChartPointDto = {
  day: string;
  revenueInPaise: number;
  paymentCount: number;
  isToday: boolean;
};

export type TopBottleDto = {
  bottleCatalogueId: number;
  brandName: string;
  productName: string;
  revenueInPaise: number;
  walletCount: number;
};

export type RecentTransactionDto = {
  paymentId: number;
  purpose: string;
  amountInPaise: number;
  paymentMethod: string | null;
  status: string;
  capturedAtUtc: string;
};

export type DashboardDto = {
  kpis: DashboardKpisDto;
  revenueChart: RevenueChartPointDto[];
  topBottles: TopBottleDto[];
  recentTransactions: RecentTransactionDto[];
  subscription: SubscriptionStatusDto | null;
};

export const getDashboard = (barId: number) =>
  request<DashboardDto>(`/api/v1/bars/${barId}/dashboard`);

// ---- Revenue ----

export type RevenueRangePreset =
  | "ThisMonth"
  | "LastMonth"
  | "Last3Months"
  | "Custom";

export type GstRowDto = {
  exGstInPaise: number;
  gstInPaise: number;
  inclGstInPaise: number;
};

export type GstSummaryDto = {
  gstPercent: number;
  walletPurchases: GstRowDto;
  foodOrders: GstRowDto;
  total: GstRowDto;
};

export type RevenueKpisDto = {
  totalWalletRevenueInPaise: number;
  averageWalletCustomerSpendInPaise: number;
  repeatVisitRatePct: number;
  additionalFoodRevenueInPaise: number;
  distinctWalletCustomerCount: number;
};

export type WalletVsWalkInDto = {
  walletRepeatRatePct: number;
  walkInRepeatRatePct: number | null;
  walletCustomerCount: number;
  insightCopy: string | null;
};

export type RevenueReportDto = {
  fromDate: string;
  toDate: string;
  rangeLabel: string;
  kpis: RevenueKpisDto;
  comparison: WalletVsWalkInDto;
  gst: GstSummaryDto;
};

export const getRevenueReport = (
  barId: number,
  preset: RevenueRangePreset = "ThisMonth",
  from?: string,
  to?: string,
) => {
  const q = new URLSearchParams({ preset });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<RevenueReportDto>(
    `/api/v1/bars/${barId}/revenue?${q.toString()}`,
  );
};

// ---- Wallet purchases ----

export type BarWalletPurchaseListItemDto = {
  paymentId: number;
  walletId: number | null;
  customerName: string;
  customerMobile: string;
  bottleName: string;
  volumeMl: number | null;
  amountInPaise: number;
  paymentMethod: string | null;
  status: string;
  createdAtUtc: string;
  capturedAtUtc: string | null;
  remainingVolumeMl: number | null;
};

export type BarWalletCustomerDto = {
  userId: number | null;
  name: string;
  mobileNumber: string;
  email: string | null;
};

export type BarWalletBottleDto = {
  bottleCatalogueId: number | null;
  name: string;
  category: string | null;
  imageUrl: string | null;
};

export type BarWalletStateDto = {
  walletId: number;
  purchasedVolumeMl: number;
  remainingVolumeMl: number;
  consumedVolumeMl: number;
  status: string;
  expiresOn: string | null;
  createdAtUtc: string;
};

export type BarWalletTransactionDto = {
  id: number;
  transactionType: string;
  volumeMlDelta: number;
  balanceAfterMl: number;
  purchasedAfterMl: number;
  paymentId: number | null;
  pourRequestId: number | null;
  notes: string | null;
  createdAtUtc: string;
};

export type BarWalletPourDto = {
  pourRequestId: number;
  requestedMl: number;
  servedMl: number | null;
  status: string;
  servedAtUtc: string | null;
  userNotes: string | null;
};

export type BarWalletPurchaseDetailDto = {
  summary: BarWalletPurchaseListItemDto;
  customer: BarWalletCustomerDto;
  bottle: BarWalletBottleDto;
  wallet: BarWalletStateDto | null;
  transactions: BarWalletTransactionDto[];
  pourHistory: BarWalletPourDto[];
};

export const listWalletPurchases = (barId: number, skip = 0, take = 50) => {
  assertValidBarId(barId);
  const q = new URLSearchParams({ skip: String(skip), take: String(take) });
  return request<BarWalletPurchaseListItemDto[]>(
    `/api/v1/bars/${barId}/wallet-purchases?${q.toString()}`,
  );
};

export const getWalletPurchaseDetail = (barId: number, paymentId: number) => {
  assertValidBarId(barId);
  return request<BarWalletPurchaseDetailDto>(
    `/api/v1/bars/${barId}/wallet-purchases/${paymentId}`,
  );
};

/**
 * Triggers a file download by fetching the export endpoint directly and
 * streaming the blob into an anchor click.  We don't go through `request()`
 * because we need the raw Response to read bytes + filename headers.
 */
export async function downloadRevenueExport(
  barId: number,
  format: "pdf" | "csv",
  preset: RevenueRangePreset = "ThisMonth",
  from?: string,
  to?: string,
): Promise<void> {
  const q = new URLSearchParams({ format, preset });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = window.sessionStorage.getItem(
      "sipsave-barowner-access-token",
    );
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(
    `${BASE_URL}/api/v1/bars/${barId}/revenue/export?${q.toString()}`,
    { headers },
  );
  if (!res.ok)
    throw new ApiError(
      res.status,
      res.statusText,
      await res.text().catch(() => null),
    );
  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ??
    `revenue.${format}`;
  triggerDownload(blob, filename);
}

function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return m ? decodeURIComponent(m[1]) : null;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Staff ----

export type StaffRowDto = {
  id: number;
  barId: number;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  role: "Manager" | "Bartender";
  isActive: boolean;
  mustResetPassword: boolean;
  lastLoginAtUtc: string | null;
  lockedUntilUtc: string | null;
  poursToday: number;
  createdAtUtc: string;
};

export type CreateStaffPayload = {
  fullName: string;
  mobileNumber: string;
  email?: string | null;
  password: string;
  role: "Manager" | "Bartender";
  sendEmail?: boolean;
};

export type UpdateStaffPayload = {
  fullName: string;
  mobileNumber: string;
  email?: string | null;
  role: "Manager" | "Bartender";
  password?: string | null;
  sendEmail?: boolean;
};

export const listStaff = (barId: number) =>
  request<StaffRowDto[]>(`/api/v1/bars/${barId}/staff`);

export type ShiftHandoverPayload = {
  bartenderId?: number | null;
  handoverToStaffId?: number | null;
  handoverToName?: string | null;
  notes?: string | null;
  barId?: number | null;
};

export const postShiftHandover = (payload: ShiftHandoverPayload) =>
  request<ShiftHandoverPayload>(`/api/v1/shifts/handover`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const createStaff = (barId: number, payload: CreateStaffPayload) =>
  request<StaffRowDto>(`/api/v1/bars/${barId}/staff`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getStaffById = (staffId: number) =>
  request<StaffRowDto>(`/api/v1/staff/${staffId}`);

export const updateStaff = (staffId: number, payload: UpdateStaffPayload) =>
  request<StaffRowDto>(`/api/v1/staff/${staffId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const setStaffActive = (staffId: number, isActive: boolean) =>
  request<StaffRowDto>(`/api/v1/staff/${staffId}/active`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });

// ---------------------------------------------------------------------------
//  Tables & QR codes
// ---------------------------------------------------------------------------

export type BarTable = {
  id: number;
  barId: number;
  tableNumber: string;
  qrToken: string;
  capacity: number | null;
  floorSection: string | null;
  isActive: boolean;
  createdAtUtc: string;
  imageData: string | null;
};

export type CreateBarTableSpec = {
  tableNumber: string;
  capacity?: number | null;
  floorSection?: string | null;
};

export const listBarTables = (barId: number) => {
  assertValidBarId(barId);
  return request<BarTable[]>(`/api/v1/bars/${barId}/tables`);
};

export const listBarTablesWithStatus = (barId: number) => {
  assertValidBarId(barId);
  return request<BarTableStatusDto[]>(
    `/api/v1/bars/${barId}/tables/availability`,
  );
};

export const createBarTables = (barId: number, tables: CreateBarTableSpec[]) =>
  request<BarTable[]>(`/api/v1/bars/${barId}/tables`, {
    method: "POST",
    body: JSON.stringify({ tables }),
  });

export async function downloadBarTableQrPng(
  barId: number,
  tableId: number,
  tableNumber: string,
): Promise<void> {
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = window.sessionStorage.getItem(
      "sipsave-barowner-access-token",
    );
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(
    `${BASE_URL}/api/v1/bars/${barId}/tables/${tableId}/qr-code`,
    { headers },
  );
  if (!res.ok)
    throw new ApiError(
      res.status,
      res.statusText,
      await res.text().catch(() => null),
    );
  const blob = await res.blob();
  triggerDownload(blob, `table-${tableNumber}-qr.png`);
}

export async function downloadBarTableQrBundle(barId: number): Promise<void> {
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = window.sessionStorage.getItem(
      "sipsave-barowner-access-token",
    );
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${BASE_URL}/api/v1/bars/${barId}/qr-codes`, {
    headers,
  });
  if (!res.ok)
    throw new ApiError(
      res.status,
      res.statusText,
      await res.text().catch(() => null),
    );
  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ??
    `sipsave-table-qr-codes-bar-${barId}.pdf`;
  triggerDownload(blob, filename);
}
