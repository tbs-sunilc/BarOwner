import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return NextResponse.json({
    startTime: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
    poursServed: Math.floor(Math.random() * 20) + 5,
    totalVolumeMl: Math.floor(Math.random() * 2000) + 500,
    avgResponseTime: (Math.random() * 2 + 1).toFixed(1),
    recentActivity: [
      { time: '10:15 PM', table: 'T2', user: 'Arjun M.', item: 'JW Black', amount: '60ml' },
      { time: '10:05 PM', table: 'T7', user: 'Karan S.', item: 'Absolut', amount: '90ml' },
      { time: '09:45 PM', table: 'T4', user: 'Meena R.', item: 'Glenfiddich', amount: '60ml' },
      { time: '09:30 PM', table: 'T1', user: 'Siddharth J.', item: 'Monkey Shoulder', amount: '30ml' },
    ]
  });
}
