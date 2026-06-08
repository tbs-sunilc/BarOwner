'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  setMenuItemAvailability,
  updateMenuItem,
  type MenuItemDto,
  type UpsertMenuItemPayload,
} from '@/lib/api-client';

const EMPTY_FORM: UpsertMenuItemPayload = {
  name: '',
  description: '',
  category: 'Starter',
  priceInPaise: 0,
  imageUrl: '',
  isVeg: true,
  spiceLevel: '',
  allergens: '',
  isAvailable: true,
  isHighlighted: false,
  displayOrder: 100,
};

const CATEGORIES = ['Starter', 'MainCourse', 'Snack', 'Beverage', 'Dessert', 'Other'];

export default function MenuPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [form, setForm] = useState<UpsertMenuItemPayload>(EMPTY_FORM);
  const [editing, setEditing] = useState<MenuItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    void loadMenu(barId);
  }, [barId]);

  const grouped = useMemo(() => {
    return items.reduce<Record<string, MenuItemDto[]>>((acc, item) => {
      acc[item.category] = acc[item.category] ?? [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [items]);

  async function loadMenu(id: number) {
    try {
      setLoading(true);
      setError(null);
      setItems(await listMenuItems(id, true));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }

  function edit(item: MenuItemDto) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description ?? '',
      category: item.category,
      priceInPaise: item.priceInPaise,
      imageUrl: item.imageUrl ?? '',
      isVeg: item.isVeg,
      spiceLevel: item.spiceLevel ?? '',
      allergens: item.allergens ?? '',
      isAvailable: item.isAvailable,
      isHighlighted: item.isHighlighted,
      displayOrder: item.displayOrder,
    });
  }

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function submit() {
    if (barId == null) return;
    if (!form.name.trim()) {
      setError('Menu item name is required.');
      return;
    }
    if (form.priceInPaise <= 0) {
      setError('Price must be greater than zero.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (editing) {
        await updateMenuItem(editing.id, form);
      } else {
        await createMenuItem(barId, form);
      }
      resetForm();
      await loadMenu(barId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save menu item');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: MenuItemDto) {
    if (barId == null) return;
    try {
      setError(null);
      await setMenuItemAvailability(item.id, !item.isAvailable);
      await loadMenu(barId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update availability');
    }
  }

  async function remove(item: MenuItemDto) {
    if (barId == null) return;
    try {
      setError(null);
      await deleteMenuItem(item.id);
      await loadMenu(barId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete menu item');
    }
  }

  return (
    <div className="max-w-6xl p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Food menu</h1>
          <p className="mt-1 text-sm text-slate-500">Manage kitchen items, prices, and staff-facing availability.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="font-bold text-slate-900">{items.length}</span>
          <span className="ml-1 text-slate-500">items</span>
        </div>
      </header>

      {error && <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Current menu</h2>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-400">Loading menu...</p>
          ) : items.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">No food items yet. Add your first item from the form.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {Object.entries(grouped).map(([category, rows]) => (
                <div key={category} className="p-5">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{category}</h3>
                  <div className="space-y-3">
                    {rows.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {item.isAvailable ? 'Available' : 'Hidden'}
                            </span>
                            {item.isVeg && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Veg</span>}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{item.description || 'No description'} · ₹{item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => edit(item)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            Edit
                          </button>
                          <button onClick={() => toggle(item)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            {item.isAvailable ? 'Hide' : 'Show'}
                          </button>
                          <button onClick={() => remove(item)} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">{editing ? 'Edit item' : 'Add item'}</h2>
          <div className="space-y-4">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Price">
              <input
                className="input"
                type="number"
                min="0"
                value={form.priceInPaise ? form.priceInPaise / 100 : ''}
                onChange={(e) => setForm({ ...form, priceInPaise: Math.round(Number(e.target.value || 0) * 100) })}
              />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-20" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Available to staff</span>
              <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Vegetarian</span>
              <input type="checkbox" checked={form.isVeg} onChange={(e) => setForm({ ...form, isVeg: e.target.checked })} />
            </label>
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving} className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update item' : 'Add item'}
              </button>
              {editing && (
                <button onClick={resetForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
