import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSlackClient } from '@/lib/slack';

// GET - Fetch messages (DMs or channel history)
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
    const type = searchParams.get('type'); // 'dm' or 'channel'
    const targetId = searchParams.get('targetId'); // user ID for DM, channel ID for channel
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!type || !targetId) {
      return NextResponse.json({ error: 'Missing type or targetId parameter' }, { status: 400 });
    }

    let messages;
    if (type === 'dm') {
      messages = await slackClient.getDirectMessageHistory(targetId, limit);
    } else if (type === 'channel') {
      messages = await slackClient.getChannelHistory(targetId, limit);
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "dm" or "channel"' }, { status: 400 });
    }

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Error fetching Slack messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST - Send a message (DM, channel, or thread reply)
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
    const { type, targetId, message, threadTs } = body;

    if (!type || !targetId || !message) {
      return NextResponse.json({ 
        error: 'Missing required fields: type, targetId, message' 
      }, { status: 400 });
    }

    let result;
    if (type === 'dm') {
      result = await slackClient.sendDirectMessage(targetId, message);
    } else if (type === 'channel') {
      result = await slackClient.sendChannelMessage(targetId, message);
    } else if (type === 'thread' && threadTs) {
      result = await slackClient.replyToThread(targetId, threadTs, message);
    } else {
      return NextResponse.json({ 
        error: 'Invalid type or missing threadTs for thread reply' 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });

  } catch (error) {
    console.error('Error sending Slack message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}