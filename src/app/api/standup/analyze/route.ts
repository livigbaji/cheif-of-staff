import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { geminiService } from '@/lib/gemini';
import db from '@/lib/db';

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
    const { question, answer, apiKey } = await request.json();

    let geminiApiKey = apiKey; // Allow passing API key in request for guest users

    // For authenticated users, try to get stored API key
    if (!currentUser.isGuest && !geminiApiKey) {
      const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(currentUser.id) as { gemini_api_key: string | null } | undefined;
      geminiApiKey = user?.gemini_api_key;
    }
    
    if (!geminiApiKey) {
      return NextResponse.json({ 
        error: 'Gemini API key required',
        isGuest: currentUser.isGuest,
        message: currentUser.isGuest ? 'Please provide your Gemini API key' : 'Please configure your Gemini API key in settings'
      }, { status: 400 });
    }

    // Initialize Gemini with API key
    geminiService.initialize(geminiApiKey);

    // Analyze the response
    const analysis = await geminiService.analyzeStandupResponse(question, answer);

    return NextResponse.json({
      ...analysis,
      isGuest: currentUser.isGuest
    });
  } catch (error) {
    console.error('Error analyzing standup response:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}