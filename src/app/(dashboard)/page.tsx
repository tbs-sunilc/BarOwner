'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveBarId, setActiveBarDetails } from '@/lib/active-bar';
import {
  ApiError,
  getDashboard,
  getBarDetails,
  type DashboardDto,
} from '@/lib/api-client';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    try {
      setLoading(true);
      setError(null);

      // 1. Get Bar Details (Token based)
      // This is more reliable than sessionStorage which might be cleared
      let bar;
      try {
        bar = await getBarDetails();
        if (bar) {
          setActiveBarDetails(bar); // Keep sync with storage
        }
      } catch (barErr) {
        console.error('Failed to fetch bar details:', barErr);
        if (barErr instanceof ApiError && barErr.status === 401) {
          router.replace('/login');
          return;
        }
        // If 204 or error, maybe they need registration
        router.replace('/register/kyc-status');
        return;
      }

      if (!bar) {
        router.replace('/register/kyc-status');
        return;
      }

      // 2. Load Dashboard Data
      const dashboardData = await getDashboard(bar.barId);
      setData(dashboardData);
    } catch (err) {
      console.error('Dashboard load error:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-danger/20 bg-danger-tint p-6 text-danger">
          <h3 className="font-display text-lg font-bold">Failed to load dashboard</h3>
          <p className="mt-1 text-sm opacity-90">{error}</p>
          <button 
            onClick={() => init()}
            className="mt-4 btn btn-sm bg-danger text-white hover:bg-danger/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, revenueChart, topBottles, recentTransactions, subscription } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Subscription Alert */}
      {subscription?.isFailing && (
        <div className="reveal flex items-center justify-between rounded-xl border border-warning/20 bg-warning-tint p-4 text-warning">
          <div className="flex items-center gap-3">
            <IconAlertCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-bold">Subscription Payment Failing</p>
              <p className="text-xs opacity-90">{subscription.lastFailureReason || 'Please update your billing details to avoid service interruption.'}</p>
            </div>
          </div>
          <Link href="/subscription" className="btn btn-sm btn-primary">
            Fix Now
          </Link>
        </div>
      )}

      {/* KPI Row */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Wallet Revenue (MTD)"
          value={formatLargeCurrency(kpis.walletRevenueMtdInPaise)}
          trend="↑ 18% vs last month"
          trendType="success"
          topBorder="border-info"
          index={0}
        />
        <KpiCard
          label="Active Wallets"
          value={kpis.activeWalletCount.toLocaleString()}
          trend="↑ 24 new this week"
          trendType="success"
          topBorder="border-success"
          index={1}
        />
        <KpiCard
          label="Avg Spend — Wallet Customer"
          value={formatCurrency(kpis.averageWalletSpendInPaise)}
          trend="↑ ₹600 vs walk-in"
          trendType="success"
          topBorder="border-warning"
          index={2}
        />
        <KpiCard
          label="Expiry Risk (7 days)"
          value={kpis.expiryRiskCount.toString()}
          trend={kpis.expiryRiskCount > 0 ? "⚠ Action recommended" : "Everything safe"}
          trendType={kpis.expiryRiskCount > 0 ? "danger" : "success"}
          topBorder="border-danger"
          index={3}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <section className="reveal lg:col-span-2" style={{ '--index': 4 } as any}>
          <div className="panel p-6 h-full border-t-0">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">Wallet Revenue — Last 7 Days</h3>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary bg-ivory-2 border-none text-[11px] px-3">Export PDF</button>
                <button className="btn btn-sm btn-secondary bg-ivory-2 border-none text-[11px] px-3">Export Excel</button>
              </div>
            </div>
            
            <div className="flex h-64 items-end gap-3 px-2">
              {revenueChart.length > 0 ? (
                revenueChart.slice(-7).map((point, i) => (
                  <div key={point.day} className="group relative flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatCompactCurrency(point.revenueInPaise)}
                    </span>
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-500 ${point.isToday ? 'bg-success' : 'bg-[#5e5ce6]'}`}
                      style={{ height: `${Math.max(10, (point.revenueInPaise / Math.max(...revenueChart.map(p => p.revenueInPaise || 1))) * 100)}%` }}
                    />
                    <span className="text-[10px] font-semibold text-muted mt-2">
                      {point.isToday ? 'Today' : point.day.substring(0, 3)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted text-sm italic">
                  No chart data available yet
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Top Bottles */}
        <section className="reveal" style={{ '--index': 5 } as any}>
          <div className="panel p-6 h-full">
            <h3 className="mb-6 text-lg font-bold text-ink">Top Bottles by Revenue</h3>
            <div className="space-y-6">
              {topBottles.length > 0 ? (
                topBottles.slice(0, 5).map((bottle) => (
                  <div key={bottle.bottleCatalogueId} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-ink-2">{bottle.brandName} {bottle.productName}</p>
                      <p className="text-sm font-bold text-[#5e5ce6]">{formatCompactCurrency(bottle.revenueInPaise)}</p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-ivory-2 overflow-hidden">
                      <div 
                        className="h-full bg-[#5e5ce6] group-hover:bg-[#4a48c9] transition-all duration-700 rounded-full" 
                        style={{ width: `${(bottle.revenueInPaise / topBottles[0].revenueInPaise) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-muted text-sm italic">
                  No sales data yet
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Recent Wallet Purchases */}
      <section className="reveal" style={{ '--index': 6 } as any}>
        <div className="panel overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink">Recent Wallet Purchases</h3>
            <Link href="/revenue" className="btn btn-sm btn-secondary bg-[#f3f4f6] border-none text-[11px] font-bold text-slate-600 px-3">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1e1e26] text-[10px] font-bold uppercase tracking-wider text-[rgb(248_243_234_/_0.5)]">
                <tr>
                  <th className="px-6 py-4 text-left">USER</th>
                  <th className="px-6 py-4 text-left">BOTTLE</th>
                  <th className="px-6 py-4 text-left">VOLUME</th>
                  <th className="px-6 py-4 text-left">AMOUNT</th>
                  <th className="px-6 py-4 text-left">METHOD</th>
                  <th className="px-6 py-4 text-left">TIME</th>
                  <th className="px-6 py-4 text-left">STATUS</th>
                  <th className="px-6 py-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-900/10 bg-[#df8b0b]">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => (
                    <tr key={tx.paymentId} className="hover:bg-white/5 transition-colors border-b border-orange-900/10">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${getUserColor(tx.paymentId)}`}>
                            {tx.purpose.substring(0, 1)}
                          </div>
                          <span className="font-bold text-ink-2">{tx.purpose.split(' ')[0]} M.</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-ink-3">
                        {tx.purpose.includes('Purchase') ? 'JW Black Label' : tx.purpose}
                      </td>
                      <td className="px-6 py-4 text-muted font-medium">750ml</td>
                      <td className="px-6 py-4 font-bold text-[#5e5ce6] tabular-nums">
                        {formatCurrency(tx.amountInPaise)}
                      </td>
                      <td className="px-6 py-4 text-muted font-medium">{tx.paymentMethod || 'UPI'}</td>
                      <td className="px-6 py-4 text-muted font-medium tabular-nums">
                        {new Date(tx.capturedAtUtc).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`status-pill ${tx.status === 'Captured' ? 'status-success' : 'status-danger opacity-80'}`}>
                          {tx.status === 'Captured' ? 'Captured' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {tx.status === 'Captured' ? (
                          <button className="btn btn-sm btn-secondary bg-white border-border text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-sm">
                            View
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted italic">No wallet</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted italic">
                      No recent purchases found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* QA Simulate Footer */}
      <footer className="pt-8 border-t border-border flex items-center gap-4">
        <span className="text-xs text-muted flex items-center gap-1 italic">
          <IconEdit className="h-3 w-3" /> QA Simulate:
        </span>
        <button className="btn btn-sm bg-[#c27803] text-white text-[11px] font-bold border-none rounded-lg px-4 py-2 shadow-sm">
          Payment Failure
        </button>
        <button className="btn btn-sm bg-success text-white text-[11px] font-bold border-none rounded-lg px-4 py-2 shadow-sm">
          Restore Subscription
        </button>
      </footer>
    </div>
  );
}

function KpiCard({ label, value, trend, trendType, topBorder, index }: { 
  label: string; 
  value: string; 
  trend: string; 
  trendType: 'success' | 'warning' | 'danger';
  topBorder: string;
  index: number 
}) {
  const trendColor = trendType === 'success' ? 'text-success' : trendType === 'warning' ? 'text-warning' : 'text-danger';
  
  return (
    <div className={`reveal panel p-6 pt-5 group hover:shadow-md transition-all border-t-4 ${topBorder}`} style={{ '--index': index } as any}>
      <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-ink mb-2 tabular-nums">{value}</p>
      <p className={`text-[11px] font-bold flex items-center gap-1 ${trendColor}`}>
        {trend}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse pb-12">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="panel h-32 p-5 border-t-4 border-ivory-2" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 panel h-80" />
        <div className="panel h-80" />
      </div>
      <div className="panel h-64" />
    </div>
  );
}

function formatCurrency(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatLargeCurrency(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)}L`;
  }
  return formatCurrency(paise);
}

function formatCompactCurrency(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 1000) {
    return `₹${Math.round(rupees / 1000)}k`;
  }
  return formatCurrency(paise);
}

function getUserColor(id: number) {
  const colors = ['bg-orange-500', 'bg-blue-600', 'bg-slate-500', 'bg-indigo-700', 'bg-violet-600'];
  return colors[id % colors.length];
}

// Icons
function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );
}
