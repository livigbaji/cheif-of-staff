import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

// GET - Fetch webhook-received Slack data and analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'recent-messages') {
      // Get recent messages received via webhooks
      const limit = parseInt(searchParams.get('limit') || '50');
      const channelId = searchParams.get('channelId');
      
      let query = `
        SELECT sm.*, sc.name as channel_name 
        FROM slack_messages sm
        LEFT JOIN slack_channels sc ON sm.channel_id = sc.channel_id AND sm.user_id = sc.user_id
        WHERE sm.user_id = ?
      `;
      const params = [session.user.id];
      
      if (channelId) {
        query += ` AND sm.channel_id = ?`;
        params.push(channelId);
      }
      
      query += ` ORDER BY sm.created_at DESC LIMIT ?`;
      params.push(limit);
      
      const messages = db.prepare(query).all(...params);
      return NextResponse.json({ messages });

    } else if (action === 'reaction-analytics') {
      // Get reaction analytics
      const days = parseInt(searchParams.get('days') || '30');
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      
      const reactions = db.prepare(`
        SELECT 
          reaction,
          COUNT(*) as count,
          COUNT(DISTINCT reactor_id) as unique_reactors,
          COUNT(DISTINCT channel_id) as channels_used
        FROM slack_reactions 
        WHERE user_id = ? AND created_at >= ?
        GROUP BY reaction 
        ORDER BY count DESC
      `).all(session.user.id, dateFilter.toISOString());
      
      return NextResponse.json({ reactions });

    } else if (action === 'channel-activity') {
      // Get channel activity summary
      const days = parseInt(searchParams.get('days') || '7');
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      
      const activity = db.prepare(`
        SELECT 
          sc.name,
          sc.channel_id,
          COUNT(sm.id) as message_count,
          COUNT(DISTINCT sm.sender_id) as unique_senders,
          MAX(sm.created_at) as last_activity
        FROM slack_channels sc
        LEFT JOIN slack_messages sm ON sc.channel_id = sm.channel_id 
          AND sc.user_id = sm.user_id 
          AND sm.created_at >= ?
        WHERE sc.user_id = ?
        GROUP BY sc.channel_id, sc.name
        ORDER BY message_count DESC
      `).all(dateFilter.toISOString(), session.user.id);
      
      return NextResponse.json({ activity });

    } else if (action === 'mentions') {
      // Find messages that might mention people from the database
      const people = db.prepare('SELECT name, slack_id, email FROM people WHERE user_id = ?')
        .all(session.user.id);
      
      const mentions = [];
      for (const person of people) {
        const personMentions = db.prepare(`
          SELECT sm.*, sc.name as channel_name 
          FROM slack_messages sm
          LEFT JOIN slack_channels sc ON sm.channel_id = sc.channel_id AND sm.user_id = sc.user_id
          WHERE sm.user_id = ? 
          AND (sm.text LIKE ? OR sm.text LIKE ? OR sm.text LIKE ?)
          ORDER BY sm.created_at DESC
          LIMIT 10
        `).all(
          session.user.id,
          `%<@${person.slack_id}>%`,
          `%${person.name?.toLowerCase()}%`,
          `%${person.email?.split('@')[0]}%`
        );
        
        if (personMentions.length > 0) {
          mentions.push({
            person: person.name,
            slack_id: person.slack_id,
            mentions: personMentions
          });
        }
      }
      
      return NextResponse.json({ mentions });

    } else if (action === 'webhook-stats') {
      // Get general webhook processing statistics
      const stats = {
        total_messages: db.prepare('SELECT COUNT(*) as count FROM slack_messages WHERE user_id = ?')
          .get(session.user.id)?.count || 0,
        total_reactions: db.prepare('SELECT COUNT(*) as count FROM slack_reactions WHERE user_id = ?')
          .get(session.user.id)?.count || 0,
        total_channels: db.prepare('SELECT COUNT(*) as count FROM slack_channels WHERE user_id = ?')
          .get(session.user.id)?.count || 0,
        last_message: db.prepare('SELECT MAX(created_at) as last FROM slack_messages WHERE user_id = ?')
          .get(session.user.id)?.last
      };
      
      return NextResponse.json({ stats });

    } else {
      return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error fetching webhook data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook data' },
      { status: 500 }
    );
  }
}

// POST - Manual webhook testing and management
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'test-webhook') {
      // Test webhook processing with a sample event
      const testEvent = {
        type: 'message',
        channel: 'C123TEST',
        user: 'U123TEST',
        text: 'This is a test message from webhook testing',
        ts: Date.now().toString(),
        team: process.env.SLACK_TEAM_ID || 'T123TEST'
      };

      // Simulate storing the test message
      const messageId = `${testEvent.channel}-${testEvent.ts}`;
      
      db.prepare(`
        INSERT OR REPLACE INTO slack_messages 
        (id, user_id, channel_id, message_ts, sender_id, text, thread_ts, message_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        messageId,
        session.user.id,
        testEvent.channel,
        testEvent.ts,
        testEvent.user,
        testEvent.text,
        null,
        'test',
        new Date().toISOString()
      );

      return NextResponse.json({ 
        success: true, 
        message: 'Test webhook event processed',
        testEvent
      });

    } else if (action === 'cleanup-old-data') {
      // Clean up old webhook data (older than specified days)
      const days = body.days || 90; // Default to 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const deletedMessages = db.prepare(`
        DELETE FROM slack_messages 
        WHERE user_id = ? AND created_at < ?
      `).run(session.user.id, cutoffDate.toISOString());
      
      const deletedReactions = db.prepare(`
        DELETE FROM slack_reactions 
        WHERE user_id = ? AND created_at < ?
      `).run(session.user.id, cutoffDate.toISOString());

      return NextResponse.json({ 
        success: true, 
        deletedMessages: deletedMessages.changes,
        deletedReactions: deletedReactions.changes,
        cutoffDate: cutoffDate.toISOString()
      });

    } else if (action === 'sync-channels') {
      // Manually trigger channel sync (useful for testing)
      // This would typically be done via the webhook when channels are created/updated
      return NextResponse.json({ 
        success: true, 
        message: 'Channel sync would be triggered here' 
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing webhook management:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// DELETE - Clear webhook data
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'messages') {
      const deleted = db.prepare('DELETE FROM slack_messages WHERE user_id = ?')
        .run(session.user.id);
      return NextResponse.json({ 
        success: true, 
        deletedCount: deleted.changes 
      });

    } else if (type === 'reactions') {
      const deleted = db.prepare('DELETE FROM slack_reactions WHERE user_id = ?')
        .run(session.user.id);
      return NextResponse.json({ 
        success: true, 
        deletedCount: deleted.changes 
      });

    } else if (type === 'channels') {
      const deleted = db.prepare('DELETE FROM slack_channels WHERE user_id = ?')
        .run(session.user.id);
      return NextResponse.json({ 
        success: true, 
        deletedCount: deleted.changes 
      });

    } else if (type === 'all') {
      // Clear all webhook data for the user
      const deletedMessages = db.prepare('DELETE FROM slack_messages WHERE user_id = ?')
        .run(session.user.id);
      const deletedReactions = db.prepare('DELETE FROM slack_reactions WHERE user_id = ?')
        .run(session.user.id);
      const deletedChannels = db.prepare('DELETE FROM slack_channels WHERE user_id = ?')
        .run(session.user.id);

      return NextResponse.json({ 
        success: true, 
        deletedMessages: deletedMessages.changes,
        deletedReactions: deletedReactions.changes,
        deletedChannels: deletedChannels.changes
      });

    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error deleting webhook data:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}