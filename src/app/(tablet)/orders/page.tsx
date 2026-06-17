'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createFoodOrder,
  fetchActiveFoodOrders,
  listMenuItems,
  serveFoodOrder,
  settleFoodOrder,
  type FoodOrderDto,
  type MenuItemDto,
} from '@/lib/api-client';
import { getActiveBarId } from '@/lib/active-bar';
import { fetchLiveTableStatus } from '@/lib/tablet-state';

export default function FoodOrdersPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [orders, setOrders] = useState<FoodOrderDto[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<any | null>(null);
  const [newOrderTable, setNewOrderTable] = useState(3);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const id = getActiveBarId() ?? 1;
    setBarId(id);
    void load(id);
  }, []);

  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuItemId) ?? menuItems[0] ?? null,
    [menuItems, selectedMenuItemId],
  );

  async function load(id = barId) {
    if (id == null) return;
    try {
      setLoading(true);
      setError(null);
      const [liveOrders, liveMenu, liveTables] = await Promise.all([
        fetchActiveFoodOrders(id),
        listMenuItems(id, false),
        fetchLiveTableStatus(id),
      ]);
      setOrders(liveOrders);
      setMenuItems(liveMenu);
      setTables(liveTables);
      if (liveMenu.length > 0 && selectedMenuItemId == null) setSelectedMenuItemId(liveMenu[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load food orders');
    } finally {
      setLoading(false);
    }
  }

  async function markServed(orderGroup: any) {
    try {
      setError(null);
      await Promise.all(orderGroup.orders.filter((o: any) => o.status === 'Pending').map((o: any) => serveFoodOrder(o.id)));
      await load();
      toast(`Table ${orderGroup.tableNumber ?? '-'}' food order marked as served`, 's');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark order served');
    }
  }

  async function settleSelectedOrder() {
    if (!selectedOrderForBill) return;
    try {
      setError(null);
      await Promise.all(selectedOrderForBill.orders.map((o: any) => settleFoodOrder(o.id)));
      await load();
      toast(`Bill settled for Table ${selectedOrderForBill.tableNumber ?? selectedOrderForBill.tableId ?? '-'}`, 's');
      setShowBillModal(false);
      setSelectedOrderForBill(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to settle bill');
    }
  }

  async function addNewOrder() {
    if (barId == null || selectedMenuItem == null) return;
    try {
      setError(null);
      await createFoodOrder({
        barId,
        tableId: newOrderTable,
        customer: `Guest T${newOrderTable}`,
        items: [{
          menuItemId: selectedMenuItem.id,
          name: selectedMenuItem.name,
          qty: quantity,
          unitPriceInPaise: selectedMenuItem.priceInPaise,
        }],
        gstPercent: 5,
        serviceChargePercent: 10,
      });
      await load();
      toast(`Food order placed for Table ${newOrderTable}`, 's');
      setShowNewOrderModal(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to place food order');
    }
  }

  function openBill(order: FoodOrderDto) {
    setSelectedOrderForBill(order);
    setShowBillModal(true);
  }

  function quickSelect(item: MenuItemDto) {
    setSelectedMenuItemId(item.id);
    setQuantity(1);
    setShowNewOrderModal(true);
  }

  const groupedOrders = useMemo(() => {
    const map = new Map<number, any>();
    for (const o of orders) {
      if (!o.tableId) continue;
      if (!map.has(o.tableId)) {
        const t = tables.find(tb => tb.id === o.tableId);
        map.set(o.tableId, {
          tableId: o.tableId,
          tableNumber: t?.tableNumber ?? o.tableId.toString(),
          customer: o.customer ?? t?.customerName ?? 'Guest',
          orders: [],
          total: 0,
          status: 'Served',
          timeLabel: o.timeLabel,
        });
      }
      const group = map.get(o.tableId)!;
      group.orders.push(o);
      group.total += o.total;
      if (o.status === 'Pending') {
        group.status = 'Pending';
        group.timeLabel = o.timeLabel;
      }
    }
    return Array.from(map.values());
  }, [orders, tables]);

  if (loading) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading orders...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Food & Drinks Orders</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Kitchen order tickets and billing terminal</p>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="rounded-lg bg-[#312e81] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-800"
        >
          + New Food Order
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-600">Active Table Orders ({orders.length})</h3>
          <div className="space-y-4">
            {groupedOrders.map((order) => {
              const isPending = order?.status === 'Pending';
              const isServed = order?.status === 'Served';
              const badgeClass = isPending
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : isServed
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200';

              return (
                <div key={order.tableId || order.id} className={`rounded-xl border p-5 transition-all ${isPending ? 'border-[#e11d48] bg-[#fff1f2]' : 'border-slate-200 bg-white hover:shadow-md'}`}>
                  <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg font-bold text-slate-900">Table {order.tableNumber ?? '-'} · {order.customer ?? 'Guest'}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${badgeClass}`}>{order.status}</span>
                      </div>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{order.timeLabel}</p>
                    </div>
                    <p className="text-xl font-black text-indigo-950">₹{order.total.toFixed(2)}</p>
                  </div>

                  <div className="mb-6 space-y-3">
                    {order.orders.flatMap((o: any) => o.items.map((i: any) => ({ ...i, __orderId: o.id }))).map((item, idx) => (
                      <div key={`${item.__orderId}-${idx}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-200">
                          {menuItems.find((menuItem) => menuItem.id === item.menuItemId)?.imageUrl ? (
                            <img
                              src={menuItems.find((menuItem) => menuItem.id === item.menuItemId)?.imageUrl ?? undefined}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase text-slate-400">
                              No Img
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{item.name} <span className="text-slate-400">x{item.qty}</span></span>
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {menuItems.find((menuItem) => menuItem.id === item.menuItemId)?.category ?? 'Food item'}
                          </span>
                        </div>
                        <span className="shrink-0">₹{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    {!isServed && (
                      <button onClick={() => markServed(order)} className="btn-tablet btn-tablet-g !px-4 !py-2 !text-xs font-black uppercase">
                        Mark Served
                      </button>
                    )}
                    <button onClick={() => openBill(order)} className="btn-tablet btn-tablet-s !px-4 !py-2 !text-xs font-bold uppercase">
                      Bill Table
                    </button>
                  </div>
                </div>
              );
            })}

            {orders.length === 0 && (
              <div className="rounded-[32px] border-2 border-dashed border-slate-100 bg-white p-16 text-center">
                <p className="text-lg font-bold text-slate-900">No open food orders</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-400">All active bills are settled.</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-600">Quick Menu</h3>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Available Items</p>
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => quickSelect(item)}
                    className="flex w-full items-center gap-3 rounded border border-transparent px-3 py-2 text-left transition-colors hover:border-[#a5b4fc] hover:bg-[#eef2ff]"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase text-slate-400">
                          No Img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.category}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-slate-900">₹{item.price.toFixed(2)}</span>
                  </button>
                ))}
                {menuItems.length === 0 && (
                  <p className="py-4 text-sm text-slate-400">Owner menu has no available items yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBillModal && selectedOrderForBill && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-6">
          <div className="w-full max-w-md rounded-[32px] border border-slate-100 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Table {selectedOrderForBill.tableNumber ?? selectedOrderForBill.tableId ?? '-'} Invoice</h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Settle Open Food Tab</p>
              </div>
              <button onClick={() => setShowBillModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-black text-slate-400">x</button>
            </div>

            <div className="mb-8 space-y-4">
              {selectedOrderForBill.orders.flatMap((o: any) => o.items).map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{item.name} x{item.qty}</span>
                  <span>₹{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="h-px bg-slate-200" />
              <BillRow label="Subtotal" value={selectedOrderForBill.orders.reduce((sum: number, o: any) => sum + (o.subtotal ?? o.total), 0)} />
              <BillRow label="GST" value={selectedOrderForBill.orders.reduce((sum: number, o: any) => sum + (o.gst ?? 0), 0)} />
              <BillRow label="Service Charge" value={selectedOrderForBill.orders.reduce((sum: number, o: any) => sum + (o.serviceCharge ?? 0), 0)} />
              <div className="h-px bg-slate-200" />
              <div className="flex items-baseline justify-between text-sm font-black uppercase tracking-wider text-indigo-950">
                <span>Grand Total</span>
                <span className="text-2xl text-indigo-600">₹{selectedOrderForBill.total.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={settleSelectedOrder} className="btn-tablet btn-tablet-g w-full justify-center py-4 font-black uppercase tracking-wider shadow-lg shadow-emerald-100">
              Print & Settle Bill
            </button>
          </div>
        </div>
      )}

      {showNewOrderModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-6">
          <div className="w-full max-w-md rounded-[32px] border border-slate-100 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Create KOT</h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">New Food Order</p>
              </div>
              <button onClick={() => setShowNewOrderModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-black text-slate-400">x</button>
            </div>

            <div className="mb-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Select Table</span>
                <select value={newOrderTable} onChange={(e) => setNewOrderTable(Number(e.target.value))} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-3 text-xs font-bold">
                  {tables.map((t) => <option key={t.id} value={t.id}>{t.tableNumber}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Item</span>
                <select value={selectedMenuItemId ?? ''} onChange={(e) => setSelectedMenuItemId(Number(e.target.value))} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-3 text-xs font-bold">
                  {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name} · ₹{item.price.toFixed(2)}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</span>
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-3 text-xs font-bold" />
              </label>
            </div>

            <button onClick={addNewOrder} disabled={!selectedMenuItem} className="btn-tablet btn-tablet-g w-full justify-center py-4 font-black uppercase tracking-wider shadow-lg shadow-emerald-100 disabled:opacity-50">
              Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BillRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
      <span>{label}</span>
      <span>₹{value.toFixed(2)}</span>
    </div>
  );
}

function toast(message: string, type: 's' | 'e' | 'i' | 'w') {
  if (typeof window !== 'undefined' && (window as any).toast) {
    (window as any).toast(message, type);
  }
}
