import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Helper function to get or create guest user session
function getGuestUser(request: NextRequest) {
  const guestId = request.headers.get('x-guest-id') || uuidv4();
  return {
    id: `guest-${guestId}`,
    email: 'guest@localhost',
    name: 'Guest User',
    isGuest: true
  };
}

// Helper function to get current user (authenticated or guest)
async function getCurrentUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.id) {
    return {
      ...session.user,
      isGuest: false
    };
  }
  
  return getGuestUser(request);
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    const body = await request.json();
    const {
      whatDidYesterday,
      whatNotAbleYesterday,
      whoNeedToDo,
      whatNeedToDo,
      whyNotAble,
      whatDoingToday,
      whatCouldStop,
      whatNeedUnderstand,
      mode = 'cadence'
    } = body;

    // Create standup session
    const sessionId = uuidv4();
    const today = new Date().toISOString().split('T')[0];

    // Only store in database for authenticated users
    if (!currentUser.isGuest) {
      db.prepare(`
        INSERT INTO standup_sessions (
          id, user_id, session_date, what_did_yesterday, what_not_able_yesterday,
          who_need_to_do, what_need_to_do, why_not_able, what_doing_today,
          what_could_stop, what_need_understand, mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        currentUser.id,
        today,
        whatDidYesterday,
        whatNotAbleYesterday,
        whoNeedToDo,
        whatNeedToDo,
        whyNotAble,
        whatDoingToday,
        whatCouldStop,
        whatNeedUnderstand,
        mode
      );
    }

    return NextResponse.json({ 
      sessionId, 
      message: 'Standup session created successfully',
      isGuest: currentUser.isGuest
    });
  } catch (error) {
    console.error('Error creating standup session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // For guest users, return empty (no persistence)
    if (currentUser.isGuest) {
      return NextResponse.json({ 
        message: 'Guest mode - no session history available',
        isGuest: true
      });
    }

    const standupSession = db.prepare(`
      SELECT * FROM standup_sessions 
      WHERE user_id = ? AND session_date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(currentUser.id, date);

    return NextResponse.json(standupSession);
  } catch (error) {
    console.error('Error fetching standup session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}