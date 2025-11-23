import { NextRequest, NextResponse } from 'next/server';

interface ChatContext {
  currentView: string;
  timeOfDay: string;
  user: string;
  timestamp: string;
}

interface ChatRequest {
  message: string;
  context: ChatContext;
}

// Mock intelligent responses based on context
const generateContextualResponse = (message: string, context: ChatContext) => {
  const { currentView, timeOfDay, user } = context;
  const lowerMessage = message.toLowerCase();
  
  // Checklist update patterns
  if (lowerMessage.includes('checklist') || lowerMessage.includes('update') || lowerMessage.includes('task')) {
    const timeBasedTasks = getTimeBasedTasks(timeOfDay, currentView);
    return {
      response: `Based on your current ${currentView} view and it being ${timeOfDay}, I've identified some contextual tasks that might be helpful. Would you like me to add these to your checklist?`,
      checklistUpdates: timeBasedTasks
    };
  }

  // Context-specific advice
  if (lowerMessage.includes('advice') || lowerMessage.includes('recommend') || lowerMessage.includes('suggest')) {
    return {
      response: getContextualAdvice(currentView, timeOfDay),
      checklistUpdates: null
    };
  }

  // "What's happening now" queries
  if (lowerMessage.includes('happening') || lowerMessage.includes('now') || lowerMessage.includes('current')) {
    return {
      response: getCurrentSituation(currentView, timeOfDay),
      checklistUpdates: null
    };
  }

  // Time optimization
  if (lowerMessage.includes('time') || lowerMessage.includes('optimize') || lowerMessage.includes('efficient')) {
    return {
      response: getTimeOptimizationTips(timeOfDay, currentView),
      checklistUpdates: getOptimizationTasks(timeOfDay)
    };
  }

  // Focus and productivity
  if (lowerMessage.includes('focus') || lowerMessage.includes('productive') || lowerMessage.includes('concentrate')) {
    return {
      response: getFocusAdvice(timeOfDay, currentView),
      checklistUpdates: getFocusTasks(timeOfDay)
    };
  }

  // Next actions
  if (lowerMessage.includes('next') || lowerMessage.includes('should') || lowerMessage.includes('priority')) {
    const nextActions = getNextActions(currentView, timeOfDay);
    return {
      response: `Based on your ${currentView} view and the current ${timeOfDay} context, here's what I recommend focusing on next:`,
      checklistUpdates: nextActions
    };
  }

  // Default contextual response
  return {
    response: `I understand you're currently in the ${currentView} section. Since it's ${timeOfDay}, I can help you with tasks, priorities, or contextual advice. What specific aspect would you like assistance with?`,
    checklistUpdates: null
  };
};

const getTimeBasedTasks = (timeOfDay: string, currentView: string) => {
  const baseId = Date.now();
  
  if (timeOfDay === 'morning') {
    return [
      {
        id: baseId + 1,
        title: 'Review daily priorities',
        description: 'Set clear intentions for the day based on current objectives',
        priority: 1,
        estimatedTimeMinutes: 10,
        goalAlignment: ['Daily Planning'],
        context: 'morning_planning'
      },
      {
        id: baseId + 2,
        title: 'Check urgent communications',
        description: 'Review emails and messages that need immediate attention',
        priority: 2,
        estimatedTimeMinutes: 15,
        goalAlignment: ['Communication'],
        context: 'morning_comms'
      }
    ];
  }
  
  if (timeOfDay === 'afternoon') {
    return [
      {
        id: baseId + 1,
        title: 'Review morning progress',
        description: 'Assess completed tasks and adjust afternoon priorities',
        priority: 2,
        estimatedTimeMinutes: 5,
        goalAlignment: ['Progress Tracking'],
        context: 'afternoon_review'
      },
      {
        id: baseId + 2,
        title: 'Handle collaborative tasks',
        description: 'Focus on team interactions and collaborative work',
        priority: 1,
        estimatedTimeMinutes: 30,
        goalAlignment: ['Team Collaboration'],
        context: 'afternoon_collab'
      }
    ];
  }
  
  // Evening
  return [
    {
      id: baseId + 1,
      title: 'Day wrap-up review',
      description: 'Reflect on accomplishments and plan for tomorrow',
      priority: 1,
      estimatedTimeMinutes: 15,
      goalAlignment: ['Daily Reflection'],
      context: 'evening_review'
    },
    {
      id: baseId + 2,
      title: 'Prepare tomorrow priorities',
      description: 'Set up tasks and priorities for the next day',
      priority: 2,
      estimatedTimeMinutes: 10,
      goalAlignment: ['Next Day Planning'],
      context: 'evening_prep'
    }
  ];
};

const getContextualAdvice = (currentView: string, timeOfDay: string) => {
  const viewAdvice = {
    'analytics': `You're reviewing your analytics during ${timeOfDay}. This is perfect for ${timeOfDay === 'morning' ? 'setting data-driven goals' : timeOfDay === 'afternoon' ? 'making informed adjustments' : 'reflecting on patterns and planning improvements'}.`,
    'standup': `Great time for a standup during ${timeOfDay}. ${timeOfDay === 'morning' ? 'Perfect for planning your day ahead' : timeOfDay === 'afternoon' ? 'Good for mid-day check-ins' : 'Excellent for end-of-day reviews'}.`,
    'goals': `Working on goals during ${timeOfDay} is ${timeOfDay === 'morning' ? 'ideal for strategic thinking' : timeOfDay === 'afternoon' ? 'great for progress tracking' : 'perfect for reflection and planning'}.`,
    'checklist': `Managing your checklist during ${timeOfDay}. ${timeOfDay === 'morning' ? 'Focus on prioritizing tasks' : timeOfDay === 'afternoon' ? 'Time to execute and update progress' : 'Review completed items and plan tomorrow'}.`,
    'people': `People management during ${timeOfDay}. ${timeOfDay === 'morning' ? 'Good time for planning team interactions' : timeOfDay === 'afternoon' ? 'Perfect for meetings and collaboration' : 'Ideal for relationship building and feedback'}.`,
  };
  
  return viewAdvice[currentView as keyof typeof viewAdvice] || `You're in the ${currentView} section during ${timeOfDay}. This is a good time to focus on the specific tasks relevant to this area.`;
};

