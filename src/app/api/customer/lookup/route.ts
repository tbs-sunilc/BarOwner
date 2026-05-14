import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mobile = searchParams.get('mobile');
  const qr = searchParams.get('qr');

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  if (mobile === '+91 00000 00000' || qr === 'invalid') {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Dynamic/Random Data
  const names = ['Arjun Mehta', 'Karan Sharma', 'Priya Rai', 'Siddharth Jain'];
  const name = names[Math.floor(Math.random() * names.length)];

  return NextResponse.json({
    name: name,
    mobile: mobile || '+91 98765 43210',
    kycStatus: 'Verified',
    currentTable: 'Table ' + (Math.floor(Math.random() * 10) + 1),
    wallets: [
      { 
        id: 1, 
        name: 'Johnnie Walker Black Label', 
        balance: Math.floor(Math.random() * 500) + 100, 
        total: 750, 
        color: 'accent',
        lastServed: '35m ago'
      },
      { 
        id: 2, 
        name: 'Absolut Vodka', 
        balance: Math.floor(Math.random() * 300) + 50, 
        total: 750, 
        color: 'warning',
        lastServed: '1h ago'
      }
    ]
  });
}
