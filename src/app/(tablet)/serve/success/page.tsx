import { Suspense } from 'react';
import ServeSuccessClient from './serve-success-client';

export default function ServeSuccessPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading confirmation…</div>}>
      <ServeSuccessClient />
    </Suspense>
  );
}

