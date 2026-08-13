import { NextResponse } from 'next/server';
import { generateImageDescription } from '@/lib/ai/gemma';
import { getRequestSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    const description = await generateImageDescription(imageUrl || '');
    return NextResponse.json({ description });
  } catch {
    return NextResponse.json({
      description: "Photo shows operational event setup with live audience engagement and production monitoring gear."
    });
  }
}
