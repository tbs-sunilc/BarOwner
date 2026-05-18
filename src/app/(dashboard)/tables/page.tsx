'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  BarTable,
  CreateBarTableSpec,
  createBarTables,
  downloadBarTableQrBundle,
  downloadBarTableQrPng,
  listBarTables,
} from '@/lib/api-client';
import { getActiveBarId, setActiveBarId } from '@/lib/active-bar';

export default function TablesPage() {
  const searchParams = useSearchParams();
  const [barId, setBarId] = useState<number | null>(null);
  const [tables, setTables] = useState<BarTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [bundleDownloading, setBundleDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
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
  }, [searchParams]);

  const refresh = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listBarTables(barId);
      setTables(rows);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    if (barId) refresh();
  }, [barId, refresh]);

  async function onDownloadBundle() {
    if (!barId) return;
    setBundleDownloading(true);
    setError(null);
    try {
      await downloadBarTableQrBundle(barId);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Download failed.');
    } finally {
      setBundleDownloading(false);
    }
  }

  async function onDownloadPng(table: BarTable) {
    if (!barId || downloadingId !== null) return;
    setDownloadingId(table.id);
    setError(null);
    try {
      await downloadBarTableQrPng(barId, table.id, table.tableNumber);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  }

  const activeCount = tables.filter((t) => t.isActive).length;

  return (
    <div className="px-6 py-6">
      <header className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tables &amp; QR Codes</h2>
          <p className="text-xs text-slate-500">
            Create tables, download QR stickers, and stick them on your physical tables.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDownloadBundle}
            disabled={bundleDownloading || activeCount === 0}
            className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bundleDownloading ? 'Generating…' : 'Download All QRs (PDF)'}
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-md"
          >
            + Add Tables
          </button>
        </div>
      </header>

      {!barId && !loading && <NoActiveBarBanner />}

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Kpi label="Total Tables" value={tables.length} subtitle="Registered in system" accent="violet" />
        <Kpi label="Active" value={activeCount} subtitle="Scanning enabled" accent="green" />
        <Kpi label="Inactive" value={tables.length - activeCount} subtitle="QR scans blocked" accent="amber" />
      </div>

      {activeCount === 0 && !loading && tables.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          All tables are inactive — customers cannot check in. Enable at least one table or add new ones.
        </div>
      )}

      {/* How it works callout — shown only when no tables yet */}
      {!loading && tables.length === 0 && barId && (
        <div className="mb-5 rounded-xl border border-violet-100 bg-violet-50 px-5 py-4 text-sm text-violet-800 space-y-1">
          <p className="font-semibold text-violet-900">How table QR codes work</p>
          <ol className="list-decimal list-inside space-y-0.5 text-violet-700">
            <li>Add your tables below (e.g. "T1", "T2", "VIP-1")</li>
            <li>Click <strong>Download All QRs (PDF)</strong> — an A4 sheet with cut marks</li>
            <li>Print, cut, and laminate each QR label</li>
            <li>Stick one label on every physical table</li>
            <li>Customers scan with the SipSave app to check in</li>
          </ol>
        </div>
      )}

      {/* Table list */}
      <section className="rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Tables ({tables.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
              <tr>
                <Th>Table No.</Th>
                <Th>Floor Section</Th>
                <Th align="right">Capacity</Th>
                <Th>Status</Th>
                <Th>QR Token</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Loading tables…</td>
                </tr>
              )}
              {!loading && tables.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No tables yet. Click <strong>+ Add Tables</strong> to get started.
                  </td>
                </tr>
              )}
              {!loading && tables.map((t) => (
                <TableRow
                  key={t.id}
                  table={t}
                  downloadingQr={downloadingId === t.id}
                  onDownloadQr={() => onDownloadPng(t)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal && barId && (
        <AddTablesModal
          barId={barId}
          onClose={() => setShowAddModal(false)}
          onCreated={(newTables) => {
            setTables((prev) => [...prev, ...newTables]);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
//  Sub-components
// =============================================================================

function Kpi({
  label, value, subtitle, accent,
}: {
  label: string; value: number; subtitle: string; accent: 'violet' | 'amber' | 'green';
}) {
  const left =
    accent === 'violet' ? 'border-l-violet-600'
    : accent === 'amber' ? 'border-l-amber-500'
    : 'border-l-green-500';
  return (
    <div className={`bg-white border border-slate-200 ${left} border-l-4 rounded-md px-4 py-3`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function TableRow({
  table, downloadingQr, onDownloadQr,
}: {
  table: BarTable; downloadingQr: boolean; onDownloadQr: () => void;
}) {
  const rowBg = table.isActive ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 text-slate-400 hover:bg-slate-100';
  return (
    <tr className={`${rowBg} border-t border-slate-100 transition`}>
      <td className="px-3 py-2.5 font-semibold text-slate-800">{table.tableNumber}</td>
      <td className="px-3 py-2.5 text-slate-500">{table.floorSection ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2.5 text-right">{table.capacity ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2.5">
        {table.isActive
          ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Active</span>
          : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">Inactive</span>}
      </td>
      <td className="px-3 py-2.5">
        <code className="text-[10px] text-slate-400 font-mono">{table.qrToken.slice(0, 12)}…</code>
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onDownloadQr}
          disabled={downloadingQr}
          className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-white disabled:opacity-50 disabled:cursor-wait"
        >
          {downloadingQr ? '…' : 'Download QR'}
        </button>
      </td>
    </tr>
  );
}

function AddTablesModal({
  barId, onClose, onCreated,
}: {
  barId: number;
  onClose: () => void;
  onCreated: (tables: BarTable[]) => void;
}) {
  const emptyRow = (): CreateBarTableSpec & { _key: number } =>
    ({ _key: Date.now() + Math.random(), tableNumber: '', capacity: null, floorSection: null });

  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: number) {
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r._key !== key) : prev);
  }

  function updateRow(key: number, field: keyof CreateBarTableSpec, value: string) {
    setRows((prev) => prev.map((r) => {
      if (r._key !== key) return r;
      if (field === 'capacity') return { ...r, capacity: value === '' ? null : Number(value) };
      if (field === 'floorSection') return { ...r, floorSection: value === '' ? null : value };
      return { ...r, [field]: value };
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const specs = rows.map(({ tableNumber, capacity, floorSection }) => ({
      tableNumber: tableNumber.trim(),
      capacity,
      floorSection: floorSection?.trim() || null,
    }));
    const invalid = specs.find((s) => !s.tableNumber);
    if (invalid) { setError('Table number is required for every row.'); return; }

    setSaving(true);
    setError(null);
    try {
      const created = await createBarTables(barId, specs);
      onCreated(created);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Failed to create tables.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">Add Tables</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 text-[11px] uppercase tracking-wide text-slate-400 font-semibold px-1">
              <span>Table Number *</span>
              <span>Capacity</span>
              <span>Floor Section</span>
              <span />
            </div>

            {rows.map((row) => (
              <div key={row._key} className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 items-center">
                <input
                  type="text"
                  value={row.tableNumber}
                  onChange={(e) => updateRow(row._key, 'tableNumber', e.target.value)}
                  placeholder="e.g. T1, VIP-2"
                  maxLength={20}
                  required
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md w-full"
                />
                <input
                  type="number"
                  value={row.capacity ?? ''}
                  onChange={(e) => updateRow(row._key, 'capacity', e.target.value)}
                  placeholder="—"
                  min={1}
                  max={100}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md w-full"
                />
                <input
                  type="text"
                  value={row.floorSection ?? ''}
                  onChange={(e) => updateRow(row._key, 'floorSection', e.target.value)}
                  placeholder="e.g. Ground, Terrace"
                  maxLength={50}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md w-full"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row._key)}
                  disabled={rows.length === 1}
                  className="text-slate-300 hover:text-rose-500 disabled:opacity-30 text-lg leading-none"
                  aria-label="Remove row"
                >
                  &times;
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium"
            >
              + Add another table
            </button>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-md disabled:opacity-60"
            >
              {saving ? 'Creating…' : `Create ${rows.length} Table${rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
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
