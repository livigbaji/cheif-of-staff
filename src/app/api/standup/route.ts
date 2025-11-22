import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    db.prepare(`
      INSERT INTO standup_sessions (
        id, user_id, session_date, what_did_yesterday, what_not_able_yesterday,
        who_need_to_do, what_need_to_do, why_not_able, what_doing_today,
        what_could_stop, what_need_understand, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      session.user.id,
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

    return NextResponse.json({ sessionId, message: 'Standup session created successfully' });
  } catch (error) {
    console.error('Error creating standup session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const standupSession = db.prepare(`
      SELECT * FROM standup_sessions 
      WHERE user_id = ? AND session_date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(session.user.id, date);

    return NextResponse.json(standupSession);
  } catch (error) {
    console.error('Error fetching standup session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}