'use client';

export default function OrdersPage() {
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
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active Tables (5)</h3>
          <div className="space-y-3">
            {[
              { tbl: 'T1', name: 'Kiran B.', total: '₹1,250', items: 3, status: 'Served' },
              { tbl: 'T7', name: 'Arjun M.', total: '₹4,820', items: 12, status: 'Cooking', active: true },
              { tbl: 'T4', name: 'Meena R.', total: '₹890', items: 2, status: 'Served' },
              { tbl: 'T2', name: 'Guest', total: '₹2,400', items: 5, status: 'Pending' },
              { tbl: 'T6', name: 'Priya S.', total: '₹1,100', items: 4, status: 'Served' },
            ].map((bill, i) => (
              <div 
                key={i} 
                className={`panel p-5 transition-all cursor-pointer ${bill.active ? 'border-amber-500 bg-white ring-1 ring-amber-500/20' : 'hover:border-amber-200'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${bill.active ? 'bg-slate-950 text-white shadow-glow' : 'bg-slate-100 text-slate-400'}`}>
                      {bill.tbl}
                    </div>
                    <div>
                      <p className="font-black text-ink">{bill.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{bill.items} items · {bill.status}</p>
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
          <div className="panel p-8 h-full flex flex-col bg-white">
            <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-4xl font-black text-ink tracking-tighter">Table 7</span>
                  <span className="badge-tablet badge-tablet-p">Active Bill</span>
                </div>
                <p className="text-sm text-muted font-medium">Customer: <span className="text-ink font-bold">Arjun M.</span> · Checked in 45m ago</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                <p className="text-5xl font-black text-amber-700 tabular-nums tracking-tighter">₹4,820</p>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto mb-8 pr-4 custom-scrollbar">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered Items</h4>
              <div className="space-y-5">
                {[
                  { qty: 1, item: 'Veg Platter (Large)', price: '₹850', status: 'Served' },
                  { qty: 2, item: 'Paneer Tikka', price: '₹700', status: 'Served' },
                  { qty: 4, item: 'Masala Peanuts', price: '₹480', status: 'Served' },
                  { qty: 3, item: 'Lemon Soda', price: '₹360', status: 'Served' },
                  { qty: 1, item: 'Chilli Chicken', price: '₹450', status: 'Cooking', warn: true },
                  { qty: 2, item: 'Coke (Canned)', price: '₹180', status: 'Served' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center group">
                    <div className="flex gap-5 items-center">
                      <span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-600 text-sm">{item.qty}</span>
                      <div>
                        <p className="font-bold text-ink group-hover:text-amber-600 transition-colors">{item.item}</p>
                        <p className={`text-[10px] font-black uppercase tracking-wider ${item.warn ? 'text-amber-500' : 'text-slate-400'}`}>{item.status}</p>
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
                <span className="text-ink">₹3,020</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider">
                <span>Taxes (GST 5%)</span>
                <span className="text-ink">₹151</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider">
                <span>Service Charge</span>
                <span className="text-ink">₹1,649</span>
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
        </div>
      </div>
    </div>
  );
}
