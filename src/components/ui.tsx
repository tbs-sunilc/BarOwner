'use client';

import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-accent-lo)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance font-display text-4xl leading-tight text-[color:var(--color-text)]">
          {title}
        </h1>
        <span className="gold-rule mb-3 mt-3 inline-block" aria-hidden="true" />
        {subtitle && <p className="text-pretty text-sm text-[color:var(--color-text-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'gold' | 'danger' | 'success';
  index?: number;
}) {
  const toneBar: Record<string, string> = {
    default: 'bg-[color:var(--color-border-strong)]',
    gold: 'bg-[color:var(--color-accent)]',
    danger: 'bg-[color:var(--color-danger)]',
    success: 'bg-[color:var(--color-success)]',
  };

  return (
    <div className="card-raised reveal relative overflow-hidden p-5" style={{ ['--index' as string]: index }}>
      <span className={`absolute bottom-0 left-0 top-0 w-[3px] ${toneBar[tone]}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-2 font-display text-3xl font-medium text-[color:var(--color-text)] font-numeric">
          {value}
        </p>
        {hint && <div className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">{hint}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-raised ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div>
            {title && <h2 className="font-display text-lg leading-snug text-[color:var(--color-text)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={title ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </section>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-[color:rgb(154_46_42/0.3)] bg-[color:var(--color-danger-tint)] px-4 py-3 text-sm text-[color:var(--color-danger)]"
    >
      <span aria-hidden="true">!</span>
      <span>{children}</span>
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-raised p-5">
          <div className="skeleton mb-3 h-2.5 w-20" />
          <div className="skeleton h-8 w-28" />
        </div>
      ))}
    </div>
  );
}
