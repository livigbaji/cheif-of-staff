import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { geminiService } from '@/lib/gemini';

// Helper to get current user (authenticated or guest)
async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.id) {
    return {
      ...session.user,
      isGuest: false
    };
  }
  
  return {
    id: 'guest',
    email: 'guest@localhost',
    name: 'Guest User',
    isGuest: true
  };
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { apiKey } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Initialize and test the API key (this now includes model testing)
    try {
      await geminiService.initialize(apiKey);
    } catch (error) {
      console.error('API key validation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return NextResponse.json({ 
        error: `API key validation failed: ${errorMessage}` 
      }, { status: 400 });
    }

    // For authenticated users, store the API key in database
    if (!currentUser.isGuest) {
      const db = await import('@/lib/db').then(m => m.default);
      db.prepare(`
        UPDATE users SET gemini_api_key = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(apiKey, currentUser.id);
    }

    // For guest users, just validate and return success (no persistence)
    return NextResponse.json({ 
      message: 'Gemini API key configured successfully',
      isGuest: currentUser.isGuest,
      persistedToProfile: !currentUser.isGuest
    });
  } catch (error) {
    console.error('Error configuring Gemini API:', error);
    return NextResponse.json({ error: 'Invalid API key or configuration failed' }, { status: 400 });
  }
}

export async function GET() {
  try {
    // For guest users and users without accounts, Gemini is available but not persisted
    // For authenticated users, check if they have a stored API key
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        hasApiKey: false,
        isConfigured: false,
        isGuest: true,
        message: 'Guest mode - API key needs to be entered each session'
      });
    }

    const db = await import('@/lib/db').then(m => m.default);
    const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(session.user.id) as { gemini_api_key: string | null } | undefined;
    
    return NextResponse.json({ 
      hasApiKey: !!user?.gemini_api_key,
      isConfigured: !!user?.gemini_api_key,
      isGuest: false
    });
  } catch (error) {
    console.error('Error checking Gemini configuration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}