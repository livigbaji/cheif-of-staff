import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  initialize(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async generateResponse(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API not initialized. Please provide your API key.');
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error('Failed to generate response from Gemini');
    }
  }

  async analyzeStandupResponse(question: string, answer: string): Promise<{
    isOnPoint: boolean;
    feedback: string;
    guidingQuestions: string[];
    suggestedRevision?: string;
  }> {
    const prompt = `
    Analyze this standup response:
    
    Question: "${question}"
    Answer: "${answer}"
    
    Evaluate if the answer is on-point and actionable. The user tends to go on tangents.
    
    Return a JSON response with:
    - isOnPoint (boolean): Is the answer focused and relevant?
    - feedback (string): Brief feedback on the response quality
    - guidingQuestions (array): 2-3 follow-up questions to get clearer answers
    - suggestedRevision (optional string): A more focused version if needed
    
    Keep feedback constructive and guiding questions specific.
    `;

    const response = await this.generateResponse(prompt);
    try {
      return JSON.parse(response);
    } catch {
      // Fallback if JSON parsing fails
      return {
        isOnPoint: false,
        feedback: "Please provide a more focused and specific answer.",
        guidingQuestions: [
          "Can you be more specific about the main point?",
          "What's the most important outcome or blocker?",
          "What concrete action needs to be taken?"
        ]
      };
    }
  }

  async generateChecklist(standupData: any): Promise<{
    items: Array<{
      title: string;
      description: string;
      priority: number;
      estimatedTimeMinutes: number;
      goalAlignment: string[];
    }>;
    insights: string;
  }> {
    const prompt = `
    Based on this standup data, create a focused daily checklist:
    
    What did yesterday: ${standupData.whatDidYesterday}
    What not able yesterday: ${standupData.whatNotAbleYesterday}
    Who need to do: ${standupData.whoNeedToDo}
    What need to do: ${standupData.whatNeedToDo}
    Why not able: ${standupData.whyNotAble}
    What doing today: ${standupData.whatDoingToday}
    What could stop: ${standupData.whatCouldStop}
    What need understand: ${standupData.whatNeedUnderstand}
    
    Create 3-7 actionable checklist items. Each should be:
    - Specific and measurable
    - Time-bounded
    - Aligned with overarching goals
    
    Return JSON with:
    - items: array of checklist items with title, description, priority (1-5), estimatedTimeMinutes, goalAlignment
    - insights: brief analysis and recommendations for the day
    `;

    const response = await this.generateResponse(prompt);
    try {
      return JSON.parse(response);
    } catch {
      return {
        items: [
          {
            title: "Review and prioritize today's tasks",
            description: "Based on standup responses, organize priorities",
            priority: 1,
            estimatedTimeMinutes: 30,
            goalAlignment: ["productivity"]
          }
        ],
        insights: "Please review your standup responses for more specific task generation."
      };
    }
  }

  async generateTaskTimeEstimate(taskDescription: string, userProfile?: any): Promise<number> {
    const prompt = `
    Estimate time needed for this task: "${taskDescription}"
    
    ${userProfile ? `User profile context: ${JSON.stringify(userProfile)}` : ''}
    
    Consider complexity, dependencies, and typical execution time.
    Return only the estimated minutes as a number.
    `;

    try {
      const response = await this.generateResponse(prompt);
      const minutes = parseInt(response.trim());
      return isNaN(minutes) ? 60 : Math.max(15, Math.min(480, minutes)); // 15min to 8hrs
    } catch {
      return 60; // Default 1 hour
    }
  }

  async generateBlockerAdvice(
    task: string, 
    blocker: string, 
    context?: any
  ): Promise<{
    advice: string;
    alternatives: string[];
    escalationSuggestion?: string;
    timeAdjustment?: number;
  }> {
    const prompt = `
    Task: "${task}"
    Blocker: "${blocker}"
    ${context ? `Context: ${JSON.stringify(context)}` : ''}
    
    Provide practical advice for overcoming this blocker:
    - advice: specific actionable steps
    - alternatives: 2-3 alternative approaches
    - escalationSuggestion: when/how to escalate if needed
    - timeAdjustment: suggested minutes to add to remaining tasks
    
    Return as JSON.
    `;

    try {
      const response = await this.generateResponse(prompt);
      return JSON.parse(response);
    } catch {
      return {
        advice: "Break down the blocker into smaller parts and tackle each systematically.",
        alternatives: [
          "Seek help from team members",
          "Research alternative approaches",
          "Schedule dedicated time to resolve"
        ]
      };
    }
  }

  async generateStakeholderReport(
    tasks: any[], 
    stakeholder: any, 
    intent: 'candid' | 'diplomatic' | 'formal' = 'candid'
  ): Promise<string> {
    const prompt = `
    Generate a ${intent} progress report for stakeholder: ${stakeholder.name}
    Role: ${stakeholder.workFunction}
    Communication style: ${stakeholder.communicationStyle}
    
    Tasks progress:
    ${tasks.map(t => `- ${t.title}: ${t.status} (${t.progressPercentage || 0}%)`).join('\n')}
    
    Make the report ${intent}, direct, and actionable based on their profile.
    Include next steps and any support needed.
    `;

    return await this.generateResponse(prompt);
  }

  async generateClarityQuestions(taskDescription: string, clarityScore: number): Promise<string[]> {
    const prompt = `
    This task has clarity score ${clarityScore}/10: "${taskDescription}"
    
    Generate 3-5 clarifying questions to help improve understanding:
    - Focus on requirements, scope, and success criteria
    - Help identify dependencies and constraints
    - Surface assumptions that need validation
    
    Return as JSON array of strings.
    `;

    try {
      const response = await this.generateResponse(prompt);
      return JSON.parse(response);
    } catch {
      return [
        "What specific outcome defines success for this task?",
        "What are the key requirements and constraints?",
        "Who else is involved and what do you need from them?",
        "What assumptions are you making that should be validated?"
      ];
    }
  }

  async generatePersonalInsights(
    progressData: any[], 
    userProfile: any, 
    goals: any[]
  ): Promise<{
    adherenceAnalysis: string;
    alignmentInsights: string;
    recommendations: string[];
    betterSelfSuggestions: string[];
  }> {
    const prompt = `
    Analyze personal productivity patterns:
    
    Progress data: ${JSON.stringify(progressData)}
    User profile: ${JSON.stringify(userProfile)}
    Goals: ${JSON.stringify(goals)}
    
    Provide insights on:
    - adherenceAnalysis: how well they stick to commitments
    - alignmentInsights: how tasks align with who they want to become
    - recommendations: 3-4 actionable improvements
    - betterSelfSuggestions: ways to evolve toward their ideal self
    
    Return as JSON.
    `;

    try {
      const response = await this.generateResponse(prompt);
      return JSON.parse(response);
    } catch {
      return {
        adherenceAnalysis: "Need more data to provide detailed analysis.",
        alignmentInsights: "Focus on connecting daily tasks to long-term goals.",
        recommendations: [
          "Set clearer daily priorities",
          "Build in buffer time for unexpected tasks",
          "Regular reflection on goal alignment"
        ],
        betterSelfSuggestions: [
          "Practice saying no to non-essential tasks",
          "Develop stronger planning habits"
        ]
      };
    }
  }
}

export const geminiService = new GeminiService();