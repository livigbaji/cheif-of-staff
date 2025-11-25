import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { geminiService } from '@/lib/gemini';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Helper function to get current user (authenticated or guest)
async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.id) {
    return {
      id: session.user.id,
      isGuest: false,
      session
    };
  }
  
  // For guest users, create or retrieve a persistent guest user ID
  const guestId = 'guest-user';
  
  // Ensure guest user exists in database
  const existingGuest = db.prepare('SELECT * FROM users WHERE id = ?').get(guestId);
  if (!existingGuest) {
    db.prepare(`
      INSERT INTO users (id, email, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(guestId, 'guest@localhost', 'Guest User', new Date().toISOString(), new Date().toISOString());
  }
  
  return {
    id: guestId,
    isGuest: true,
    session: null
  };
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { sessionId, standupData } = await request.json();

    let standupSession = null;
    
    // For authenticated users, try to get standup session from database
    if (!currentUser.isGuest && sessionId) {
      standupSession = db.prepare(`
        SELECT * FROM standup_sessions WHERE id = ? AND user_id = ?
      `).get(sessionId, currentUser.id);
    }
    
    // If no session found in DB, use provided standup data (for guest mode or new sessions)
    if (!standupSession && standupData) {
      standupSession = standupData;
    }

    if (!standupSession) {
      return NextResponse.json({ error: 'No standup data provided' }, { status: 400 });
    }

    // Get user's Gemini API key (for authenticated users) or use default
    let userApiKey = process.env.GEMINI_API_KEY || '';
    if (!currentUser.isGuest) {
      const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(currentUser.id) as { gemini_api_key: string | null };
      if (user?.gemini_api_key) {
        userApiKey = user.gemini_api_key;
      }
    }
    
    if (!userApiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });
    }

    // Initialize Gemini with API key
    await geminiService.initialize(userApiKey);

    // Get user goals for alignment (authenticated users only)
    let goals = [];
    if (!currentUser.isGuest) {
      goals = db.prepare(`
        SELECT * FROM goals WHERE user_id = ? AND status = 'active'
      `).all(currentUser.id);
    }

    // Generate checklist
    const checklistData = await geminiService.generateChecklist({
      whatDidYesterday: standupSession.what_did_yesterday,
      whatNotAbleYesterday: standupSession.what_not_able_yesterday,
      whoNeedToDo: standupSession.who_need_to_do,
      whatNeedToDo: standupSession.what_need_to_do,
      whyNotAble: standupSession.why_not_able,
      whatDoingToday: standupSession.what_doing_today,
      whatCouldStop: standupSession.what_could_stop,
      whatNeedUnderstand: standupSession.what_need_understand,
      goals
    });

    // Store checklist items in database (for all users including guests)
    const checklistItems = [];
    for (let index = 0; index < checklistData.items.length; index++) {
      const item = checklistData.items[index];
      const itemId = uuidv4();
      
      // Find matching goal if any
      const matchingGoal = goals.find(goal => 
        item.goalAlignment && item.goalAlignment.some(alignment => 
          goal.title.toLowerCase().includes(alignment.toLowerCase()) ||
          goal.description?.toLowerCase().includes(alignment.toLowerCase())
        )
      );

      db.prepare(`
        INSERT INTO checklist_items (
          id, standup_session_id, user_id, title, description,
          estimated_time_minutes, priority, goal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        sessionId,
        currentUser.id,
        item.title,
        item.description,
        item.estimatedTimeMinutes,
        item.priority,
        matchingGoal?.id || null
      );

      checklistItems.push({
        id: itemId,
        ...item,
        goalId: matchingGoal?.id || null
      });
    }

    // Update standup session with generated checklist
    db.prepare(`
      UPDATE standup_sessions 
      SET checklist_generated = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(checklistData), sessionId);

    return NextResponse.json({
      items: checklistItems,
      insights: checklistData.insights,
      sessionId
    });
  } catch (error) {
    console.error('Error generating checklist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}