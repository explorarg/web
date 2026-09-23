import { NextResponse } from 'next/server';
import { getHomeData } from '@/lib/homeData';

export const revalidate = 0;

export async function GET() {
  try {
    const data = await getHomeData();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    return NextResponse.json({ error: 'Error fetching home data' }, { status: 500 });
  }
}
