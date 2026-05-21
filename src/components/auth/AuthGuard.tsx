'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AuthGuardProps = {
  children: ReactNode;
  allowedTokens: string[];
  fallbackPath?: string;
};

export default function AuthGuard({
  children,
  allowedTokens,
  fallbackPath = '/login',
}: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasStoredToken = allowedTokens.some((tokenKey) =>
      Boolean(window.sessionStorage.getItem(tokenKey)),
    );

    if (!hasStoredToken) {
      router.replace(fallbackPath);
      return;
    }

    setChecked(true);
  }, [allowedTokens, fallbackPath, router]);

  if (!checked) {
    return null;
  }

  return <>{children}</>;
}
