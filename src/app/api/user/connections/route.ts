import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ google_id: null, slack_id: null });
    }

    // Get user connection status
    const user = db.prepare(`
      SELECT google_id, slack_id 
      FROM users 
      WHERE email = ?
    `).get(session.user.email);

    return NextResponse.json({
      google_id: user?.google_id || null,
      slack_id: user?.slack_id || null
    });

  } catch (error) {
    console.error('Error checking connection status:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}