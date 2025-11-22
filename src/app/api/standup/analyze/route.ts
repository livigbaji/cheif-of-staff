import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { geminiService } from '@/lib/gemini';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { question, answer } = await request.json();

    // Get user's Gemini API key
    const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(session.user.id) as { gemini_api_key: string | null };
    
    if (!user?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });
    }

    // Initialize Gemini with user's API key
    geminiService.initialize(user.gemini_api_key);

    // Analyze the response
    const analysis = await geminiService.analyzeStandupResponse(question, answer);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing standup response:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}