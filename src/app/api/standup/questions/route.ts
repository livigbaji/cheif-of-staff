import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_QUESTIONS = [
  { id: 1, text: 'What did you do yesterday?' },
  { id: 2, text: 'What were you not able to do yesterday?' },
  { id: 3, text: 'Who do you need to do it?' },
  { id: 4, text: 'What do you need to do it?' },
  { id: 5, text: 'Why were you not able to do it?' },
  { id: 6, text: 'What are you doing today?' },
  { id: 7, text: 'What could stop you from doing it?' },
  { id: 8, text: 'What do you need to understand going into the day?' }
];

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    // Return default questions for guest mode
    return NextResponse.json({ success: true, questions: DEFAULT_QUESTIONS, isCustom: false });
  }

  try {
    // Check if user has custom questions
    const customQuestions = db.prepare(`
      SELECT questions_json FROM user_profiles 
      WHERE user_id = ?
    `).get(session.user.id);

    if (customQuestions?.questions_json) {
      const questions = JSON.parse(customQuestions.questions_json);
      return NextResponse.json({ success: true, questions, isCustom: true });
    }

    // Return default questions if no custom ones exist
    return NextResponse.json({ success: true, questions: DEFAULT_QUESTIONS, isCustom: false });

  } catch (error) {
    console.error('Error fetching standup questions:', error);
    return NextResponse.json({ success: true, questions: DEFAULT_QUESTIONS, isCustom: false });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { questions } = await request.json();

    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: 'Questions must be an array' }, { status: 400 });
    }

    // Validate questions
    const validQuestions = questions.filter(q => typeof q === 'string' && q.trim().length > 0);
    
    if (validQuestions.length === 0) {
      return NextResponse.json({ error: 'At least one valid question is required' }, { status: 400 });
    }

    // Check if user profile exists
    const existingProfile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(session.user.id);

    if (existingProfile) {
      // Update existing profile with questions
      db.prepare(`
        UPDATE user_profiles 
        SET questions_json = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(JSON.stringify(validQuestions), session.user.id);
    } else {
      // Create new profile with questions
      const profileId = uuidv4();
      db.prepare(`
        INSERT INTO user_profiles (id, user_id, questions_json)
        VALUES (?, ?, ?)
      `).run(profileId, session.user.id, JSON.stringify(validQuestions));
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Standup questions saved successfully',
      questions: validQuestions 
    });

  } catch (error) {
    console.error('Error saving standup questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}