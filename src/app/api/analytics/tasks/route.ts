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
  const status = searchParams.get('status');

  try {
    let query = `
      SELECT * FROM task_tracking 
      WHERE user_id = ?
    `;
    const params = [session.user.id];

    if (startDate && endDate) {
      query += ` AND created_at >= ? AND created_at <= ?`;
      params.push(startDate, endDate);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const tasks = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
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
      title, 
      description, 
      priority = 'medium',
      estimated_minutes,
      actual_minutes,
      due_date,
      status = 'pending'
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO task_tracking (
        id, user_id, title, description, priority, estimated_minutes,
        actual_minutes, due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, session.user.id, title, description, priority, 
      estimated_minutes, actual_minutes, due_date, status
    );

    return NextResponse.json({ success: true, id });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      id, 
      title, 
      description, 
      priority, 
      estimated_minutes, 
      actual_minutes, 
      due_date, 
      status,
      completed_at
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Verify ownership
    const task = db.prepare(`
      SELECT * FROM task_tracking WHERE id = ? AND user_id = ?
    `).get(id, session.user.id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Auto-set completed_at if status changed to completed
    let finalCompletedAt = completed_at;
    if (status === 'completed' && !completed_at && task.status !== 'completed') {
      finalCompletedAt = new Date().toISOString();
    }

    db.prepare(`
      UPDATE task_tracking SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        estimated_minutes = COALESCE(?, estimated_minutes),
        actual_minutes = COALESCE(?, actual_minutes),
        due_date = COALESCE(?, due_date),
        status = COALESCE(?, status),
        completed_at = COALESCE(?, completed_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, description, priority, estimated_minutes, actual_minutes,
      due_date, status, finalCompletedAt, id
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Verify ownership and delete
    const result = db.prepare(`
      DELETE FROM task_tracking WHERE id = ? AND user_id = ?
    `).run(id, session.user.id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}