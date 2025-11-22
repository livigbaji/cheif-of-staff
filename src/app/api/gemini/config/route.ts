import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { geminiService } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { apiKey } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Test the API key
    geminiService.initialize(apiKey);
    await geminiService.generateResponse('Hello, this is a test.');

    // Store the API key in the database
    const db = await import('@/lib/db').then(m => m.default);
    db.prepare(`
      UPDATE users SET gemini_api_key = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(apiKey, session.user.id);

    return NextResponse.json({ message: 'Gemini API key configured successfully' });
  } catch (error) {
    console.error('Error configuring Gemini API:', error);
    return NextResponse.json({ error: 'Invalid API key or configuration failed' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await import('@/lib/db').then(m => m.default);
    const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(session.user.id) as any;
    
    return NextResponse.json({ 
      hasApiKey: !!user?.gemini_api_key,
      isConfigured: !!user?.gemini_api_key 
    });
  } catch (error) {
    console.error('Error checking Gemini configuration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}