'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTabletState, TabletState, saveTabletState, FoodOrderState } from '@/lib/tablet-state';
import { fetchActiveFoodOrders } from '@/lib/api-client';

export default function FoodOrdersPage() {
  const [state, setState] = useState<TabletState | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<FoodOrderState | null>(null);

  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrderTable, setNewOrderTable] = useState<number>(3);
  const [newOrderItems, setNewOrderItems] = useState<{ name: string; qty: number; price: number }[]>([
    { name: 'Peanut Masala', qty: 1, price: 120 }
  ]);

  useEffect(() => {
    const local = getTabletState();
    setState(local);

    let mounted = true;
    (async () => {
      try {
        const orders = await fetchActiveFoodOrders(1);
        if (!mounted || !orders) return;

        const mapped = orders.map(o => ({
          id: o.id,
          tableId: o.tableId ?? 0,
          customer: o.customer ?? `Guest T${o.tableId ?? 0}`,
          timeLabel: o.timeLabel,
          status: (o.status as any) ?? 'Pending',
          items: o.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          total: Number(o.total)
        } as FoodOrderState));

        const updated = { ...(local ?? {} as TabletState), foodOrders: mapped } as TabletState;
        saveTabletState(updated);
        setState(updated);
      } catch (err) {
        console.warn('Failed to fetch live orders', err);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading orders...</div>;
  }

  const handleMarkServed = (orderId: number) => {
    const updatedState = { ...state };
    updatedState.foodOrders = updatedState.foodOrders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'Served' as const };
      }
      return o;
    });

    saveTabletState(updatedState);
    setState(updatedState);

    const order = updatedState.foodOrders.find(o => o.id === orderId);
    if ((window as any).toast && order) {
      (window as any).toast(`✅ Table ${order.tableId} food order marked as Served`, 's');
    }
  };

  const handleOpenBillModal = (order: FoodOrderState) => {
    setSelectedOrderForBill(order);
    setShowBillModal(true);
  };

  const handleSettleBill = () => {
    if (!selectedOrderForBill) return;

    const updatedState = { ...state };
    // Settle/remove the order
    updatedState.foodOrders = updatedState.foodOrders.filter(o => o.id !== selectedOrderForBill.id);

    // Free the table on Floor Plan
    updatedState.tables = updatedState.tables.map(t => {
      if (t.id === selectedOrderForBill.tableId) {
        return { ...t, status: 'available' as const, guests: 0, sessionTime: '' };
      }
      return t;
    });

    saveTabletState(updatedState);
    setState(updatedState);

    if ((window as any).toast) {
      (window as any).toast(`📄 Bill printed for Table ${selectedOrderForBill.tableId}. Session closed.`, 's');
    }

    setShowBillModal(false);
    setSelectedOrderForBill(null);
  };

  const handleAddNewOrder = () => {
    const total = newOrderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const newOrder: FoodOrderState = {
      id: Date.now(),
      tableId: newOrderTable,
      customer: `Guest T${newOrderTable}`,
      timeLabel: 'Ordered just now',
      status: 'Pending',
      items: newOrderItems,
      total
    };

    const updatedState = { ...state };
    updatedState.foodOrders = [newOrder, ...updatedState.foodOrders];
    
    // Update Floor plan to occupied
    updatedState.tables = updatedState.tables.map(t => {
      if (t.id === newOrderTable) {
        return { ...t, status: 'occupied' as const, guests: 2, sessionTime: '1 min' };
      }
      return t;
    });

    saveTabletState(updatedState);
    setState(updatedState);

    if ((window as any).toast) {
      (window as any).toast(`🍔 Food order placed for Table ${newOrderTable}`, 's');
    }

    setShowNewOrderModal(false);
  };

  const handleQuickMenuClick = (itemName: string, price: number) => {
    if ((window as any).toast) {
      (window as any).toast(`🍿 ${itemName} added. Select "+ New Food Order" to place.`, 'i');
    }
  };

  return (
    <div>
      {/* Header Bar */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Food & Drinks Orders</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Kitchen Order Tickets (KOT) & billing terminal
          </p>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="bg-[#312e81] hover:bg-indigo-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm"
        >
          + New Food Order
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Columns (Col Span 2): Open Food Orders */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Active Table Orders ({state.foodOrders.length})</h3>

          <div className="space-y-4">
            {state.foodOrders.map((order) => {
              const isPending = order.status === 'Pending';
              const isServed = order.status === 'Served';
              
              const badgeClass =
                isPending ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' :
                isServed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                'bg-amber-100 text-amber-700 border border-amber-200';

              const borderClass = isPending ? 'border-[#e11d48] bg-[#fff1f2]' : 'border-slate-200 bg-white hover:shadow-md';

              return (
                <div key={order.id} className={`rounded-xl p-5 border cursor-pointer transition-all ${borderClass}`}>
                  <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-900">Table {order.tableId} · {order.customer}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${badgeClass}`}>{order.status}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{order.timeLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-indigo-950">₹{order.total}</p>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="space-y-3 mb-6">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-bold text-slate-600">
                        <span>{item.name} <span className="text-slate-400">x{item.qty}</span></span>
                        <span>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    {!isServed && (
                      <button
                        onClick={() => handleMarkServed(order.id)}
                        className="btn-tablet btn-tablet-g !py-2 !px-4 !text-xs font-black uppercase"
                      >
                        Mark Served
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenBillModal(order)}
                      className="btn-tablet btn-tablet-s !py-2 !px-4 !text-xs font-bold uppercase"
                    >
                      Bill Table
                    </button>
                  </div>
                </div>
              );
            })}

            {state.foodOrders.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-24 text-center">
                <div className="text-6xl mb-4 grayscale opacity-20">🍔</div>
                <p className="text-slate-900 font-bold text-lg">No open food orders</p>
                <p className="text-slate-400 text-sm mt-1 font-medium leading-relaxed">
                  All active bills settled! Use "+ New Food Order" to place a food ticket.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Menu */}
        <div>
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Quick Menu</h3>

          <div className="space-y-4">
            {/* Starters */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Starters</p>
              <div className="space-y-1">
                {[
                  { name: 'Chicken Wings', price: 240 },
                  { name: 'Paneer Tikka', price: 280 },
                  { name: 'Peanut Masala', price: 120 },
                  { name: 'French Fries', price: 150 },
                ].map((item) => (
                  <div
                    key={item.name}
                    onClick={() => handleQuickMenuClick(item.name, item.price)}
                    className="flex justify-between items-center px-3 py-2 rounded border border-transparent hover:bg-[#eef2ff] hover:border-[#a5b4fc] cursor-pointer transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900">₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mains */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Main Course</p>
              <div className="space-y-1">
                {[
                  { name: 'Butter Chicken', price: 380 },
                  { name: 'Paneer Butter Masala', price: 340 },
                  { name: 'Veg Biryani', price: 290 },
                ].map((item) => (
                  <div
                    key={item.name}
                    onClick={() => handleQuickMenuClick(item.name, item.price)}
                    className="flex justify-between items-center px-3 py-2 rounded border border-transparent hover:bg-[#eef2ff] hover:border-[#a5b4fc] cursor-pointer transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900">₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Modal */}
      {showBillModal && selectedOrderForBill && (
        <div className="fixed inset-0 bg-slate-950/60 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Table {selectedOrderForBill.tableId} Invoice</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Settle Open Food Tab</p>
              </div>
              <button
                onClick={() => setShowBillModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {selectedOrderForBill.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{item.name} x{item.qty}</span>
                  <span>₹{item.price * item.qty}</span>
                </div>
              ))}
              <div className="h-px bg-slate-200"></div>
              
              {/* Calculations */}
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Subtotal</span>
                <span>₹{selectedOrderForBill.total}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>GST (5%)</span>
                <span>₹{selectedOrderForBill.total * 0.05}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Service Charge (10%)</span>
                <span>₹{selectedOrderForBill.total * 0.10}</span>
              </div>
              
              <div className="h-px bg-slate-200"></div>
              <div className="flex justify-between items-baseline text-sm font-black text-indigo-950 uppercase tracking-wider">
                <span>Grand Total</span>
                <span className="text-2xl font-black text-indigo-600">₹{selectedOrderForBill.total * 1.15}</span>
              </div>
            </div>

            <button
              onClick={handleSettleBill}
              className="btn-tablet btn-tablet-g w-full justify-center py-4 font-black uppercase tracking-wider shadow-lg shadow-emerald-100"
            >
              📄 Print & Settle Bill
            </button>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Create KOT</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">New Food Order</p>
              </div>
              <button
                onClick={() => setShowNewOrderModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Table</label>
                <select
                  value={newOrderTable}
                  onChange={(e) => setNewOrderTable(Number(e.target.value))}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-bold text-xs"
                >
                  {[3, 5, 8, 9].map((num) => (
                    <option key={num} value={num}>Table {num} ({num === 5 ? 'Reserved' : 'Available'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Add Item</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewOrderItems([{ name: 'Chicken Wings', qty: 2, price: 240 }])}
                    className={`btn-tablet justify-center py-2.5 rounded-xl text-xs ${newOrderItems[0]?.name === 'Chicken Wings' ? 'btn-tablet-p' : 'btn-tablet-s'}`}
                  >
                    Chicken Wings (x2)
                  </button>
                  <button
                    onClick={() => setNewOrderItems([{ name: 'Paneer Tikka', qty: 1, price: 280 }])}
                    className={`btn-tablet justify-center py-2.5 rounded-xl text-xs ${newOrderItems[0]?.name === 'Paneer Tikka' ? 'btn-tablet-p' : 'btn-tablet-s'}`}
                  >
                    Paneer Tikka (x1)
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddNewOrder}
              className="btn-tablet btn-tablet-g w-full justify-center py-4 font-black uppercase tracking-wider shadow-lg shadow-emerald-100"
            >
              🚀 Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
