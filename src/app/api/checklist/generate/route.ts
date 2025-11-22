import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { geminiService } from '@/lib/gemini';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId } = await request.json();

    // Get standup session data
    const standupSession = db.prepare(`
      SELECT * FROM standup_sessions WHERE id = ? AND user_id = ?
    `).get(sessionId, session.user.id);

    if (!standupSession) {
      return NextResponse.json({ error: 'Standup session not found' }, { status: 404 });
    }

    // Get user's Gemini API key
    const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(session.user.id) as { gemini_api_key: string | null };
    
    if (!user?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });
    }

    // Initialize Gemini with user's API key
    geminiService.initialize(user.gemini_api_key);

    // Get user goals for alignment
    const goals = db.prepare(`
      SELECT * FROM goals WHERE user_id = ? AND status = 'active'
    `).all(session.user.id);

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

    // Store checklist items in database
    const checklistItems = [];
    for (const item of checklistData.items) {
      const itemId = uuidv4();
      
      // Find matching goal if any
      const matchingGoal = goals.find(goal => 
        item.goalAlignment.some(alignment => 
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
        session.user.id,
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