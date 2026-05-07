'use client';

import { useState } from 'react';

/**
 * SC-18 cancel-plan confirm modal.
 *
 * Shows the active-wallet count so the owner sees the customer impact up
 * front.  After cancellation:
 *   - Existing wallets can still be poured against until exhausted / expired.
 *   - No new wallet purchases, offers, or loyalty accrual.
 *   - Bar is de-listed from discover once the billing period ends.
 * The reason dropdown feeds the <c>BarSubscription.CancellationReason</c>
 * column — useful for churn analytics in Phase 10.
 */

type Props = {
  activeWalletCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string, detail?: string) => void;
};

const REASONS = [
  'Closing the bar',
  'Too expensive',
  'Not enough customers using it',
  'Switching to a different platform',
  'Temporary pause',
  'Other',
] as const;

export function CancelSubscriptionModal({
  activeWalletCount,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [detail, setDetail] = useState('');

  return (
    <Backdrop onDismiss={busy ? undefined : onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-slate-900 text-lg">Cancel subscription?</h3>

        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          <p className="font-semibold">
            {activeWalletCount} active customer wallet{activeWalletCount === 1 ? '' : 's'} at your bar.
          </p>
          <p className="mt-1">
            Customers can still pour against their remaining balance, but you won&apos;t be able to
            accept new wallet purchases or top-ups after cancellation.
          </p>
        </div>

        <label className="block text-xs font-medium text-slate-600 mt-4">Reason for cancelling</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        >
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className="block text-xs font-medium text-slate-600 mt-3">
          Anything else? (optional)
        </label>
        <textarea
          rows={2}
          maxLength={500}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Tell us what we could have done better…"
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        />

        <p className="text-xs text-slate-500 mt-3">
          You&apos;ll keep access until the end of the current billing period.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Keep plan
          </button>
          <button
            onClick={() => onConfirm(reason, detail.trim())}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg"
          >
            {busy ? 'Cancelling…' : 'Cancel plan'}
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
