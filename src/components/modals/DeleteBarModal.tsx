'use client';

import { useState } from 'react';

/**
 * SC-19 Danger zone — "Delete bar account" modal.
 *
 * Two layers of guard:
 *   1. Hard block when <c>activeWalletCount &gt; 0</c> — we cannot orphan
 *      customer money.  The owner must either wait for wallets to exhaust /
 *      expire or issue refunds first.
 *   2. Type-to-confirm — owner must type the bar name exactly to enable the
 *      red button.  Match is whitespace-trimmed + case-insensitive so typos
 *      don't get punished.
 *
 * Deletion is soft on the server (BRD §4.5) — the row stays for audit /
 * compliance, but all user-visible surfaces go dark.
 */

type Props = {
  activeWalletCount: number;
  barName?: string;        // label the owner types to confirm; falls back to "delete my bar"
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteBarModal({
  activeWalletCount,
  barName,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const confirmPhrase = barName?.trim() || 'delete my bar';
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === confirmPhrase.toLowerCase();
  const blocked = activeWalletCount > 0;

  return (
    <Backdrop onDismiss={busy ? undefined : onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-slate-900 text-lg">Delete bar account?</h3>

        {blocked ? (
          <>
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm">
              <p className="font-semibold text-rose-900">
                Blocked — <strong>{activeWalletCount}</strong> active customer wallet
                {activeWalletCount === 1 ? '' : 's'} at your bar.
              </p>
              <p className="text-rose-800 mt-1">
                You cannot delete while customers hold wallet balances at your bar.
                Options:
              </p>
              <ul className="list-disc list-inside text-rose-800 mt-2 space-y-1">
                <li>Close temporarily until balances exhaust / expire naturally.</li>
                <li>Issue refunds (wallet-by-wallet from the customer screen — Phase 8).</li>
              </ul>
            </div>
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
              This is permanent.  Your bar listing, inventory, staff, offers, loyalty programme,
              campaigns and historical sessions will all be removed from customer-facing surfaces.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Accounting records are retained for compliance for 7 years — but customers can no
              longer see your bar.
            </p>

            <label className="block text-xs font-medium text-slate-600 mt-4">
              Type <span className="font-mono text-rose-700">{confirmPhrase}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder={confirmPhrase}
              className="mt-1 w-full rounded-lg border-slate-300 text-sm font-mono focus:border-rose-500 focus:ring-rose-500"
              aria-label={`Type ${confirmPhrase} to confirm deletion`}
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
                {busy ? 'Deleting…' : 'Delete forever'}
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
