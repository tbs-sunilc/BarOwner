'use client';

import { useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  createFeaturedListing,
  listFeaturedListings,
  updateFeaturedListing,
  type FeaturedListingDto,
} from '@/lib/api-client';

export default function FeaturedListingsPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [rows, setRows] = useState<FeaturedListingDto[]>([]);
  const [slotType, setSlotType] = useState('Homepage');
  const [scopeCity, setScopeCity] = useState('');
  const [scopeCategory, setScopeCategory] = useState('');
  const [priority, setPriority] = useState(100);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInput(d);
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) {
      setLoading(false);
      return;
    }
    void refresh(barId);
  }, [barId]);

  async function refresh(id: number) {
    setLoading(true);
    setError(null);
    try {
      setRows(await listFeaturedListings(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load featured listings');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (barId == null) return;
    setSaving(true);
    setError(null);
    try {
      await createFeaturedListing(barId, {
        slotType: slotType.trim(),
        scopeCity: scopeCity.trim() || null,
        scopeCategory: scopeCategory.trim() || null,
        priority,
        startsAtUtc: new Date(startsAt).toISOString(),
        endsAtUtc: new Date(endsAt).toISOString(),
      });
      await refresh(barId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create featured listing');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row: FeaturedListingDto, status: string) {
    setError(null);
    try {
      const updated = await updateFeaturedListing(row.id, {
        slotType: row.slotType,
        scopeCity: row.scopeCity,
        scopeCategory: row.scopeCategory,
        priority: row.priority,
        startsAtUtc: row.startsAtUtc,
        endsAtUtc: row.endsAtUtc,
        status,
      });
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update listing');
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Featured listings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage paid visibility slots for this bar.</p>
      </header>

      {error && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">{error}</p>}

      <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Slot type">
            <input value={slotType} onChange={(e) => setSlotType(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
          <Field label="Scope city">
            <input value={scopeCity} onChange={(e) => setScopeCity(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
          <Field label="Scope category">
            <input value={scopeCategory} onChange={(e) => setScopeCategory(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
          <Field label="Priority">
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
          <Field label="Starts at">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
          <Field label="Ends at">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full rounded-lg border-slate-300 text-sm" />
          </Field>
        </div>
        <button disabled={saving || barId == null} className="mt-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
          {saving ? 'Creating...' : 'Create listing'}
        </button>
      </form>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Slot</th>
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-left">Dates</th>
              <th className="px-3 py-2 text-right">Views / clicks</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No featured listings yet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{row.slotType}</td>
                <td className="px-3 py-2 text-slate-600">{[row.scopeCity, row.scopeCategory].filter(Boolean).join(' / ') || '-'}</td>
                <td className="px-3 py-2 text-slate-600">{new Date(row.startsAtUtc).toLocaleDateString()} - {new Date(row.endsAtUtc).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.impressionCount} / {row.clickCount}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setStatus(row, row.status === 'Active' ? 'Scheduled' : 'Active')} className="text-xs font-semibold text-violet-700 hover:bg-violet-50 px-2 py-1 rounded">
                    {row.status === 'Active' ? 'Schedule' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toLocalInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
