'use client';

/**
 * SC-10 — Edit Bottle modal.
 *
 *   • Top section is the editable form (price, stock, threshold, volumes,
 *     availability + a stock-change-reason note for the audit log).
 *   • Bottom is the "Danger Zone" — soft-delete via two-tap confirmation. The
 *     warning copy spells out BR-029: existing wallet holders keep consuming.
 *
 * Caller pattern:
 *   <EditBottleModal
 *     item={selected}
 *     isOpen={!!selected}
 *     onClose={() => setSelected(null)}
 *     onUpdated={(updated) => refresh(updated)}
 *     onDeleted={() => refresh()}
 *   />
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  deleteInventoryItem,
  updateInventoryItem,
  type BarInventoryCategory,
  type InventoryItem,
  type UpdateInventoryPayload,
} from '@/lib/api-client';
import { getDocumentUrl } from '@/lib/document-url';

type Props = {
  item: InventoryItem | null;
  categories: BarInventoryCategory[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (item: InventoryItem) => void;
  onDeleted: () => void;
};

export function EditBottleModal({ item, categories, isOpen, onClose, onUpdated, onDeleted }: Props) {
  // We cache the modal's working copy of `item` so the form keeps a coherent state
  // across the briefly-empty render that follows `onClose()`.
  const [draft, setDraft] = useState<InventoryItem | null>(item);
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [bottlesInStock, setBottlesInStock] = useState<string>('');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('');
  const [v750, setV750] = useState(true);
  const [v1000, setV1000] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [stockChangeReason, setStockChangeReason] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!item) return;
    setDraft(item);
    setSellingPrice(String(item.sellingPrice));
    setCostPrice(item.costPrice === null || item.costPrice === undefined ? '' : String(item.costPrice));
    setBottlesInStock(String(item.bottlesInStock));
    setLowStockThreshold(String(item.lowStockThreshold));
    setV750(item.volume750MlAvailable);
    setV1000(item.volume1000MlAvailable);
    setIsAvailable(item.isAvailable);
    setCategoryId(item.barInventoryCategoryId);
    setStockChangeReason('');
    setErrorMessage(null);
    setConfirmingDelete(false);
  }, [item]);

  // Close on ESC.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  const sellingPriceNum     = Number(sellingPrice);
  const stockNum            = Number(bottlesInStock);
  const thresholdNum        = Number(lowStockThreshold);
  const stockChanged        = draft ? stockNum !== draft.bottlesInStock : false;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!Number.isFinite(sellingPriceNum) || sellingPriceNum <= 0) e.sellingPrice = 'Selling price must be greater than ₹0.';
    if (costPrice && (!Number.isFinite(Number(costPrice)) || Number(costPrice) < 0)) e.costPrice = 'Cost price cannot be negative.';
    if (!Number.isFinite(stockNum) || stockNum < 0) e.bottlesInStock = 'Stock must be 0 or more.';
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) e.lowStockThreshold = 'Threshold must be 0 or more.';
    if (!v750 && !v1000) e.volumes = 'Pick at least one volume.';
    if (!categoryId) e.category = 'Select a category.';
    if (stockChanged && stockChangeReason.trim().length === 0)
      e.stockChangeReason = 'Add a short reason — every stock change writes to the audit log.';
    return e;
  }, [sellingPriceNum, costPrice, stockNum, thresholdNum, v750, v1000, categoryId, stockChanged, stockChangeReason]);

  const canSave = draft !== null && Object.keys(errors).length === 0 && !busy;

  if (!isOpen || !draft) return null;

  async function onSave() {
    if (!draft || !canSave) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const payload: UpdateInventoryPayload = {
        barInventoryCategoryId: categoryId!,
        sellingPrice:          sellingPriceNum,
        costPrice:             costPrice ? Number(costPrice) : null,
        bottlesInStock:        stockNum,
        lowStockThreshold:     thresholdNum,
        volume750MlAvailable:  v750,
        volume1000MlAvailable: v1000,
        isAvailable,
        stockChangeReason:     stockChanged ? stockChangeReason.trim() : null,
      };
      const updated = await updateInventoryItem(draft.id, payload);
      onUpdated(updated);
      onClose();
    } catch (ex) {
      setErrorMessage(ex instanceof ApiError ? ex.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!draft) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      await deleteInventoryItem(draft.id);
      onDeleted();
      onClose();
    } catch (ex) {
      setErrorMessage(ex instanceof ApiError ? ex.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 sm:p-8 overflow-y-auto"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-xl my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Edit Bottle — {draft.brandName} {draft.productName}
            </h3>
            <p className="text-[11px] text-slate-500">{draft.category}{draft.subCategory ? ` · ${draft.subCategory}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                {draft.imageUrl ? (
                  <img
                    src={getDocumentUrl(draft.imageUrl)}
                    alt={`${draft.brandName} ${draft.productName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase text-violet-300">
                    No Img
                  </div>
                )}
              </div>
              <div>
                Editing <strong>{draft.brandName} {draft.productName}</strong>. Changes apply
            immediately to <em>new</em> purchases. Existing wallet holders are not affected by
            price or availability changes (BR-029).
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              ❌ {errorMessage}
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-700">Your Category *</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className={[
                'mt-1 w-full px-3 py-2.5 border rounded-md text-sm bg-white',
                errors.category ? 'border-red-400' : 'border-slate-200 focus:border-violet-500',
                'focus:outline-none focus:ring-1 focus:ring-violet-500',
              ].join(' ')}
            >
              <option value="" disabled>Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-[11px] text-red-600">{errors.category}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumField
              label="Selling Price (₹) *"
              value={sellingPrice}
              onChange={setSellingPrice}
              error={errors.sellingPrice}
            />
            <NumField
              label="Cost Price (₹) — Private"
              value={costPrice}
              onChange={setCostPrice}
              hint="Not visible to users or staff"
              error={errors.costPrice}
            />
            <NumField
              label="Bottles in Stock"
              value={bottlesInStock}
              onChange={setBottlesInStock}
              error={errors.bottlesInStock}
            />
            <NumField
              label="Low Stock Threshold"
              value={lowStockThreshold}
              onChange={setLowStockThreshold}
              error={errors.lowStockThreshold}
            />
          </div>

          {stockChanged && (
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700">Stock change reason *</label>
              <input
                type="text"
                value={stockChangeReason}
                onChange={(e) => setStockChangeReason(e.target.value)}
                placeholder="e.g. New shipment received, breakage, monthly reconciliation"
                className={[
                  'mt-1 w-full px-3 py-2.5 border rounded-md text-sm',
                  errors.stockChangeReason ? 'border-red-400' : 'border-slate-200 focus:border-violet-500',
                  'focus:outline-none focus:ring-1 focus:ring-violet-500',
                ].join(' ')}
              />
              {errors.stockChangeReason && (
                <p className="mt-1 text-[11px] text-red-600">{errors.stockChangeReason}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Recorded on InventoryAdjustments for the audit trail.
              </p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Available Volumes *</p>
            <div className="flex gap-3">
              <VolumeChip label="750 ml" selected={v750} onToggle={() => setV750((v) => !v)} />
              <VolumeChip label="1 Litre" selected={v1000} onToggle={() => setV1000((v) => !v)} />
            </div>
            {errors.volumes && <p className="mt-1 text-[11px] text-red-600">{errors.volumes}</p>}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-700">Available for Purchase</p>
              <p className="text-[11px] text-slate-400">
                When disabled, bottle is hidden from new user purchases. Existing wallets unaffected.
              </p>
            </div>
            <Toggle on={isAvailable} onChange={setIsAvailable} />
          </div>

          <div className="mt-5 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-md"
            >
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <section className="px-5 py-4 border-t border-slate-100 bg-rose-50/40 rounded-b-xl">
          <h4 className="text-sm font-bold text-rose-700 mb-1">⚠️ Danger Zone</h4>
          <p className="text-xs text-slate-600 mb-3">
            Permanently remove this bottle from inventory.{' '}
            <strong>Warning:</strong> any users with active wallet balances for this bottle will
            still be able to consume — their wallets remain until exhausted (BR-029).
          </p>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="px-3 py-2 text-xs font-semibold border border-rose-300 text-rose-700 rounded-md hover:bg-rose-100"
            >
              Remove Bottle from Inventory
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-rose-700 font-semibold">
                Are you sure? This action soft-deletes the row.
              </span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md"
              >
                {busy ? 'Removing…' : 'Yes, remove it'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Field widgets (local — keep the modal self-contained)
// ─────────────────────────────────────────────────────────────────────────────

function NumField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'mt-1 w-full px-3 py-2.5 border rounded-md text-sm',
          error ? 'border-red-400' : 'border-slate-200 focus:border-violet-500',
          'focus:outline-none focus:ring-1 focus:ring-violet-500',
        ].join(' ')}
      />
      {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function VolumeChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'px-4 py-2 rounded-md text-sm font-semibold border transition',
        selected
          ? 'bg-violet-600 text-white border-violet-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={[
        'relative inline-flex h-7 w-12 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-violet-300',
        on ? 'bg-violet-600' : 'bg-slate-300',
      ].join(' ')}
      role="switch"
      aria-checked={on}
    >
      <span
        className={[
          'absolute top-1 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-150',
          on ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}
