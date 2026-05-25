'use client';

/**
 * SC-16 Loyalty programme config + live stats.
 *
 * Two independent reads land in parallel on mount: the programme (which may
 * 204, in which case the form renders the starter defaults) and the stats
 * tiles (which always return something — zeros if no ledger yet).
 */

import { useEffect, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  CheckboxField,
  FormField,
  FormRow,
  INPUT_CLASS,
} from '@/components/forms/FormField';
import {
  ApiError,
  getLoyaltyProgramme,
  getLoyaltyStats,
  saveLoyaltyProgramme,
  type ConfigureProgrammePayload,
  type ProgrammeDto,
  type ProgrammeStatsDto,
} from '@/lib/api-client';

const STARTER: ConfigureProgrammePayload = {
  name: '  Regulars rewards',
  description: null,
  // Spec default: 1 point per ₹100 ⇒ 0.01 points per rupee.
  pointsPerRupeeSpent: 0.01,
  pointsPerRedemption: 100,
  redemptionValueInPaise: 10_000, // ₹100
  minPointsForRedemption: 100,
  maxRedemptionPctOfPurchase: 50,
  pointsExpiryDays: null,
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: null,
  isActive: true,
};

export default function LoyaltyPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [form, setForm] = useState<ConfigureProgrammePayload>(STARTER);
  const [stats, setStats] = useState<ProgrammeStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    (async () => {
      try {
        const [programme, statsRow] = await Promise.all([
          getLoyaltyProgramme(barId),
          getLoyaltyStats(barId),
        ]);
        if (programme) setForm(toPayload(programme));
        setStats(statsRow);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load programme');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  const update = <K extends keyof ConfigureProgrammePayload>(k: K, v: ConfigureProgrammePayload[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  async function handleSave() {
    if (barId == null) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await saveLoyaltyProgramme(barId, form);
      setForm(toPayload(updated));
      setStats(await getLoyaltyStats(barId));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save programme');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Loyalty</h1>
        <p className="text-sm text-slate-500 mt-1">
          Reward regulars with points they can spend on food orders at your bar.
        </p>
      </header>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Members" value={stats?.memberCount ?? '—'} />
        <StatTile label="Earned (this month)" value={stats?.pointsEarnedThisMonth ?? '—'} />
        <StatTile label="Redeemed (this month)" value={stats?.pointsRedeemedThisMonth ?? '—'} />
        <StatTile label="Lifetime redeemed" value={stats?.lifetimePointsRedeemed ?? '—'} />
      </div>

      {loading && <p className="text-slate-400">Loading programme…</p>}
      {error && (
        <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {!loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <FormRow>
            <FormField label="Programme name">
              <input value={form.name} maxLength={120}
                onChange={(e) => update('name', e.target.value)}
                className={INPUT_CLASS} />
            </FormField>
            <CheckboxField
              label="Status"
              checked={form.isActive}
              onChange={(v) => update('isActive', v)}
              description="Accepting new earns + redemptions"
            />
          </FormRow>

          <FormField label="Description (optional)">
            <textarea rows={2} value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value || null)}
              className={INPUT_CLASS} />
          </FormField>

          <FormRow>
            <FormField
              label="Points earned per ₹1 spent"
              hint={<p className="text-xs text-slate-500">{describeRate(form.pointsPerRupeeSpent)}</p>}
            >
              <input type="number" min={0} step="0.001" value={form.pointsPerRupeeSpent}
                onChange={(e) => update('pointsPerRupeeSpent', Number(e.target.value))}
                className={INPUT_CLASS} />
            </FormField>
            <FormField label="Points expiry (days, blank = never)">
              <input type="number" min={0} value={form.pointsExpiryDays ?? ''}
                onChange={(e) => update('pointsExpiryDays', e.target.value === '' ? null : Number(e.target.value))}
                className={INPUT_CLASS} />
            </FormField>
          </FormRow>

          <FormRow cols={3}>
            <FormField label="Points per redemption chunk">
              <input type="number" min={1} value={form.pointsPerRedemption}
                onChange={(e) => update('pointsPerRedemption', Number(e.target.value))}
                className={INPUT_CLASS} />
            </FormField>
            <FormField label="Chunk value (₹)">
              <input type="number" min={1} value={form.redemptionValueInPaise / 100}
                onChange={(e) => update('redemptionValueInPaise', Math.round(Number(e.target.value) * 100))}
                className={INPUT_CLASS} />
            </FormField>
            <FormField label="Minimum to redeem">
              <input type="number" min={form.pointsPerRedemption} step={form.pointsPerRedemption}
                value={form.minPointsForRedemption}
                onChange={(e) => update('minPointsForRedemption', Number(e.target.value))}
                className={INPUT_CLASS} />
            </FormField>
          </FormRow>

          <FormField label="Max redemption share of a single order (%)">
            <input type="number" min={0} max={100} step={1} value={form.maxRedemptionPctOfPurchase}
              onChange={(e) => update('maxRedemptionPctOfPurchase', Number(e.target.value))}
              className={`${INPUT_CLASS} max-w-[10rem]`} />
          </FormField>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
            >
              {saving ? 'Saving…' : 'Save programme'}
            </button>
            {saved && <span className="text-emerald-700 text-sm">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function describeRate(rate: number): string {
  if (rate <= 0) return 'No points issued.';
  const rupeesPerPoint = 1 / rate;
  if (Math.abs(rupeesPerPoint - Math.round(rupeesPerPoint)) < 0.01) {
    return `≈ 1 point per ₹${Math.round(rupeesPerPoint)} spent.`;
  }
  return `≈ ${rate.toFixed(3)} points per ₹1 spent.`;
}

function toPayload(p: ProgrammeDto): ConfigureProgrammePayload {
  return {
    name: p.name,
    description: p.description,
    pointsPerRupeeSpent: p.pointsPerRupeeSpent,
    pointsPerRedemption: p.pointsPerRedemption,
    redemptionValueInPaise: p.redemptionValueInPaise,
    minPointsForRedemption: p.minPointsForRedemption,
    maxRedemptionPctOfPurchase: p.maxRedemptionPctOfPurchase,
    pointsExpiryDays: p.pointsExpiryDays,
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    isActive: p.isActive,
  };
}