const getCurrentSituation = (currentView: string, timeOfDay: string) => {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  return `Right now it's ${timeOfDay} on ${dayOfWeek}. You're currently focused on ${currentView}. Based on typical productivity patterns, this is ${getProductivityContext(timeOfDay, dayOfWeek)}. I can help you make the most of this time by suggesting relevant tasks or optimizations.`;
};

const getProductivityContext = (timeOfDay: string, dayOfWeek: string) => {
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
  
  if (isWeekend) {
    return `a good time for ${timeOfDay === 'morning' ? 'personal planning and reflection' : timeOfDay === 'afternoon' ? 'lighter tasks and preparation' : 'relaxation and next week planning'}`;
  }
  
  return `typically ${timeOfDay === 'morning' ? 'high-energy time for complex tasks' : timeOfDay === 'afternoon' ? 'good for collaborative work and meetings' : 'ideal for planning and administrative tasks'}`;
};

const getTimeOptimizationTips = (timeOfDay: string, currentView: string) => {
  const tips = {
    'morning': 'Morning is your peak energy time. Focus on your most challenging tasks, creative work, or strategic thinking. Avoid meetings if possible.',
    'afternoon': 'Afternoon energy is great for collaborative work. Schedule meetings, team interactions, and routine tasks that require social energy.',
    'evening': 'Evening is perfect for planning, reflection, and administrative tasks. Prepare for tomorrow and wind down with lighter work.'
  };
  
  return `${tips[timeOfDay as keyof typeof tips]} Since you're in ${currentView}, consider how this aligns with your current focus.`;
};

const getOptimizationTasks = (timeOfDay: string) => {
  const baseId = Date.now();
  
  return [{
    id: baseId,
    title: `${timeOfDay === 'morning' ? 'Tackle high-priority task' : timeOfDay === 'afternoon' ? 'Schedule team check-in' : 'Plan tomorrow\'s priorities'}`,
    description: `Optimize your ${timeOfDay} productivity`,
    priority: 1,
    estimatedTimeMinutes: timeOfDay === 'morning' ? 45 : timeOfDay === 'afternoon' ? 30 : 15,
    goalAlignment: ['Time Optimization'],
    context: `${timeOfDay}_optimization`
  }];
};

const getFocusAdvice = (timeOfDay: string, currentView: string) => {
  return `For better focus during ${timeOfDay}: ${
    timeOfDay === 'morning' ? 'Use the Pomodoro technique, minimize distractions, tackle your hardest task first' :
    timeOfDay === 'afternoon' ? 'Take short breaks, collaborate when energy dips, batch similar tasks' :
    'Wind down gradually, avoid heavy cognitive load, prepare for tomorrow'
  }. Your ${currentView} view is perfect for this type of work right now.`;
};

const getFocusTasks = (timeOfDay: string) => {
  const baseId = Date.now();
  
  return [{
    id: baseId,
    title: `${timeOfDay} focus session`,
    description: `25-minute focused work block optimized for ${timeOfDay} energy`,
    priority: 1,
    estimatedTimeMinutes: 25,
    goalAlignment: ['Focus & Productivity'],
    context: `${timeOfDay}_focus`
  }];
};

const getNextActions = (currentView: string, timeOfDay: string) => {
  const baseId = Date.now();
  
  const actions = {
    'analytics': [
      {
        id: baseId,
        title: 'Review key metrics',
        description: 'Analyze current performance data for insights',
        priority: 1,
        estimatedTimeMinutes: 20,
        goalAlignment: ['Data Analysis'],
        context: 'analytics_review'
      }
    ],
    'standup': [
      {
        id: baseId,
        title: 'Complete standup reflection',
        description: 'Document progress, blockers, and next steps',
        priority: 1,
        estimatedTimeMinutes: 15,
        goalAlignment: ['Daily Planning'],
        context: 'standup_completion'
      }
    ],
    'goals': [
      {
        id: baseId,
        title: 'Update goal progress',
        description: 'Review and update current objective status',
        priority: 1,
        estimatedTimeMinutes: 25,
        goalAlignment: ['Goal Management'],
        context: 'goals_update'
      }
    ]
  };
  
  return actions[currentView as keyof typeof actions] || [{
    id: baseId,
    title: `Continue ${currentView} work`,
    description: `Focus on ${currentView} related tasks during ${timeOfDay}`,
    priority: 1,
    estimatedTimeMinutes: 30,
    goalAlignment: [currentView],
    context: `${currentView}_${timeOfDay}`
  }];
};

export async function POST(request: NextRequest) {
  try {
    const { message, context }: ChatRequest = await request.json();
    
    if (!message || !context) {
      return NextResponse.json({ error: 'Missing message or context' }, { status: 400 });
    }
    
    const result = generateContextualResponse(message, context);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        response: "I'm having trouble processing that request right now. Please try again.",
        checklistUpdates: null
      }, 
      { status: 500 }
    );
  }
}