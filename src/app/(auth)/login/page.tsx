"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ui";
import {
  ApiError,
  getBarDetails,
  getDashboard,
  loginOwner,
  loginStaff,
  type BarDetails,
  type VerifyOtpResponse,
  type StaffLoginResponse,
} from "@/lib/api-client";
import {
  clearActiveBarId,
  setActiveBarDetails,
  setActiveBarId,
} from "@/lib/active-bar";
import { clearKycStatus, saveKycStatus, parseKycStatusFromApi } from "@/lib/kyc-status";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function BarOwnerLoginPage() {
  const router = useRouter();
  const [isFlipped, setIsFlipped] = useState(false);
  const [staffSessionNotice, setStaffSessionNotice] = useState<string | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const isStaffMode = params.get("staff") === "1";
    if (isStaffMode) setIsFlipped(true);
    if (params.get("reset") === "1") {
      const resetMessage = "Your password has been reset. Please sign in with the new password.";
      if (isStaffMode) {
        setStaffSessionNotice(resetMessage);
      } else {
        setNotice(resetMessage);
      }
    }
    const reason = params.get("reason");
    if (reason === "expired") {
      setStaffSessionNotice(
        "Your shift session has expired. Please log in again.",
      );
    } else if (reason === "unauthorized") {
      setStaffSessionNotice("You have been signed out. Please log in again.");
    }
  }, []);

  async function handleOwnerLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      const response = await loginOwner({
        email: normalizedEmail,
        password,
      });
      await handleSuccessfulOwnerLogin(response);
    } catch (err) {
      setError(readApiMessage(err, "Invalid email or password. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSuccessfulOwnerLogin(response: VerifyOtpResponse) {
    clearActiveBarId();
    clearKycStatus();
    persistOwnerSession(response);

    if (response.user.mustResetPassword) {
      router.replace("/change-password");
      return;
    }

    const kycData = parseKycStatusFromApi(
      response.user.kycStatus,
      response.user.kycRejectionReason,
    );

    if (kycData) {
      saveKycStatus(kycData);

      try {
        const bar = await getBarDetails();
        if (!bar.isEmailVerified) {
          clearActiveBarId();
          setNotice(getBarAccessMessage(bar));
          return;
        }
        persistBarDetails(bar);

        const dashboard = await getDashboard(bar.barId);
        if (dashboard.subscription) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        if (kycData.status === "user_approved") {
          clearActiveBarId();
          router.replace("/register/kyc-status");
          return;
        }
      }

      router.replace("/register/kyc-status");
      return;
    }

    let bar: BarDetails;
    try {
      bar = await getBarDetails();
    } catch (err) {
      setError(
        readApiMessage(
          err,
          "Login succeeded, but we could not load your bar details. Please try again.",
        ),
      );
      return;
    }

    if (!bar.isEmailVerified || !bar.isVerified || !bar.isActive) {
      clearActiveBarId();
      setNotice(getBarAccessMessage(bar));
      return;
    }

    persistBarDetails(bar);
    router.replace("/inventory");
  }

  return (
    <div className="flip-container w-full max-w-md">
      <div className={`flip-card ${isFlipped ? "flipped" : ""}`}>
        {/* FRONT: Bar Owner Login */}
        <div className="flip-card-front">
          <div className="w-full">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display font-semibold text-accent">
                  S
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">SipSave</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent-lo">
                    Noir Console
                  </p>
                </div>
              </div>
            </div>

            <header className="mb-6">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
                Secure email sign-in
              </p>
              <h1 className="mt-2 font-display text-4xl leading-tight text-ink">
                Owner Login
              </h1>
              <span className="gold-rule mb-3 mt-3" aria-hidden="true" />
              <p className="text-sm text-muted">
                Use your registered owner email and password to access the
                dashboard.
              </p>
            </header>

            <form onSubmit={handleOwnerLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="ownerEmail" className="field-label">
                  Email address
                </label>
                <input
                  id="ownerEmail"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="input"
                  placeholder="owner@bar.com"
                />
              </div>

              <div>
                <label htmlFor="ownerPassword" className="field-label">
                  Password
                </label>
                <input
                  id="ownerPassword"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input"
                  placeholder="••••••••"
                />
                <div className="mt-2 flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-accent-lo transition hover:text-ink"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}
              {notice && (
                <NoticeCard
                  title="Bar access pending"
                  message={notice}
                  actionHref="/register"
                  actionText="Register your bar"
                />
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary w-full"
              >
                {busy ? "Signing in..." : "Sign in"}
              </button>

              <div className="pt-2 text-center">
                <p className="mb-2 text-xs text-soft">New bar owner?</p>
                <Link href="/register" className="btn btn-ghost btn-sm">
                  Register your bar
                </Link>
              </div>
              <p className="pt-2 text-center text-xs text-soft">
                Trouble signing in? Contact support.
              </p>
            </form>

            <div className="mt-8 pt-6 border-t border-strong/30 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-soft mb-3">
                Shift Personnel?
              </p>
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="btn btn-secondary w-full"
              >
                Staff Login
              </button>
            </div>
          </div>
        </div>

        {/* BACK: Staff Login */}
        <div className="flip-card-back">
          <StaffLoginForm
            onBack={() => {
              setIsFlipped(false);
              setStaffSessionNotice(null);
            }}
            sessionNotice={staffSessionNotice}
          />
        </div>
      </div>
    </div>
  );
}

function StaffLoginForm({
  onBack,
  sessionNotice,
}: {
  onBack: () => void;
  sessionNotice?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Please enter a valid email address and password.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      const response = await loginStaff({
        email: normalizedEmail,
        password,
      });
      persistStaffSession(response);
      if (response.mustResetPassword) {
        router.replace("/change-password?staff=1");
        return;
      }
      router.push("/floor");
    } catch (err) {
      setError(readApiMessage(err, "Invalid email or password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display font-semibold text-accent">
            S
          </div>
          <div>
            <p className="font-display text-lg leading-tight">SipSave</p>
            <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent-lo">
              Noir Console
            </p>
          </div>
        </div>
      </div>

      <header className="mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
          Staff Terminal Access
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-ink">
          Staff Login.
        </h1>
        <span className="gold-rule mb-3 mt-3" aria-hidden="true" />
        <p className="text-sm text-muted">
          Enter your registered email address and password to begin your shift.
        </p>
      </header>

      {sessionNotice && (
        <div className="mb-4 rounded-lg border border-[color:var(--color-warning)] bg-[color:var(--color-warning-tint)] px-4 py-3 text-sm font-semibold text-[color:var(--color-text)]">
          {sessionNotice}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div>
          <label htmlFor="staffEmail" className="field-label">
            Email address
          </label>
          <input
            id="staffEmail"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
            placeholder="staff@bar.com"
          />
        </div>

        <div>
          <label htmlFor="staffPassword" className="field-label">
            Password
          </label>
          <input
            id="staffPassword"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
            placeholder="••••••••"
          />
          <div className="mt-2 flex justify-end">
            <Link
              href="/forgot-password?staff=1"
              className="text-xs font-semibold text-accent-lo transition hover:text-ink"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Verifying..." : "Login to Terminal"}
        </button>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onBack}
            className="btn btn-ghost btn-sm"
          >
            ← Back to Owner Login
          </button>
        </div>
      </form>
    </div>
  );
}

function persistOwnerSession(response: VerifyOtpResponse): void {
  window.sessionStorage.setItem(
    "sipsave-barowner-access-token",
    response.tokens.accessToken,
  );
  window.sessionStorage.setItem(
    "sipsave-barowner-refresh-token",
    response.tokens.refreshToken,
  );
  window.sessionStorage.setItem(
    "sipsave-barowner-token-type",
    response.tokens.tokenType,
  );
  window.sessionStorage.setItem(
    "sipsave-barowner-access-token-expires-at",
    response.tokens.accessTokenExpiresAtUtc,
  );
  window.sessionStorage.setItem(
    "sipsave-barowner-user",
    JSON.stringify(response.user),
  );

  if (response.user.email)
    window.sessionStorage.setItem(
      "sipsave-barowner-email",
      response.user.email,
    );
  if (response.user.fullName)
    window.sessionStorage.setItem(
      "sipsave-barowner-full-name",
      response.user.fullName,
    );
  if (response.user.barId && response.user.barId > 0)
    setActiveBarId(response.user.barId);
}

function persistStaffSession(response: StaffLoginResponse): void {
  window.sessionStorage.setItem(
    "sipsave-staff-access-token",
    response.accessToken,
  );
  window.sessionStorage.setItem(
    "sipsave-staff-access-token-expires-at",
    response.expiresAtUtc,
  );

  const userObj = {
    id: response.staffId,
    fullName: response.fullName,
    role: response.role,
    barId: response.barId,
    email: response.email ?? null,
    mustResetPassword: response.mustResetPassword,
  };
  window.sessionStorage.setItem("sipsave-staff-user", JSON.stringify(userObj));

  if (response.email)
    window.sessionStorage.setItem("sipsave-staff-email", response.email);
  if (response.fullName)
    window.sessionStorage.setItem("sipsave-staff-full-name", response.fullName);
  if (response.barId && response.barId > 0) setActiveBarId(response.barId);
}

function persistBarDetails(bar: BarDetails): void {
  setActiveBarDetails(bar);
}

function getBarAccessMessage(bar: BarDetails): string {
  const status = bar.verificationQueueMessage?.trim();
  if (!bar.isEmailVerified) {
    return `${bar.businessName} email is not verified yet. Please verify the email sent to your registered inbox before opening the owner dashboard.`;
  }
  if (!bar.isVerified) {
    return (
      status ||
      `${bar.businessName} is not verified yet. Please wait for verification before opening the owner dashboard.`
    );
  }
  if (!bar.isActive) {
    return (
      status ||
      `${bar.businessName} is not active right now. Please contact support to activate your bar.`
    );
  }
  return status || `${bar.businessName} is not ready for dashboard access yet.`;
}

function NoticeCard({
  title,
  message,
  actionHref,
  actionText,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionText?: string;
}) {
  return (
    <div
      role="alertdialog"
      className="rounded-lg border border-[color:rgb(184_134_11/0.35)] bg-accent-tint px-4 py-3 text-sm text-accent-lo"
    >
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1">{message}</p>
      {actionHref && actionText && (
        <Link href={actionHref} className="btn btn-ghost btn-sm mt-3">
          {actionText}
        </Link>
      )}
    </div>
  );
}

function readApiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const body = err.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.message === "string") return record.message;
    if (typeof record.title === "string") return record.title;
  }
  return err.message || fallback;
}
