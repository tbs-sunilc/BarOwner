'use client';

/**
 * SC-11 Staff accounts.
 *
 * Active/inactive rendered inline with a badge.  The "Deactivate" action opens
 * a confirm modal (defined below — not yet abstracted into the shared modals
 * folder because its copy is unique to this screen).  Pours-today is server-
 * computed in the StaffService so the table doesn't need a second query.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  listStaff,
  setStaffActive,
  type StaffRowDto,
} from '@/lib/api-client';

export default function StaffPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [rows, setRows] = useState<StaffRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<StaffRowDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | string>('All');

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    void reload(barId);
  }, [barId]);

  async function reload(id: number) {
    try {
      setError(null);
      setRows(await listStaff(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(row: StaffRowDto, isActive: boolean) {
    setBusy(true);
    try {
      const updated = await setStaffActive(row.id, isActive);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setPendingDeactivate(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update staff');
    } finally {
      setBusy(false);
    }
  }

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== 'All' && r.role !== roleFilter) return false;
      if (term) {
        const hay = `${r.fullName} ${r.mobileNumber}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, searchTerm, roleFilter]);

  return (
    <div className="px-6 py-6">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff accounts</h1>
        </div>
        <Link href="/staff/add" className="px-3 py-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-md">+ Add staff</Link>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      )}

      {/* Staff table card (panel centered; empty state shown as a rounded card) */}
      <div className="max-w-6xl mx-auto">
        <section className="panel">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Staff accounts ({rows.length})</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff…"
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md w-52"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value === 'All' ? 'All' : e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="All">All Roles</option>
                <option value="Manager">Manager</option>
                <option value="Bartender">Bartender</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-slate-400">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1e1e26] text-[12px] font-bold uppercase tracking-wider text-[rgb(248_243_234_/_0.5)]">
                  <tr>
                    <th className="px-6 py-4 text-left">NAME</th>
                    <th className="px-6 py-4 text-left">ROLE</th>
                    <th className="px-6 py-4 text-left">MOBILE</th>
                    <th className="px-6 py-4 text-left">LAST LOGIN</th>
                    <th className="px-6 py-4 text-left">STATUS</th>
                    <th className="px-6 py-4 text-right">POURS TODAY</th>
                    <th className="px-6 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-900/10 bg-white">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6">
                        <div className="rounded-xl bg-white p-10 text-center text-slate-500">
                          No staff yet — add your first bartender to get started.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
                        <td className="px-6 py-4 font-medium text-slate-900">{r.fullName}</td>
                        <td className="px-6 py-4"><RoleBadge role={r.role} /></td>
                        <td className="px-6 py-4 text-slate-600">{r.mobileNumber}</td>
                        <td className="px-6 py-4 text-slate-600 tabular-nums">{r.lastLoginAtUtc ? new Date(r.lastLoginAtUtc).toLocaleDateString() : 'Never'}</td>
                        <td className="px-6 py-4">{r.isActive ? (<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Active</span>) : (<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">Inactive</span>)}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{r.poursToday}</td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            <Link href={`/staff/${r.id}/edit`} className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-white">Edit</Link>
                            {r.isActive ? (
                              <button onClick={() => setPendingDeactivate(r)} className="px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded">Deactivate</button>
                            ) : (
                              <button onClick={() => toggleActive(r, true)} disabled={busy} className="px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded">Reactivate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {pendingDeactivate && (
        <DeactivateStaffModal
          row={pendingDeactivate}
          busy={busy}
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={() => toggleActive(pendingDeactivate, false)}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: StaffRowDto['role'] }) {
  const tone = role === 'Manager'
    ? 'bg-violet-100 text-violet-800'
    : 'bg-slate-100 text-slate-700';
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${tone}`}>
      {role}
    </span>
  );
}

function DeactivateStaffModal({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: StaffRowDto;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-slate-900 text-lg">Deactivate {row.fullName}?</h3>
        <p className="text-sm text-slate-600 mt-2">
          They&apos;ll be signed out of the tablet immediately and won&apos;t be able to log back in until you reactivate them. Pour history stays intact.
        </p>
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
            className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg"
          >
            {busy ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
