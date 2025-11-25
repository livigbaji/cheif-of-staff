import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSlackClient, mapEmailsToSlackIds } from '@/lib/slack';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';

// GET - Fetch Slack users and manage user mapping
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slackClient = await createSlackClient(session.user.id);
    if (!slackClient) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'all') {
      // Get all users in the Slack workspace
      const users = await slackClient.getAllUsers();
      return NextResponse.json({ users });
      
    } else if (action === 'map-people') {
      // Map people from the database to Slack users
      const people = db.prepare('SELECT * FROM people WHERE user_id = ?').all(session.user.id);
      const emails = people.map(person => person.email).filter(Boolean);
      
      if (emails.length === 0) {
        return NextResponse.json({ mappings: {} });
      }
      
      const mappings = await mapEmailsToSlackIds(emails, slackClient);
      
      // Update people records with Slack IDs
      for (const [email, slackId] of Object.entries(mappings)) {
        db.prepare(`
          UPDATE people 
          SET slack_id = ? 
          WHERE user_id = ? AND email = ?
        `).run(slackId, session.user.id, email);
      }
      
      return NextResponse.json({ mappings });
      
    } else if (action === 'lookup') {
      // Look up specific user by email or ID
      const email = searchParams.get('email');
      const userId = searchParams.get('userId');
      
      if (!email && !userId) {
        return NextResponse.json({ error: 'Provide email or userId' }, { status: 400 });
      }
      
      let user;
      if (email) {
        user = await slackClient.getUserByEmail(email);
      } else if (userId) {
        user = await slackClient.getUserInfo(userId);
      }
      
      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error managing Slack users:', error);
    return NextResponse.json(
      { error: 'Failed to manage users' },
      { status: 500 }
    );
  }
}

// POST - Update user mappings or sync with people database
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slackClient = await createSlackClient(session.user.id);
    if (!slackClient) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    const body = await request.json();
    const { action, data } = body;

    if (action === 'sync-people') {
      // Sync all Slack users with the people database
      const slackUsers = await slackClient.getAllUsers();
      let syncedCount = 0;

      for (const slackUser of slackUsers) {
        if (slackUser.profile?.email && !slackUser.deleted && !slackUser.is_bot) {
          // Check if person exists
          const existingPerson = db.prepare(`
            SELECT id FROM people 
            WHERE user_id = ? AND (email = ? OR slack_id = ?)
          `).get(session.user.id, slackUser.profile.email, slackUser.id);

          if (existingPerson) {
            // Update existing person with Slack ID
            db.prepare(`
              UPDATE people 
              SET slack_id = ?, name = COALESCE(?, name)
              WHERE id = ?
            `).run(slackUser.id, slackUser.profile.display_name || slackUser.real_name, existingPerson.id);
          } else {
            // Create new person from Slack user
            const personId = uuidv4();
            db.prepare(`
              INSERT INTO people (id, user_id, name, email, slack_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              personId,
              session.user.id,
              slackUser.profile.display_name || slackUser.real_name || slackUser.name,
              slackUser.profile.email,
              slackUser.id,
              new Date().toISOString(),
              new Date().toISOString()
            );
          }
          syncedCount++;
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Synced ${syncedCount} Slack users with people database` 
      });

    } else if (action === 'manual-mapping') {
      // Manually map a person to a Slack user
      const { personId, slackUserId } = data;
      
      if (!personId || !slackUserId) {
        return NextResponse.json({ 
          error: 'Missing personId or slackUserId' 
        }, { status: 400 });
      }

      db.prepare(`
        UPDATE people 
        SET slack_id = ? 
        WHERE id = ? AND user_id = ?
      `).run(slackUserId, personId, session.user.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error syncing Slack users:', error);
    return NextResponse.json(
      { error: 'Failed to sync users' },
      { status: 500 }
    );
  }
}