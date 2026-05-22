"use client";

import { type ReactNode, useEffect, useState } from "react";
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
};

const SESSION_CHECK_INTERVAL_MS = 15_000;

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

export default function AuthGuard({
  children,
  allowedTokens,
  fallbackPath = "/login",
}: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const isStaffGuard = allowedTokens.includes(STAFF_TOKEN_KEY);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enforce = () => {
      if (!hasValidSession(allowedTokens)) {
        if (isStaffGuard) {
          clearStaffSession();
          redirectToStaffLogin("expired");
          return;
        }

        // If we have a refresh token we should offer the user a chance
        // to refresh the session via the popup instead of immediately
        // redirecting them to the login page.
        const hasRefreshToken = Boolean(
          window.sessionStorage.getItem("sipsave-barowner-refresh-token"),
        );

        if (hasRefreshToken) {
          setShowRefreshPopup(true);
          setChecked(true); // render children under the popup
          return;
        }

        router.replace(fallbackPath);
        return;
      }

      setChecked(true);
    };

    const handleExpiredOwnerSession = () => {
      if (!isStaffGuard) {
        setShowRefreshPopup(true);
      }
    };

    const eventHandler = () => handleExpiredOwnerSession();
    window.addEventListener("sipsave-owner-session-expired", eventHandler);
    enforce();

    const interval = window.setInterval(enforce, SESSION_CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener("sipsave-owner-session-expired", eventHandler);
      window.clearInterval(interval);
    };
  }, [allowedTokens, fallbackPath, isStaffGuard, router]);

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

      if (user) {
        window.sessionStorage.setItem(
          "sipsave-barowner-user",
          JSON.stringify(user),
        );
        if (user.email)
          window.sessionStorage.setItem("sipsave-barowner-email", user.email);
        if (user.fullName)
          window.sessionStorage.setItem(
            "sipsave-barowner-full-name",
            user.fullName,
          );
      }

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
            <h2 className="text-xl font-semibold text-slate-900">
              Your session has expired
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your access token expired. Tap Continue to refresh your session
              and keep working.
            </p>
            {refreshError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {refreshError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.replace(fallbackPath)}
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
