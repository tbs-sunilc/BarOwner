'use client';

import { useState, useEffect } from 'react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]); // Keeping array as any for now but adding local type hints
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        setOrders(data);
        // Default to the first active order or the first one
        setSelectedOrder(data.find((o: any) => o.active) || data[0]);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) {
    return <div className="p-10 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading orders...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-ink tracking-tighter">Food & Drink Orders</h1>
          <p className="text-sm text-muted font-medium mt-1">Manage active table bills and KOT service</p>
        </div>
        <button className="btn-tablet btn-tablet-p shadow-glow">
          ➕ New Order
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Active Bills */}
        <div className="lg:col-span-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active Tables ({orders.length})</h3>
          <div className="space-y-3">
            {orders.map((bill, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedOrder(bill)}
                className={`panel p-5 transition-all cursor-pointer ${selectedOrder?.tbl === bill.tbl ? 'border-amber-500 bg-white ring-1 ring-amber-500/20' : 'hover:border-amber-200'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${selectedOrder?.tbl === bill.tbl ? 'bg-slate-950 text-white shadow-glow' : 'bg-slate-100 text-slate-400'}`}>
                      {bill.tbl}
                    </div>
                    <div>
                      <p className="font-black text-ink">{bill.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{bill.items.length} items · {bill.status}</p>
                    </div>
                  </div>
                  <p className="font-black text-amber-700 text-lg">{bill.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Bill Details */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            <div className="panel p-8 h-full flex flex-col bg-white">
              <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-4xl font-black text-ink tracking-tighter">Table {selectedOrder.tbl.replace('T', '')}</span>
                    <span className="badge-tablet badge-tablet-p">Active Bill</span>
                  </div>
                  <p className="text-sm text-muted font-medium">Customer: <span className="text-ink font-bold">{selectedOrder.name}</span> · Checked in 45m ago</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                  <p className="text-5xl font-black text-amber-700 tabular-nums tracking-tighter">{selectedOrder.total}</p>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto mb-8 pr-4 custom-scrollbar">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered Items</h4>
                <div className="space-y-5">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center group">
                      <div className="flex gap-5 items-center">
                        <span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-600 text-sm">{item.qty}</span>
                        <div>
                          <p className="font-bold text-ink group-hover:text-amber-600 transition-colors">{item.item}</p>
                          <p className={`text-[10px] font-black uppercase tracking-wider ${item.status === 'Cooking' ? 'text-amber-500' : 'text-slate-400'}`}>{item.status}</p>
                        </div>
                      </div>
                      <p className="font-black text-ink">{item.price}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-4">
                <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider">
                  <span>Subtotal</span>
                  <span className="text-ink">₹{(parseInt(selectedOrder.total.replace(/[^0-9]/g, '')) * 0.8).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider">
                  <span>Taxes (GST 5%)</span>
                  <span className="text-ink">₹{(parseInt(selectedOrder.total.replace(/[^0-9]/g, '')) * 0.05).toLocaleString()}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button className="btn-tablet btn-tablet-s justify-center py-4 uppercase tracking-widest text-[10px] font-black">
                    🖨️ Print KOT
                  </button>
                  <button className="btn-tablet btn-tablet-g justify-center py-4 text-base shadow-xl shadow-emerald-100 font-black">
                    💳 Settle & Close
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel p-20 text-center flex flex-col items-center justify-center h-full text-slate-300">
              <span className="text-6xl mb-4">🍔</span>
              <p className="font-black uppercase tracking-widest text-xs">Select a table to view bill</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
