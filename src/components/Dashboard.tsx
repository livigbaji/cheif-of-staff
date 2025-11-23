'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Mic, MicOff, Settings, Users, Target, BarChart3, FileText } from 'lucide-react';

interface StandupQuestion {
  id: string;
  question: string;
  answer: string;
  isAnalyzed: boolean;
  analysis?: {
    insights: string[];
    suggestions: string[];
    mood: string;
    productivity_score: number;
    isOnPoint?: boolean;
    feedback?: string;
    guidingQuestions?: string[];
  };
}

interface ChecklistItem {
  title: string;
  description?: string;
  priority?: number;
  estimated_time?: string;
  estimatedTimeMinutes?: number;
  status?: string;
  goalAlignment?: string[];
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  
  // App works without authentication, but Google login unlocks integrations
  const hasGoogleIntegration = !!session?.user;
  const currentUser = session?.user || { id: 'guest', name: 'Guest User', email: 'guest@localhost' };
  
  const [currentView, setCurrentView] = useState('standup');
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(!hasGoogleIntegration);
  const [standupQuestions, setStandupQuestions] = useState<StandupQuestion[]>([
    { id: '1', question: 'What did you do yesterday?', answer: '', isAnalyzed: false },
    { id: '2', question: 'What were you not able to do yesterday?', answer: '', isAnalyzed: false },
    { id: '3', question: 'Who do you need to do it?', answer: '', isAnalyzed: false },
    { id: '4', question: 'What do you need to do it?', answer: '', isAnalyzed: false },
    { id: '5', question: 'Why were you not able to do it?', answer: '', isAnalyzed: false },
    { id: '6', question: 'What are you doing today?', answer: '', isAnalyzed: false },
    { id: '7', question: 'What could stop you from doing it?', answer: '', isAnalyzed: false },
    { id: '8', question: 'What do you need to understand going into the day?', answer: '', isAnalyzed: false },
  ]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [mode, setMode] = useState<'cadence' | 'waterfall'>('cadence');

  const checkGeminiConfiguration = useCallback(async () => {
    try {
      const response = await fetch('/api/gemini/config');
      const data = await response.json();
      setGeminiConfigured(data.hasApiKey);
      setIsGuestMode(data.isGuest || !hasGoogleIntegration);
    } catch (error) {
      console.error('Error checking Gemini configuration:', error);
      setIsGuestMode(!hasGoogleIntegration);
    }
  }, [hasGoogleIntegration]);

  useEffect(() => {
    if (session) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        checkGeminiConfiguration();
      }, 0);
    }
  }, [session, checkGeminiConfiguration]);

  const configureGemini = async () => {
    try {
      const response = await fetch('/api/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      if (response.ok) {
        setGeminiConfigured(true);
        setApiKey('');
        alert('Gemini API configured successfully!');
      } else {
        alert('Failed to configure Gemini API. Please check your key.');
      }
    } catch (error) {
      console.error('Error configuring Gemini:', error);
    }
  };

  const startVoiceRecognition = (questionIndex: number) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      const newQuestions = [...standupQuestions];
      newQuestions[questionIndex].answer = transcript;
      setStandupQuestions(newQuestions);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();

    // Auto-stop after 30 seconds
    setTimeout(() => {
      recognition.stop();
      setIsListening(false);
    }, 30000);
  };

  const analyzeAnswer = async (questionIndex: number) => {
    const question = standupQuestions[questionIndex];
    if (!question.answer.trim()) return;

    // For guest users or if no stored API key, require API key input
    let requestApiKey = '';
    if (isGuestMode || !geminiConfigured) {
      const enteredApiKey = prompt('Please enter your Gemini API key:');
      if (!enteredApiKey) {
        alert('Gemini API key is required for analysis');
        return;
      }
      requestApiKey = enteredApiKey;
    }

    try {
      const response = await fetch('/api/standup/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          answer: question.answer,
          ...(requestApiKey && { apiKey: requestApiKey })
        })
      });

      const analysis = await response.json();
      
      if (response.ok) {
        const newQuestions = [...standupQuestions];
        newQuestions[questionIndex].analysis = analysis;
        newQuestions[questionIndex].isAnalyzed = true;
        setStandupQuestions(newQuestions);
      } else {
        alert(analysis.message || analysis.error || 'Failed to analyze response');
      }
    } catch (error) {
      console.error('Error analyzing answer:', error);
      alert('Failed to analyze response. Please check your connection and try again.');
    }
  };

  const generateChecklist = async () => {
    try {
      // First create standup session
      const standupResponse = await fetch('/api/standup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatDidYesterday: standupQuestions[0].answer,
          whatNotAbleYesterday: standupQuestions[1].answer,
          whoNeedToDo: standupQuestions[2].answer,
          whatNeedToDo: standupQuestions[3].answer,
          whyNotAble: standupQuestions[4].answer,
          whatDoingToday: standupQuestions[5].answer,
          whatCouldStop: standupQuestions[6].answer,
          whatNeedUnderstand: standupQuestions[7].answer,
          mode
        })
      });

      const standupData = await standupResponse.json();

      // Then generate checklist
      const checklistResponse = await fetch('/api/checklist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: standupData.sessionId })
      });

      const checklistData = await checklistResponse.json();
      setChecklist(checklistData.items);
      setCurrentView('checklist');
    } catch (error) {
      console.error('Error generating checklist:', error);
    }
  };

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-violet-300 font-bold" style={{ backgroundColor: '#141414' }}>Loading...</div>;
  }

  // Always show main interface in guest mode for non-authenticated users
  if (!geminiConfigured && !isGuestMode && hasGoogleIntegration) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#141414' }}>
        <div className="bg-slate-800 p-8 rounded-lg shadow-lg max-w-md w-full border border-slate-700">
          <h2 className="text-2xl font-bold mb-4 text-violet-300">Configure Gemini API</h2>
          <p className="text-slate-300 mb-4">
            Please enter your Gemini API key to enable AI features for your account.
          </p>
          <input
            type="password"
            placeholder="Enter Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-3 border border-slate-600 rounded-lg mb-4 bg-slate-700 text-slate-200 placeholder-slate-400 focus:border-violet-400 focus:outline-none"
          />
          <button
            onClick={configureGemini}
            className="w-full bg-violet-400 text-white p-3 rounded-lg hover:bg-violet-300 mb-3 font-bold border border-violet-300 transition-colors"
          >
            Save API Key
          </button>
          <button
            onClick={() => setIsGuestMode(true)}
            className="w-full bg-slate-700 text-slate-300 p-3 rounded-lg hover:bg-slate-600 border border-slate-600 font-bold transition-colors"
          >
            Continue as Guest
          </button>
          <p className="text-xs text-slate-400 mt-2">
            Guest mode: You&apos;ll need to enter your API key for each AI analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#141414' }}>
      {/* Header */}
      <header className="bg-slate-800 shadow-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-violet-300">Chief of Staff</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-300">{currentUser.name}</span>
              {hasGoogleIntegration ? (
                <button
                  onClick={() => signOut()}
                  className="text-sm text-slate-300 hover:text-violet-300 transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => signIn('google')}
                  className="text-sm bg-violet-400 text-white px-3 py-1 rounded hover:bg-violet-300 font-bold transition-colors"
                >
                  Connect Google
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-slate-800 shadow-sm min-h-screen border-r border-slate-700">
          <div className="p-4">
            {/* Integration Status */}
            <div className="mb-6 p-3 bg-slate-700 rounded-lg border border-slate-600">
              <h3 className="text-sm font-bold text-slate-100 mb-2">Integrations</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Google APIs</span>
                  <span className={`px-2 py-1 rounded font-bold ${hasGoogleIntegration ? 'bg-violet-900 text-violet-300 border border-violet-500' : 'bg-slate-600 text-slate-400'}`}>
                    {hasGoogleIntegration ? 'Connected' : 'Available'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Slack</span>
                  <span className="px-2 py-1 rounded bg-slate-600 text-slate-400 font-bold">Available</span>
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setCurrentView('standup')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'standup' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Mic className="w-5 h-5 mr-3" />
                  Daily Standup
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('checklist')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'checklist' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <FileText className="w-5 h-5 mr-3" />
                  Checklist
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('goals')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'goals' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Target className="w-5 h-5 mr-3" />
                  Goals & Objectives
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('people')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'people' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-5 h-5 mr-3" />
                  People
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('analytics')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'analytics' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Analytics
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'settings' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Settings
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8" style={{ backgroundColor: '#141414' }}>
          {currentView === 'standup' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <h2 className="text-2xl font-bold mb-6 text-violet-300">Daily Standup</h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-bold mb-2 text-slate-300">Mode:</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setMode('cadence')}
                      className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                        mode === 'cadence' ? 'bg-violet-400 text-white border border-violet-300' : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      Cadence Mode
                    </button>
                    <button
                      onClick={() => setMode('waterfall')}
                      className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                        mode === 'waterfall' ? 'bg-violet-400 text-white border border-violet-300' : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      Waterfall Mode
                    </button>
                  </div>
                </div>

                {standupQuestions.map((q, index) => (
                  <div key={q.id} className="mb-6 p-4 border border-slate-600 rounded-lg bg-slate-700">
                    <h3 className="font-bold mb-3 text-slate-100">{q.question}</h3>
                    
                    <div className="flex items-center space-x-2 mb-3">
                      <textarea
                        value={q.answer}
                        onChange={(e) => {
                          const newQuestions = [...standupQuestions];
                          newQuestions[index].answer = e.target.value;
                          newQuestions[index].isAnalyzed = false;
                          setStandupQuestions(newQuestions);
                        }}
                        placeholder="Type your answer or use voice input..."
                        className="flex-1 p-3 border border-slate-600 rounded-lg resize-none bg-slate-800 text-slate-200 placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                        rows={3}
                      />
                      <button
                        onClick={() => startVoiceRecognition(index)}
                        className={`p-3 rounded-lg font-bold transition-colors ${
                          isListening ? 'bg-red-600 text-white border border-red-400' : 'bg-violet-400 text-white border border-violet-300'
                        } hover:opacity-80`}
                      >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    </div>

                    {q.answer.trim() && !q.isAnalyzed && (
                      <button
                        onClick={() => analyzeAnswer(index)}
                        className="bg-violet-400 text-white px-4 py-2 rounded-lg hover:bg-violet-300 font-bold border border-violet-300 transition-colors"
                      >
                        Analyze Answer
                      </button>
                    )}

                    {q.analysis && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center mb-2">
                          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                            q.analysis.isOnPoint ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></span>
                          <span className="font-medium">
                            {q.analysis.isOnPoint ? 'On Point' : 'Needs Focus'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{q.analysis.feedback}</p>
                        {q.analysis.guidingQuestions && q.analysis.guidingQuestions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Guiding Questions:</p>
                            <ul className="text-sm text-gray-600 list-disc list-inside">
                              {q.analysis.guidingQuestions.map((gq: string, i: number) => (
                                <li key={i}>{gq}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="text-center">
                  <button
                    onClick={generateChecklist}
                    disabled={!standupQuestions.every(q => q.answer.trim())}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Generate Checklist
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentView === 'checklist' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold mb-6">Today&apos;s Checklist</h2>
                {checklist.length === 0 ? (
                  <p className="text-gray-600">Complete your standup to generate checklist items.</p>
                ) : (
                  <div className="space-y-4">
                    {checklist.map((item: ChecklistItem, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{item.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs ${
                            (item.priority || 5) <= 2 ? 'bg-red-100 text-red-700' :
                            (item.priority || 5) <= 3 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            Priority {item.priority || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Est. {item.estimatedTimeMinutes || 'N/A'} min</span>
                          <span>Goal Aligned: {item.goalAlignment?.join(', ') || 'None'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other views would go here */}
          {currentView === 'goals' && (
            <div className="text-center py-12">
              <p className="text-gray-600">Goals & Objectives view - Coming soon!</p>
            </div>
          )}

          {currentView === 'people' && (
            <div className="text-center py-12">
              <p className="text-gray-600">People management view - Coming soon!</p>
            </div>
          )}

          {currentView === 'analytics' && (
            <div className="text-center py-12">
              <p className="text-gray-600">Analytics view - Coming soon!</p>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="text-center py-12">
              <p className="text-gray-600">Settings view - Coming soon!</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}