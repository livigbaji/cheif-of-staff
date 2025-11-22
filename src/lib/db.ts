import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'chief-of-staff.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
const initializeDatabase = () => {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      google_id TEXT UNIQUE,
      gemini_api_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User profiles
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      who_i_am TEXT,
      who_i_want_to_be TEXT,
      strengths TEXT,
      weaknesses TEXT,
      work_style TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // People profiles
  db.exec(`
    CREATE TABLE IF NOT EXISTS people_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      work_function TEXT,
      characteristics TEXT,
      biases TEXT,
      communication_style TEXT,
      relationship_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Goals and objectives
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'goal', 'routine', 'business_objective'
      priority INTEGER DEFAULT 1,
      deadline DATETIME,
      cadence_time TEXT, -- 'daily', 'weekly', 'monthly', etc.
      status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'archived'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Standup sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS standup_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_date DATE NOT NULL,
      what_did_yesterday TEXT,
      what_not_able_yesterday TEXT,
      who_need_to_do TEXT,
      what_need_to_do TEXT,
      why_not_able TEXT,
      what_doing_today TEXT,
      what_could_stop TEXT,
      what_need_understand TEXT,
      checklist_generated TEXT,
      mode TEXT DEFAULT 'cadence', -- 'cadence' or 'waterfall'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Checklist items
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      standup_session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      estimated_time_minutes INTEGER,
      actual_time_minutes INTEGER,
      priority INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'blocked', 'at_risk'
      strikes INTEGER DEFAULT 0,
      max_strikes INTEGER DEFAULT 3,
      assigned_by TEXT,
      assigned_to TEXT,
      due_date DATETIME,
      goal_id TEXT,
      clarity_score INTEGER DEFAULT 10, -- 1-10 scale
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (standup_session_id) REFERENCES standup_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (goal_id) REFERENCES goals(id),
      FOREIGN KEY (assigned_by) REFERENCES people_profiles(id),
      FOREIGN KEY (assigned_to) REFERENCES people_profiles(id)
    )
  `);

  // Check-ins
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      checklist_item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      blockers TEXT,
      time_spent_minutes INTEGER,
      progress_percentage INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Progress tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_tracking (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      total_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      adherence_score REAL DEFAULT 0,
      alignment_score REAL DEFAULT 0,
      productivity_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Stakeholder reports
  db.exec(`
    CREATE TABLE IF NOT EXISTS stakeholder_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stakeholder_id TEXT NOT NULL,
      content TEXT NOT NULL,
      intent TEXT DEFAULT 'candid', -- 'candid', 'diplomatic', 'formal'
      milestone_id TEXT,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stakeholder_id) REFERENCES people_profiles(id)
    )
  `);

  // Vector embeddings for semantic search
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL, -- 'standup', 'checklist_item', 'profile', 'goal'
      content_id TEXT NOT NULL,
      content_text TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Integration settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_name TEXT NOT NULL, -- 'slack', 'email', 'google_calendar', 'google_tasks'
      access_token TEXT,
      refresh_token TEXT,
      settings_json TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
};

// Initialize database on import
initializeDatabase();

export default db;