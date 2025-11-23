import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  // For guest mode, return empty array
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }

  try {
    const goals = db.prepare(`
      SELECT * FROM goals 
      WHERE user_id = ? 
      ORDER BY priority ASC, created_at DESC
    `).all(session.user.id);

    // Parse stakeholders JSON for each goal
    const goalsWithParsedStakeholders = goals.map(goal => ({
      ...goal,
      stakeholders: goal.stakeholders ? JSON.parse(goal.stakeholders) : []
    }));

    return NextResponse.json(goalsWithParsedStakeholders);
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
    const { title, description, type, priority, deadline, cadence_time, status, stakeholders } = await request.json();

    const goalId = uuidv4();
    db.prepare(`
      INSERT INTO goals (
        id, user_id, title, description, type, priority, deadline, cadence_time, status, stakeholders
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      goalId,
      session.user.id,
      title,
      description || null,
      type,
      priority || 3,
      deadline || null,
      cadence_time || null,
      status || 'active',
      stakeholders ? JSON.stringify(stakeholders) : null
    );

    const newGoal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
    // Parse stakeholders for response
    const goalWithParsedStakeholders = {
      ...newGoal,
      stakeholders: newGoal.stakeholders ? JSON.parse(newGoal.stakeholders) : []
    };
    return NextResponse.json(goalWithParsedStakeholders);
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const goalId = url.searchParams.get('id');
    
    if (!goalId) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 });
    }

    const { title, description, type, priority, deadline, cadence_time, status, stakeholders } = await request.json();

    // Verify goal belongs to user
    const existingGoal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(goalId, session.user.id);
    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Update goal
    db.prepare(`
      UPDATE goals 
      SET title = ?, description = ?, type = ?, priority = ?, deadline = ?, cadence_time = ?, status = ?, stakeholders = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      title,
      description || null,
      type,
      priority || 3,
      deadline || null,
      cadence_time || null,
      status || 'active',
      stakeholders ? JSON.stringify(stakeholders) : null,
      goalId,
      session.user.id
    );

    const updatedGoal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
    // Parse stakeholders for response
    const goalWithParsedStakeholders = {
      ...updatedGoal,
      stakeholders: updatedGoal.stakeholders ? JSON.parse(updatedGoal.stakeholders) : []
    };
    return NextResponse.json(goalWithParsedStakeholders);
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const goalId = url.searchParams.get('id');
    
    if (!goalId) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 });
    }

    // Verify goal belongs to user and delete
    const result = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(goalId, session.user.id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}