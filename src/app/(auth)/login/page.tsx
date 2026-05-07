'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorBanner } from '@/components/ui';

export default function BarOwnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (email.trim() && password) {
        window.sessionStorage.setItem('sipsave-barowner-access-token', `mock-token-${Date.now()}`);
        window.sessionStorage.setItem('sipsave-barowner-email', email);
        router.replace('/inventory');
      } else {
        setError('Please enter valid email and password.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display font-semibold text-accent">
            S
          </div>
          <div>
            <p className="font-display text-lg leading-tight">SipSave</p>
            <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent-lo">Noir Console</p>
          </div>
        </div>
      </div>

      <header className="mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-lo">
          Secure sign-in
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-ink">Welcome back.</h1>
        <span className="gold-rule mb-3 mt-3" aria-hidden="true" />
        <p className="text-sm text-muted">
          Access your bar owner dashboard. All sign-ins are logged for compliance.
        </p>
      </header>

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="field-label">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            aria-invalid={error ? 'true' : undefined}
            className="input"
            placeholder="owner@yourbar.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            aria-invalid={error ? 'true' : undefined}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? 'Signing in...' : 'Continue'}
        </button>

        {process.env.NEXT_PUBLIC_USE_MOCK !== '0' && (
          <div className="mt-4 rounded-md border border-dashed border-strong bg-accent-tint/50 px-3 py-2 text-[0.7rem] leading-relaxed text-accent-lo">
            <strong className="uppercase tracking-wider">Demo mode</strong> - enter any email + any
            password to sign in.
          </div>
        )}

        <div className="pt-2 text-center">
          <p className="mb-2 text-xs text-soft">New bar owner?</p>
          <Link href="/register" className="btn btn-ghost btn-sm">
            Register your bar
          </Link>
        </div>

        <p className="pt-2 text-center text-xs text-soft">Trouble signing in? Contact support.</p>
      </form>
    </div>
  );
}
