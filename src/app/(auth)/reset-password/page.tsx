"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ui";
import {
  ApiError,
  resetOwnerPassword,
  resetStaffPassword,
} from "@/lib/api-client";
import { clearOwnerSession } from "@/lib/owner-session";
import { clearStaffSession } from "@/lib/staff-session";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isStaffFlow, setIsStaffFlow] = useState(false);
  const [token, setToken] = useState<string>("");
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

    const value = params.get("token") ?? "";
    setToken(value);
    if (!value) {
      setError("This reset link is missing a token.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }

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
        await resetStaffPassword({
          token,
          newPassword,
        });
        clearStaffSession();
        setSuccess("Password updated successfully. Redirecting you to login...");
        window.setTimeout(() => {
          router.replace("/login?staff=1&reset=1");
        }, 900);
      } else {
        await resetOwnerPassword({
          token,
          newPassword,
        });
        clearOwnerSession();
        setSuccess("Password updated successfully. Redirecting you to login...");
        window.setTimeout(() => {
          router.replace("/login?reset=1");
        }, 900);
      }
    } catch (err) {
      setError(
        readApiMessage(
          err,
          "We could not reset your password. The link may have expired.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const forgotHref = isStaffFlow
    ? "/forgot-password?staff=1"
    : "/forgot-password";

  return (
    <div className="auth-fit auth-compact w-full max-w-md">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
        Account recovery
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Set a New Password
      </h1>
      <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-muted">
        {isStaffFlow
          ? "Choose a new password for your staff account. This will replace your current password immediately."
          : "Choose a new password for your owner account. This will replace your current password immediately."}
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
            autoFocus
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
          {busy ? "Resetting..." : "Reset Password"}
        </button>

        <div className="pt-2 text-center">
          <Link href={forgotHref} className="btn btn-ghost btn-sm">
            Request a New Link
          </Link>
        </div>
      </form>
    </div>
  );
}

function readApiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const body = err.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string" && record.detail.trim()) {
      return record.detail;
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.title === "string" && record.title.trim()) {
      return record.title;
    }
  }
  return err.message || fallback;
}
