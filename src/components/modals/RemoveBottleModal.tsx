'use client';

import { useState } from 'react';

/**
 * Inventory "Remove bottle" confirm modal with type-to-confirm input.
 *
 * Removal is destructive: the bottle disappears from history reports for new
 * sales.  The owner must type the bottle's label exactly to enable the
 * confirm button — the same friction Stripe / GitHub uses for dangerous
 * delete actions.  Match is case-insensitive + whitespace-trimmed so a
 * reasonable owner doesn't get punished by muscle-memory.
 *
 * If <code>committedBottleCount &gt; 0</code> the modal blocks outright — we
 * can't orphan customer wallets.  The owner must disable first, wait for
 * wallets to exhaust, then remove.
 */

type Props = {
  bottleLabel: string;
  committedBottleCount?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveBottleModal({
  bottleLabel,
  committedBottleCount = 0,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('');
  const blocked = committedBottleCount > 0;
  const matches = typed.trim().toLowerCase() === bottleLabel.trim().toLowerCase();

  return (
    <Backdrop onDismiss={busy ? undefined : onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-slate-900 text-lg">Remove {bottleLabel}?</h3>

        {blocked ? (
          <>
            <p className="text-sm text-rose-700 mt-2">
              Blocked — <strong>{committedBottleCount}</strong> active customer wallet{committedBottleCount === 1 ? '' : 's'}
              {' '}still tied to this bottle.
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Disable it first (stops new sales) and wait for those wallets to exhaust, expire, or be refunded
              before removing.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 mt-2">
              This removes the bottle from your inventory and future reports.  This cannot be undone.
            </p>

            <label className="block text-xs font-medium text-slate-600 mt-4">
              Type <span className="font-mono text-rose-700">{bottleLabel}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder={bottleLabel}
              className="mt-1 w-full rounded-lg border-slate-300 text-sm font-mono focus:border-rose-500 focus:ring-rose-500"
              aria-label={`Type ${bottleLabel} to confirm removal`}
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={busy}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy || !matches}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg"
              >
                {busy ? 'Removing…' : 'Remove permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (onDismiss && e.target === e.currentTarget) onDismiss();
      }}
    >
      {children}
    </div>
  );
}
