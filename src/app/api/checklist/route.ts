import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Helper function to get current user (authenticated or guest)
async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.id) {
    return {
      id: session.user.id,
      isGuest: false
    };
  }
  
  // For guest users, create or retrieve a persistent guest user ID
  const guestId = 'guest-user';
  
  // Ensure guest user exists in database
  const existingGuest = db.prepare('SELECT * FROM users WHERE id = ?').get(guestId);
  if (!existingGuest) {
    db.prepare(`
      INSERT INTO users (id, email, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(guestId, 'guest@localhost', 'Guest User', new Date().toISOString(), new Date().toISOString());
  }
  
  return {
    id: guestId,
    isGuest: true
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const sessionId = searchParams.get('sessionId');

    let whereClause = 'WHERE user_id = ?';
    const params: string[] = [currentUser.id];

    if (sessionId) {
      whereClause += ' AND standup_session_id = ?';
      params.push(sessionId);
    } else if (date) {
      // Get today's standup session first
      const standupSession = db.prepare(`
        SELECT id FROM standup_sessions 
        WHERE user_id = ? AND session_date = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(currentUser.id, date);

      if (standupSession) {
        whereClause += ' AND standup_session_id = ?';
        params.push(standupSession.id as string);
      } else {
        return NextResponse.json({ items: [] });
      }
    }

    const items = db.prepare(`
      SELECT ci.*, g.title as goal_title, g.type as goal_type
      FROM checklist_items ci
      LEFT JOIN goals g ON ci.goal_id = g.id
      ${whereClause}
      ORDER BY ci.priority ASC, ci.created_at ASC
    `).all(...params);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching checklist items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { itemId, status, notes, progressPercentage, timeSpent } = await request.json();

    // Update checklist item
    db.prepare(`
      UPDATE checklist_items 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(status, itemId, currentUser.id);

    // Create check-in record
    db.prepare(`
      INSERT INTO checkins (
        id, checklist_item_id, user_id, status, notes, 
        time_spent_minutes, progress_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      itemId,
      currentUser.id,
      status,
      notes || null,
      timeSpent || null,
      progressPercentage || 0
    );

    return NextResponse.json({ message: 'Checklist item updated successfully' });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}