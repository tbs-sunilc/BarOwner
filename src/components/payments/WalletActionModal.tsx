'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WalletVolumeMl } from '@/lib/api-client';

const DEFAULT_VOLUMES: WalletVolumeMl[] = [750, 1000];

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  errorMessage?: string | null;
  availableVolumes?: readonly WalletVolumeMl[];
  defaultVolumeMl?: WalletVolumeMl;
  tone?: 'violet' | 'emerald';
  onClose: () => void;
  onConfirm: (volumeMl: WalletVolumeMl) => void | Promise<void>;
};

export function WalletActionModal({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  errorMessage = null,
  availableVolumes = DEFAULT_VOLUMES,
  defaultVolumeMl,
  tone = 'violet',
  onClose,
  onConfirm,
}: Props) {
  const volumes = useMemo(
    () => (availableVolumes.length > 0 ? [...availableVolumes] : DEFAULT_VOLUMES),
    [availableVolumes],
  );
  const [selectedVolume, setSelectedVolume] = useState<WalletVolumeMl>(
    defaultVolumeMl ?? volumes[0] ?? 750,
  );

  useEffect(() => {
    if (!open) return;
    const initial =
      (defaultVolumeMl && volumes.includes(defaultVolumeMl) ? defaultVolumeMl : null) ??
      volumes[0] ??
      750;
    setSelectedVolume(initial);
  }, [open, defaultVolumeMl, volumes]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const accent = tone === 'emerald' ? 'emerald' : 'violet';
  const confirmClasses =
    accent === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
      : 'bg-violet-600 hover:bg-violet-700 focus:ring-violet-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-action-title"
      aria-describedby="wallet-action-description"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h3 id="wallet-action-title" className="text-lg font-bold text-slate-900">
              {title}
            </h3>
            <p id="wallet-action-description" className="mt-1 text-sm leading-6 text-slate-500 whitespace-pre-line">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-2 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close payment modal"
          >
            ×
          </button>
        </header>

        <div className="px-6 py-5">
          {errorMessage && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Choose volume
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {volumes.map((volume) => {
                const active = volume === selectedVolume;
                const activeClasses =
                  accent === 'emerald'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-violet-500 bg-violet-50 text-violet-700';
                return (
                  <button
                    key={volume}
                    type="button"
                    onClick={() => setSelectedVolume(volume)}
                    disabled={busy}
                    className={[
                      'rounded-2xl border px-4 py-4 text-left transition',
                      active
                        ? activeClasses
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                      busy && 'cursor-wait opacity-70',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="text-lg font-black">{volume} ml</div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest opacity-70">
                      Razorpay checkout
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            The secure Razorpay window opens after you continue. You can close this dialog at any time before payment is completed.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(selectedVolume)}
            disabled={busy}
            className={[
              'rounded-xl px-5 py-2.5 text-sm font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2',
              confirmClasses,
              busy && 'cursor-wait opacity-80',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {busy ? 'Preparing checkout…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
