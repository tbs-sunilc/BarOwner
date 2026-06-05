'use client';

/**
 * SC-08 — Inventory Management. Reads from GET /api/v1/bars/{barId}/inventory and
 * renders the bottle table with row-level low-stock (amber) / out-of-stock (red)
 * highlighting. The "Disable / Enable" toggle hits PUT /inventory/{id}/availability;
 * the optimistic update is rolled back on API failure.
 *
 * Filters:
 *   • Free-text search across brand + product names (client-side; backend supports
 *     server-side filtering when the catalogue grows beyond a screen).
 *   • Category dropdown uses bar-owner categories from GET .../inventory/categories.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  getBarDetails,
  listInventory,
  listInventoryCategories,
  setInventoryAvailability,
  type BarInventoryCategory,
  type InventoryItem,
} from '@/lib/api-client';
import { getActiveBarId, setActiveBarDetails, setActiveBarId } from '@/lib/active-bar';
import { EditBottleModal } from '@/components/inventory/EditBottleModal';
import { ManageCategoriesModal } from '@/components/inventory/ManageCategoriesModal';

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [barId, setBarId] = useState<number | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState<number | 'All'>('All');
  const [barCategories, setBarCategories] = useState<BarInventoryCategory[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Resolve active bar from token (owner session). Keep URL/storage as fallback for demos.
  useEffect(() => {
    let canceled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const bar = await getBarDetails();
        if (canceled) return;
        setActiveBarDetails(bar);
        setBarId(bar.barId);
        return;
      } catch (ex) {
        if (canceled) return;
        if (ex instanceof ApiError && ex.status === 401) {
          router.replace('/login');
          return;
        }
        // Fallback: allow demo mode via URL/storage when backend details aren't available.
        const fromUrl = searchParams.get('barId');
        if (fromUrl) {
          const n = Number(fromUrl);
          if (Number.isFinite(n) && n > 0) {
            setActiveBarId(n);
            setBarId(n);
            return;
          }
        }
        const fromStorage = getActiveBarId();
        if (fromStorage) setBarId(fromStorage);
        else setLoading(false);
      }
    }

    void init();
    return () => {
      canceled = true;
    };
  }, [router, searchParams]);

  const refresh = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, categories] = await Promise.all([
        listInventory(barId, true),
        listInventoryCategories(barId),
      ]);
      setItems(rows);
      setBarCategories(categories);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    if (barId) refresh();
  }, [barId, refresh]);

  // ── KPI roll-ups ──────────────────────────────────────────────────────
  const totalStock     = items.reduce((sum, i) => sum + i.bottlesInStock, 0);
  const totalCommitted = items.reduce((sum, i) => sum + i.bottlesCommitted, 0);
  const totalAvailable = items.reduce((sum, i) => sum + i.bottlesAvailableForPurchase, 0);
  const lowStockCount  = items.filter((i) => i.stockState === 'LowStock').length;
  const outOfStockCount = items.filter((i) => i.stockState === 'OutOfStock').length;
  const skuCount = items.length;

  // ── Filtering ─────────────────────────────────────────────────────────
  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of barCategories) map.set(c.id, c.name);
    return map;
  }, [barCategories]);

  const categoryOptions = useMemo(() => {
    const sorted = [...barCategories].sort((a, b) => a.name.localeCompare(b.name));
    return [
      { id: 'All' as const, label: 'All Categories' },
      ...sorted.map((c) => ({ id: c.id, label: c.name })),
    ];
  }, [barCategories]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryId !== 'All' && i.barInventoryCategoryId !== categoryId) return false;
      if (term && !`${i.brandName} ${i.productName}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, searchTerm, categoryId]);

  // ── Availability toggle (optimistic) ──────────────────────────────────
  async function onToggleAvailability(item: InventoryItem) {
    if (pendingToggleId !== null) return;
    setPendingToggleId(item.id);
    const previous = items;
    const optimistic = items.map((i) =>
      i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i,
    );
    setItems(optimistic);
    try {
      const updated = await setInventoryAvailability(item.id, !item.isAvailable);
      setItems((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
    } catch (ex) {
      setItems(previous);
      setError(ex instanceof ApiError ? ex.message : 'Network error.');
    } finally {
      setPendingToggleId(null);
    }
  }

  function onEdit(item: InventoryItem) {
    setSelectedItem(item);
  }

  function onModalUpdated(updated: InventoryItem) {
    setItems((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    setSelectedItem(updated);
  }

  function onModalDeleted() {
    setItems((rows) => rows.filter((row) => row.id !== selectedItem?.id));
    setSelectedItem(null);
  }

  function onDownloadReconciliationReport() {
    if (!barId || downloadingReport) return;
    setError(null);
    setDownloadingReport(true);
    try {
      downloadInventoryReconciliationCsv(items, barId);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to download reconciliation report.');
    } finally {
      setDownloadingReport(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6">
      <header className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Inventory Management</h2>
          <p className="text-xs text-slate-500">Physical stock vs. wallet commitments</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-white"
            onClick={() => setCategoriesOpen(true)}
            disabled={!barId}
          >
            Manage Categories
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onDownloadReconciliationReport}
            disabled={!barId || loading || downloadingReport}
          >
            {downloadingReport ? 'Preparing Report...' : 'Reconciliation Report'}
          </button>
          <Link
            href="/inventory/add"
            className="px-3 py-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-md"
          >
            + Add Bottle
          </Link>
        </div>
      </header>

      {!barId && !loading && <NoActiveBarBanner />}

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ❌ {error}
        </div>
      )}

      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            <strong>
              {lowStockCount + outOfStockCount} bottle{lowStockCount + outOfStockCount === 1 ? '' : 's'} need attention.
            </strong>{' '}
            {lowStockCount > 0 && `${lowStockCount} low stock`}
            {lowStockCount > 0 && outOfStockCount > 0 && ', '}
            {outOfStockCount > 0 && `${outOfStockCount} out of stock`}.
          </span>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Kpi
          label="Total Bottles in Stock"
          value={totalStock}
          subtitle={`Across ${skuCount} SKU${skuCount === 1 ? '' : 's'}`}
          accent="violet"
        />
        <Kpi
          label="Committed to Wallets"
          value={totalCommitted}
          subtitle="Active wallet balances"
          accent="amber"
        />
        <Kpi
          label="Available for New Purchases"
          value={totalAvailable}
          subtitle="Ready to sell"
          accent="green"
        />
      </div>

      {/* Table card */}
      <section className="rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Bottle Inventory ({filtered.length} {filtered.length === 1 ? 'SKU' : 'SKUs'})
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search bottles…"
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-md w-52"
            />
            <select
              value={categoryId === 'All' ? 'All' : String(categoryId)}
              onChange={(e) => {
                const v = e.target.value;
                setCategoryId(v === 'All' ? 'All' : Number(v));
              }}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              {categoryOptions.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
              <tr>
                <Th>Bottle</Th>
                <Th>Category</Th>
                <Th align="right">Sell Price</Th>
                <Th align="right">Physical</Th>
                <Th align="right">Committed</Th>
                <Th align="right">Available</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Loading inventory…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No bottles match the current filter.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    pendingToggle={pendingToggleId === item.id}
                    onToggle={() => onToggleAvailability(item)}
                    onEdit={() => onEdit(item)}
                    categoryNameById={categoryNameById}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <EditBottleModal
        item={selectedItem}
        categories={barCategories}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdated={onModalUpdated}
        onDeleted={onModalDeleted}
      />

      <ManageCategoriesModal
        barId={barId}
        isOpen={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        onChanged={refresh}
      />
    </div>
  );
}

