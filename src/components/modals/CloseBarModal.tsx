'use client';

import { useState } from 'react';

/**
 * SC-19 Danger zone — "Close bar temporarily" modal.
 *
 * Soft-close semantics:
 *   - Bar is hidden from discover.
 *   - No new wallet purchases / top-ups / gifts accepted.
 *   - Existing wallets keep working; bartender tablet stays live.
 *   - Owner can re-open anytime from the same screen.
 *
 * Optional "re-open date" hint lets the owner schedule a reminder later (the
 * Phase 8 endpoint will honour it or ignore it per ops preference).
 */

type Props = {
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, reopenOn: string | null) => void;
};

export function CloseBarModal({ busy = false, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [reopenOn, setReopenOn] = useState('');

  return (
    <Backdrop onDismiss={busy ? undefined : onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-slate-900 text-lg">Close bar temporarily?</h3>
        <p className="text-sm text-slate-600 mt-2">
          We&apos;ll pause new wallet purchases and hide your bar from discover. Existing wallets keep
          pouring, and you can re-open anytime.
        </p>

        <label className="block text-xs font-medium text-slate-600 mt-4">Why? (shown to returning customers)</label>
        <textarea
          rows={2}
          maxLength={280}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Closed for renovations until next Monday"
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        />

        <label className="block text-xs font-medium text-slate-600 mt-3">Planned re-open date (optional)</label>
        <input
          type="date"
          value={reopenOn}
          onChange={(e) => setReopenOn(e.target.value)}
          className="mt-1 rounded-lg border-slate-300 text-sm"
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
            onClick={() => onConfirm(reason.trim(), reopenOn || null)}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-lg"
          >
            {busy ? 'Closing…' : 'Close temporarily'}
          </button>
        </div>
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
