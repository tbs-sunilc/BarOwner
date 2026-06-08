"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveBarId, setActiveBarDetails } from "@/lib/active-bar";
import {
  ApiError,
  getDashboard,
  getBarDetails,
  listBarTables,
  listWalletPurchases,
  downloadRevenueExport,
  simulateSubscriptionPaymentFailure,
  simulateSubscriptionRestore,
  type BarTableDto,
  type BarWalletPurchaseListItemDto,
  type DashboardDto,
  BarTable,
  downloadBarTableQrBundle,
} from "@/lib/api-client";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [barId, setBarId] = useState<number | null>(null);
  const [barName, setBarName] = useState("");
  const [ownerName, setOwnerName] = useState("Owner");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTables, setQrTables] = useState<BarTableDto[]>([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [tables, setTables] = useState<BarTable[]>([]);
  const [recentWalletPurchases, setRecentWalletPurchases] = useState<
    BarWalletPurchaseListItemDto[]
  >([]);
  const [bundleDownloading, setBundleDownloading] = useState(false);
  const [subscriptionQaAction, setSubscriptionQaAction] = useState<
    "failure" | "restore" | null
  >(null);

  useEffect(() => {
    void init();
  }, []);

  const refresh = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listBarTables(barId);
      setTables(rows);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : "Network error.");
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
      setError(ex instanceof ApiError ? ex.message : "Download failed.");
    } finally {
      setBundleDownloading(false);
    }
  }

  async function init() {
    try {
      setLoading(true);
      setError(null);

      // 1. Get Bar Details (Token based)
      let bar;
      try {
        bar = await getBarDetails();
        if (bar) {
          if (!bar.isEmailVerified) {
            clearActiveBarId();
            setError(
              "Your bar email is not verified yet. Please check your inbox and verify the email before accessing the dashboard.",
            );
            return;
          }
          setBarId(bar.barId);
          setBarName(bar.businessName);
          setActiveBarDetails(bar);
        }
      } catch (barErr) {
        console.error("Failed to fetch bar details:", barErr);
        if (barErr instanceof ApiError && barErr.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/register/kyc-status");
        return;
      }

      if (typeof window !== "undefined") {
        const storedName = window.sessionStorage.getItem(
          "sipsave-barowner-full-name",
        );
        if (storedName) setOwnerName(storedName);
      }

      if (!bar) {
        router.replace("/register/kyc-status");
        return;
      }

      // 2. Load Dashboard + table QR data + real recent wallet purchases for the active bar
      const [dashboardData, tableData, walletPurchaseData] = await Promise.all([
        getDashboard(bar.barId),
        loadQrTables(bar.barId),
        listWalletPurchases(bar.barId, 0, 5),
      ]);
      setData(dashboardData);
      setQrTables(tableData);
      setRecentWalletPurchases(walletPurchaseData);
    } catch (err) {
      console.error("Dashboard load error:", err);
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        err instanceof ApiError ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: "pdf" | "csv") {
    if (!barId) return;
    try {
      setExporting(true);
      await downloadRevenueExport(barId, format, "ThisMonth");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export report. Please try again later.");
    } finally {
      setExporting(false);
    }
  }

  async function loadQrTables(activeBarId = barId): Promise<BarTableDto[]> {
    if (!activeBarId) return [];
    try {
      setQrLoading(true);
      setQrError(null);
      const tables = await listBarTables(activeBarId);
      return tables;
    } catch (err) {
      console.error("QR table load error:", err);
      setQrError(
        err instanceof ApiError ? err.message : "Failed to load table QR codes",
      );
      return [];
    } finally {
      setQrLoading(false);
    }
  }

  async function openQrModal() {
    setShowQrModal(true);
    if (barId) refresh();
    // barId, refresh
    // if (barId && qrTables.length === 0 && !qrLoading) {
    //   setQrTables(await loadQrTables(barId));
    // }
  }

  async function handleSubscriptionQa(action: "failure" | "restore") {
    if (!barId || subscriptionQaAction) return;

    try {
      setSubscriptionQaAction(action);
      setError(null);
      if (action === "failure") {
        await simulateSubscriptionPaymentFailure(barId);
      } else {
        await simulateSubscriptionRestore(barId);
      }
      await init();
    } catch (err) {
      console.error("Subscription QA simulation failed:", err);
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to update subscription QA state.",
      );
    } finally {
      setSubscriptionQaAction(null);
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-danger/20 bg-danger-tint p-6 text-danger">
          <h3 className="font-display text-lg font-bold">
            Failed to load dashboard
          </h3>
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

  const { kpis, revenueChart, topBottles, subscription } = data;
  const visibleRevenueChart = revenueChart.slice(-7);
  const maxRevenue = Math.max(...visibleRevenueChart.map((p) => p.revenueInPaise), 0);

  const handleDownloadPDF = () => {
    if (qrTables.length === 0) return;
    const printWindow = window.open("", "", "width=800,height=800");
    if (!printWindow) {
      alert("Please allow popups to download the PDF.");
      return;
    }

    const svgElements = document.querySelectorAll(".qr-code-svg");

    let content = `
      <html>
        <head>
          <title>Bar QR Codes - SipSave</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e1e26; }
            .header { text-align: center; margin-bottom: 40px; padding: 20px; border-bottom: 2px solid #f3f4f6; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; padding: 20px; }
            .card { border: 2px dashed #e5e7eb; border-radius: 16px; padding: 30px; text-align: center; page-break-inside: avoid; }
            .table-name { font-size: 24px; font-weight: bold; margin: 16px 0 8px; color: #1e1b4b; }
            .token { font-family: monospace; font-size: 10px; color: #6b7280; word-break: break-all; }
            .instructions { font-size: 14px; color: #6b7280; margin-top: 10px; }
            @media print {
              @page { margin: 20mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SipSave Table QR Codes</h1>
            <p class="instructions">Print and place these QR codes on each table. Customers scan them to check in.</p>
          </div>
          <div class="grid">
    `;

    qrTables.forEach((table, index) => {
      const svg = svgElements[index]?.outerHTML || "";
      content += `
        <div class="card">
          ${svg}
          <div class="table-name">${escapeHtml(table.tableNumber)}</div>
          <div class="token">${escapeHtml(table.qrToken)}</div>
        </div>
      `;
    });

    content += `
          </div>
          <script>
            window.onload = () => { 
              setTimeout(() => {
                window.print(); 
                window.close(); 
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Welcome back, {ownerName} · {barName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-[11px] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Subscription Active
          </div>
          <button
            onClick={openQrModal}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg shadow-sm text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <IconQrCode className="h-4 w-4 text-slate-500" />
            View Bar QR Codes
          </button>
          <Link
            href="/inventory/add"
            className="flex items-center gap-2 px-4 py-2 bg-[#5e5ce6] hover:bg-[#4a48c9] text-white rounded-lg shadow-sm text-[11px] font-bold transition-colors"
          >
            <IconPlus className="h-4 w-4" />
            Add Bottle
          </Link>
        </div>
      </div>

      {/* Subscription Alert */}
      {subscription?.isFailing && (
        <div className="reveal flex items-center justify-between rounded-xl border border-warning/20 bg-warning-tint p-4 text-warning">
          <div className="flex items-center gap-3">
            <IconAlertCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-bold">Subscription Payment Failing</p>
              <p className="text-xs opacity-90">
                {subscription.lastFailureReason ||
                  "Please update your billing details to avoid service interruption."}
              </p>
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
          trend={
            kpis.expiryRiskCount > 0
              ? "⚠ Action recommended"
              : "Everything safe"
          }
          trendType={kpis.expiryRiskCount > 0 ? "danger" : "success"}
          topBorder="border-danger"
          index={3}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <section
          className="reveal lg:col-span-2"
          style={{ "--index": 4 } as any}
        >
          <div className="panel p-6 h-full border-t-0">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Wallet Revenue — Last 7 Days
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={exporting}
                  onClick={() => handleExport("pdf")}
                  className="btn btn-sm btn-secondary bg-[#f3f4f6] border-none text-[11px] font-bold text-slate-600 px-3 hover:bg-slate-200"
                >
                  {exporting ? "..." : "Export PDF"}
                </button>
                <button
                  disabled={exporting}
                  onClick={() => handleExport("csv")}
                  className="btn btn-sm btn-secondary bg-[#f3f4f6] border-none text-[11px] font-bold text-slate-600 px-3 hover:bg-slate-200"
                >
                  {exporting ? "..." : "Export Excel"}
                </button>
              </div>
            </div>
            
            <div className="flex h-64 items-end gap-3 px-2" >
              <div className="h-56 w-full pt-2">
  {revenueChart.length > 0 ? (
    <>
      {/* Grid */}
      <div className="relative h-full">

        {/* Horizontal Grid Lines */}
        <div className="absolute inset-x-0 bottom-8 top-0 border-b border-l border-slate-200">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[1, 2, 3, 4].map((line) => (
              <div
                key={line}
                className="border-t border-dashed border-slate-200"
              />
            ))}
          </div>

          <div className="absolute inset-x-4 bottom-0 top-0 z-10 flex items-end gap-4">
            {visibleRevenueChart.map((point) => {
              const barHeight =
                maxRevenue > 0 && point.revenueInPaise > 0
                  ? Math.max(24, (point.revenueInPaise / maxRevenue) * 180)
                  : 8;

              return (
                <div
                  key={point.day}
                  className="relative flex h-full flex-1 flex-col items-center justify-end"
                >
                  {/* Amount */}
                  <span className="mb-2 text-[11px] font-bold text-slate-600">
                    {formatCompactCurrency(point.revenueInPaise)}
                  </span>

                  {/* Bar */}
                  <div
                    className={`
                      w-full max-w-[56px]
                      rounded-t-xl
                      transition-all duration-500
                      hover:opacity-90
                      ${
                        point.isToday
                          ? 'bg-emerald-500'
                          : 'bg-[#5e5ce6]'
                      }
                    `}
                    style={{
                      height: `${barHeight}px`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-0 flex h-8 items-end gap-4">
          {visibleRevenueChart.map((point) => (
            <div
              key={point.day}
              className="flex flex-1 items-center justify-center pt-3"
            >
              <span className="text-[11px] font-semibold text-slate-500">
                {point.isToday
                  ? 'Today'
                  : new Date(point.day).toLocaleDateString(
                      'en-IN',
                      {
                        weekday: 'short',
                      }
                    )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  ) : (
    <div className="flex h-full items-center justify-center text-sm italic text-slate-400">
      No chart data available yet
    </div>
  )}
</div>
            </div>
          </div>
        </section>

        {/* Top Bottles */}
        <section className="reveal" style={{ "--index": 5 } as any}>
          <div className="panel p-6 h-full">
            <h3 className="mb-6 text-lg font-bold text-ink">
              Top Bottles by Revenue
            </h3>
            <div className="space-y-6">
              {topBottles.length > 0 ? (
                topBottles.slice(0, 5).map((bottle) => (
                  <div key={bottle.bottleCatalogueId} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-ink-2">
                        {bottle.brandName} {bottle.productName}
                      </p>
                      <p className="text-sm font-bold text-[#5e5ce6]">
                        {formatCompactCurrency(bottle.revenueInPaise)}
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-ivory-2 overflow-hidden">
                      <div
                        className="h-full bg-[#5e5ce6] group-hover:bg-[#4a48c9] transition-all duration-700 rounded-full"
                        style={{
                          width: `${(bottle.revenueInPaise / topBottles[0].revenueInPaise) * 100}%`,
                        }}
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
      <section className="reveal" style={{ "--index": 6 } as any}>
        <div className="panel overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink">Recent Wallet Purchases</h3>
            <Link href="/wallet-purchases" className="btn btn-sm btn-secondary bg-[#f3f4f6] border-none text-[11px] font-bold text-slate-600 px-3">
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
                {recentWalletPurchases.length > 0 ? (
                  recentWalletPurchases.map((tx) => {
                    const customerName = tx.customerName || "Unknown customer";
                    const capturedAt = tx.capturedAtUtc ?? tx.createdAtUtc;

                    return (
                      <tr
                        key={tx.paymentId}
                        className="hover:bg-white/5 transition-colors border-b border-orange-900/10"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${getUserColor(tx.paymentId)}`}
                            >
                              {customerName.substring(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-ink-2">{customerName}</p>
                              <p className="text-[11px] font-medium text-muted">
                                {tx.customerMobile || "No mobile"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-ink-3">
                          {tx.bottleName || "-"}
                        </td>
                        <td className="px-6 py-4 text-muted font-medium">
                          {tx.volumeMl == null ? "-" : `${tx.volumeMl}ml`}
                        </td>
                        <td className="px-6 py-4 font-bold text-[#5e5ce6] tabular-nums">
                          {formatCurrency(tx.amountInPaise)}
                        </td>
                        <td className="px-6 py-4 text-muted font-medium">
                          {tx.paymentMethod || "-"}
                        </td>
                        <td className="px-6 py-4 text-muted font-medium tabular-nums">
                          {new Date(capturedAt).toLocaleTimeString(
                            "en-IN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            },
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`status-pill ${tx.status === "Captured" ? "status-success" : "status-danger opacity-80"}`}
                          >
                            {tx.status === "Captured" ? "Captured" : "Failed"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {tx.status === "Captured" && tx.walletId != null ? (
                            <Link href={`/wallet-purchases/${tx.paymentId}`} className="btn btn-sm btn-secondary bg-white border-border text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-sm">
                              View
                            </Link>
                          ) : (
                            <span className="text-[10px] text-muted italic">
                              No wallet
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-muted italic"
                    >
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
        <button
          disabled={subscriptionQaAction !== null}
          onClick={() => handleSubscriptionQa("failure")}
          className="btn btn-sm bg-[#c27803] text-white text-[11px] font-bold border-none rounded-lg px-4 py-2 shadow-sm disabled:opacity-60"
        >
          {subscriptionQaAction === "failure" ? "Working..." : "Payment Failure"}
        </button>
        <button
          disabled={subscriptionQaAction !== null}
          onClick={() => handleSubscriptionQa("restore")}
          className="btn btn-sm bg-success text-white text-[11px] font-bold border-none rounded-lg px-4 py-2 shadow-sm disabled:opacity-60"
        >
          {subscriptionQaAction === "restore" ? "Working..." : "Restore Subscription"}
        </button>
      </footer>

      {/* Bar QR Codes Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-ink">Bar QR Codes</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Print and place these QR codes on each table. Customers scan
                  them to check in via the SipSave app.
                </p>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              {qrLoading ? (
                <div className="py-16 text-center text-sm font-semibold text-slate-500">
                  Loading table QR codes...
                </div>
              ) : qrError ? (
                <div className="rounded-xl border border-danger/20 bg-danger-tint p-5 text-center">
                  <p className="text-sm font-bold text-danger">{qrError}</p>
                  <button
                    onClick={async () => setQrTables(await loadQrTables(barId))}
                    className="mt-4 btn btn-sm bg-danger text-white hover:bg-danger/90"
                  >
                    Retry
                  </button>
                </div>
              ) : tables.length === 0 ? (
                <div className="py-16 text-center text-sm font-semibold text-slate-500">
                  No tables found for this bar yet.
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-8">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className="flex flex-col items-center bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                        {/* <QRCodeSVG
                          className="qr-code-svg"
                          value={`https://app.sipsave.com/t/${table.qrToken}`}
                          size={150}
                          level="H"
                          includeMargin={false}
                        /> */}
                        {/* <div className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-sm border border-gray-200">
                          <img
                            src={`data:image/png;base64,${table?.imageData}`}
                            alt="QR Code"
                            className="qr-code-svg h-[150px] w-[150px] object-contain"
                          />
                        </div> */}

                        <div className="inline-flex items-center justify-center rounded-2xl bg-white p-4 ring-1 ring-black/5 shadow-md">
                          <img
                            src={`data:image/png;base64,${table?.imageData}`}
                            alt={`QR for Table ${table.tableNumber}`}
                            className="qr-code-svg w-[150px] h-[150px] object-contain"
                            loading="lazy"
                          />
                        </div>
                      </div>
                      <p className="font-bold text-ink-2 text-lg">
                        Table {table.tableNumber}
                      </p>
                      <p
                        className="text-[10px] text-slate-400 font-mono mt-1 w-32 truncate text-center"
                        title={table.floorSection || undefined}
                      >
                        {table.floorSection}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-center">
              <button
                disabled={qrTables.length === 0 || qrLoading}
                className="btn btn-primary w-full max-w-md bg-[#5e5ce6] hover:bg-[#4a48c9] text-white py-3 rounded-lg font-bold shadow-md shadow-indigo-200"
                onClick={onDownloadBundle}
              >
                Download All QR Codes (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  trend,
  trendType,
  topBorder,
  index,
}: {
  label: string;
  value: string;
  trend: string;
  trendType: "success" | "warning" | "danger";
  topBorder: string;
  index: number;
}) {
  const trendColor =
    trendType === "success"
      ? "text-success"
      : trendType === "warning"
        ? "text-warning"
        : "text-danger";

  return (
    <div
      className={`reveal panel p-6 pt-5 group hover:shadow-md transition-all border-t-4 ${topBorder}`}
      style={{ "--index": index } as any}
    >
      <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-ink mb-2 tabular-nums">{value}</p>
      <p
        className={`text-[11px] font-bold flex items-center gap-1 ${trendColor}`}
      >
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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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
  const colors = [
    "bg-orange-500",
    "bg-blue-600",
    "bg-slate-500",
    "bg-indigo-700",
    "bg-violet-600",
  ];
  return colors[id % colors.length];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Icons
function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );
}

function IconQrCode({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
      <line x1="7" y1="7" x2="7" y2="7"></line>
      <line x1="17" y1="7" x2="17" y2="7"></line>
      <line x1="17" y1="17" x2="17" y2="17"></line>
      <line x1="7" y1="17" x2="7" y2="17"></line>
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}
