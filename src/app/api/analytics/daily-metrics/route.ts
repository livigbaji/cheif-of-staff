import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7');
  const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

  try {
    // Get daily metrics for the specified period
    const metrics = db.prepare(`
      SELECT * FROM daily_metrics 
      WHERE user_id = ? 
      AND date >= date(?, '-${days-1} days') 
      AND date <= ?
      ORDER BY date DESC
    `).all(session.user.id, endDate, endDate);

    // Get current day metrics (today)
    const today = new Date().toISOString().split('T')[0];
    const todayMetrics = db.prepare(`
      SELECT * FROM daily_metrics 
      WHERE user_id = ? AND date = ?
    `).get(session.user.id, today);

    return NextResponse.json({
      success: true,
      metrics,
      today: todayMetrics || {
        focus_score: 0,
        completion_rate: 0,
        proactiveness_score: 0,
        alignment_score: 0
      }
    });

  } catch (error) {
    console.error('Error fetching daily metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      date = new Date().toISOString().split('T')[0],
      focus_score,
      completion_rate,
      proactiveness_score,
      alignment_score,
      tasks_planned,
      tasks_completed,
      blockers_encountered,
      blockers_resolved,
      distractions_count,
      focus_time_minutes,
      total_work_minutes
    } = body;

    // Upsert daily metrics
    const existingMetric = db.prepare(`
      SELECT id FROM daily_metrics WHERE user_id = ? AND date = ?
    `).get(session.user.id, date);

    if (existingMetric) {
      // Update existing record
      db.prepare(`
        UPDATE daily_metrics SET
          focus_score = COALESCE(?, focus_score),
          completion_rate = COALESCE(?, completion_rate),
          proactiveness_score = COALESCE(?, proactiveness_score),
          alignment_score = COALESCE(?, alignment_score),
          tasks_planned = COALESCE(?, tasks_planned),
          tasks_completed = COALESCE(?, tasks_completed),
          blockers_encountered = COALESCE(?, blockers_encountered),
          blockers_resolved = COALESCE(?, blockers_resolved),
          distractions_count = COALESCE(?, distractions_count),
          focus_time_minutes = COALESCE(?, focus_time_minutes),
          total_work_minutes = COALESCE(?, total_work_minutes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        focus_score, completion_rate, proactiveness_score, alignment_score,
        tasks_planned, tasks_completed, blockers_encountered, blockers_resolved,
        distractions_count, focus_time_minutes, total_work_minutes,
        existingMetric.id
      );
    } else {
      // Insert new record
      const id = uuidv4();
      db.prepare(`
        INSERT INTO daily_metrics (
          id, user_id, date, focus_score, completion_rate, proactiveness_score,
          alignment_score, tasks_planned, tasks_completed, blockers_encountered,
          blockers_resolved, distractions_count, focus_time_minutes, total_work_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, session.user.id, date, focus_score || 0, completion_rate || 0,
        proactiveness_score || 0, alignment_score || 0, tasks_planned || 0,
        tasks_completed || 0, blockers_encountered || 0, blockers_resolved || 0,
        distractions_count || 0, focus_time_minutes || 0, total_work_minutes || 0
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error saving daily metrics:', error);
    return NextResponse.json({ error: 'Failed to save metrics' }, { status: 500 });
  }
}