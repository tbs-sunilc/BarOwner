'use client';

/**
 * SC-17 Re-engagement campaigns.
 *
 * Single-page workspace:
 *   - Left column: dormant-user table with checkboxes.  Rows already at the
 *     BR-044 monthly cap render disabled + tagged so the bar owner can see
 *     exactly which recipients will be dropped on submit.
 *   - Right column: composer with subject + body template and a live preview
 *     that substitutes {name}/{bottle}/{remaining} against the first selected
 *     row — the same substitution the server runs at send time.
 *   - Bottom: recent campaigns history, aggregated by CampaignId.
 */

import { useEffect, useMemo, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  createCampaign,
  listCampaigns,
  listDormantUsers,
  type CampaignHistoryDto,
  type DormantUserDto,
} from '@/lib/api-client';

const DEFAULT_TEMPLATE =
  'Hey {name}, you still have {remaining} left in your {bottle} bottle at our bar. Drop by and finish it off!';

export default function CampaignsPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [daysInactive, setDaysInactive] = useState(30);
  const [rows, setRows] = useState<DormantUserDto[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [subject, setSubject] = useState('We miss you');
  const [body, setBody] = useState(DEFAULT_TEMPLATE);
  const [pushOn, setPushOn] = useState(true);
  const [whatsappOn, setWhatsappOn] = useState(true);

  const [history, setHistory] = useState<CampaignHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    void reload(barId, daysInactive);
  }, [barId, daysInactive]);

  async function reload(id: number, days: number) {
    try {
      setError(null);
      const [dormant, recent] = await Promise.all([
        listDormantUsers(id, days),
        listCampaigns(id, 25),
      ]);
      setRows(dormant);
      setHistory(recent);
      // Prune selections for rows that disappeared on refresh.
      setSelected((prev) => {
        const next = new Set<number>();
        for (const r of dormant) if (prev.has(r.userId) && !r.atMonthlyCap) next.add(r.userId);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dormant users');
    } finally {
      setLoading(false);
    }
  }

  const eligibleRows = useMemo(() => rows.filter((r) => !r.atMonthlyCap), [rows]);

  function toggleAll() {
    if (selected.size === eligibleRows.length) setSelected(new Set());
    else setSelected(new Set(eligibleRows.map((r) => r.userId)));
  }

  function toggleOne(userId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  // Live preview keyed off the first selected user (or the first row).
  const previewAnchor = useMemo(() => {
    const first = rows.find((r) => selected.has(r.userId)) ?? rows[0];
    return first ?? null;
  }, [rows, selected]);

  const preview = useMemo(() => {
    if (!previewAnchor) return body;
    return body
      .replaceAll('{name}', previewAnchor.fullName?.trim() || 'there')
      .replaceAll('{bottle}', `${previewAnchor.bottleBrandName} ${previewAnchor.bottleProductName}`.trim())
      .replaceAll('{remaining}', `${previewAnchor.remainingVolumeMl} ml`);
  }, [body, previewAnchor]);

  async function handleSend() {
    if (barId == null || selected.size === 0) return;
    const channels: ('Push' | 'Whatsapp')[] = [];
    if (pushOn) channels.push('Push');
    if (whatsappOn) channels.push('Whatsapp');
    if (channels.length === 0) {
      setError('Select at least one channel.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCampaign(barId, {
        subject: subject.trim(),
        bodyTemplate: body,
        userIds: Array.from(selected),
        channels,
      });
      setFlash(
        `Campaign queued — ${result.enqueuedCount} recipient${result.enqueuedCount === 1 ? '' : 's'}` +
        (result.skippedCount > 0 ? `, ${result.skippedCount} skipped (monthly cap).` : '.'));
      setSelected(new Set());
      await reload(barId, daysInactive);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Re-engagement campaigns</h1>
        <p className="text-sm text-slate-500 mt-1">
          Reach customers with leftover bottles who haven&apos;t been in for a while. Max 2 campaigns per user per month.
        </p>
      </header>

      {flash && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          {flash}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6 mb-10">
        {/* Dormant user table */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-800 text-sm">Dormant customers</h2>
              <label className="text-xs text-slate-500">
                Inactive&nbsp;
                <select value={daysInactive} onChange={(e) => setDaysInactive(Number(e.target.value))}
                        className="rounded border-slate-300 text-xs">
                  <option value={14}>14+ days</option>
                  <option value={30}>30+ days</option>
                  <option value={60}>60+ days</option>
                  <option value={90}>90+ days</option>
                </select>
              </label>
            </div>
            <span className="text-xs text-slate-500">
              {selected.size} selected · {eligibleRows.length} eligible of {rows.length}
            </span>
          </div>

          {loading && <p className="p-6 text-slate-400 text-sm">Loading dormant customers…</p>}
          {!loading && rows.length === 0 && (
            <p className="p-6 text-slate-500 text-sm">No dormant wallets yet at this threshold.</p>
          )}

          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox"
                           checked={eligibleRows.length > 0 && selected.size === eligibleRows.length}
                           onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Bottle</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                  <th className="px-3 py-2 text-right">Days dormant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const capped = r.atMonthlyCap;
                  return (
                    <tr key={r.userId} className={capped ? 'opacity-50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2">
                        <input type="checkbox"
                               disabled={capped}
                               checked={selected.has(r.userId)}
                               onChange={() => toggleOne(r.userId)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{r.fullName ?? '—'}</div>
                        <div className="text-xs text-slate-500">{r.mobileNumber}</div>
                        {capped && <div className="text-[10px] uppercase text-amber-700">At monthly cap</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {r.bottleBrandName} {r.bottleProductName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.remainingVolumeMl} ml</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.daysSinceLastActivity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Composer */}
        <aside className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-800 text-sm">Compose message</h2>

          <label className="block text-xs font-medium text-slate-600 space-y-1">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120}
                   className="w-full rounded-lg border-slate-300 text-sm" />
          </label>

          <label className="block text-xs font-medium text-slate-600 space-y-1">
            <span>Body (supports {'{name}'}, {'{bottle}'}, {'{remaining}'})</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1000}
                      className="w-full rounded-lg border-slate-300 text-sm font-mono" />
          </label>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Preview</p>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap">
              {preview || <span className="text-slate-400">Nothing to preview yet.</span>}
            </div>
          </div>

          <fieldset className="space-y-1">
            <legend className="text-xs font-medium text-slate-600">Channels</legend>
            <label className="inline-flex items-center gap-2 text-sm mr-4">
              <input type="checkbox" checked={pushOn} onChange={(e) => setPushOn(e.target.checked)} /> Push
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={whatsappOn} onChange={(e) => setWhatsappOn(e.target.checked)} /> WhatsApp
            </label>
          </fieldset>

          <button
            onClick={handleSend}
            disabled={submitting || selected.size === 0 || (!pushOn && !whatsappOn)}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold py-2.5 rounded-lg text-sm transition"
          >
            {submitting ? 'Sending…' : `Send to ${selected.size} customer${selected.size === 1 ? '' : 's'}`}
          </button>
        </aside>
      </div>

      {/* History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm">Recent campaigns</h2>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm">No campaigns sent yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Sent</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-right">Recipients</th>
                <th className="px-3 py-2 text-right">Delivered</th>
                <th className="px-3 py-2 text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c.campaignId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700 tabular-nums">
                    {new Date(c.createdAtUtc).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{c.subject ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.recipientCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.deliveredCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">{c.failedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
