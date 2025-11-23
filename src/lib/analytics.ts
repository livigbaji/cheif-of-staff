// Analytics data fetching utilities
interface DailyMetric {
  id: string;
  user_id: string;
  date: string;
  focus_score: number;
  completion_rate: number;
  proactiveness_score: number;
  alignment_score: number;
  tasks_planned: number;
  tasks_completed: number;
  blockers_encountered: number;
  blockers_resolved: number;
  distractions_count: number;
  focus_time_minutes: number;
  total_work_minutes: number;
  created_at: string;
  updated_at: string;
}

interface Objective {
  id: string;
  user_id: string;
  title: string;
  description: string;
  target_date: string;
  progress_percentage: number;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimated_minutes: number;
  actual_minutes: number;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at: string;
  created_at: string;
  updated_at: string;
}

interface FocusSession {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  session_type: 'deep_work' | 'meetings' | 'admin' | 'break';
  interruptions_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export async function fetchDailyMetrics(days: number = 7): Promise<{
  metrics: DailyMetric[];
  today: Partial<DailyMetric>;
}> {
  const response = await fetch(`/api/analytics/daily-metrics?days=${days}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch daily metrics');
  }

  const data = await response.json();
  return data;
}

export async function updateDailyMetrics(metrics: Partial<DailyMetric>): Promise<void> {
  const response = await fetch('/api/analytics/daily-metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metrics),
  });

  if (!response.ok) {
    throw new Error('Failed to update daily metrics');
  }
}

export async function fetchObjectives(): Promise<Objective[]> {
  const response = await fetch('/api/analytics/objectives', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch objectives');
  }

  const data = await response.json();
  return data.objectives;
}

export async function createObjective(objective: Omit<Objective, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
  const response = await fetch('/api/analytics/objectives', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(objective),
  });

  if (!response.ok) {
    throw new Error('Failed to create objective');
  }

  const data = await response.json();
  return data.id;
}

export async function updateObjective(id: string, updates: Partial<Objective>): Promise<void> {
  const response = await fetch('/api/analytics/objectives', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!response.ok) {
    throw new Error('Failed to update objective');
  }
}

export async function fetchTasks(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`/api/analytics/tasks?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }

  const data = await response.json();
  return data.tasks;
}

export async function createTask(task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at'>): Promise<string> {
  const response = await fetch('/api/analytics/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error('Failed to create task');
  }

  const data = await response.json();
  return data.id;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const response = await fetch('/api/analytics/tasks', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!response.ok) {
    throw new Error('Failed to update task');
  }
}

export async function fetchFocusSessions(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<FocusSession[]> {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await fetch(`/api/analytics/focus-sessions?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch focus sessions');
  }

  const data = await response.json();
  return data.sessions;
}

export async function startFocusSession(session: Omit<FocusSession, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'end_time'>): Promise<string> {
  const response = await fetch('/api/analytics/focus-sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(session),
  });

  if (!response.ok) {
    throw new Error('Failed to start focus session');
  }

  const data = await response.json();
  return data.id;
}

export async function endFocusSession(id: string, updates: Partial<FocusSession>): Promise<void> {
  const response = await fetch('/api/analytics/focus-sessions', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!response.ok) {
    throw new Error('Failed to end focus session');
  }
}

// Calculate productivity metrics from raw data
export function calculateMetrics(metrics: DailyMetric[], tasks: Task[], focusSessions: FocusSession[]) {
  const today = new Date().toISOString().split('T')[0];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  // Current metrics (most recent or today)
  const latestMetrics = metrics.find(m => m.date === today) || metrics[0] || {
    focus_score: 0,
    completion_rate: 0,
    proactiveness_score: 0,
    alignment_score: 0
  };

  // Weekly completion trend
  const weeklyData = last7Days.map(date => {
    const dayMetrics = metrics.find(m => m.date === date);
    const dayTasks = tasks.filter(t => t.created_at.startsWith(date));
    const completedTasks = dayTasks.filter(t => t.status === 'completed').length;
    const totalTasks = dayTasks.length;
    
    return {
      date,
      completion: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : dayMetrics?.completion_rate || 0
    };
  });

  // Calendar heatmap data (last 28 days)
  const last28Days = Array.from({ length: 28 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const calendarData = last28Days.map(date => {
    const dayMetrics = metrics.find(m => m.date === date);
    const dayTasks = tasks.filter(t => t.created_at.startsWith(date));
    const dayFocus = focusSessions.filter(s => s.start_time.startsWith(date));
    
    const completedTasks = dayTasks.filter(t => t.status === 'completed').length;
    const totalTasks = dayTasks.length;
    const focusTime = dayFocus.reduce((sum, s) => sum + s.duration_minutes, 0);
    
    return {
      date,
      completion: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : dayMetrics?.completion_rate || 0,
      focus: dayMetrics?.focus_score || (focusTime > 0 ? Math.min(100, focusTime / 2) : 0),
      proactiveness: dayMetrics?.proactiveness_score || 0
    };
  });

  return {
    current: latestMetrics,
    weekly: weeklyData,
    calendar: calendarData
  };
}