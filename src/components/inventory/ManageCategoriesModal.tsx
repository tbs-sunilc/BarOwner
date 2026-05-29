'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  createInventoryCategory,
  deleteInventoryCategory,
  listInventoryCategories,
  updateInventoryCategory,
  type BarInventoryCategory,
} from '@/lib/api-client';

type Props = {
  barId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function ManageCategoriesModal({ barId, isOpen, onClose, onChanged }: Props) {
  const [categories, setCategories] = useState<BarInventoryCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !barId) return;
    setLoading(true);
    setError(null);
    listInventoryCategories(barId)
      .then(setCategories)
      .catch((ex) =>
        setError(ex instanceof ApiError ? ex.message : 'Failed to load categories.'),
      )
      .finally(() => setLoading(false));
  }, [isOpen, barId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  async function refresh() {
    if (!barId) return;
    const rows = await listInventoryCategories(barId);
    setCategories(rows);
    onChanged();
  }

  async function onCreate() {
    if (!barId || !newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createInventoryCategory(barId, { name: newName.trim() });
      setNewName('');
      await refresh();
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Failed to create category.');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(categoryId: number) {
    if (!barId || !editName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateInventoryCategory(barId, categoryId, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      await refresh();
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Failed to update category.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(category: BarInventoryCategory) {
    if (!barId || busy) return;
    if (category.bottleCount > 0) {
      setError(`Cannot delete "${category.name}" — ${category.bottleCount} bottle(s) still use it.`);
      return;
    }
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteInventoryCategory(barId, category.id);
      await refresh();
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Failed to delete category.');
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
        className="w-full max-w-lg bg-white rounded-xl shadow-xl my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Manage Categories</h3>
            <p className="text-[11px] text-slate-500">
              Your bar&apos;s own bottle groupings — independent per bar.
            </p>
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

        <div className="px-5 py-4">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name, e.g. Premium Whisky"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm"
              disabled={!barId || busy}
              onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            />
            <button
              type="button"
              onClick={onCreate}
              disabled={!barId || !newName.trim() || busy}
              className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-md"
            >
              Add
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400">Loading categories…</p>
          ) : categories.length === 0 ? (
            <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center">
              No categories yet. Create one above, then assign bottles when adding inventory.
            </p>
          ) : (
            <ul className="rounded-md border border-slate-200 divide-y divide-slate-100">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  {editingId === c.id ? (
                    <div className="flex flex-1 gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => onSaveEdit(c.id)}
                        disabled={busy || !editName.trim()}
                        className="text-xs font-semibold text-violet-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditName(''); }}
                        className="text-xs text-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="ml-2 text-[11px] text-slate-400">
                          {c.bottleCount} bottle{c.bottleCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                          disabled={busy}
                          className="text-xs font-medium text-violet-600 hover:underline"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(c)}
                          disabled={busy || c.bottleCount > 0}
                          className="text-xs font-medium text-rose-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                          title={c.bottleCount > 0 ? 'Reassign bottles before deleting' : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
