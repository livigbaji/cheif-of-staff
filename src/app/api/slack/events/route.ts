import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';

// TypeScript interfaces for Slack events
interface SlackEvent {
  type: string;
  challenge?: string;
  event?: SlackEventData;
}

interface SlackEventData {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  team?: string;
  bot_id?: string;
  subtype?: string;
  channel_type?: string;
  item?: {
    channel: string;
    ts: string;
  };
  reaction?: string;
  channel_id?: string;
}

interface SlackReactionEvent extends SlackEventData {
  item: {
    channel: string;
    ts: string;
  };
  reaction: string;
  user: string;
  team: string;
}

interface SlackChannelEvent extends SlackEventData {
  channel: {
    id: string;
    name: string;
    is_private?: boolean;
    creator?: string;
  };
  team: string;
}

interface SlackUserEvent extends SlackEventData {
  user: {
    id: string;
    name: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
      email?: string;
    };
  };
  team: string;
}

// Slack Events API webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-slack-signature');
    const timestamp = request.headers.get('x-slack-request-timestamp');

    // Verify the request is from Slack
    if (!verifySlackSignature(body, signature, timestamp)) {
      console.error('Invalid Slack signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle different event types
    switch (event.type) {
      case 'url_verification':
        // This is for initial webhook setup verification
        return NextResponse.json({ challenge: event.challenge });

      case 'event_callback':
        // Handle actual events
        await handleSlackEvent(event.event);
        break;

      case 'app_rate_limited':
        console.warn('Slack app rate limited:', event);
        break;

      default:
        console.log('Unhandled Slack event type:', event.type);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Error handling Slack webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function verifySlackSignature(body: string, signature: string | null, timestamp: string | null): boolean {
  if (!signature || !timestamp || !process.env.SLACK_SIGNING_SECRET) {
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minutes tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Calculate expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

async function handleSlackEvent(event: SlackEventData) {
  try {
    switch (event.type) {
      case 'message':
        await handleMessageEvent(event);
        break;

      case 'reaction_added':
        await handleReactionEvent(event as SlackReactionEvent, 'added');
        break;

      case 'reaction_removed':
        await handleReactionEvent(event as SlackReactionEvent, 'removed');
        break;

      case 'channel_created':
        await handleChannelEvent(event as SlackChannelEvent, 'created');
        break;

      case 'channel_deleted':
        await handleChannelEvent(event as SlackChannelEvent, 'deleted');
        break;

      case 'channel_rename':
        await handleChannelEvent(event as SlackChannelEvent, 'renamed');
        break;

      case 'member_joined_channel':
        await handleMemberEvent(event, 'joined');
        break;

      case 'member_left_channel':
        await handleMemberEvent(event, 'left');
        break;

      case 'team_join':
        await handleTeamJoinEvent(event as SlackUserEvent);
        break;

      case 'user_change':
        await handleUserChangeEvent(event as SlackUserEvent);
        break;

      default:
        console.log('Unhandled Slack event:', event.type);
    }
  } catch (error) {
    console.error('Error processing Slack event:', error);
  }
}

async function handleMessageEvent(event: SlackEventData) {
  // Skip bot messages and message changes
  if (event.bot_id || event.subtype === 'message_changed' || event.subtype === 'message_deleted') {
    return;
  }

  // Find user associated with this Slack workspace
  const teamId = event.team || process.env.SLACK_TEAM_ID;
  const userId = await findUserBySlackTeam(teamId || '');
  
  if (!userId) {
    console.log('No user found for Slack team:', teamId);
    return;
  }

  // Store the message in our database for analytics/search
  const messageId = `${event.channel}-${event.ts}`;
  
  try {
    db.prepare(`
      INSERT OR REPLACE INTO slack_messages 
      (id, user_id, channel_id, message_ts, sender_id, text, thread_ts, message_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      userId,
      event.channel,
      event.ts,
      event.user,
      event.text || '',
      event.thread_ts || null,
      event.channel_type || 'channel',
      new Date().toISOString()
    );

    // If this mentions people from our database, create notifications
    await checkForPeopleMentions(userId, event);

  } catch (error) {
    console.error('Error storing message:', error);
  }
}

async function handleReactionEvent(event: SlackReactionEvent, action: 'added' | 'removed') {
  const teamId = event.team || process.env.SLACK_TEAM_ID;
  const userId = await findUserBySlackTeam(teamId || '');
  
  if (!userId) return;

  const reactionId = `${event.item.channel}-${event.item.ts}-${event.reaction}-${event.user}`;
  
  if (action === 'added') {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO slack_reactions 
        (id, user_id, channel_id, message_ts, reaction, reactor_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        reactionId,
        userId,
        event.item.channel,
        event.item.ts,
        event.reaction,
        event.user,
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Error storing reaction:', error);
    }
  } else {
    try {
      db.prepare(`DELETE FROM slack_reactions WHERE id = ?`).run(reactionId);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  }
}

async function handleChannelEvent(event: SlackChannelEvent, action: 'created' | 'deleted' | 'renamed') {
  const teamId = event.team || process.env.SLACK_TEAM_ID;
  const userId = await findUserBySlackTeam(teamId || '');
  
  if (!userId) return;

  try {
    if (action === 'created') {
      db.prepare(`
        INSERT OR REPLACE INTO slack_channels 
        (id, user_id, channel_id, name, is_private, creator_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `${userId}-${event.channel.id}`,
        userId,
        event.channel.id,
        event.channel.name,
        event.channel.is_private ? 1 : 0,
        event.channel.creator,
        new Date().toISOString(),
        new Date().toISOString()
      );
    } else if (action === 'deleted') {
      db.prepare(`DELETE FROM slack_channels WHERE user_id = ? AND channel_id = ?`)
        .run(userId, event.channel);
    } else if (action === 'renamed') {
      db.prepare(`
        UPDATE slack_channels 
        SET name = ?, updated_at = ? 
        WHERE user_id = ? AND channel_id = ?
      `).run(event.channel.name, new Date().toISOString(), userId, event.channel.id);
    }
  } catch (error) {
    console.error('Error handling channel event:', error);
  }
}

async function handleMemberEvent(event: SlackEventData, action: 'joined' | 'left') {
  // Log channel membership changes for analytics
  console.log(`User ${event.user} ${action} channel ${event.channel}`);
}

async function handleTeamJoinEvent(event: SlackUserEvent) {
  // A new user joined the Slack workspace
  const teamId = event.team || process.env.SLACK_TEAM_ID;
  const userId = await findUserBySlackTeam(teamId || '');
  
  if (!userId) return;

  // Optionally sync this new user with the people database
  console.log('New team member:', event.user);
}

async function handleUserChangeEvent(event: SlackUserEvent) {
  // A user's profile changed - update our records if they're in our people database
  const teamId = event.team || process.env.SLACK_TEAM_ID;
  const userId = await findUserBySlackTeam(teamId || '');
  
  if (!userId) return;

  try {
    const userProfile = event.user.profile;
    if (userProfile?.email) {
      db.prepare(`
        UPDATE people 
        SET name = COALESCE(?, name), updated_at = ?
        WHERE user_id = ? AND slack_id = ?
      `).run(
        userProfile.display_name || userProfile.real_name || event.user.name,
        new Date().toISOString(),
        userId,
        event.user.id
      );
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

async function findUserBySlackTeam(teamId: string): Promise<string | null> {
  try {
    // Find user who has connected this Slack workspace
    const integration = db.prepare(`
      SELECT user_id 
      FROM integration_settings 
      WHERE service_name = 'slack' 
      AND (team_id = ? OR access_token LIKE '%${teamId}%')
    `).get(teamId);

    return integration?.user_id || null;
  } catch (error) {
    console.error('Error finding user by team:', error);
    return null;
  }
}

async function checkForPeopleMentions(userId: string, event: SlackEventData) {
  if (!event.text) return;

  try {
    // Get all people for this user
    const people = db.prepare('SELECT id, name, email, slack_id FROM people WHERE user_id = ?').all(userId);
    
    for (const person of people) {
      // Check if person is mentioned by Slack ID or name
      const mentionPatterns = [
        `<@${person.slack_id}>`, // Slack user mention
        person.name?.toLowerCase(),
        person.email?.split('@')[0] // username part of email
      ].filter(Boolean);

      const messageText = event.text.toLowerCase();
      const isMentioned = mentionPatterns.some(pattern => 
        messageText.includes(pattern.toLowerCase())
      );

      if (isMentioned) {
        // Create a notification or log the mention
        console.log(`Person ${person.name} mentioned in Slack message`);
        
        // You could create a notification in your database here
        // or trigger other actions like updating person interaction history
      }
    }
  } catch (error) {
    console.error('Error checking mentions:', error);
  }
}