'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  type MenuItemUploadPayload,
} from '@/lib/api-client';

const EMPTY_FORM: MenuItemUploadPayload = {
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

const CATEGORY_DEFS = [
  { id: 'All', name: 'All' },
  { id: 'Starter', name: 'Starter' },
  { id: 'MainCourse', name: 'Main Course' },
  { id: 'Snack', name: 'Snacks' },
  { id: 'Dessert', name: 'Desserts' },
  { id: 'Beverage', name: 'Beverages' },
];

export default function MenuPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [form, setForm] = useState<MenuItemUploadPayload>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    void loadMenu(barId);
  }, [barId]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Group items and find the first image for each category thumbnail
  const { grouped, categoryThumbnails, filteredItems } = useMemo(() => {
    const filtered = items.filter(item => 
      selectedCategory === 'All' || item.category === selectedCategory
    );
    const g = filtered.reduce<Record<string, MenuItemDto[]>>((acc, item) => {
      acc[item.category] = acc[item.category] ?? [];
      acc[item.category].push(item);
      return acc;
    }, {});

    const thumbs: Record<string, string | null> = {};
    items.forEach(item => {
      if (!thumbs[item.category] && item.imageUrl) {
        thumbs[item.category] = item.imageUrl;
      }
    });

    return { filteredItems: filtered, grouped: g, categoryThumbnails: thumbs };
  }, [items, selectedCategory]);

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
    setImageFile(null);
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
    setImageFile(null);
    setImagePreviewUrl(null);
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
      const payload = {
        ...form,
        imageUrl: form.imageUrl?.trim() || null,
        imageFile,
      };
      if (editing) {
        await updateMenuItem(editing.id, payload);
      } else {
        await createMenuItem(barId, payload);
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
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      setError(null);
      await deleteMenuItem(item.id);
      await loadMenu(barId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete menu item');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Food Menu</h1>
          <p className="mt-1 text-xs text-slate-500">Manage kitchen items, prices, and staff-facing availability.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <span className="font-bold text-slate-900">{items.length}</span>
            <span className="ml-1 text-slate-500">items</span>
          </div>
          <button 
            onClick={resetForm}
            className="btn btn-primary btn-sm"
          >
            <IconPlus />
            <span>Add Item</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 animate-in fade-in slide-in-from-top-2">
          <IconWarning />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Content Area */}
        <section className="space-y-6 lg:col-span-8">
          {/* Categories Horizontal Scroll */}
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
              {CATEGORY_DEFS.map((cat) => {
                const thumb = cat.id === 'All' ? Object.values(categoryThumbnails)[0] : categoryThumbnails[cat.id];
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="group flex min-w-[4.5rem] flex-col items-center gap-1.5"
                  >
                    <div 
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 transition-all duration-200 shadow-sm ${
                        selectedCategory === cat.id 
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-tint)] scale-105' 
                          : 'border-slate-100 bg-white group-hover:border-slate-200'
                      }`}
                    >
                      {thumb ? (
                        <img src={thumb} alt={cat.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl">🍽️</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      selectedCategory === cat.id ? 'text-[var(--color-accent)]' : 'text-slate-500'
                    }`}>
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Menu Sections */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-64 rounded-2xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-12 text-center">
              <p className="text-slate-500 text-sm">No food items yet. Add your first item to get started!</p>
            </div>
          ) : selectedCategory === 'All' ? (
            /* Overview Mode: Horizontal scrollable rows per category */
            <div className="space-y-8">
              {Object.entries(grouped).map(([category, categoryItems]) => (
                <CategorySection 
                  key={category}
                  title={category}
                  items={categoryItems}
                  onEdit={edit}
                  onToggle={toggle}
                  onDelete={remove}
                />
              ))}
            </div>
          ) : (
            /* Category Mode: Vertical grid of items */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">{selectedCategory} <span className="text-slate-400 text-sm font-medium ml-1">({filteredItems.length})</span></h2>
                <button onClick={() => setSelectedCategory('All')} className="text-xs font-semibold text-slate-500 hover:text-[var(--color-accent)]">&larr; Back to Overview</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-20">
                {filteredItems.map((item) => (
                  <MenuItemCard 
                    key={item.id} 
                    item={item} 
                    onEdit={() => edit(item)} 
                    onToggle={() => toggle(item)}
                    onDelete={() => remove(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sticky Sidebar Form */}
        <aside className="lg:col-span-4 lg:sticky lg:top-4 h-fit pb-20">
          <div className="panel p-5 shadow-lg border-t-4 border-t-[var(--color-accent)]">
            <h2 className="mb-4 text-base font-bold text-slate-900">{editing ? 'Edit Menu Item' : 'Add New Item'}</h2>
            <div className="space-y-4">
              <Field label="Name">
                <input 
                  className="input py-2 text-sm" 
                  placeholder="e.g. Butter Chicken"
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                />
              </Field>
              
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select 
                    className="select py-2 text-sm" 
                    value={form.category} 
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORY_DEFS.filter(c => c.id !== 'All').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Price (₹)">
                  <input
                    className="input py-2 text-sm"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={form.priceInPaise ? form.priceInPaise / 100 : ''}
                    onChange={(e) => setForm({ ...form, priceInPaise: Math.round(Number(e.target.value || 0) * 100) })}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea 
                  className="input min-h-[4rem] py-2 text-sm resize-none" 
                  placeholder="Tell us about this dish..."
                  value={form.description ?? ''} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                />
              </Field>

              <Field label="Image URL">
                <input 
                  className="input py-2 text-sm" 
                  placeholder="https://example.com/food.jpg"
                  value={form.imageUrl ?? ''} 
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} 
                />
              </Field>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Or Upload Image</p>
                <div 
                  className="group relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors hover:border-[var(--color-accent)] hover:bg-white"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  {imagePreviewUrl || form.imageUrl ? (
                    <img 
                      src={imagePreviewUrl ?? form.imageUrl ?? undefined} 
                      alt="Preview" 
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                        <IconImage />
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">Click to upload image</p>
                    </div>
                  )}
                  <input 
                    id="image-upload" 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1 text-sm">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 transition-colors hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Vegetarian</span>
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-slate-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]" 
                    checked={form.isVeg} 
                    onChange={(e) => setForm({ ...form, isVeg: e.target.checked })} 
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 transition-colors hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Available to staff</span>
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-slate-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    checked={form.isAvailable} 
                    onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} 
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={submit} 
                  disabled={saving} 
                  className="btn btn-primary flex-1 shadow-glow py-2 text-sm"
                >
                  {saving ? 'Saving...' : editing ? 'Update Item' : 'Save Item'}
                </button>
                {editing && (
                  <button onClick={resetForm} className="btn btn-secondary py-2 text-sm px-3">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CategorySection({ title, items, onEdit, onToggle, onDelete }: { 
  title: string; 
  items: MenuItemDto[];
  onEdit: (item: MenuItemDto) => void;
  onToggle: (item: MenuItemDto) => void;
  onDelete: (item: MenuItemDto) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 600;
      scrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div className="relative space-y-3 group/section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">{title} <span className="text-slate-400 text-xs font-medium ml-1">({items.length})</span></h2>
      </div>

      <div className="relative">
        <button 
          onClick={() => scroll('left')}
          className="absolute -left-4 top-[80px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 text-slate-600 opacity-0 transition-opacity hover:bg-slate-50 group-hover/section:opacity-100"
        >
          <IconChevronLeft />
        </button>
        <button 
          onClick={() => scroll('right')}
          className="absolute -right-4 top-[80px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 text-slate-600 opacity-0 transition-opacity hover:bg-slate-50 group-hover/section:opacity-100"
        >
          <IconChevronRight />
        </button>

        <div 
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 no-scrollbar scroll-smooth"
        >
          {items.map((item) => (
            <div key={item.id} className="w-[18rem] shrink-0">
              <MenuItemCard 
                item={item} 
                onEdit={() => onEdit(item)} 
                onToggle={() => onToggle(item)}
                onDelete={() => onDelete(item)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuItemCard({ item, onEdit, onToggle, onDelete }: { 
  item: MenuItemDto; 
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Image section as per Image 1 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img 
          src={item.imageUrl || 'https://placehold.co/600x400?text=Food+Image'} 
          alt={item.name} 
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {item.isHighlighted && (
          <div className="absolute left-3 top-3 z-10">
            <span className="badge bg-purple-500 text-white shadow-lg">🔥 Best Seller</span>
          </div>
        )}
      </div>

      {/* Content section */}
      <div className="flex flex-1 flex-col p-4 bg-white">
        {/* Tags row immediately below image */}
        <div className="mb-3 flex gap-2">
          <span className={`badge ${item.isVeg ? 'badge-success' : 'badge-warn'} py-0.5 px-2.5 text-[9px] shadow-sm`}>
            {item.isVeg ? 'Veg' : 'Non-Veg'}
          </span>
          <span className={`status-pill py-0.5 px-2.5 text-[9px] ${item.isAvailable ? 'status-success' : 'status-danger'} shadow-sm`}>
            {item.isAvailable ? 'Available' : 'Hidden'}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-800 line-clamp-1 mb-1">{item.name}</h3>
        <p className="mb-6 text-[11px] text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {item.description || "Freshly prepared with authentic ingredients for a truly delightful taste experience."}
        </p>

        {/* Bottom row: Price and Actions */}
        <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-3">
          <p className="text-lg font-black text-slate-900 font-numeric">₹{item.price.toFixed(0)}</p>
          <div className="flex gap-2">
            <button 
              onClick={onEdit}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-tint)] hover:text-[var(--color-accent)]"
              title="Edit Item"
            >
              <IconEdit size={16} />
            </button>
            <button 
              onClick={onToggle}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-tint)] hover:text-[var(--color-accent)]"
              title={item.isAvailable ? 'Hide Item' : 'Show Item'}
            >
              {item.isAvailable ? <IconEye size={16} /> : <IconEyeOff size={16} />}
            </button>
            <button 
              onClick={onDelete}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-600"
              title="Delete Item"
            >
              <IconTrash size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

// Icons
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  );
}

function IconWarning() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
  );
}

function IconEdit({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
  );
}

function IconTrash({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
  );
}

function IconEye({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
  );
}

function IconEyeOff({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 1.24-2.11m4.24-4.22A10.07 10.07 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)]"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
  );
}
