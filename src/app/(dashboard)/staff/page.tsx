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
import { useEffect, useState } from 'react';
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

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff accounts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bartenders and managers who log into the tablet.
          </p>
        </div>
        <Link
          href="/staff/add"
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          + Add staff
        </Link>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {!loading && rows.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
          No staff yet — add your first bartender to get started.
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Mobile</th>
                <th className="px-3 py-2 text-left">Last login</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Pours today</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.isActive ? 'hover:bg-slate-50' : 'opacity-60 hover:bg-slate-50'}>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.fullName}</td>
                  <td className="px-3 py-2">
                    <RoleBadge role={r.role} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.mobileNumber}</td>
                  <td className="px-3 py-2 text-slate-600 tabular-nums">
                    {r.lastLoginAtUtc ? new Date(r.lastLoginAtUtc).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-2">
                    {r.isActive ? (
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Active</span>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.poursToday}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/staff/${r.id}/edit`}
                      className="text-xs font-semibold text-slate-700 hover:bg-slate-100 px-2 py-1 rounded mr-1"
                    >
                      Edit
                    </Link>
                    {r.isActive ? (
                      <button
                        onClick={() => setPendingDeactivate(r)}
                        className="text-xs font-semibold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleActive(r, true)}
                        disabled={busy}
                        className="text-xs font-semibold text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
