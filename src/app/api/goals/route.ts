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

  try {
    const goals = db.prepare(`
      SELECT * FROM goals 
      WHERE user_id = ? 
      ORDER BY priority ASC, created_at DESC
    `).all(session.user.id);

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, type, priority, deadline, cadenceTime } = await request.json();

    const goalId = uuidv4();
    db.prepare(`
      INSERT INTO goals (
        id, user_id, title, description, type, priority, deadline, cadence_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      goalId,
      session.user.id,
      title,
      description || null,
      type,
      priority || 3,
      deadline || null,
      cadenceTime || null
    );

    return NextResponse.json({ goalId, message: 'Goal created successfully' });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}