import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(null);
  }

  try {
    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(session.user.id);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { who_i_am, who_i_want_to_be, strengths, weaknesses, work_style } = await request.json();

    // Check if profile exists
    const existingProfile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(session.user.id);

    if (existingProfile) {
      // Update existing profile
      db.prepare(`
        UPDATE user_profiles 
        SET who_i_am = ?, who_i_want_to_be = ?, strengths = ?, weaknesses = ?, work_style = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(
        who_i_am || null,
        who_i_want_to_be || null,
        strengths || null,
        weaknesses || null,
        work_style || null,
        session.user.id
      );
    } else {
      // Create new profile
      const profileId = uuidv4();
      db.prepare(`
        INSERT INTO user_profiles (id, user_id, who_i_am, who_i_want_to_be, strengths, weaknesses, work_style)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        profileId,
        session.user.id,
        who_i_am || null,
        who_i_want_to_be || null,
        strengths || null,
        weaknesses || null,
        work_style || null
      );
    }

    const updatedProfile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(session.user.id);
    return NextResponse.json(updatedProfile);

  } catch (error) {
    console.error('Error saving user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}