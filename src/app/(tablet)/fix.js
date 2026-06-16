const fs = require('fs');

// 1. Queue page
let queueCode = fs.readFileSync('queue/page.tsx', 'utf8');
queueCode = queueCode.replace(/<span className="text-lg font-bold text-slate-900">Table \{req\.tableId\}<\/span>/, 
  '<span className="text-lg font-bold text-slate-900">Table {state?.tables.find(t => t.id === req.tableId)?.tableNumber ?? req.tableId}</span>');
fs.writeFileSync('queue/page.tsx', queueCode);

// 2. Serve page
let serveCode = fs.readFileSync('serve/[pourRequestId]/page.tsx', 'utf8');
serveCode = serveCode.replace("import { getActiveBarId } from '@/lib/active-bar';",
  "import { getActiveBarId } from '@/lib/active-bar';\nimport { getTabletState } from '@/lib/tablet-state';");

serveCode = serveCode.replace("const customerName = row?.userDisplayName?.trim() || 'Customer';",
  "const customerName = row?.userDisplayName?.trim() || 'Customer';\n  const tabletState = typeof window !== 'undefined' ? getTabletState() : null;\n  const targetTable = tabletState?.tables.find(t => t.id === row?.barTableId);\n  const tableDisplay = targetTable?.tableNumber ?? (row?.barTableId != null ? `Table ${row.barTableId}` : '—');");

