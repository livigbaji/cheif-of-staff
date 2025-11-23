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
    const people = db.prepare(`
      SELECT * FROM people_profiles 
      WHERE user_id = ? 
      ORDER BY name ASC
    `).all(session.user.id);

    return NextResponse.json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, work_function, characteristics, biases, communication_style, relationship_type, profile_picture, sentiment_summary } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const personId = uuidv4();
    db.prepare(`
      INSERT INTO people_profiles (
        id, user_id, name, work_function, characteristics, biases, communication_style, relationship_type, profile_picture, sentiment_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personId,
      session.user.id,
      name,
      work_function || null,
      characteristics || null,
      biases || null,
      communication_style || null,
      relationship_type || null,
      profile_picture || null,
      sentiment_summary || null
    );

    const newPerson = db.prepare('SELECT * FROM people_profiles WHERE id = ?').get(personId);
    return NextResponse.json(newPerson);
  } catch (error) {
    console.error('Error creating person:', error);
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
    const personId = url.searchParams.get('id');
    
    if (!personId) {
      return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
    }

    const { name, work_function, characteristics, biases, communication_style, relationship_type, profile_picture, sentiment_summary } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Verify person belongs to user
    const existingPerson = db.prepare('SELECT * FROM people_profiles WHERE id = ? AND user_id = ?').get(personId, session.user.id);
    if (!existingPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Update person
    db.prepare(`
      UPDATE people_profiles 
      SET name = ?, work_function = ?, characteristics = ?, biases = ?, communication_style = ?, relationship_type = ?, profile_picture = ?, sentiment_summary = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      name,
      work_function || null,
      characteristics || null,
      biases || null,
      communication_style || null,
      relationship_type || null,
      profile_picture || null,
      sentiment_summary || null,
      personId,
      session.user.id
    );

    const updatedPerson = db.prepare('SELECT * FROM people_profiles WHERE id = ?').get(personId);
    return NextResponse.json(updatedPerson);
  } catch (error) {
    console.error('Error updating person:', error);
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
    const personId = url.searchParams.get('id');
    
    if (!personId) {
      return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
    }

    // Verify person belongs to user and delete
    const result = db.prepare('DELETE FROM people_profiles WHERE id = ? AND user_id = ?').run(personId, session.user.id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}