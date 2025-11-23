import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { personId, personData } = await request.json();

    // Get user's Gemini API key
    const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(session.user.id);
    
    if (!user?.gemini_api_key) {
      return NextResponse.json({ 
        sentiment_summary: 'AI analysis unavailable - configure Gemini API key in settings' 
      });
    }

    // Gather factual data about the person
    const dataPoints: string[] = [];

    // Basic information
    if (personData.name) {
      dataPoints.push(`Person: ${personData.name}`);
    }
    if (personData.work_function) {
      dataPoints.push(`Role: ${personData.work_function}`);
    }
    if (personData.relationship_type) {
      dataPoints.push(`Relationship: ${personData.relationship_type}`);
    }
    if (personData.characteristics) {
      dataPoints.push(`Characteristics: ${personData.characteristics}`);
    }
    if (personData.communication_style) {
      dataPoints.push(`Communication style: ${personData.communication_style}`);
    }

    // Get goal/objective involvement if person exists
    if (personId) {
      const goals = db.prepare(`
        SELECT title, status, priority, type, created_at, updated_at 
        FROM goals 
        WHERE user_id = ? AND stakeholders LIKE ?
      `).all(session.user.id, `%"${personId}"%`);

      if (goals.length > 0) {
        dataPoints.push(`Involved in ${goals.length} goals/objectives`);
        
        const completedGoals = goals.filter(g => g.status === 'completed');
        const activeGoals = goals.filter(g => g.status === 'active');
        const pausedGoals = goals.filter(g => g.status === 'paused');
        
        if (completedGoals.length > 0) {
          dataPoints.push(`Successfully completed ${completedGoals.length} goals`);
        }
        if (activeGoals.length > 0) {
          dataPoints.push(`Currently active on ${activeGoals.length} goals`);
        }
        if (pausedGoals.length > 0) {
          dataPoints.push(`${pausedGoals.length} goals paused/at-risk`);
        }

        // Analyze priority levels
        const highPriorityGoals = goals.filter(g => g.priority <= 2).length;
        if (highPriorityGoals > 0) {
          dataPoints.push(`Involved in ${highPriorityGoals} high-priority initiatives`);
        }
      }

      // Get checklist item performance data
      const checklistItems = db.prepare(`
        SELECT ci.status, ci.priority, ci.strikes, ci.clarity_score, ss.session_date
        FROM checklist_items ci
        JOIN standup_sessions ss ON ci.standup_session_id = ss.id
        WHERE ci.assigned_to IN (
          SELECT id FROM people_profiles WHERE id = ? AND user_id = ?
        )
        ORDER BY ss.session_date DESC
        LIMIT 50
      `).all(personId, session.user.id);

      if (checklistItems.length > 0) {
        const completedItems = checklistItems.filter(item => item.status === 'completed').length;
        const blockedItems = checklistItems.filter(item => item.status === 'blocked').length;
        const atRiskItems = checklistItems.filter(item => item.strikes > 0).length;
        
        const completionRate = Math.round((completedItems / checklistItems.length) * 100);
        dataPoints.push(`Task completion rate: ${completionRate}% (${completedItems}/${checklistItems.length})`);
        
        if (blockedItems > 0) {
          dataPoints.push(`${blockedItems} tasks currently blocked`);
        }
        if (atRiskItems > 0) {
          dataPoints.push(`${atRiskItems} tasks have strikes/delays`);
        }

        // Average clarity score
        const clarityScores = checklistItems.filter(item => item.clarity_score).map(item => item.clarity_score);
        if (clarityScores.length > 0) {
          const avgClarity = Math.round(clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length);
          dataPoints.push(`Average task clarity score: ${avgClarity}/10`);
        }
      }
    }

    // If no factual data is available
    if (dataPoints.length === 0) {
      return NextResponse.json({ 
        sentiment_summary: 'Insufficient data for AI analysis - add more interactions and goals' 
      });
    }

    // Generate AI sentiment analysis
    const prompt = `Based on the following factual data about a work relationship, provide a brief, objective sentiment summary (2-4 words max) that reflects delivery patterns, collaboration effectiveness, and professional dynamics. Focus only on measurable outcomes and observable patterns, not personal feelings.

Data points:
${dataPoints.join('\n')}

Provide only a brief sentiment summary like "Reliable collaborator", "Needs support", "Strong performer", "Inconsistent delivery", "Developing relationship", etc. Be factual and professional.`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${user.gemini_api_key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!geminiResponse.ok) {
      throw new Error('Gemini API request failed');
    }

    const geminiData = await geminiResponse.json();
    const sentiment_summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Analysis pending';

    // Clean up the response to ensure it's concise
    const cleanedSentiment = sentiment_summary
      .replace(/['"]/g, '')
      .split('.')[0] // Take only first sentence
      .substring(0, 50) // Limit length
      .trim();

    return NextResponse.json({ sentiment_summary: cleanedSentiment });

  } catch (error) {
    console.error('Error generating sentiment summary:', error);
    return NextResponse.json({ 
      sentiment_summary: 'Analysis temporarily unavailable' 
    });
  }
}