import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private apiKey: string | null = null;

  async initialize(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    try {
      // First, get the list of available models using ListModels API as recommended
      console.log('Calling ListModels API to discover available models...');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const models = data.models || [];
      
      interface GeminiModel {
        name: string;
        supportedGenerationMethods?: string[];
      }
      
      console.log('Available models:', models.map((m: GeminiModel) => m.name));
      
      // Filter models that support generateContent
      const supportedModels = models.filter((model: GeminiModel) => 
        model.supportedGenerationMethods?.includes('generateContent')
      );
      
      if (supportedModels.length === 0) {
        throw new Error('No models found that support generateContent. Please check your API key permissions.');
      }
      
      // Try each supported model until one works
      let lastError = '';
      for (const modelInfo of supportedModels) {
        try {
          // Extract just the model name (e.g., 'gemini-pro' from 'models/gemini-pro')
          const modelName = modelInfo.name.replace('models/', '');
          const testModel = this.genAI.getGenerativeModel({ model: modelName });
          
          // Test the model with a simple request
          const testResult = await testModel.generateContent('Test');
          await testResult.response.text();
          
          // If we get here, the model works
          this.model = testModel;
          console.log(`Successfully initialized with model: ${modelName}`);
          return;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          lastError = `${modelInfo.name}: ${errorMessage}`;
          console.warn(`Model ${modelInfo.name} failed:`, errorMessage);
          continue;
        }
      }
      
      // If we get here, all models failed
      throw new Error(`Failed to initialize any Gemini model. Last error: ${lastError}. Please verify your API key has access to Gemini models.`);
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to initialize')) {
        throw error; // Re-throw our custom error
      }
      throw new Error(`Failed to initialize Gemini API: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      
      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorObj = error as { status?: number; code?: string };
      const errorStatus = errorObj.status;
      
      if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('invalid api key')) {
        throw new Error('Invalid API key. Please check your Gemini API key.');
      }
      
      if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission denied')) {
        throw new Error('Permission denied. Please verify your API key has access to Gemini models.');
      }
      
      if (errorMessage.includes('QUOTA_EXCEEDED') || errorMessage.includes('quota exceeded')) {
        throw new Error('API quota exceeded. Please check your usage limits.');
      }
      
      if (errorMessage.includes('RATE_LIMIT_EXCEEDED') || errorMessage.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      
      if (errorStatus === 403) {
        throw new Error('Access forbidden. Please verify your API key has the required permissions.');
      }
      
      if (errorStatus === 404) {
        throw new Error('Model not found. Please ensure your API key has access to Gemini models.');
      }
      
      if (errorStatus === 429) {
        throw new Error('Too many requests. Please wait and try again.');
      }
      
      if (errorStatus && errorStatus >= 500) {
        throw new Error('Gemini service temporarily unavailable. Please try again later.');
      }
      
      // Generic error with more context
      const statusCode = errorStatus ? ` (Status: ${errorStatus})` : '';
      throw new Error(`Failed to generate response from Gemini: ${errorMessage}${statusCode}`);
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

  async generateChecklist(standupData: StandupData): Promise<{
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

  async generateTaskTimeEstimate(taskDescription: string, userProfile?: UserProfile): Promise<number> {
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
    context?: Record<string, unknown>
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
    tasks: Array<{ title: string; description?: string; status?: string }>,
    stakeholder: { name: string; role: string; email: string },
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
    progressData: Array<{ date: string; completed: number; total: number }>,
    userProfile: UserProfile,
    goals: Array<{ title: string; description: string; target_date: string }>
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