import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSlackClient } from '@/lib/slack';

// GET - Fetch thread replies or message context
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
    const channelId = searchParams.get('channelId');
    const messageTs = searchParams.get('messageTs');
    const action = searchParams.get('action');

    if (!channelId || !messageTs) {
      return NextResponse.json({ 
        error: 'Missing channelId or messageTs parameter' 
      }, { status: 400 });
    }

    if (action === 'replies') {
      // Get thread replies
      const replies = await slackClient.getThreadReplies(channelId, messageTs);
      return NextResponse.json({ replies });
      
    } else if (action === 'context') {
      // Get message context (messages before and after)
      const contextSize = parseInt(searchParams.get('contextSize') || '5');
      const context = await slackClient.getMessageContext(channelId, messageTs, contextSize);
      return NextResponse.json({ context });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching Slack thread data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread data' },
      { status: 500 }
    );
  }
}

// POST - Add reactions or manage thread interactions
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
    const { action, channelId, messageTs, reaction } = body;

    if (!channelId || !messageTs) {
      return NextResponse.json({ 
        error: 'Missing channelId or messageTs' 
      }, { status: 400 });
    }

    if (action === 'add-reaction') {
      if (!reaction) {
        return NextResponse.json({ error: 'Missing reaction' }, { status: 400 });
      }
      
      const result = await slackClient.addReaction(channelId, messageTs, reaction);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error managing Slack thread interaction:', error);
    return NextResponse.json(
      { error: 'Failed to manage thread interaction' },
      { status: 500 }
    );
  }
}