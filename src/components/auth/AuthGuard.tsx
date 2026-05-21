'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  STAFF_TOKEN_KEY,
  clearStaffSession,
  isStaffSessionValid,
  redirectToStaffLogin,
} from '@/lib/staff-session';

type AuthGuardProps = {
  children: ReactNode;
  allowedTokens: string[];
  fallbackPath?: string;
};

const SESSION_CHECK_INTERVAL_MS = 15_000;

function hasValidSession(allowedTokens: string[]): boolean {
  if (typeof window === 'undefined') return false;

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
  fallbackPath = '/login',
}: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const isStaffGuard = allowedTokens.includes(STAFF_TOKEN_KEY);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const enforce = () => {
      if (!hasValidSession(allowedTokens)) {
        if (isStaffGuard) {
          clearStaffSession();
          redirectToStaffLogin('expired');
          return;
        }
        router.replace(fallbackPath);
        return;
      }
      setChecked(true);
    };

    enforce();

    const interval = window.setInterval(enforce, SESSION_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [allowedTokens, fallbackPath, isStaffGuard, router]);

  if (!checked) {
    return null;
  }

  return <>{children}</>;
}
