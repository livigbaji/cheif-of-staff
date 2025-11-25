import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSlackClient } from '@/lib/slack';

// GET - Fetch Slack channels and workspace info
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

    if (action === 'channels') {
      // Get all channels user has access to
      const channels = await slackClient.getChannels();
      return NextResponse.json({ channels });
      
    } else if (action === 'team-info') {
      // Get workspace/team information
      const teamInfo = await slackClient.getTeamInfo();
      return NextResponse.json({ teamInfo });
      
    } else if (action === 'search') {
      // Search messages across the workspace
      const query = searchParams.get('query');
      const count = parseInt(searchParams.get('count') || '20');
      
      if (!query) {
        return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
      }
      
      const results = await slackClient.searchMessages(query, count);
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching Slack workspace data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace data' },
      { status: 500 }
    );
  }
}