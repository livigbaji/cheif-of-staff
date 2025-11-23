'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: {
    currentView: string;
    activeTask?: string;
    urgentItems?: number;
    timeOfDay: string;
    lastActivity?: string;
  };
}

interface FloatingChatProps {
  currentView: string;
  onChecklistUpdate?: (newItems: any[]) => void;
}

export default function FloatingChat({ currentView, onChecklistUpdate }: FloatingChatProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [contextData, setContextData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current context
  const getCurrentContext = () => {
    const now = new Date();
    const hour = now.getHours();
    let timeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17) timeOfDay = 'evening';

    return {
      currentView,
      timeOfDay,
      timestamp: now.toISOString(),
      user: session?.user?.name || 'User',
    };
  };

  // Initialize with context-aware welcome message
  useEffect(() => {
    const context = getCurrentContext();
    const welcomeMessage: ChatMessage = {
      id: '1',
      type: 'system',
      content: `Good ${context.timeOfDay}, ${context.user}! I'm your AI assistant. I can help you with tasks, update your checklist based on what's happening now, and provide contextual advice. What's on your mind?`,
      timestamp: new Date(),
      context: {
        currentView: context.currentView,
        timeOfDay: context.timeOfDay,
        lastActivity: 'session_start'
      }
    };
    setMessages([welcomeMessage]);
    setContextData(context);
  }, [session, currentView]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle real-time context updates
  useEffect(() => {
    const interval = setInterval(() => {
      setContextData(getCurrentContext());
    }, 30000); // Update context every 30 seconds

    return () => clearInterval(interval);
  }, [currentView, session]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      context: {
        currentView,
        timeOfDay: contextData?.timeOfDay || 'unknown',
        lastActivity: 'user_message'
      }
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response with context awareness
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          context: {
            currentView,
            timeOfDay: contextData?.timeOfDay,
            user: session?.user?.name,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response,
          timestamp: new Date(),
          context: {
            currentView,
            timeOfDay: contextData?.timeOfDay || 'unknown',
            lastActivity: 'ai_response'
          }
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Handle checklist updates if suggested
        if (data.checklistUpdates && onChecklistUpdate) {
          onChecklistUpdate(data.checklistUpdates);
        }
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      // Fallback to mock response
      const mockResponses = [
        `Based on your current ${currentView} view, I notice you might want to focus on priority tasks. Would you like me to update your checklist?`,
        `It's ${contextData?.timeOfDay} - a great time for ${contextData?.timeOfDay === 'morning' ? 'planning' : contextData?.timeOfDay === 'afternoon' ? 'execution' : 'review'}. How can I help optimize your workflow?`,
        `I can see you're working on ${currentView}. Let me suggest some contextual actions based on what's happening now.`,
        `Since it's ${contextData?.timeOfDay}, I recommend focusing on ${contextData?.timeOfDay === 'morning' ? 'high-energy tasks' : contextData?.timeOfDay === 'afternoon' ? 'collaborative work' : 'planning for tomorrow'}. Shall I adjust your priorities?`
      ];

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
        timestamp: new Date(),
        context: {
          currentView,
          timeOfDay: contextData?.timeOfDay || 'unknown',
          lastActivity: 'fallback_response'
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
    }

    setIsTyping(false);
  };

  const handleQuickAction = async (action: string) => {
    let actionMessage = '';
    
    switch (action) {
      case 'update_checklist':
        actionMessage = `Update my checklist based on current ${currentView} context and ${contextData?.timeOfDay} priorities`;
        break;
      case 'whats_next':
        actionMessage = "What should I focus on next given the current situation?";
        break;
      case 'time_optimization':
        actionMessage = `How can I optimize my time during this ${contextData?.timeOfDay} period?`;
        break;
      case 'context_advice':
        actionMessage = `Give me contextual advice for my current ${currentView} view`;
        break;
    }

    setInputMessage(actionMessage);
    await handleSendMessage();
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="w-12 h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg transition-all duration-300 flex items-center justify-center relative group"
        >
          <span className="text-xl">💬</span>
          {/* Pulse indicator for activity */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Open AI Assistant
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed transition-all duration-300 ease-in-out z-50 ${
      isOpen 
        ? 'bottom-6 right-6 w-96 h-[500px]' 
        : 'bottom-6 right-6 w-16 h-16'
    }`}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center relative group transform hover:scale-110"
        >
          <span className="text-2xl">💬</span>
          
          {/* Activity indicator */}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-400 rounded-full animate-pulse flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>

          {/* Context indicator */}
          <div className="absolute top-0 left-0 w-full h-full rounded-full border-2 border-orange-400 opacity-75 animate-ping"></div>
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            AI Assistant - What's happening now?
          </div>
        </button>
      ) : (
        <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xl">🤖</span>
              <div>
                <h3 className="text-white font-semibold">AI Assistant</h3>
                <p className="text-violet-200 text-xs">
                  {currentView} • {contextData?.timeOfDay}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="text-violet-200 hover:text-white p-1 rounded"
              >
                <span className="text-sm">−</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-violet-200 hover:text-white p-1 rounded"
              >
                <span className="text-sm">×</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 bg-slate-700 border-b border-slate-600">
            <div className="flex space-x-2">
              <button
                onClick={() => handleQuickAction('update_checklist')}
                className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-2 py-1 rounded transition-colors"
              >
                📝 Update Checklist
              </button>
              <button
                onClick={() => handleQuickAction('whats_next')}
                className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors"
              >
                ⚡ What's Next?
              </button>
              <button
                onClick={() => handleQuickAction('context_advice')}
                className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors"
              >
                💡 Advice
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-violet-600 text-white ml-4'
                      : message.type === 'system'
                      ? 'bg-blue-600 text-white mr-4'
                      : 'bg-slate-600 text-slate-100 mr-4'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-600 text-slate-100 p-3 rounded-lg mr-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-600 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about current context..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-600 text-white p-2 rounded-lg transition-colors"
              >
                <span className="text-sm">🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}