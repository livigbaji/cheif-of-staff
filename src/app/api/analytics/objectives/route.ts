import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const objectives = db.prepare(`
      SELECT * FROM objective_progress 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(session.user.id);

    return NextResponse.json({
      success: true,
      objectives
    });

  } catch (error) {
    console.error('Error fetching objectives:', error);
    return NextResponse.json({ error: 'Failed to fetch objectives' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, target_date, progress_percentage = 0 } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO objective_progress (
        id, user_id, title, description, target_date, progress_percentage
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, session.user.id, title, description, target_date, progress_percentage);

    return NextResponse.json({ success: true, id });

  } catch (error) {
    console.error('Error creating objective:', error);
    return NextResponse.json({ error: 'Failed to create objective' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, title, description, target_date, progress_percentage, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Objective ID is required' }, { status: 400 });
    }

    // Verify ownership
    const objective = db.prepare(`
      SELECT * FROM objective_progress WHERE id = ? AND user_id = ?
    `).get(id, session.user.id);

    if (!objective) {
      return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE objective_progress SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        target_date = COALESCE(?, target_date),
        progress_percentage = COALESCE(?, progress_percentage),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, target_date, progress_percentage, status, id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating objective:', error);
    return NextResponse.json({ error: 'Failed to update objective' }, { status: 500 });
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
      return NextResponse.json({ error: 'Objective ID is required' }, { status: 400 });
    }

    // Verify ownership and delete
    const result = db.prepare(`
      DELETE FROM objective_progress WHERE id = ? AND user_id = ?
    `).run(id, session.user.id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting objective:', error);
    return NextResponse.json({ error: 'Failed to delete objective' }, { status: 500 });
  }
}