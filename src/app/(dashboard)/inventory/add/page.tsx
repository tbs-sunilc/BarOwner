'use client';

/**
 * SC-09 — Add Bottle to Inventory.
 *
 * Two-stage flow:
 *   1. Debounced master-catalogue search (GET /bars/{barId}/inventory/catalogue-search).
 *   2. Pick a result → reveal pricing/stock form → submit (POST /bars/{barId}/inventory).
 *
 * Rows already present in this bar's inventory render with an "Already added"
 * badge and disable selection — backend would reject anyway, this saves a round trip.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  addBottleToInventory,
  createInventoryCategory,
  getBarDetails,
  listInventoryCategories,
  searchBottleCatalogue,
  type AddBottlePayload,
  type BarInventoryCategory,
  type BottleCatalogueSearchHit,
} from '@/lib/api-client';
import { getActiveBarId, setActiveBarDetails } from '@/lib/active-bar';

type FormState = {
  sellingPrice: string;
  costPrice: string;
  bottlesInStock: string;
  lowStockThreshold: string;
  volume750MlAvailable: boolean;
  volume1000MlAvailable: boolean;
  isAvailable: boolean;
};

const EMPTY_FORM: FormState = {
  sellingPrice: '',
  costPrice: '',
  bottlesInStock: '',
  lowStockThreshold: '3',
  volume750MlAvailable: true,
  volume1000MlAvailable: false,
  isAvailable: true,
};

export default function AddBottlePage() {
  const router = useRouter();
  const [barId, setBarId] = useState<number | null>(null);
  const [categories, setCategories] = useState<BarInventoryCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<BottleCatalogueSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Bar category is for organizing inventory, not filtering catalogue search.
  // Show all catalogue results regardless of selected bar category.
  const filteredResults = useMemo(() => results, [results]);
  const [picked, setPicked] = useState<BottleCatalogueSearchHit | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Resolve active bar from token (owner session). Keep storage fallback for demos.
  useEffect(() => {
    let canceled = false;
    const init = async () => {
      try {
        const bar = await getBarDetails();
        if (canceled) return;
        setActiveBarDetails(bar);
        setBarId(bar.barId);
      } catch {
        if (canceled) return;
        setBarId(getActiveBarId());
      }
    };
    void init();
    return () => {
      canceled = true;
    };
  }, []);

  // Load full bottle catalogue on bar load (no search term) to enable category filter before searching
  useEffect(() => {
    if (!barId) return;
    const loadAll = async () => {
      try {
        const allHits = await searchBottleCatalogue(barId, '');
        setResults(allHits);
      } catch (ex) {
        setSearchError(ex instanceof ApiError ? ex.message : 'Failed to load catalogue');
      }
    };
    loadAll();
  }, [barId]);
  useEffect(() => {
    if (!barId) return;
    listInventoryCategories(barId)
      .then((rows) => {
        setCategories(rows);
        if (rows.length === 1) setSelectedCategoryId(rows[0].id);
      })
      .catch(() => setCategories([]));
  }, [barId]);

  // Debounced search.
  useEffect(() => {
    if (!barId) return;
    const term = searchTerm.trim();
    if (term.length < 2) {
      // If the search term is empty or too short, load the full catalogue (or category‑filtered list).
      const loadAll = async () => {
        try {
          const allHits = await searchBottleCatalogue(barId, '');
          setResults(allHits);
        } catch (ex) {
          setSearchError(ex instanceof ApiError ? ex.message : 'Failed to load catalogue');
        }
      };
      loadAll();
      setSearching(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const hits = await searchBottleCatalogue(barId, term);
        setResults(hits);
      } catch (ex) {
        setSearchError(ex instanceof ApiError ? ex.message : 'Network error.');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [barId, searchTerm]);

  // ── Form helpers ──────────────────────────────────────────────────────
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const sellingPriceNum = useMemo(() => Number(form.sellingPrice), [form.sellingPrice]);
  const stockNum        = useMemo(() => Number(form.bottlesInStock), [form.bottlesInStock]);
  const thresholdNum    = useMemo(() => Number(form.lowStockThreshold), [form.lowStockThreshold]);

  const formErrors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!Number.isFinite(sellingPriceNum) || sellingPriceNum <= 0) e.sellingPrice = 'Selling price must be greater than ₹0.';
    if (form.costPrice && (!Number.isFinite(Number(form.costPrice)) || Number(form.costPrice) < 0)) e.costPrice = 'Cost price cannot be negative.';
    if (!Number.isFinite(stockNum) || stockNum < 0) e.bottlesInStock = 'Stock must be 0 or more.';
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) e.lowStockThreshold = 'Threshold must be 0 or more.';
    if (!form.volume750MlAvailable && !form.volume1000MlAvailable)
      e.volume750MlAvailable = 'Pick at least one volume.';
    return e;
  }, [form, sellingPriceNum, stockNum, thresholdNum]);

  const [isCustom, setIsCustom] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');
  const [customProductName, setCustomProductName] = useState('');

  const canSave =
    picked !== null &&
    selectedCategoryId !== null &&
    Object.keys(formErrors).length === 0 &&
    !submitting &&
    (!isCustom || (customBrandName.trim() !== '' && customProductName.trim() !== ''));

  async function onCreateCategory() {
    if (!barId || !newCategoryName.trim() || creatingCategory) return;
    setCreatingCategory(true);
    setSearchError(null);
    try {
      const created = await createInventoryCategory(barId, { name: newCategoryName.trim() });
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCategoryId(created.id);
      setNewCategoryName('');
    } catch (ex) {
      setSearchError(ex instanceof ApiError ? ex.message : 'Failed to create category.');
    } finally {
      setCreatingCategory(false);
    }
  }

  function pickBottle(hit: BottleCatalogueSearchHit) {
    if (hit.alreadyInInventory) return;
    setPicked(hit);
    setIsCustom(false);
    setCustomBrandName('');
    setCustomProductName('');
    setSubmitError(null);
    setForm(EMPTY_FORM);
  }

  function startCustomBottle() {
    setIsCustom(true);
    setCustomBrandName(searchTerm || '');
    setCustomProductName('');
    setPicked({
      id: 0,
      brandName: '',
      productName: '',
      category: '',
      defaultVolumeMl: 750,
      alreadyInInventory: false,
    });
    setSubmitError(null);
    setForm(EMPTY_FORM);
  }

  async function onSave() {
    if (!barId || !picked || !canSave) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: AddBottlePayload = {
        bottleCatalogueId:     isCustom ? 0 : picked.id,
        barInventoryCategoryId: selectedCategoryId!,
        sellingPrice:          sellingPriceNum,
        costPrice:             form.costPrice ? Number(form.costPrice) : null,
        bottlesInStock:        stockNum,
        lowStockThreshold:     thresholdNum,
        volume750MlAvailable:  form.volume750MlAvailable,
        volume1000MlAvailable: form.volume1000MlAvailable,
        isAvailable:           form.isAvailable,
        customBrandName:       isCustom ? customBrandName.trim() : undefined,
        customProductName:     isCustom ? customProductName.trim() : undefined,
        customDefaultVolumeMl: isCustom ? (form.volume750MlAvailable ? 750 : 1000) : undefined,
      };
      await addBottleToInventory(barId, payload);
      router.replace('/inventory');
    } catch (ex) {
      setSubmitError(ex instanceof ApiError ? ex.message : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 max-w-3xl">
      <header className="flex items-center gap-3 mb-5">
        <Link
          href="/inventory"
          className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-white"
        >
          ← Back
        </Link>
        <h2 className="text-lg font-bold text-slate-900">Add Bottle to Inventory</h2>
      </header>

      {!barId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800 mb-4">
          <strong>No active bar selected.</strong> Open the inventory page with{' '}
          <code className="bg-amber-100 px-1 rounded">?barId=&lt;id&gt;</code> first.
        </div>
      )}

      <section className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Your Category *</h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Assign this bottle to one of your bar&apos;s categories. Create new ones anytime.
        </p>

        {categories.length > 0 ? (
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => {
            const id = Number(e.target.value);
            setSelectedCategoryId(id);
          }}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm bg-white mb-3"
            disabled={!barId}
          >
            <option value="" disabled>Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            Create your first category below before adding a bottle.
          </p>
        )}

        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm"
            disabled={!barId || creatingCategory}
            onKeyDown={(e) => e.key === 'Enter' && onCreateCategory()}
          />
          <button
            type="button"
            onClick={onCreateCategory}
            disabled={!barId || !newCategoryName.trim() || creatingCategory}
            className="px-4 py-2 text-sm font-semibold border border-violet-200 text-violet-700 rounded-md hover:bg-violet-50 disabled:opacity-50"
          >
            {creatingCategory ? 'Adding…' : '+ Add Category'}
          </button>
        </div>

        <h3 className="text-sm font-bold text-slate-800 mb-4">🔍 Search Master Bottle Catalogue</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g. Jack Daniel's, Hendrick's, Patron…"
            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-md text-sm"
            disabled={!barId}
          />
        </div>

        {barId && (
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={startCustomBottle}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              + Or add custom bottle directly
            </button>
          </div>
        )}

        {searchError && (
          <p className="mt-2 text-xs text-red-600">❌ {searchError}</p>
        )}

        {/* Results list */}
        {(filteredResults.length > 0) && (
          <ul className="mt-3 rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
            {filteredResults.map((r) => (
              <li
                key={r.id}
                onClick={() => pickBottle(r)}
                className={[
                  'flex items-center justify-between gap-3 px-3 py-2.5 text-sm border-b border-slate-100 last:border-b-0',
                  r.alreadyInInventory
                    ? 'cursor-not-allowed opacity-60'
                    : picked?.id === r.id
                    ? 'bg-violet-50'
                    : 'cursor-pointer hover:bg-violet-50',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">
                    {r.brandName} — {r.productName}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.category}
                    {r.subCategory ? ` · ${r.subCategory}` : ''}
                    {r.originCountry ? ` · ${r.originCountry}` : ''}
                    {' · '}
                    {r.defaultVolumeMl} ml
                    {r.alcoholContentPct ? ` · ${r.alcoholContentPct}% ABV` : ''}
                  </div>
                </div>
                {r.alreadyInInventory ? (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
                    Already added
                  </span>
                ) : picked?.id === r.id ? (
                  <span className="px-2 py-0.5 rounded-full bg-violet-200 text-[11px] font-semibold text-violet-700">
                    Selected
                  </span>
                ) : (
                  <span className="text-xs text-violet-600">Select →</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {searching && results.length === 0 && (
          <p className="mt-3 text-xs text-slate-400">Searching…</p>
        )}

        {!searching && results.length === 0 && searchTerm.trim().length >= 2 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 flex flex-col gap-2 items-start">
            <div>
              No bottles found matching your search. You can create a custom bottle directly under your selected category.
            </div>
            <button
              type="button"
              onClick={startCustomBottle}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md shadow-sm"
            >
              + Create Custom Bottle
            </button>
          </div>
        )}

        {/* Bottle form (revealed after pick) */}
        {picked && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            {isCustom ? (
              <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 mb-4">
                <p className="text-xs font-bold text-violet-800 mb-2">✨ Custom Bottle Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Brand Name *</label>
                    <input
                      type="text"
                      value={customBrandName}
                      onChange={(e) => setCustomBrandName(e.target.value)}
                      placeholder="e.g. Kingfisher, Bro Code"
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Product Name *</label>
                    <input
                      type="text"
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      placeholder="e.g. Ultra Max, Strong Beer"
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mb-4">
                ✅ <strong>{picked.brandName} — {picked.productName}</strong> selected from
                catalogue
              </div>
            )}

            {submitError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                ❌ {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="Selling Price to User (₹) *"
                value={form.sellingPrice}
                onChange={(v) => update('sellingPrice', v)}
                placeholder="3800"
                error={formErrors.sellingPrice}
              />
              <NumberField
                label="Cost Price (₹)"
                value={form.costPrice}
                onChange={(v) => update('costPrice', v)}
                placeholder="2200"
                error={formErrors.costPrice}
                hint="Private — used in revenue analytics."
              />
              <NumberField
                label="Bottles in Stock *"
                value={form.bottlesInStock}
                onChange={(v) => update('bottlesInStock', v)}
                placeholder="10"
                error={formErrors.bottlesInStock}
              />
              <NumberField
                label="Low Stock Alert Threshold"
                value={form.lowStockThreshold}
                onChange={(v) => update('lowStockThreshold', v)}
                placeholder="3"
                error={formErrors.lowStockThreshold}
                hint="Alert when available stock falls below this number."
              />
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-700 mb-2">Available Volumes *</p>
              <div className="flex gap-3">
                <VolumeChip
                  label="750 ml"
                  selected={form.volume750MlAvailable}
                  onToggle={() => update('volume750MlAvailable', !form.volume750MlAvailable)}
                />
                <VolumeChip
                  label="1 Litre"
                  selected={form.volume1000MlAvailable}
                  onToggle={() => update('volume1000MlAvailable', !form.volume1000MlAvailable)}
                />
              </div>
              {formErrors.volume750MlAvailable && (
                <p className="mt-1 text-xs text-red-600">{formErrors.volume750MlAvailable}</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-700">Available for Purchase</p>
                <p className="text-[11px] text-slate-400">
                  Bottle appears in user app immediately when enabled.
                </p>
              </div>
              <Toggle
                on={form.isAvailable}
                onChange={(v) => update('isAvailable', v)}
              />
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <Link
                href="/inventory"
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-md hover:bg-white"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className="px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-md"
              >
                {submitting ? 'Saving…' : 'Save to Inventory'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================================
//  Form widgets
// =============================================================================

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
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
        placeholder={placeholder}
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
