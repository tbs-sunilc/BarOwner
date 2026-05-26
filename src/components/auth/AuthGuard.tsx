
"use client";

import { type ReactNode, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshAuthToken } from "@/lib/api-client";

import {
  STAFF_TOKEN_KEY,
  clearStaffSession,
  isStaffSessionValid,
  redirectToStaffLogin,
} from "@/lib/staff-session";

type AuthGuardProps = {
  children: ReactNode;
  allowedTokens: string[];
  fallbackPath?: string;
  inactivityTimeoutMs?: number;
  warningCountdownSeconds?: number;
};

const SESSION_CHECK_INTERVAL_MS = 5_000;

function hasValidSession(allowedTokens: string[]): boolean {
  if (typeof window === "undefined") return false;

  const isStaffRoute = allowedTokens.includes(STAFF_TOKEN_KEY);

  if (isStaffRoute) {
    return isStaffSessionValid();
  }

  return allowedTokens.some((tokenKey) =>
    Boolean(window.sessionStorage.getItem(tokenKey)),
  );
}

function getOwnerTokenExpiry(): Date | null {
  if (typeof window === "undefined") return null;

  const tokenTime = window.sessionStorage.getItem(
    "sipsave-barowner-access-token-expires-at",
  );

  return tokenTime ? new Date(tokenTime) : null;
}

function isOwnerTokenExpired(): boolean {
  const expiresAt = getOwnerTokenExpiry();

  return expiresAt !== null ? Date.now() >= expiresAt.getTime() : false;
}

