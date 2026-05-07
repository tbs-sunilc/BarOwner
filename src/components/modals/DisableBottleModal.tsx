'use client';

/**
 * Inventory "Disable bottle" confirm modal.
 *
 * Semantics: disabling takes a bottle off the customer-facing menu without
 * destroying data.  Existing wallets keep working.  This is a soft-reversible
 * toggle, so the copy doesn't need the type-to-confirm pattern (that's
 * reserved for destructive deletes — see RemoveBottleModal).
 */

type Props = {
  bottleLabel: string;  // e.g., "Johnnie Walker Black Label"
  committedBottleCount?: number;  // # of active wallets tied to this SKU
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DisableBottleModal({
  bottleLabel,
  committedBottleCount = 0,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Backdrop onDismiss={busy ? undefined : onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-slate-900 text-lg">Disable {bottleLabel}?</h3>
        <p className="text-sm text-slate-600 mt-2">
          Customers won&apos;t see it on the menu or be able to buy new wallets of this bottle.
          Existing pours and wallets keep working.
        </p>

        {committedBottleCount > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>{committedBottleCount}</strong> active wallet{committedBottleCount === 1 ? '' : 's'} currently
            tied to this bottle. They&apos;ll keep pouring against their remaining balance.
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">You can re-enable it anytime from the inventory screen.</p>

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
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-lg"
          >
            {busy ? 'Disabling…' : 'Disable bottle'}
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