serveCode = serveCode.replace(/\{tableId \!= null \? \`Table \$\{tableId\}\` : 'Table —'\}/g, '{tableDisplay}');
serveCode = serveCode.replace(/value=\{tableId \!= null \? \`Table \$\{tableId\}\` : '—'\}/g, 'value={tableDisplay}');
fs.writeFileSync('serve/[pourRequestId]/page.tsx', serveCode);

// 3. Orders page
let ordersCode = fs.readFileSync('orders/page.tsx', 'utf8');
ordersCode = ordersCode.replace("const [orders, setOrders] = useState<FoodOrderDto[]>([]);",
  "const [orders, setOrders] = useState<FoodOrderDto[]>([]);\n  const [tables, setTables] = useState<any[]>([]);");

ordersCode = ordersCode.replace("import { getActiveBarId } from '@/lib/active-bar';",
  "import { getActiveBarId } from '@/lib/active-bar';\nimport { fetchLiveTableStatus } from '@/lib/tablet-state';");

ordersCode = ordersCode.replace(/const \[liveOrders, liveMenu\] = await Promise\.all\(\[\s+fetchActiveFoodOrders\(id\),\s+listMenuItems\(id, false\),\s+\]\);/,
  "const [liveOrders, liveMenu, liveTables] = await Promise.all([\n        fetchActiveFoodOrders(id),\n        listMenuItems(id, false),\n        fetchLiveTableStatus(id),\n      ]);");

ordersCode = ordersCode.replace("setMenuItems(liveMenu);",
  "setMenuItems(liveMenu);\n      setTables(liveTables);");

// calculate grouped orders
ordersCode = ordersCode.replace("if (loading) {",
  `const groupedOrders = useMemo(() => {
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

  if (loading) {`);

ordersCode = ordersCode.replace(/orders\.map\(\(order\) => \{/g, "groupedOrders.map((order) => {");
ordersCode = ordersCode.replace(/<span className="text-lg font-bold text-slate-900">Table \{order\.tableId \?\? '-'} · \{order\.customer \?\? 'Guest'}<\/span>/g, '<span className="text-lg font-bold text-slate-900">Table {order.tableNumber ?? \'-\'} · {order.customer ?? \'Guest\'}</span>');
ordersCode = ordersCode.replace(/order\.items\.map\(/g, "order.orders.flatMap((o: any) => o.items.map((i: any) => ({ ...i, __orderId: o.id }))).map(");

ordersCode = ordersCode.replace(/async function markServed\(order: FoodOrderDto\) \{/g, `async function markServed(orderGroup: any) {`);
ordersCode = ordersCode.replace(/await serveFoodOrder\(order\.id\);/g, `await Promise.all(orderGroup.orders.filter((o: any) => o.status === 'Pending').map((o: any) => serveFoodOrder(o.id)));`);
ordersCode = ordersCode.replace(/toast\(\`Table \$\{order\.tableId \?\? '-'\}/g, "toast(`Table ${orderGroup.tableNumber ?? '-'}'");

ordersCode = ordersCode.replace(/const isPending = order\.status === 'Pending';/g, "const isPending = order?.status === 'Pending';");
ordersCode = ordersCode.replace(/const isServed = order\.status === 'Served';/g, "const isServed = order?.status === 'Served';");
ordersCode = ordersCode.replace(/<button onClick=\{\(\) => markServed\(order\)\}/g, "<button onClick={() => markServed(order)}");
ordersCode = ordersCode.replace(/<button onClick=\{\(\) => openBill\(order\)\}/g, "<button onClick={() => openBill(order)}");

// fixing UI mappings
ordersCode = ordersCode.replace(/key=\{order\.id\}/g, "key={order.tableId || order.id}");
ordersCode = ordersCode.replace(/key=\{\`\$\{order\.id\}-\$\{idx\}\`\}/g, "key={`${item.__orderId}-${idx}`}");

// settling bills
ordersCode = ordersCode.replace(/const \[selectedOrderForBill, setSelectedOrderForBill\] = useState<FoodOrderDto \| null>\(null\);/, "const [selectedOrderForBill, setSelectedOrderForBill] = useState<any | null>(null);");
ordersCode = ordersCode.replace(/await settleFoodOrder\(selectedOrderForBill\.id\);/, "await Promise.all(selectedOrderForBill.orders.map((o: any) => settleFoodOrder(o.id)));");
ordersCode = ordersCode.replace(/toast\(\`Bill settled for Table \$\{selectedOrderForBill\.tableId/g, "toast(`Bill settled for Table ${selectedOrderForBill.tableNumber ?? selectedOrderForBill.tableId");

ordersCode = ordersCode.replace(/\{selectedOrderForBill\.items\.map/g, "{selectedOrderForBill.orders.flatMap((o: any) => o.items).map");
ordersCode = ordersCode.replace(/selectedOrderForBill\.subtotal \?\? selectedOrderForBill\.total/g, "selectedOrderForBill.orders.reduce((sum: number, o: any) => sum + (o.subtotal ?? o.total), 0)");
ordersCode = ordersCode.replace(/selectedOrderForBill\.gst \?\? 0/g, "selectedOrderForBill.orders.reduce((sum: number, o: any) => sum + (o.gst ?? 0), 0)");
ordersCode = ordersCode.replace(/selectedOrderForBill\.serviceCharge \?\? 0/g, "selectedOrderForBill.orders.reduce((sum: number, o: any) => sum + (o.serviceCharge ?? 0), 0)");
ordersCode = ordersCode.replace(/<h3 className="text-xl font-black tracking-tight text-slate-900">Table \{selectedOrderForBill\.tableId \?\? '-'} Invoice<\/h3>/g, "<h3 className=\"text-xl font-black tracking-tight text-slate-900\">Table {selectedOrderForBill.tableNumber ?? selectedOrderForBill.tableId ?? '-'} Invoice</h3>");
ordersCode = ordersCode.replace(/<span className="text-2xl text-indigo-600">₹\{selectedOrderForBill\.total\.toFixed\(2\)\}<\/span>/g, "<span className=\"text-2xl text-indigo-600\">₹{selectedOrderForBill.total.toFixed(2)}</span>")

ordersCode = ordersCode.replace(/\{\[1, 2, 3, 4, 5, 6, 7, 8, 9\]\.map\(\(num\) => <option key=\{num\} value=\{num\}>Table \{num\}<\/option>\)\}/g,
  "{tables.map((t) => <option key={t.id} value={t.id}>{t.tableNumber}</option>)}");

fs.writeFileSync('orders/page.tsx', ordersCode);
console.log('done');
