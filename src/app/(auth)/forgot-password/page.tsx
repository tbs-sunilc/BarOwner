"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ui";
import {
  ApiError,
  requestOwnerPasswordReset,
  requestStaffPasswordReset,
} from "@/lib/api-client";
import { STAFF_EMAIL_KEY } from "@/lib/staff-session";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OWNER_EMAIL_KEY = "sipsave-barowner-email";

export default function ForgotPasswordPage() {
  const [isStaffFlow, setIsStaffFlow] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const staffFlow = params.get("staff") === "1";
    setIsStaffFlow(staffFlow);

    const storedEmail = window.sessionStorage.getItem(
      staffFlow ? STAFF_EMAIL_KEY : OWNER_EMAIL_KEY,
    );
    if (storedEmail) setEmail(storedEmail);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      if (isStaffFlow) {
        await requestStaffPasswordReset({ email: normalizedEmail });
      } else {
        await requestOwnerPasswordReset({ email: normalizedEmail });
      }
      setSuccess(
        "If an account exists for that email, we sent a password reset link. Please check your inbox and spam folder.",
      );
    } catch (err) {
      setError(
        readApiMessage(
          err,
          "We could not start the password reset flow. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const loginHref = isStaffFlow ? "/login?staff=1" : "/login";
  const successLoginHref = isStaffFlow
    ? "/login?staff=1&reset=1"
    : "/login?reset=1";

  return (
    <div className="auth-fit auth-compact w-full max-w-md">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
        Account recovery
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">
        Forgot Password
      </h1>
      <span className="gold-rule mb-2 mt-2" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-muted">
        {isStaffFlow
          ? "Enter the email address linked to your staff account and we’ll send a secure link to create a new password."
          : "Enter your owner email address and we’ll send a secure link to create a new password."}
      </p>

      {success ? (
        <div className="card-raised mt-5 border-l-4 border-[color:var(--color-success)] bg-[color:var(--color-success-tint)] p-4 text-left text-sm text-[color:var(--color-success)]">
          <p className="font-semibold text-ink">Check your inbox</p>
          <p className="mt-1 leading-relaxed">{success}</p>
        </div>
      ) : null}

      {!success ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="resetEmail" className="field-label">
              Email address
            </label>
            <input
              id="resetEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="input"
              placeholder={isStaffFlow ? "staff@bar.com" : "owner@bar.com"}
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? "Sending link..." : "Send Reset Link"}
          </button>

          <div className="pt-2 text-center">
            <Link href={loginHref} className="btn btn-ghost btn-sm">
              Back to Login
            </Link>
          </div>
        </form>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          <Link href={successLoginHref} className="btn btn-primary">
            Back to Login
          </Link>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="btn btn-ghost"
          >
            Send another link
          </button>
        </div>
      )}
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
