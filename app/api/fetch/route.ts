// app/api/fetch/route.ts

import { NextResponse } from 'next/server';
import { fetchAndClusterNews } from '@/lib/news-fetcher';

export async function POST() {
  try {
    const result = await fetchAndClusterNews();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch error:', error);
    const details = process.env.NODE_ENV === 'development' ? String(error) : undefined;
    return NextResponse.json(
      { error: 'Failed to fetch news', ...(details && { details }) },
      { status: 500 }
    );
  }
}
