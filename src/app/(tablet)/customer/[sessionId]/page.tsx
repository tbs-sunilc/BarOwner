'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  fetchPourQueue,
  type PourRequestDto,
} from '@/lib/api-client';

/**
 * SC-23 Customer detail. Scopes the pour queue down to a single session so a
 * bartender can see everything that table has pending in one place and tap
 * through to serve.
 *
 * Deep read (all wallets + full session shape) lives behind the end-user
 * `/api/v1/sessions/active` surface — staff-side session detail is a Phase-7
 * addition. For now this page runs on the same queue-by-bar feed, filtered.
 */
export default function CustomerDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const router = useRouter();

  const [rows, setRows] = useState<PourRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const barId = getActiveBarId();
    if (!barId || !Number.isFinite(sessionId) || sessionId <= 0) {
      setError('Missing bar or session context.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const queue = await fetchPourQueue(barId);
        setRows(queue.filter((r) => r.sessionId === sessionId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const customerName = rows[0]?.userDisplayName ?? 'Guest';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-slate-400 hover:text-white text-sm mb-4"
      >
        ← Back to floor
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{customerName}</h1>
        <p className="text-slate-400 text-sm">Session #{sessionId}</p>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="text-rose-400 bg-rose-950/40 border border-rose-900 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
          <p>No pending pour requests on this table.</p>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((pour) => (
          <li key={pour.id}>
            <Link
              href={`/serve/${pour.id}`}
              className="block bg-slate-800 border border-slate-700 hover:border-violet-500 hover:bg-slate-700/60 rounded-xl p-4 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {pour.bottleBrandName ?? 'Bottle'} {pour.bottleProductName ?? ''}
                  </p>
                  <p className="text-sm text-slate-400">
                    Requested {new Date(pour.createdAtUtc).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-2xl font-bold text-violet-300">{pour.requestedMl} ml</span>
              </div>
              {pour.userNotes && (
                <p className="mt-2 text-xs text-slate-400 italic">
                  &ldquo;{pour.userNotes}&rdquo;
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
