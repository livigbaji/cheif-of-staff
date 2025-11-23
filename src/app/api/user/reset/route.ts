import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

export async function POST() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete all user data
    const tables = [
      'checklist_items',
      'standup_sessions', 
      'goals',
      'people_profiles',
      'user_profiles',
      'progress_tracking',
      'stakeholder_reports',
      'embeddings',
      'integration_settings'
    ];

    // Start transaction
    db.exec('BEGIN TRANSACTION');

    try {
      for (const table of tables) {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(session.user.id);
      }

      // Clear Gemini API key from users table
      db.prepare('UPDATE users SET gemini_api_key = NULL WHERE id = ?').run(session.user.id);

      db.exec('COMMIT');
      
      return NextResponse.json({ success: true, message: 'All user data has been reset' });

    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error resetting user data:', error);
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
  }
}