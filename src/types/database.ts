export interface User {
  id: string;
  email: string;
  name: string;
  google_id?: string;
  gemini_api_key?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  who_i_am?: string;
  who_i_want_to_be?: string;
  strengths?: string;
  weaknesses?: string;
  work_style?: string;
  created_at: string;
  updated_at: string;
}

export interface PeopleProfile {
  id: string;
  user_id: string;
  name: string;
  work_function?: string;
  characteristics?: string;
  biases?: string;
  communication_style?: string;
  relationship_type?: string;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: 'goal' | 'routine' | 'business_objective';
  priority: number;
  deadline?: string;
  cadence_time?: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface StandupSession {
  id: string;
  user_id: string;
  session_date: string;
  what_did_yesterday?: string;
  what_not_able_yesterday?: string;
  who_need_to_do?: string;
  what_need_to_do?: string;
  why_not_able?: string;
  what_doing_today?: string;
  what_could_stop?: string;
  what_need_understand?: string;
  checklist_generated?: string;
  mode: 'cadence' | 'waterfall';
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  standup_session_id: string;
  user_id: string;
  title: string;
  description?: string;
  estimated_time_minutes?: number;
  actual_time_minutes?: number;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'at_risk';
  strikes: number;
  max_strikes: number;
  assigned_by?: string;
  assigned_to?: string;
  due_date?: string;
  goal_id?: string;
  clarity_score: number;
  created_at: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  checklist_item_id: string;
  user_id: string;
  status: string;
  notes?: string;
  blockers?: string;
  time_spent_minutes?: number;
  progress_percentage: number;
  created_at: string;
}

export interface ProgressTracking {
  id: string;
  user_id: string;
  date: string;
  total_tasks: number;
  completed_tasks: number;
  adherence_score: number;
  alignment_score: number;
  productivity_score: number;
  created_at: string;
}

export interface StakeholderReport {
  id: string;
  user_id: string;
  stakeholder_id: string;
  content: string;
  intent: 'candid' | 'diplomatic' | 'formal';
  milestone_id?: string;
  sent_at?: string;
  created_at: string;
}

export interface IntegrationSettings {
  id: string;
  user_id: string;
  service_name: string;
  access_token?: string;
  refresh_token?: string;
  settings_json?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}