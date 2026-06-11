'use client';

export type TableState = {
  id: number;
  status: 'occupied' | 'pour-pending' | 'available' | 'reserved';
  guests: number;
  sessionTime: string;
  customerName?: string;
  details?: string;
};

export type PourRequestState = {
  id: number;
  tableId: number;
  customer: string;
  bottle: string;
  walletBalance: number;
  requestedAmount: number;
  waitTime: string;
  urgent?: boolean;
};

export type ServedPourLog = {
  time: string;
  table: string;
  customer: string;
  bottle: string;
  amount: string;
};

export type FoodItem = {
  name: string;
  qty: number;
  price: number;
};

export type FoodOrderState = {
  id: number;
  tableId: number;
  customer: string;
  timeLabel: string;
  status: 'Pending' | 'In preparation' | 'Served';
  items: FoodItem[];
  total: number;
};

export type TabletState = {
  currentBartender: {
    id: string;
    name: string;
    shiftStart: string;
  };
  tables: TableState[];
  pourQueue: PourRequestState[];
  servedPours: ServedPourLog[];
  shiftStats: {
    poursServed: number;
    totalMlServed: number;
    uniqueCustomers: number;
    avgServiceTime: string;
    walletDeductions: number;
  };
  customerProfile: {
    name: string;
    mobile: string;
    kycStatus: string;
    table: string;
    wallets: {
      id: number;
      name: string;
      balance: number;
      total: number;
      lastServed: string;
      warning?: string;
    }[];
  } | null;
  foodOrders: FoodOrderState[];
  handoverNotes: string;
};

const DEFAULT_STATE: TabletState = {
  currentBartender: {
    id: 'BART001',
    name: 'Rahul Sharma',
    shiftStart: '6:00 PM'
  },
  tables: [
    { id: 1, status: 'occupied', guests: 2, sessionTime: '45 min', customerName: 'Kiran B.' },
    { id: 2, status: 'pour-pending', guests: 1, sessionTime: '20 min', customerName: 'Arjun M.' },
    { id: 3, status: 'available', guests: 0, sessionTime: '' },
    { id: 4, status: 'occupied', guests: 4, sessionTime: '1h 12m', customerName: 'Meena R.' },
    { id: 5, status: 'reserved', guests: 0, sessionTime: '9:30 PM', details: 'Priya S.' },
    { id: 6, status: 'pour-pending', guests: 3, sessionTime: '55 min', customerName: 'Priya S.' },
    { id: 7, status: 'occupied', guests: 2, sessionTime: '26 min', customerName: 'Arjun M.' },
    { id: 8, status: 'available', guests: 0, sessionTime: '' },
    { id: 9, status: 'available', guests: 0, sessionTime: '' },
    { id: 10, status: 'pour-pending', guests: 1, sessionTime: '5 min', customerName: 'Rajan K.' }
  ],
  pourQueue: [
    { 
      id: 5002,
      tableId: 2, 
      customer: 'Arjun M.', 
      bottle: 'Johnnie Walker Black Label', 
      walletBalance: 338, 
      requestedAmount: 60,
      waitTime: '4 min',
      urgent: true
    },
    { 
      id: 5006,
      tableId: 6, 
      customer: 'Priya S.', 
      bottle: 'Glenfiddich 12 Year', 
      walletBalance: 420, 
      requestedAmount: 90,
      waitTime: '2 min'
    },
    { 
      id: 5010,
      tableId: 10, 
      customer: 'Rajan K.', 
      bottle: 'Absolut Vodka', 
      walletBalance: 220, 
      requestedAmount: 30,
      waitTime: 'Just now'
    }
  ],
  servedPours: [
    { time: '9:41 PM', table: 'T2', customer: 'Arjun M.', bottle: 'JW Black Label', amount: '60ml' },
    { time: '9:35 PM', table: 'T7', customer: 'Arjun M.', bottle: 'JW Black Label', amount: '90ml' },
    { time: '9:28 PM', table: 'T4', customer: 'Meena R.', bottle: 'Monkey Shldr', amount: '60ml' },
    { time: '9:22 PM', table: 'T6', customer: 'Priya S.', bottle: 'Glenfiddich 12 Yr', amount: '120ml' },
    { time: '9:15 PM', table: 'T1', customer: 'Kiran B.', bottle: 'Absolut Vodka', amount: '60ml' },
    { time: '9:08 PM', table: 'T4', customer: 'Meena R.', bottle: 'Monkey Shldr', amount: '30ml' }
  ],
  shiftStats: {
    poursServed: 14,
    totalMlServed: 840,
    uniqueCustomers: 8,
    avgServiceTime: '2.1 min',
    walletDeductions: 12400
  },
  customerProfile: {
    name: 'Arjun Mehta',
    mobile: '+91 98765 43210',
    kycStatus: 'Verified',
    table: 'Table 7',
    wallets: [
      { 
        id: 1, 
        name: 'Johnnie Walker Black Label', 
        balance: 338, 
        total: 750, 
        lastServed: '35 min ago' 
      },
      { 
        id: 2, 
        name: 'Absolut Vodka', 
        balance: 168, 
        total: 750, 
        lastServed: '1 hour ago',
        warning: 'Expires in 7 days'
      }
    ]
  },
  foodOrders: [
    {
      id: 1,
      tableId: 7,
      customer: 'Arjun M.',
      timeLabel: 'Ordered 15 min ago',
      status: 'Pending',
      items: [
        { name: 'Chicken Wings', qty: 2, price: 240 },
        { name: 'Peanut Masala', qty: 1, price: 120 }
      ],
      total: 600
    },
    {
      id: 2,
      tableId: 4,
      customer: 'Meena R.',
      timeLabel: 'Ordered 32 min ago',
      status: 'In preparation',
      items: [
        { name: 'Paneer Tikka', qty: 1, price: 280 },
        { name: 'Caesar Salad', qty: 2, price: 180 }
      ],
      total: 640
    }
  ],
  handoverNotes: ''
};