// =============================================================================
//  Sub-components
// =============================================================================

function Kpi({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: number;
  subtitle: string;
  accent: 'violet' | 'amber' | 'green';
}) {
  const left =
    accent === 'violet'
      ? 'border-l-violet-600'
      : accent === 'amber'
      ? 'border-l-amber-500'
      : 'border-l-green-500';
  return (
    <div className={`bg-white border border-slate-200 ${left} border-l-4 rounded-md px-4 py-3`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-3 py-2 font-semibold ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function InventoryRow({
  item,
  categoryNameById,
  pendingToggle,
  onToggle,
  onEdit,
}: {
  item: InventoryItem;
  categoryNameById: Map<number, string>;
  pendingToggle: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  // Row background per stock state (matches prototype's row tinting).
  const rowBg =
    item.stockState === 'OutOfStock'
      ? 'bg-rose-50 hover:bg-rose-100'
      : item.stockState === 'LowStock'
      ? 'bg-amber-50 hover:bg-amber-100'
      : item.stockState === 'Unavailable'
      ? 'bg-slate-50/60 text-slate-400 hover:bg-slate-100'
      : 'bg-white hover:bg-slate-50';

  const availableCellColor =
    item.stockState === 'OutOfStock'
      ? 'text-rose-600'
      : item.stockState === 'LowStock'
      ? 'text-amber-600'
      : 'text-green-600';

  return (
    <tr
      className={`${rowBg} cursor-pointer border-t border-slate-100 transition`}
      onClick={onEdit}
    >
      <td className="px-3 py-2.5">
        <div className="font-semibold text-slate-800">{item.brandName}</div>
        <div className="text-[11px] text-slate-400">
          {item.productName}
          {item.subCategory ? ` · ${item.subCategory}` : ''}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-slate-800">
          {categoryNameById.get(item.barInventoryCategoryId) ?? '—'}
        </div>
        <div className="text-[11px] text-slate-400">{item.category}</div>
      </td>
      <td className="px-3 py-2.5 text-right font-semibold text-violet-700">
        ₹{item.sellingPrice.toLocaleString('en-IN')}
      </td>
      <td className="px-3 py-2.5 text-right">{item.bottlesInStock}</td>
      <td className="px-3 py-2.5 text-right">{item.bottlesCommitted}</td>
      <td className={`px-3 py-2.5 text-right font-bold ${availableCellColor}`}>
        {item.bottlesAvailableForPurchase}
        {item.stockState === 'LowStock' && ' ⚠️'}
        {item.stockState === 'OutOfStock' && ' 🚫'}
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge state={item.stockState} isAvailable={item.isAvailable} />
      </td>
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-white"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={pendingToggle}
            className={[
              'px-2.5 py-1 text-xs font-medium rounded border',
              item.isAvailable
                ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                : 'border-green-200 text-green-700 hover:bg-green-50',
              pendingToggle && 'opacity-60 cursor-wait',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {pendingToggle ? '…' : item.isAvailable ? 'Disable' : 'Enable'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({
  state,
  isAvailable,
}: {
  state: InventoryItem['stockState'];
  isAvailable: boolean;
}) {
  if (!isAvailable) {
    return <Pill text="Disabled" tone="slate" />;
  }
  switch (state) {
    case 'InStock':     return <Pill text="Available" tone="green" />;
    case 'LowStock':    return <Pill text="Low Stock" tone="amber" />;
    case 'OutOfStock':  return <Pill text="Out of Stock" tone="red" />;
    case 'Unavailable': return <Pill text="Disabled" tone="slate" />;
  }
}

function Pill({
  text,
  tone,
}: {
  text: string;
  tone: 'green' | 'amber' | 'red' | 'slate';
}) {
  const cls =
    tone === 'green'
      ? 'bg-green-100 text-green-700'
      : tone === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'red'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-slate-100 text-slate-500';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}

function NoActiveBarBanner() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
      <strong>No active bar selected.</strong> Open this page with{' '}
      <code className="bg-amber-100 px-1 rounded">?barId=&lt;your-bar-id&gt;</code>{' '}
      until owner login is wired (Phase 8).
    </div>
  );
}

function downloadInventoryReconciliationCsv(items: InventoryItem[], barId: number): void {
  if (typeof document === 'undefined') {
    throw new Error('Report downloads are only available in the browser.');
  }

  const generatedAt = new Date();
  const headers = [
    'Generated At',
    'Bar ID',
    'Inventory ID',
    'Brand',
    'Product',
    'Category',
    'Sub Category',
    'Selling Price',
    'Physical Stock',
    'Committed To Wallets',
    'Available For Purchase',
    'Reconciliation Difference',
    'Stock State',
    'Enabled',
    'Physical Stock Value',
    'Committed Stock Value',
    'Available Stock Value',
  ];

  const rows = items.map((item) => {
    const reconciliationDifference =
      item.bottlesInStock - item.bottlesCommitted - item.bottlesAvailableForPurchase;

    return [
      generatedAt.toLocaleString('en-IN'),
      barId,
      item.id,
      item.brandName,
      item.productName,
      item.category,
      item.subCategory ?? '',
      item.sellingPrice,
      item.bottlesInStock,
      item.bottlesCommitted,
      item.bottlesAvailableForPurchase,
      reconciliationDifference,
      item.stockState,
      item.isAvailable ? 'Yes' : 'No',
      item.bottlesInStock * item.sellingPrice,
      item.bottlesCommitted * item.sellingPrice,
      item.bottlesAvailableForPurchase * item.sellingPrice,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const datePart = generatedAt.toISOString().slice(0, 10);
  triggerClientDownload(blob, `inventory-reconciliation-bar-${barId}-${datePart}.csv`);
}

function csvCell(value: string | number): string {
  const text = String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function triggerClientDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
