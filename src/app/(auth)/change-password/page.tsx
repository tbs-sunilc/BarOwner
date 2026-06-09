"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/ui";
import {
  ApiError,
  changeOwnerPassword,
  changeStaffPassword,
  refreshAuthToken,
} from "@/lib/api-client";
import {
  getStaffAccessToken,
  getStoredStaffUser,
  isStaffSessionValid,
  redirectToStaffLogin,
  type StaffSessionUser,
} from "@/lib/staff-session";

const MIN_PASSWORD_LENGTH = 8;
const OWNER_USER_KEY = "sipsave-barowner-user";
const OWNER_TOKEN_KEY = "sipsave-barowner-access-token";
const OWNER_REFRESH_TOKEN_KEY = "sipsave-barowner-refresh-token";
const OWNER_TOKEN_EXPIRES_KEY = "sipsave-barowner-access-token-expires-at";

type StoredOwnerUser = {
  mustResetPassword?: boolean;
  email?: string | null;
  fullName?: string | null;
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [isStaffFlow, setIsStaffFlow] = useState(false);
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const staffFlow = params.get("staff") === "1";
    setIsStaffFlow(staffFlow);

    if (staffFlow) {
      const token = getStaffAccessToken();
      const user = getStoredStaffUser();

      if (!token || !user) {
        redirectToStaffLogin("unauthorized");
        return;
      }

      if (!isStaffSessionValid()) {
        redirectToStaffLogin("expired");
        return;
      }

      if (!user.mustResetPassword) {
        router.replace("/floor");
        return;
      }

      setReady(true);
      return;
    }

    const token = window.sessionStorage.getItem(OWNER_TOKEN_KEY);
    if (!token) {
      router.replace("/login");
      return;
    }

    const user = getStoredOwnerUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    if (!user.mustResetPassword) {
      router.replace("/dashboard");
      return;
    }

    const expiresAtRaw = window.sessionStorage.getItem(
      OWNER_TOKEN_EXPIRES_KEY,
    );
    const isExpired = expiresAtRaw
      ? Date.now() >= Date.parse(expiresAtRaw)
      : false;

    if (!isExpired) {
      setReady(true);
      return;
    }

    const refreshToken = window.sessionStorage.getItem(
      OWNER_REFRESH_TOKEN_KEY,
    );
    if (!refreshToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await refreshAuthToken(refreshToken);
        if (cancelled) return;

        persistRefreshedOwnerSession(response.tokens, response.user);
        if (response.user?.mustResetPassword === false) {
          router.replace("/dashboard");
          return;
        }

        setReady(true);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (isStaffFlow) {
        await changeStaffPassword({ newPassword });
        markStaffPasswordChanged();
        setSuccess("Password updated. Redirecting to your floor...");
        window.setTimeout(() => {
          router.replace("/floor");
        }, 900);
      } else {
        await changeOwnerPassword({ newPassword });
        markOwnerPasswordChanged();
        setSuccess("Password updated. Redirecting to your dashboard...");
        window.setTimeout(() => {
          router.replace("/dashboard");
        }, 900);
      }
    } catch (err) {
      setError(
        readApiMessage(err, "Could not update your password. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="auth-fit auth-compact w-full max-w-md">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
        {isStaffFlow ? "Staff access" : "First-time sign-in"}
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Set a New Password
      </h1>
      <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-muted">
        {isStaffFlow
          ? "Your temporary password has been accepted. Choose a permanent password to continue into the staff terminal."
          : "Your temporary password has been accepted. Choose a permanent password to continue into the owner dashboard."}
      </p>

      {success ? (
        <div className="card-raised mt-5 border-l-4 border-[color:var(--color-success)] bg-[color:var(--color-success-tint)] p-4 text-left text-sm text-[color:var(--color-success)]">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div>
          <label htmlFor="newPassword" className="field-label">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="input"
            placeholder="Create a secure password"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="field-label">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="input"
            placeholder="Repeat the new password"
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Updating..." : "Update Password"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-soft">
        {isStaffFlow
          ? "If you need help, contact the bar owner or your supervisor."
          : "If you need help, contact support using the email address linked to your bar."}
      </p>
    </div>
  );
}

function getStoredOwnerUser(): StoredOwnerUser | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(OWNER_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredOwnerUser;
  } catch {
    return null;
  }
}

function markOwnerPasswordChanged(): void {
  if (typeof window === "undefined") return;

  const raw = window.sessionStorage.getItem(OWNER_USER_KEY);
  if (!raw) return;

  try {
    const user = JSON.parse(raw) as StoredOwnerUser;
    user.mustResetPassword = false;
    window.sessionStorage.setItem(OWNER_USER_KEY, JSON.stringify(user));
  } catch {
    // If the stored user payload is malformed, leave the session as-is.
  }
}

function markStaffPasswordChanged(): void {
  if (typeof window === "undefined") return;

  const raw = window.sessionStorage.getItem("sipsave-staff-user");
  if (!raw) return;

  try {
    const user = JSON.parse(raw) as StaffSessionUser;
    user.mustResetPassword = false;
    window.sessionStorage.setItem("sipsave-staff-user", JSON.stringify(user));
  } catch {
    // If the stored user payload is malformed, leave the session as-is.
  }
}

function persistRefreshedOwnerSession(
  tokens: {
    accessToken: string;
    accessTokenExpiresAtUtc: string;
    refreshToken: string;
    refreshTokenExpiresAtUtc: string;
    tokenType: string;
  },
  user?: StoredOwnerUser,
): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    OWNER_TOKEN_KEY,
    tokens.accessToken,
  );
  window.sessionStorage.setItem(
    "sipsave-barowner-refresh-token",
    tokens.refreshToken,
  );
  window.sessionStorage.setItem(
    "sipsave-barowner-token-type",
    tokens.tokenType,
  );
  window.sessionStorage.setItem(
    OWNER_TOKEN_EXPIRES_KEY,
    tokens.accessTokenExpiresAtUtc,
  );

  if (user) {
    window.sessionStorage.setItem(OWNER_USER_KEY, JSON.stringify(user));
    if (user.email) {
      window.sessionStorage.setItem("sipsave-barowner-email", user.email);
    }
    if (user.fullName) {
      window.sessionStorage.setItem(
        "sipsave-barowner-full-name",
        user.fullName,
      );
    }
  }
}

function readApiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const body = err.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string" && record.detail.trim()) {
      return record.detail;
    }
    if (typeof record.title === "string" && record.title.trim()) {
      return record.title;
    }
  }
  return err.message || fallback;
}
