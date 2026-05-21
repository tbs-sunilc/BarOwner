'use client';

import { useSearchParams } from 'next/navigation';

export default function ServeSuccessClient() {
  const params = useSearchParams();

  const customer = params.get('customer') ?? 'Guest';
  const amount   = params.get('amount')   ?? '0';
  const bottle   = params.get('bottle')   ?? '';
  const balance  = params.get('balance')  ?? '0';

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>✅ Pour Served</h1>

      <div style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>
        <p><strong>Customer:</strong> {customer}</p>
        <p><strong>Amount:</strong> {amount} ml</p>
        <p><strong>Bottle:</strong> {bottle}</p>
        <p><strong>Remaining Balance:</strong> ₹{balance}</p>
      </div>
    </div>
  );
}