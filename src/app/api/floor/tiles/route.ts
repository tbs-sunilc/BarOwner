import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));

  const names = ['Arjun M.', 'Meena R.', 'Suresh K.', 'Rahul V.', 'Sana P.', 'Guest'];
  
  const tiles = Array.from({ length: 8 }, (_, i) => {
    const pendingCount = Math.random() > 0.7 ? (Math.random() > 0.8 ? 2 : 1) : 0;
    const isOccupied = Math.random() > 0.3 || pendingCount > 0;

    if (!isOccupied) return null;

    return {
      sessionId: 1000 + i,
      userId: 500 + i,
      userDisplayName: names[Math.floor(Math.random() * names.length)],
      pendingCount: pendingCount,
      oldestPour: pendingCount > 0 ? {
        id: 5000 + i,
        requestedMl: [30, 60, 90][Math.floor(Math.random() * 3)]
      } : null
    };
  }).filter(Boolean);

  return NextResponse.json(tiles);
}