export default function AuthGuard({
  children,
  allowedTokens,
  fallbackPath = "/login",
  warningCountdownSeconds = 120,
}: AuthGuardProps) {
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Countdown state
  const [countdownTime, setCountdownTime] = useState(warningCountdownSeconds);

  // Refs
  const countdownIntervalRef = useRef<number | null>(null);
  const popupTimeoutRef = useRef<number | null>(null);

  // IMPORTANT: Prevent popup reopening
  const popupShownRef = useRef(false);

  const isStaffGuard = allowedTokens.includes(STAFF_TOKEN_KEY);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let interval: number | undefined;

    /**
     * Clear countdown
     */
    const clearCountdown = () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };

    /**
     * Start countdown timer
     */
    const startCountdown = (seconds: number = warningCountdownSeconds) => {
      clearCountdown();

      let remaining = seconds;

      setCountdownTime(remaining);

      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 1;

        setCountdownTime(remaining);

        if (remaining <= 0) {
          clearCountdown();

          console.log("[AuthGuard] Countdown finished. Logging out...");

          popupShownRef.current = false;

          // Clear session
          window.sessionStorage.clear();

          // Staff cleanup
          clearStaffSession();

          // Redirect
          router.replace(fallbackPath);
        }
      }, 1000) as unknown as number;
    };

    /**
     * Show refresh popup
     */
    const showRefreshForExpiredToken = () => {
      // Prevent reopening popup
      if (popupShownRef.current) return;

      if (!isStaffGuard) {
        popupShownRef.current = true;

        console.log("[AuthGuard] Token expiring. Showing refresh popup...");

        setShowRefreshPopup(true);
        setChecked(true);

        // Start countdown ONLY ONCE
        startCountdown(warningCountdownSeconds);
      }
    };

    /**
     * Schedule popup before token expiry
     */
    const scheduleExpiryCheck = () => {
      if (popupTimeoutRef.current) {
        window.clearTimeout(popupTimeoutRef.current);
      }

      const expiresAt = getOwnerTokenExpiry();

      if (!expiresAt) return;

      const delayMs = expiresAt.getTime() - Date.now();

      // Show popup `warningCountdownSeconds` before expiry
      const showPopupInMs = delayMs - warningCountdownSeconds * 1000;

      if (showPopupInMs <= 0) {
        showRefreshForExpiredToken();
      } else {
        popupTimeoutRef.current = window.setTimeout(() => {
          showRefreshForExpiredToken();
        }, showPopupInMs);
      }
    };

    /**
     * Main auth enforcement
     */
    const enforce = () => {
      /**
       * STAFF AUTH
       */
      if (isStaffGuard) {
        if (!hasValidSession(allowedTokens)) {
          clearStaffSession();
          redirectToStaffLogin("expired");
          return;
        }

        setChecked(true);

        return;
      }

      /**
       * OWNER TOKEN EXPIRED
       */
      if (isOwnerTokenExpired()) {
        const hasRefreshToken = Boolean(
          window.sessionStorage.getItem("sipsave-barowner-refresh-token"),
        );

        if (hasRefreshToken) {
          showRefreshForExpiredToken();
          return;
        }

        // No refresh token → logout
        popupShownRef.current = false;

        window.sessionStorage.clear();

        router.replace(fallbackPath);

        return;
      }

      /**
       * NO VALID SESSION
       */
      if (!hasValidSession(allowedTokens)) {
        popupShownRef.current = false;

        window.sessionStorage.clear();

        router.replace(fallbackPath);

        return;
      }

      setChecked(true);

      // Schedule popup
      scheduleExpiryCheck();
    };

    /**
     * Custom event listener
     */
    const handleExpiredOwnerSession = () => {
      if (!isStaffGuard && isOwnerTokenExpired()) {
        showRefreshForExpiredToken();
      }
    };

    const eventHandler = () => handleExpiredOwnerSession();

    window.addEventListener("sipsave-owner-session-expired", eventHandler);

    /**
     * Initial check
     */
    enforce();

    /**
     * Check every 5 seconds
     */
    interval = window.setInterval(enforce, SESSION_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("sipsave-owner-session-expired", eventHandler);

      if (interval) {
        window.clearInterval(interval);
      }

      clearCountdown();

      if (popupTimeoutRef.current) {
        window.clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [allowedTokens, fallbackPath, isStaffGuard, router, warningCountdownSeconds]);

  /**
   * Refresh token
   */
  const refreshOwnerToken = async () => {
    setRefreshing(true);

    setRefreshError(null);

    if (typeof window === "undefined") {
      setRefreshError("Unable to refresh session on the server.");

      setRefreshing(false);

      return;
    }

    const refreshToken = window.sessionStorage.getItem(
      "sipsave-barowner-refresh-token",
    );

    if (!refreshToken) {
      setRefreshError("Refresh token is missing. Please sign in again.");

      setRefreshing(false);

      return;
    }

    try {
      const response = await refreshAuthToken(refreshToken);

      const { tokens, user } = response;

      /**
       * Save tokens
       */
      window.sessionStorage.setItem(
        "sipsave-barowner-access-token",
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
        "sipsave-barowner-access-token-expires-at",
        tokens.accessTokenExpiresAtUtc,
      );

      /**
       * Save user info
       */
      if (user) {
        window.sessionStorage.setItem(
          "sipsave-barowner-user",
          JSON.stringify(user),
        );

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

      /**
       * Clear countdown
       */
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }

      /**
       * Reset popup flag
       */
      popupShownRef.current = false;

      setShowRefreshPopup(false);

      setRefreshing(false);

      setChecked(true);

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to refresh session.";

      setRefreshError(message);

      setRefreshing(false);
    }
  };

  /**
   * Loading
   */
  if (!checked) {
    return null;
  }

  return (
    <>
      {children}

      {showRefreshPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Session expiring soon
              </h2>

              {/* LIVE COUNTDOWN */}
              <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                {Math.floor(countdownTime / 60)
                  .toString()
                  .padStart(2, "0")}
                :{(countdownTime % 60).toString().padStart(2, "0")}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your session will expire shortly. Continue now to refresh your
              session and keep working without interruption.
            </p>

            {refreshError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {refreshError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  popupShownRef.current = false;

                  window.sessionStorage.clear();

                  router.replace(fallbackPath);
                }}
                className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Sign in again
              </button>

              <button
                type="button"
                onClick={refreshOwnerToken}
                disabled={refreshing}
                className="inline-flex justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Continuing…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
