'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Mic, MicOff, Settings, Calendar, Users, Target, BarChart3, FileText } from 'lucide-react';

interface StandupQuestion {
  id: string;
  question: string;
  answer: string;
  isAnalyzed: boolean;
  analysis?: any;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState('standup');
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isListening, setIsListening] = useState(false);
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [checklist, setChecklist] = useState([]);
  const [mode, setMode] = useState<'cadence' | 'waterfall'>('cadence');

  useEffect(() => {
    if (session) {
      checkGeminiConfiguration();
    }
  }, [session]);

  const checkGeminiConfiguration = async () => {
    try {
      const response = await fetch('/api/gemini/config');
      const data = await response.json();
      setGeminiConfigured(data.hasApiKey);
    } catch (error) {
      console.error('Error checking Gemini configuration:', error);
    }
  };

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

    recognition.onresult = (event) => {
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

    try {
      const response = await fetch('/api/standup/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          answer: question.answer
        })
      });

      const analysis = await response.json();
      
      const newQuestions = [...standupQuestions];
      newQuestions[questionIndex].analysis = analysis;
      newQuestions[questionIndex].isAnalyzed = true;
      setStandupQuestions(newQuestions);
    } catch (error) {
      console.error('Error analyzing answer:', error);
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">Chief of Staff</h1>
          <p className="text-gray-600 mb-8">AI-powered productivity assistant</p>
          <button
            onClick={() => signIn('google')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!geminiConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Configure Gemini API</h2>
          <p className="text-gray-600 mb-4">
            Please enter your Gemini API key to enable AI features.
          </p>
          <input
            type="password"
            placeholder="Enter Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4"
          />
          <button
            onClick={configureGemini}
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
          >
            Configure API
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">Chief of Staff</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm min-h-screen">
          <div className="p-4">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setCurrentView('standup')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg ${
                    currentView === 'standup' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Mic className="w-5 h-5 mr-3" />
                  Daily Standup
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('checklist')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg ${
                    currentView === 'checklist' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-5 h-5 mr-3" />
                  Checklist
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('goals')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg ${
                    currentView === 'goals' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Target className="w-5 h-5 mr-3" />
                  Goals & Objectives
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('people')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg ${
                    currentView === 'people' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-5 h-5 mr-3" />
                  People
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('analytics')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg ${
                    currentView === 'analytics' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Analytics
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg ${
                    currentView === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
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
        <main className="flex-1 p-8">
          {currentView === 'standup' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold mb-6">Daily Standup</h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Mode:</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setMode('cadence')}
                      className={`px-4 py-2 rounded-lg ${
                        mode === 'cadence' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Cadence Mode
                    </button>
                    <button
                      onClick={() => setMode('waterfall')}
                      className={`px-4 py-2 rounded-lg ${
                        mode === 'waterfall' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Waterfall Mode
                    </button>
                  </div>
                </div>

                {standupQuestions.map((q, index) => (
                  <div key={q.id} className="mb-6 p-4 border rounded-lg">
                    <h3 className="font-medium mb-3">{q.question}</h3>
                    
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
                        className="flex-1 p-3 border rounded-lg resize-none"
                        rows={3}
                      />
                      <button
                        onClick={() => startVoiceRecognition(index)}
                        className={`p-3 rounded-lg ${
                          isListening ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        } hover:opacity-80`}
                      >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    </div>

                    {q.answer.trim() && !q.isAnalyzed && (
                      <button
                        onClick={() => analyzeAnswer(index)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
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
                <h2 className="text-2xl font-bold mb-6">Today's Checklist</h2>
                {checklist.length === 0 ? (
                  <p className="text-gray-600">Complete your standup to generate checklist items.</p>
                ) : (
                  <div className="space-y-4">
                    {checklist.map((item: any, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{item.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.priority <= 2 ? 'bg-red-100 text-red-700' :
                            item.priority <= 3 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            Priority {item.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Est. {item.estimatedTimeMinutes} min</span>
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