/**
 * Fetch live table availability from the API.
 * Falls back to mock data if the request fails.
 */
export async function fetchLiveTableStatus(barId: number): Promise<TableState[]> {
  try {
    const { listBarTablesWithStatus } = await import('./api-client');
    const apiTables = await listBarTablesWithStatus(barId);
    
    return apiTables.map(t => ({
      id: t.id,
      status: mapApiStatusToTableStatus(t.status),
      guests: t.activeGuestCount || 0,
      sessionTime: t.sessionTimeLabel || '',
      customerName: t.customerName || undefined,
      details: t.reservationDetails || undefined
    }));
  } catch (error) {
    console.warn('Failed to fetch live table status, using mock data:', error);
    // Fall back to mock data from DEFAULT_STATE
    return DEFAULT_STATE.tables;
  }
}

function mapApiStatusToTableStatus(apiStatus: string): 'occupied' | 'pour-pending' | 'available' | 'reserved' {
  // Map backend status to frontend status
  switch (apiStatus.toLowerCase()) {
    case 'occupied':
      return 'occupied';
    case 'pourpending':
      return 'pour-pending';
    case 'reserved':
      return 'reserved';
    case 'available':
    default:
      return 'available';
  }
}

export function getTabletState(): TabletState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const stateStr = window.localStorage.getItem('sipsave_tablet_state');
  if (!stateStr) {
    window.localStorage.setItem('sipsave_tablet_state', JSON.stringify(DEFAULT_STATE));
    return DEFAULT_STATE;
  }
  try {
    return JSON.parse(stateStr);
  } catch (e) {
    return DEFAULT_STATE;
  }
}

export function saveTabletState(state: TabletState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('sipsave_tablet_state', JSON.stringify(state));
}

export function resetTabletState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('sipsave_tablet_state', JSON.stringify(DEFAULT_STATE));
}
