import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://192.168.1.239:5000';
const DEFAULT_BAR_ID = process.env.NEXT_PUBLIC_ACTIVE_BAR_ID ?? '1';

function normalizeMobileForBackend(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mobile = searchParams.get('mobile');
  const qr = searchParams.get('qr');
  const barId = searchParams.get('barId') ?? DEFAULT_BAR_ID;

  if (mobile) {
    const normalizedMobile = normalizeMobileForBackend(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'mobile query parameter is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const lookupUrl = `${BACKEND_URL}/api/v1/sessions/customer-lookup?mobileNumber=${encodeURIComponent(normalizedMobile)}&barId=${encodeURIComponent(barId)}`;

    try {
      const headers = new Headers();
      if (authHeader) headers.set('Authorization', authHeader);
      const response = await fetch(lookupUrl, { headers });
      const bodyText = await response.text();
      let body: unknown = null;
      try {
        body = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        body = bodyText;
      }

      if (!response.ok) {
        return NextResponse.json(
          { error: body && typeof body === 'object' && 'error' in body ? (body as any).error : body ?? 'Customer not found' },
          { status: response.status },
        );
      }

      return NextResponse.json(body);
    } catch (error) {
      console.error('[CustomerLookup]', error);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
  }

  if (qr === 'invalid') {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Keep QR simulation for development/demo workflows.
  await new Promise(resolve => setTimeout(resolve, 800));

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
        lastServed: '35m ago',
      },
      {
        id: 2,
        name: 'Absolut Vodka',
        balance: Math.floor(Math.random() * 300) + 50,
        total: 750,
        lastServed: '1h ago',
      },
    ],
  });
}
