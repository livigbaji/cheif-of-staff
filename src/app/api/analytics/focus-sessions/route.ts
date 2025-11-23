import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = `
      SELECT * FROM focus_sessions 
      WHERE user_id = ?
    `;
    const params = [session.user.id];

    if (startDate && endDate) {
      query += ` AND start_time >= ? AND start_time <= ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY start_time DESC`;

    const sessions = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      sessions
    });

  } catch (error) {
    console.error('Error fetching focus sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch focus sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      start_time, 
      end_time, 
      duration_minutes, 
      session_type = 'deep_work',
      interruptions_count = 0,
      notes
    } = body;

    if (!start_time || !duration_minutes) {
      return NextResponse.json({ 
        error: 'Start time and duration are required' 
      }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO focus_sessions (
        id, user_id, start_time, end_time, duration_minutes, 
        session_type, interruptions_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, session.user.id, start_time, end_time, duration_minutes,
      session_type, interruptions_count, notes
    );

    return NextResponse.json({ success: true, id });

  } catch (error) {
    console.error('Error creating focus session:', error);
    return NextResponse.json({ error: 'Failed to create focus session' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, end_time, duration_minutes, interruptions_count, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify ownership
    const focusSession = db.prepare(`
      SELECT * FROM focus_sessions WHERE id = ? AND user_id = ?
    `).get(id, session.user.id);

    if (!focusSession) {
      return NextResponse.json({ error: 'Focus session not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE focus_sessions SET
        end_time = COALESCE(?, end_time),
        duration_minutes = COALESCE(?, duration_minutes),
        interruptions_count = COALESCE(?, interruptions_count),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(end_time, duration_minutes, interruptions_count, notes, id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating focus session:', error);
    return NextResponse.json({ error: 'Failed to update focus session' }, { status: 500 });
  }
}