'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import FloatingChat from './FloatingChat';
import { Mic, MicOff, Settings, Users, Target, BarChart3, FileText, Plus, Edit2, Trash2, Save, X, Calendar } from 'lucide-react';
import { StandupQuestion } from '../types/database';
import {
  fetchDailyMetrics,
  fetchObjectives,
  fetchTasks,
  fetchFocusSessions,
  calculateMetrics
} from '../lib/analytics';

interface StandupQuestionWithAnalysis {
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
  id?: number | string;
  title: string;
  description?: string;
  priority?: number;
  estimated_time?: string;
  estimatedTimeMinutes?: number;
  status?: string;
  goalAlignment?: string[];
  stakeholders?: string[];
  risks?: string[];
  context?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: {
    timestamp: string;
    action: string;
    user: string;
    details?: string;
  }[];
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  type: 'goal' | 'routine' | 'business_objective';
  priority: number;
  deadline?: string;
  cadence_time?: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  stakeholders?: string[];
  created_at: string;
  updated_at: string;
  attachments?: {
    id: string;
    name: string;
    type: 'document' | 'spreadsheet' | 'link' | 'image';
    url?: string;
    fileData?: string;
    extractedContent?: string;
    metadata?: {
      size?: number;
      mimeType?: string;
      uploadedAt: string;
      extractedAt?: string;
    };
  }[];
}

interface Person {
  id: string;
  name: string;
  work_function?: string;
  characteristics?: string;
  biases?: string;
  communication_style?: string;
  relationship_type?: string;
  profile_picture?: string;
  sentiment_summary?: string;
  created_at: string;
  updated_at: string;
}

function GoalsObjectivesView() {
  const [activeTab, setActiveTab] = useState<'objectives' | 'routines'>('objectives');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Goal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [editingItem, setEditingItem] = useState<Goal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [formData, setFormData] = useState<Partial<Goal>>({
    title: '',
    description: '',
    priority: 1,
    deadline: '',
    cadence_time: '',
    status: 'active',
    stakeholders: [],
    attachments: []
  });

  const loadGoals = useCallback(async () => {
    try {
      const [goalsResponse, peopleResponse] = await Promise.all([
        fetch('/api/goals'),
        fetch('/api/people')
      ]);
      
      if (goalsResponse.ok) {
        const allGoals = await goalsResponse.json();
        setGoals(allGoals.filter((g: Goal) => g.type === 'goal' || g.type === 'business_objective'));
        setRoutines(allGoals.filter((g: Goal) => g.type === 'routine'));
      }
      
      if (peopleResponse.ok) {
        const peopleData = await peopleResponse.json();
        setPeople(peopleData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  useEffect(() => {
    const initializeGoals = async () => {
      await loadGoals();
    };
    initializeGoals();
  }, [loadGoals]);

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        type: activeTab === 'objectives' ? 'goal' : 'routine'
      };

      const url = editingItem ? `/api/goals?id=${editingItem.id}` : '/api/goals';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await loadGoals();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const response = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadGoals();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleEdit = (item: Goal) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      priority: item.priority,
      deadline: item.deadline || '',
      cadence_time: item.cadence_time || '',
      status: item.status,
      stakeholders: item.stakeholders || []
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setShowForm(false);
    setFormData({
      title: '',
      description: '',
      priority: 1,
      deadline: '',
      cadence_time: '',
      status: 'active',
      stakeholders: []
    });
  };

  const currentItems = activeTab === 'objectives' ? goals : routines;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-violet-300 mb-4">Goals & Objectives</h1>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('objectives')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'objectives' 
                ? 'bg-violet-400 text-white' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Target className="w-5 h-5 inline mr-2" />
            Objectives & Goals
          </button>
          <button
            onClick={() => setActiveTab('routines')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'routines' 
                ? 'bg-violet-400 text-white' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-5 h-5 inline mr-2" />
            Routines & Habits
          </button>
        </div>

        {/* Add New Button */}
        <button
          onClick={() => setShowForm(true)}
          className="bg-violet-400 text-white px-4 py-2 rounded-lg hover:bg-violet-300 transition-colors font-bold border border-violet-300"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Add New {activeTab === 'objectives' ? 'Objective' : 'Routine'}
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-violet-300 mb-4">
              {editingItem ? 'Edit' : 'Add New'} {activeTab === 'objectives' ? 'Objective' : 'Routine'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  placeholder="Enter title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  placeholder="Enter description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                  <select
                    value={formData.priority || 1}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white focus:border-violet-400 focus:outline-none"
                  >
                    <option value={1}>High (1)</option>
                    <option value={2}>Medium-High (2)</option>
                    <option value={3}>Medium (3)</option>
                    <option value={4}>Medium-Low (4)</option>
                    <option value={5}>Low (5)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'completed' | 'paused' | 'archived' })}
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white focus:border-violet-400 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {activeTab === 'objectives' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Deadline</label>
                  <input
                    type="date"
                    value={formData.deadline || ''}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white focus:border-violet-400 focus:outline-none"
                  />
                </div>
              )}

              {activeTab === 'routines' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Cadence</label>
                  <select
                    value={formData.cadence_time || ''}
                    onChange={(e) => setFormData({ ...formData, cadence_time: e.target.value })}
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white focus:border-violet-400 focus:outline-none"
                  >
                    <option value="">Select frequency...</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Stakeholders</label>
                <div className="space-y-2">
                  {people.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No people profiles available. Add people first to assign stakeholders.</p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {people.map((person) => (
                        <label key={person.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={(formData.stakeholders || []).includes(person.id)}
                            onChange={(e) => {
                              const currentStakeholders = formData.stakeholders || [];
                              if (e.target.checked) {
                                setFormData({ ...formData, stakeholders: [...currentStakeholders, person.id] });
                              } else {
                                setFormData({ ...formData, stakeholders: currentStakeholders.filter(id => id !== person.id) });
                              }
                            }}
                            className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 focus:ring-offset-slate-800"
                          />
                          <span className="text-sm text-slate-300">{person.name}</span>
                          {person.work_function && (
                            <span className="text-xs text-slate-400">({person.work_function})</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Document/Sheet/Link Attachments */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Attachments (Docs, Sheets, Links)</label>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.md,.json"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingDocument(true);
                    // Simulate upload and extraction (replace with real API call)
                    const newAttachments = await Promise.all(files.map(async (file) => {
                      const reader = new FileReader();
                      return new Promise((resolve) => {
                        reader.onload = () => {
                          resolve({
                            id: Date.now() + Math.random(),
                            name: file.name,
                            type: 'document',
                            fileData: reader.result,
                            metadata: {
                              size: file.size,
                              mimeType: file.type,
                              uploadedAt: new Date().toISOString()
                            }
                          });
                        };
                        reader.readAsDataURL(file);
                      });
                    }));
                    setFormData((prev) => ({
                      ...prev,
                      attachments: [...(prev.attachments || []), ...newAttachments]
                    }));
                    setUploadingDocument(false);
                  }}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-700 file:text-white hover:file:bg-violet-600"
                />
                <input
                  type="url"
                  placeholder="Paste a link to a doc, sheet, or resource..."
                  className="w-full p-2 border border-slate-600 rounded bg-slate-700 text-slate-200 placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  onBlur={e => {
                    const url = e.target.value.trim();
                    if (url) {
                      setFormData((prev) => ({
                        ...prev,
                        attachments: [
                          ...(prev.attachments || []),
                          {
                            id: Date.now() + Math.random(),
                            name: url,
                            type: 'link',
                            url,
                            metadata: { uploadedAt: new Date().toISOString() }
                          }
                        ]
                      }));
                      e.target.value = '';
                    }
                  }}
                />
                {/* List of attachments */}
                {formData.attachments && formData.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.attachments.map((att, idx) => (
                      <div key={att.id || idx} className="flex items-center space-x-2 bg-slate-700 rounded px-3 py-2">
                        <span className="text-violet-300 text-xs font-mono truncate max-w-xs">
                          {att.type === 'link' ? <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline">{att.name}</a> : att.name}
                        </span>
                        <button
                          className="ml-auto text-slate-400 hover:text-red-400"
                          onClick={() => setFormData((prev) => ({
                            ...prev,
                            attachments: (prev.attachments || []).filter((_, i) => i !== idx)
                          }))}
                          title="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadingDocument && (
                  <div className="text-xs text-violet-300 mt-1">Uploading and extracting...</div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 inline mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title}
                className="px-4 py-2 bg-violet-400 text-white rounded-lg hover:bg-violet-300 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4 inline mr-2" />
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-4">
        {currentItems.length === 0 ? (
          <div className="text-center py-12 bg-slate-800 rounded-lg">
            <Target className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg mb-2">
              No {activeTab === 'objectives' ? 'objectives' : 'routines'} yet
            </p>
            <p className="text-slate-500">
              Start by adding your first {activeTab === 'objectives' ? 'goal or objective' : 'routine or habit'}
            </p>
          </div>
        ) : (
          currentItems.map((item) => (
            <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{item.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.priority <= 2 ? 'bg-red-900 text-red-200' :
                      item.priority <= 3 ? 'bg-yellow-900 text-yellow-200' :
                      'bg-green-900 text-green-200'
                    }`}>
                      Priority {item.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.status === 'active' ? 'bg-violet-900 text-violet-200' :
                      item.status === 'completed' ? 'bg-green-900 text-green-200' :
                      item.status === 'paused' ? 'bg-yellow-900 text-yellow-200' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-slate-300 mb-3">{item.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-slate-400">
                    {activeTab === 'objectives' && item.deadline && (
                      <span>📅 Due: {new Date(item.deadline).toLocaleDateString()}</span>
                    )}
                    {activeTab === 'routines' && item.cadence_time && (
                      <span>🔄 {item.cadence_time}</span>
                    )}
                    {item.stakeholders && item.stakeholders.length > 0 && (
                      <span>👥 {item.stakeholders.map(id => people.find(p => p.id === id)?.name).filter(Boolean).join(', ')}</span>
                    )}
                    <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-slate-400 hover:text-violet-300 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PeopleManagementView() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [formData, setFormData] = useState<Partial<Person>>({
    name: '',
    work_function: '',
    characteristics: '',
    biases: '',
    communication_style: '',
    relationship_type: '',
    profile_picture: '',
    sentiment_summary: ''
  });

  const loadPeople = useCallback(async () => {
    try {
      const response = await fetch('/api/people');
      if (response.ok) {
        const peopleData = await response.json();
        setPeople(peopleData);
      }
    } catch (error) {
      console.error('Error loading people:', error);
    }
  }, []);

  useEffect(() => {
    const initializePeople = async () => {
      await loadPeople();
    };
    initializePeople();
  }, [loadPeople]);

  const handleSave = async () => {
    try {
      const url = editingPerson ? `/api/people?id=${editingPerson.id}` : '/api/people';
      const method = editingPerson ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadPeople();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving person:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this person?')) return;
    
    try {
      const response = await fetch(`/api/people?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadPeople();
        setSelectedPeople(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPeople.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedPeople.size} selected people? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    try {
      const deletePromises = Array.from(selectedPeople).map(id => 
        fetch(`/api/people?id=${id}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      await loadPeople();
      setSelectedPeople(new Set());
      setShowBulkDelete(false);
    } catch (error) {
      console.error('Error bulk deleting people:', error);
    }
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      work_function: person.work_function || '',
      characteristics: person.characteristics || '',
      biases: person.biases || '',
      communication_style: person.communication_style || '',
      relationship_type: person.relationship_type || '',
      profile_picture: person.profile_picture || '',
      sentiment_summary: person.sentiment_summary || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingPerson(null);
    setShowForm(false);
    setFormData({
      name: '',
      work_function: '',
      characteristics: '',
      biases: '',
      communication_style: '',
      relationship_type: '',
      profile_picture: '',
      sentiment_summary: ''
    });
  };

  const togglePersonSelection = (id: string) => {
    setSelectedPeople(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPeople.size === people.length) {
      setSelectedPeople(new Set());
    } else {
      setSelectedPeople(new Set(people.map(p => p.id)));
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    if (!sentiment) return 'text-slate-400';
    const lower = sentiment.toLowerCase();
    if (lower.includes('positive') || lower.includes('good') || lower.includes('excellent') || lower.includes('reliable') || lower.includes('collaborative')) return 'text-green-400';
    if (lower.includes('negative') || lower.includes('poor') || lower.includes('difficult') || lower.includes('concerning') || lower.includes('unreliable')) return 'text-red-400';
    if (lower.includes('neutral') || lower.includes('mixed') || lower.includes('inconsistent') || lower.includes('developing')) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const generateSentimentSummary = async (personData: Partial<Person>) => {
    try {
      const response = await fetch('/api/people/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: editingPerson?.id,
          personData
        })
      });

      if (response.ok) {
        const { sentiment_summary } = await response.json();
        setFormData({ ...formData, sentiment_summary });
      } else {
        console.error('Failed to generate sentiment summary');
        setFormData({ ...formData, sentiment_summary: 'Unable to generate AI summary at this time' });
      }
    } catch (error) {
      console.error('Error generating sentiment summary:', error);
      setFormData({ ...formData, sentiment_summary: 'Error generating AI summary' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-violet-300">People Management</h1>
          
          <div className="flex items-center space-x-3">
            {selectedPeople.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">
                  {selectedPeople.size} selected
                </span>
                <button
                  onClick={() => setShowBulkDelete(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-bold"
                >
                  <Trash2 className="w-4 h-4 inline mr-2" />
                  Delete Selected
                </button>
              </div>
            )}
            
            <button
              onClick={() => setShowForm(true)}
              className="bg-violet-400 text-white px-4 py-2 rounded-lg hover:bg-violet-300 transition-colors font-bold border border-violet-300"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Person
            </button>
          </div>
        </div>

        {/* Bulk Selection Controls */}
        {people.length > 0 && (
          <div className="flex items-center space-x-4 mb-6 p-4 bg-slate-800 rounded-lg">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedPeople.size === people.length && people.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 focus:ring-offset-slate-800"
              />
              <span className="text-slate-300">
                Select All ({people.length})
              </span>
            </label>
            <span className="text-slate-500">•</span>
            <span className="text-sm text-slate-400">
              {selectedPeople.size} of {people.length} selected
            </span>
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-red-400 mb-4">
              Confirm Bulk Delete
            </h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete {selectedPeople.size} selected people? This action cannot be undone and will also remove them from any associated goals or routines.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkDelete(false)}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete {selectedPeople.size} People
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-violet-300 mb-4">
              {editingPerson ? 'Edit Person' : 'Add New Person'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                    placeholder="Enter full name..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Position/Role</label>
                  <input
                    type="text"
                    value={formData.work_function || ''}
                    onChange={(e) => setFormData({ ...formData, work_function: e.target.value })}
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                    placeholder="e.g., Product Manager, Engineer..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Profile Picture URL</label>
                <input
                  type="url"
                  value={formData.profile_picture || ''}
                  onChange={(e) => setFormData({ ...formData, profile_picture: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Relationship Type</label>
                <select
                  value={formData.relationship_type || ''}
                  onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white focus:border-violet-400 focus:outline-none"
                >
                  <option value="">Select relationship...</option>
                  <option value="direct_report">Direct Report</option>
                  <option value="manager">Manager</option>
                  <option value="peer">Peer</option>
                  <option value="stakeholder">Stakeholder</option>
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Characteristics</label>
                <textarea
                  value={formData.characteristics || ''}
                  onChange={(e) => setFormData({ ...formData, characteristics: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  placeholder="Key personality traits, strengths, working style..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Communication Style</label>
                <textarea
                  value={formData.communication_style || ''}
                  onChange={(e) => setFormData({ ...formData, communication_style: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  placeholder="How they prefer to communicate, meeting styles, feedback preferences..."
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Potential Biases & Personal Sentiments</label>
                <textarea
                  value={formData.biases || ''}
                  onChange={(e) => setFormData({ ...formData, biases: e.target.value })}
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  placeholder="Known biases, blind spots, your personal feelings about working with them..."
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">AI Sentiment Summary</label>
                <div className="p-3 border border-slate-600 rounded-lg bg-slate-700">
                  <p className="text-sm text-slate-400 mb-2">
                    📊 AI will analyze delivery patterns, communication history, and relationship dynamics to generate an objective sentiment summary.
                  </p>
                  {formData.sentiment_summary ? (
                    <p className="text-sm text-slate-200">
                      Current: <span className={getSentimentColor(formData.sentiment_summary)}>{formData.sentiment_summary}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No AI analysis available yet</p>
                  )}
                  <button
                    type="button"
                    onClick={() => generateSentimentSummary(formData)}
                    className="mt-2 text-xs bg-violet-400 text-white px-3 py-1 rounded hover:bg-violet-300 transition-colors"
                  >
                    Generate AI Summary
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 inline mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name}
                className="px-4 py-2 bg-violet-400 text-white rounded-lg hover:bg-violet-300 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4 inline mr-2" />
                {editingPerson ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* People Cards Grid */}
      {people.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg">
          <Users className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg mb-2">
            No people profiles yet
          </p>
          <p className="text-slate-500">
            Start building your network by adding people you work with
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {people.map((person) => (
            <div
              key={person.id}
              className={`bg-slate-800 border rounded-lg p-6 transition-all hover:shadow-lg ${
                selectedPeople.has(person.id) 
                  ? 'border-violet-400 bg-violet-900/20' 
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Card Header with Selection */}
              <div className="flex items-start justify-between mb-4">
                <input
                  type="checkbox"
                  checked={selectedPeople.has(person.id)}
                  onChange={() => togglePersonSelection(person.id)}
                  className="mt-1 rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 focus:ring-offset-slate-800"
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(person)}
                    className="p-2 text-slate-400 hover:text-violet-300 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(person.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Profile Picture */}
              <div className="flex justify-center mb-4">
                {person.profile_picture ? (
                  <Image
                    src={person.profile_picture}
                    alt={person.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-600"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-16 h-16 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center ${person.profile_picture ? 'hidden' : ''}`}>
                  <span className="text-2xl font-bold text-slate-400">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Name and Position */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white mb-1">{person.name}</h3>
                {person.work_function && (
                  <p className="text-sm text-slate-400">{person.work_function}</p>
                )}
                {person.relationship_type && (
                  <span className="inline-block mt-1 px-2 py-1 bg-slate-700 text-xs rounded-full text-slate-300">
                    {person.relationship_type.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* AI Sentiment Summary */}
              {person.sentiment_summary && (
                <div className="mb-4 p-3 bg-slate-700 rounded-lg">
                  <div className="flex items-center mb-1">
                    <p className="text-xs font-medium text-slate-400">AI Analysis</p>
                    <span className="ml-2 text-xs text-violet-400">📊</span>
                  </div>
                  <p className={`text-sm font-medium ${getSentimentColor(person.sentiment_summary)}`}>
                    {person.sentiment_summary}
                  </p>
                </div>
              )}

              {/* Additional Info */}
              <div className="space-y-2 text-xs text-slate-500">
                {person.biases && (
                  <div>
                    <span className="font-medium">Notes:</span> {person.biases.substring(0, 60)}...
                  </div>
                )}
                <div>
                  <span className="font-medium">Added:</span> {new Date(person.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView() {
  const { data: session } = useSession();
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [userProfile, setUserProfile] = useState({
    who_i_am: '',
    who_i_want_to_be: '',
    strengths: '',
    weaknesses: '',
    work_style: ''
  });
  const [standupQuestions, setStandupQuestions] = useState<string[]>([
    'What did you do yesterday?',
    'What were you not able to do yesterday?',
    'Who do you need to do it?',
    'What do you need to do it?',
    'Why were you not able to do it?',
    'What are you doing today?',
    'What could stop you from doing it?',
    'What do you need to understand going into the day?'
  ]);
  const [newQuestion, setNewQuestion] = useState('');
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsLoading(true);
      
      // Load Gemini configuration
      const geminiResponse = await fetch('/api/gemini/config');
      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        setGeminiApiKey(geminiData.configured ? '••••••••••••••••' : '');
      }
      
      // Load user profile
      const profileResponse = await fetch('/api/user/profile');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData) {
          setUserProfile({
            who_i_am: profileData.who_i_am || '',
            who_i_want_to_be: profileData.who_i_want_to_be || '',
            strengths: profileData.strengths || '',
            weaknesses: profileData.weaknesses || '',
            work_style: profileData.work_style || ''
          });
        }
      }
      
      // Load standup questions
      const questionsResponse = await fetch('/api/standup/questions');
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        if (questionsData.success && questionsData.questions && questionsData.isCustom) {
          // Only override defaults if user has custom questions
          const questionTexts = questionsData.questions.map((q: StandupQuestion | string) => 
            typeof q === 'string' ? q : q.text
          );
          setStandupQuestions(questionTexts);
        } else if (questionsData.success && !questionsData.isCustom) {
          // User sees the default questions that are already pre-filled
          console.log('Using default questions in settings');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveGeminiApiKey = async () => {
    if (!geminiApiKey || geminiApiKey.includes('•')) return;
    
    try {
      setSaveStatus('saving');
      
      const response = await fetch('/api/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey })
      });

      if (response.ok) {
        setSaveStatus('success');
        setGeminiApiKey('••••••••••••••••');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Error saving Gemini API key:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const testGeminiConnection = async () => {
    if (!geminiApiKey || geminiApiKey.includes('•')) {
      showModal('Input Required', 'Please enter a new API key to test', 'warning');
      return;
    }

    try {
      setTestStatus('testing');
      
      const response = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTestStatus('success');
          setTimeout(() => setTestStatus('idle'), 3000);
        } else {
          setTestStatus('error');
          setTimeout(() => setTestStatus('idle'), 3000);
        }
      } else {
        setTestStatus('error');
        setTimeout(() => setTestStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Error testing Gemini connection:', error);
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  const saveUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
      });

      if (response.ok) {
        // Show success feedback
        console.log('Profile saved successfully');
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  };

  const resetData = async () => {
    const confirmMessage = 'Are you sure you want to reset all data? This will delete all your standups, goals, people, and settings. This action cannot be undone.';
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch('/api/user/reset', { method: 'POST' });
      if (response.ok) {
        showModal('Success', 'All data has been reset successfully', 'success');
        window.location.reload();
      } else {
        showModal('Error', 'Failed to reset data', 'error');
      }
    } catch (error) {
      console.error('Error resetting data:', error);
      showModal('Error', 'Error resetting data', 'error');
    }
  };

  const saveStandupQuestions = useCallback(async () => {
    try {
      // Convert string array to object format for API
      const questionsForAPI = standupQuestions.map((text, index) => ({
        id: index + 1,
        text: text
      }));
      
      const response = await fetch('/api/standup/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: questionsForAPI })
      });

      if (response.ok) {
        console.log('Standup questions saved successfully');
      }
    } catch (error) {
      console.error('Error saving standup questions:', error);
    }
  }, [standupQuestions]);

  const addStandupQuestion = () => {
    if (!newQuestion.trim()) return;
    
    const updatedQuestions = [...standupQuestions, newQuestion.trim()];
    setStandupQuestions(updatedQuestions);
    setNewQuestion('');
    saveStandupQuestions();
  };

  const editStandupQuestion = (index: number) => {
    setEditingQuestionIndex(index);
    setEditingQuestionText(standupQuestions[index]);
  };

  const saveEditedQuestion = () => {
    if (editingQuestionIndex === null || !editingQuestionText.trim()) return;
    
    const updatedQuestions = [...standupQuestions];
    updatedQuestions[editingQuestionIndex] = editingQuestionText.trim();
    setStandupQuestions(updatedQuestions);
    setEditingQuestionIndex(null);
    setEditingQuestionText('');
    saveStandupQuestions();
  };

  const deleteStandupQuestion = (index: number) => {
    setQuestionToDelete(index);
    setShowDeleteModal(true);
  };

  const confirmDeleteQuestion = () => {
    if (questionToDelete !== null) {
      const updatedQuestions = standupQuestions.filter((_, i) => i !== questionToDelete);
      setStandupQuestions(updatedQuestions);
      saveStandupQuestions();
    }
    setShowDeleteModal(false);
    setQuestionToDelete(null);
  };

  const cancelDeleteQuestion = () => {
    setShowDeleteModal(false);
    setQuestionToDelete(null);
  };

  const resetToDefaultQuestions = () => {
    if (!confirm('Reset to default standup questions? This will replace all current questions.')) return;
    
    const defaultQuestions = [
      'What did you do yesterday?',
      'What were you not able to do yesterday?',
      'Who do you need to do it?',
      'What do you need to do it?',
      'Why were you not able to do it?',
      'What are you doing today?',
      'What could stop you from doing it?',
      'What do you need to understand going into the day?'
    ];
    
    setStandupQuestions(defaultQuestions);
    saveStandupQuestions();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-violet-300 mb-2">Settings</h1>
        <p className="text-slate-400">Configure your Chief of Staff preferences and integrations</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading settings...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* AI Configuration */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-violet-300 mb-4 flex items-center">
              <span className="mr-2">🤖</span>
              AI Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Google Gemini API Key
                </label>
                <div className="flex space-x-3">
                  <input
                    type={geminiApiKey.includes('•') ? 'password' : 'text'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    className="flex-1 p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    onClick={testGeminiConnection}
                    disabled={testStatus === 'testing' || !geminiApiKey || geminiApiKey.includes('•')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      testStatus === 'success' ? 'bg-green-600 text-white' :
                      testStatus === 'error' ? 'bg-red-600 text-white' :
                      testStatus === 'testing' ? 'bg-violet-600 text-white' :
                      'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    {testStatus === 'testing' ? 'Testing...' :
                     testStatus === 'success' ? 'Valid' :
                     testStatus === 'error' ? 'Failed' : 'Test'}
                  </button>
                  <button
                    onClick={saveGeminiApiKey}
                    disabled={saveStatus === 'saving' || !geminiApiKey || geminiApiKey.includes('•')}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      saveStatus === 'success' ? 'bg-green-600 text-white' :
                      saveStatus === 'error' ? 'bg-red-600 text-white' :
                      saveStatus === 'saving' ? 'bg-violet-600 text-white' :
                      'bg-violet-400 text-white hover:bg-violet-300'
                    }`}
                  >
                    {saveStatus === 'saving' ? 'Saving...' :
                     saveStatus === 'success' ? 'Saved!' :
                     saveStatus === 'error' ? 'Error' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Get your free API key from{' '}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline"
                  >
                    Google AI Studio
                  </a>
                  . Required for AI analysis, checklist generation, and sentiment summaries.
                </p>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-violet-300 mb-4 flex items-center">
              <span className="mr-2">👤</span>
              Personal Profile
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Who I Am
                </label>
                <textarea
                  value={userProfile.who_i_am}
                  onChange={(e) => setUserProfile({ ...userProfile, who_i_am: e.target.value })}
                  placeholder="Describe your current role, responsibilities, and identity..."
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Who I Want to Be
                </label>
                <textarea
                  value={userProfile.who_i_want_to_be}
                  onChange={(e) => setUserProfile({ ...userProfile, who_i_want_to_be: e.target.value })}
                  placeholder="Describe your aspirations, career goals, and desired growth..."
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Strengths
                  </label>
                  <textarea
                    value={userProfile.strengths}
                    onChange={(e) => setUserProfile({ ...userProfile, strengths: e.target.value })}
                    placeholder="Your key strengths and talents..."
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Areas for Growth
                  </label>
                  <textarea
                    value={userProfile.weaknesses}
                    onChange={(e) => setUserProfile({ ...userProfile, weaknesses: e.target.value })}
                    placeholder="Areas you'd like to improve or develop..."
                    className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Work Style
                </label>
                <textarea
                  value={userProfile.work_style}
                  onChange={(e) => setUserProfile({ ...userProfile, work_style: e.target.value })}
                  placeholder="How you prefer to work, communicate, and collaborate..."
                  className="w-full p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
                  rows={2}
                />
              </div>

              <button
                onClick={saveUserProfile}
                className="bg-violet-400 text-white px-6 py-2 rounded-lg hover:bg-violet-300 transition-colors font-medium"
              >
                Save Profile
              </button>
            </div>
          </div>

          {/* Standup Questions Configuration */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-violet-300 flex items-center">
                <span className="mr-2">❓</span>
                Standup Questions
              </h2>
              <button
                onClick={resetToDefaultQuestions}
                className="text-sm bg-slate-600 text-slate-300 px-3 py-1 rounded hover:bg-slate-500 transition-colors"
              >
                Reset to Default
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Current Questions */}
              <div className="space-y-2">
                {standupQuestions.map((question, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-slate-700 rounded-lg">
                    {editingQuestionIndex === index ? (
                      <>
                        <input
                          type="text"
                          value={editingQuestionText}
                          onChange={(e) => setEditingQuestionText(e.target.value)}
                          className="flex-1 p-2 border border-slate-600 rounded bg-slate-600 text-white focus:border-violet-400 focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditedQuestion();
                            if (e.key === 'Escape') {
                              setEditingQuestionIndex(null);
                              setEditingQuestionText('');
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={saveEditedQuestion}
                          className="text-green-400 hover:text-green-300 p-1"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingQuestionIndex(null);
                            setEditingQuestionText('');
                          }}
                          className="text-slate-400 hover:text-slate-300 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-400 text-sm w-6">{index + 1}.</span>
                        <span className="flex-1 text-white">{question}</span>
                        <button
                          onClick={() => editStandupQuestion(index)}
                          className="text-slate-400 hover:text-violet-300 p-1"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteStandupQuestion(index)}
                          className="text-slate-400 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Question */}
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Add a new standup question..."
                  className="flex-1 p-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addStandupQuestion();
                  }}
                />
                <button
                  onClick={addStandupQuestion}
                  disabled={!newQuestion.trim()}
                  className="bg-violet-400 text-white px-4 py-2 rounded-lg hover:bg-violet-300 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Customize your daily standup questions. Changes will apply to new standups.
              </p>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-violet-300 mb-4 flex items-center">
              <span className="mr-2">ℹ️</span>
              Account Information
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Email:</span>
                <span className="text-white">{session?.user?.email || 'Guest Mode'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Name:</span>
                <span className="text-white">{session?.user?.name || 'Guest User'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Mode:</span>
                <span className="text-white">{session?.user ? 'Google Account' : 'Guest Mode'}</span>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-violet-300 mb-4 flex items-center">
              <span className="mr-2">🗃️</span>
              Data Management
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-700 rounded-lg">
                <h3 className="font-medium text-white mb-2">Reset All Data</h3>
                <p className="text-sm text-slate-400 mb-3">
                  This will permanently delete all your standups, goals, people profiles, and settings. This action cannot be undone.
                </p>
                <button
                  onClick={resetData}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Reset Everything
                </button>
              </div>
            </div>
          </div>

          {/* App Information */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-violet-300 mb-4 flex items-center">
              <span className="mr-2">📱</span>
              About
            </h2>
            
            <div className="space-y-2 text-sm text-slate-400">
              <p><strong>Chief of Staff</strong> - AI-powered productivity and relationship management</p>
              <p>Version: 1.0.0</p>
              <p>Built with Next.js, TypeScript, and Google Gemini AI</p>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-slate-100 mb-4">Delete Question</h3>
                <p className="text-slate-300 mb-6">
                  Are you sure you want to delete this question? This action cannot be undone.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={cancelDeleteQuestion}
                    className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteQuestion}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // App works without authentication, but Google/Slack login unlocks enhanced integrations
  const hasGoogleIntegration = !!session?.user;
  const currentUser = session?.user || { id: 'guest', name: 'Guest User', email: 'guest@localhost' };
  
  // Track connection status for both providers
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false);
  const [hasSlackConnection, setHasSlackConnection] = useState(false);
  const isGuestMode = !session?.user;
  
  const [currentView, setCurrentView] = useState(() => {
    // Get initial view from URL or default to standup
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const view = urlParams.get('view');
      if (view && ['standup', 'checklist', 'goals', 'people', 'analytics', 'settings'].includes(view)) {
        return view;
      }
    }
    return 'standup';
  });
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [standupQuestions, setStandupQuestions] = useState<StandupQuestionWithAnalysis[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [mode, setMode] = useState<'cadence' | 'waterfall'>('cadence');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ChecklistItem | null>(null);

  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  // Modal helper function
  const showModal = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  // Draft persistence for standup form
  const saveDraft = useCallback((questionIndex: number, answer: string) => {
    const draftKey = `standup-draft-${questionIndex}`;
    console.log(`Saving draft: ${draftKey} = "${answer}"`);
    localStorage.setItem(draftKey, answer);
  }, []);

  const clearDrafts = useCallback(() => {
    for (let i = 0; i < 8; i++) {
      localStorage.removeItem(`standup-draft-${i}`);
    }
  }, []);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState({
    current: {
      focus_score: 0,
      completion_rate: 0,
      proactiveness_score: 0,
      alignment_score: 0
    },
    weekly: [],
    calendar: [],
    objectives: [],
    isLoading: true,
    error: null
  });

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

  // Check which services are connected
  const checkConnectionStatus = useCallback(async () => {
    if (!session?.user?.email) {
      setHasGoogleConnection(false);
      setHasSlackConnection(false);
      return;
    }
    
    try {
      const response = await fetch('/api/user/connections');
      if (response.ok) {
        const data = await response.json();
        setHasGoogleConnection(!!data.google_id);
        setHasSlackConnection(!!data.slack_id);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  }, [session?.user?.email]);

  const loadStandupQuestions = useCallback(async () => {
    try {
      const response = await fetch('/api/standup/questions');
      const data = await response.json();
      
      if (data.success && data.questions.length > 0) {
        // Convert simple questions into full question objects for the standup interface
        const questionsWithAnalysis = data.questions.map((q: StandupQuestion, index: number) => {
          const draftKey = `standup-draft-${index}`;
          const savedDraft = localStorage.getItem(draftKey);
          console.log(`Question ${index}: Loading draft "${savedDraft}"`);
          return {
            id: `q${index + 1}`,
            question: q.text,
            answer: savedDraft || '',
            isAnalyzed: false
          };
        });
        setStandupQuestions(questionsWithAnalysis);
      } else {
        // Use default questions with drafts if none found
        const defaultQuestions = [
          { id: 'q1', question: 'What did you do yesterday?', answer: '', isAnalyzed: false },
          { id: 'q2', question: 'What were you not able to do yesterday?', answer: '', isAnalyzed: false },
          { id: 'q3', question: 'Who do you need to do it?', answer: '', isAnalyzed: false },
          { id: 'q4', question: 'What do you need to do it?', answer: '', isAnalyzed: false },
          { id: 'q5', question: 'Why were you not able to do it?', answer: '', isAnalyzed: false },
          { id: 'q6', question: 'What are you doing today?', answer: '', isAnalyzed: false },
          { id: 'q7', question: 'What could stop you from doing it?', answer: '', isAnalyzed: false },
          { id: 'q8', question: 'What do you need to understand going into the day?', answer: '', isAnalyzed: false }
        ];
        
        // Load drafts for default questions
        const questionsWithDrafts = defaultQuestions.map((q, index) => {
          const draftKey = `standup-draft-${index}`;
          const savedDraft = localStorage.getItem(draftKey);
          console.log(`Default question ${index}: Loading draft "${savedDraft}"`);
          return {
            ...q,
            answer: savedDraft || ''
          };
        });
        setStandupQuestions(questionsWithDrafts);
      }
    } catch (error) {
      console.error('Error loading standup questions:', error);
      // If loading fails, use default questions with drafts
      const defaultQuestions = [
        { id: 'q1', question: 'What did you do yesterday?', answer: '', isAnalyzed: false },
        { id: 'q2', question: 'What were you not able to do yesterday?', answer: '', isAnalyzed: false },
        { id: 'q3', question: 'Who do you need to do it?', answer: '', isAnalyzed: false },
        { id: 'q4', question: 'What do you need to do it?', answer: '', isAnalyzed: false },
        { id: 'q5', question: 'Why were you not able to do it?', answer: '', isAnalyzed: false },
        { id: 'q6', question: 'What are you doing today?', answer: '', isAnalyzed: false },
        { id: 'q7', question: 'What could stop you from doing it?', answer: '', isAnalyzed: false },
        { id: 'q8', question: 'What do you need to understand going into the day?', answer: '', isAnalyzed: false }
      ];
      
      const questionsWithDrafts = defaultQuestions.map((q, index) => {
        const draftKey = `standup-draft-${index}`;
        const savedDraft = localStorage.getItem(draftKey);
        return {
          ...q,
          answer: savedDraft || ''
        };
      });
      setStandupQuestions(questionsWithDrafts);
    }
  }, []);

  const loadAnalyticsData = useCallback(async () => {
    if (isGuestMode) {
      // Use mock data for guests
      setAnalyticsData({
        current: {
          focus_score: 87,
          completion_rate: 92,
          proactiveness_score: 75,
          alignment_score: 94
        },
        weekly: [
          { date: '2024-11-17', completion: 85 },
          { date: '2024-11-18', completion: 90 },
          { date: '2024-11-19', completion: 78 },
          { date: '2024-11-20', completion: 95 },
          { date: '2024-11-21', completion: 88 },
          { date: '2024-11-22', completion: 92 },
          { date: '2024-11-23', completion: 89 }
        ],
        calendar: Array.from({ length: 28 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (27 - i));
          return {
            date: date.toISOString().split('T')[0],
            completion: Math.random() * 100,
            focus: Math.random() * 100,
            proactiveness: Math.random() * 100
          };
        }),
        objectives: [
          { id: '1', title: 'Complete Product Roadmap', progress_percentage: 75, target_date: '2024-12-15', status: 'active' },
          { id: '2', title: 'Improve Team Communication', progress_percentage: 60, target_date: '2024-11-30', status: 'active' },
          { id: '3', title: 'Launch Marketing Campaign', progress_percentage: 90, target_date: '2024-12-01', status: 'active' }
        ],
        isLoading: false,
        error: null
      });
      return;
    }

    try {
      setAnalyticsData(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch all analytics data in parallel
      const [metricsResponse, objectivesResponse, tasksResponse, focusResponse] = await Promise.all([
        fetchDailyMetrics(7),
        fetchObjectives(),
        fetchTasks(),
        fetchFocusSessions()
      ]);

      // Calculate derived metrics
      const calculatedMetrics = calculateMetrics(
        metricsResponse.metrics,
        tasksResponse,
        focusResponse
      );

      setAnalyticsData({
        current: calculatedMetrics.current,
        weekly: calculatedMetrics.weekly,
        calendar: calculatedMetrics.calendar,
        objectives: objectivesResponse,
        isLoading: false,
        error: null
      });

    } catch (error) {
      console.error('Error loading analytics data:', error);
      setAnalyticsData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load analytics data'
      }));
    }
  }, [isGuestMode]);

  useEffect(() => {
    // Load standup questions only once on mount
    loadStandupQuestions();
    
    if (session) {
      checkGeminiConfiguration();
      checkConnectionStatus();
    }
    
    // Load analytics data
    loadAnalyticsData();
  }, [loadStandupQuestions, session, checkGeminiConfiguration, checkConnectionStatus, loadAnalyticsData]);

  // Sync URL with current view
  useEffect(() => {
    const view = searchParams.get('view');
    if (view && ['standup', 'checklist', 'goals', 'people', 'analytics', 'settings'].includes(view)) {
      setCurrentView(view);
    }
  }, [searchParams]);

  // Function to change view and update URL
  const handleChecklistUpdate = useCallback((newItems: ChecklistItem[]) => {
    // Add new items to existing checklist
    setChecklist(prevChecklist => {
      const existingIds = new Set(prevChecklist.map(item => item.id));
      const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
      return [...prevChecklist, ...uniqueNewItems];
    });
    
    // Show notification
    console.log('Checklist updated with new contextual items:', newItems.length);
  }, []);

  const changeView = (view: string) => {
    setCurrentView(view);
    router.push(`/?view=${view}`, { scroll: false });
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
        showModal('Success', 'Gemini API configured successfully!', 'success');
      } else {
        showModal('Error', 'Failed to configure Gemini API. Please check your key.', 'error');
      }
    } catch (error) {
      console.error('Error configuring Gemini:', error);
    }
  };

  const startVoiceRecognition = (questionIndex: number) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showModal('Not Supported', 'Speech recognition not supported in this browser', 'warning');
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
        showModal('Configuration Required', 'Gemini API key is required for analysis', 'warning');
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
        showModal('Analysis Error', analysis.message || analysis.error || 'Failed to analyze response', 'error');
      }
    } catch (error) {
      console.error('Error analyzing answer:', error);
      showModal('Analysis Error', 'Failed to analyze response. Please check your connection and try again.', 'error');
    }
  };

  const generateChecklist = async () => {
    try {
      // Validate all questions have answers
      if (!standupQuestions.every(q => q.answer.trim())) {
        showModal('Incomplete Form', 'Please answer all questions before generating checklist.', 'warning');
        return;
      }

      // First create standup session
      const standupResponse = await fetch('/api/standup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatDidYesterday: standupQuestions[0]?.answer || '',
          whatNotAbleYesterday: standupQuestions[1]?.answer || '',
          whoNeedToDo: standupQuestions[2]?.answer || '',
          whatNeedToDo: standupQuestions[3]?.answer || '',
          whyNotAble: standupQuestions[4]?.answer || '',
          whatDoingToday: standupQuestions[5]?.answer || '',
          whatCouldStop: standupQuestions[6]?.answer || '',
          whatNeedUnderstand: standupQuestions[7]?.answer || '',
          mode
        })
      });

      if (!standupResponse.ok) {
        const errorData = await standupResponse.json();
        throw new Error(errorData.error || 'Failed to create standup session');
      }

      const standupData = await standupResponse.json();

      if (!standupData.sessionId) {
        throw new Error('No session ID returned from standup creation');
      }

      // Then generate checklist  
      const checklistResponse = await fetch('/api/checklist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: standupData.sessionId })
      });

      if (!checklistResponse.ok) {
        const errorData = await checklistResponse.json();
        throw new Error(errorData.error || 'Failed to generate checklist');
      }

      const checklistData = await checklistResponse.json();
      
      if (checklistData.items) {
        setChecklist(checklistData.items);
        clearDrafts(); // Clear drafts after successful submission
        setCurrentView('checklist');
        router.push('/?view=checklist', { scroll: false });
      } else {
        throw new Error('No checklist items received');
      }
    } catch (error) {
      console.error('Error generating checklist:', error);
      showModal('Generation Error', `Error: ${error.message || 'Failed to generate checklist. Please try again.'}`, 'error');
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
              <span className="text-sm text-slate-300">
                {currentUser.name}
                {isGuestMode && <span className="text-xs text-slate-400 ml-1">(Guest Mode)</span>}
              </span>
              <div className="flex flex-col items-end space-y-1">
                {(hasGoogleConnection || hasSlackConnection) && (
                  <div className="flex items-center space-x-2 text-xs">
                    {hasGoogleConnection && <span className="text-green-400">Google ✓</span>}
                    {hasSlackConnection && <span className="text-green-400">Slack ✓</span>}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  {session?.user && (
                    <button
                      onClick={() => signOut()}
                      className="text-sm text-slate-300 hover:text-violet-300 transition-colors"
                    >
                      Sign out
                    </button>
                  )}
                  <div className="text-xs text-slate-400">Optional integrations:</div>
                  <div className="flex space-x-1">
                    {!hasGoogleConnection && (
                      <button
                        onClick={() => signIn('google')}
                        className="text-xs bg-violet-400 text-white px-2 py-1 rounded hover:bg-violet-300 font-bold transition-colors"
                      >
                        Google
                      </button>
                    )}
                    {!hasSlackConnection && (
                      <button
                        onClick={() => signIn('slack')}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-500 font-bold transition-colors"
                      >
                        Slack
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className={`transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } bg-slate-800 shadow-sm min-h-screen border-r border-slate-700 relative`}>
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:text-violet-300 hover:bg-slate-600 transition-colors z-10"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '→' : '←'}
          </button>
          
          <div className="p-4">
            {/* Integration Status */}
            {!isSidebarCollapsed && (
              <div className="mb-6 p-3 bg-slate-700 rounded-lg border border-slate-600">
                <h3 className="text-sm font-bold text-slate-100 mb-2">Integrations</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Google APIs</span>
                    <span className={`px-2 py-1 rounded font-bold ${hasGoogleConnection ? 'bg-violet-900 text-violet-300 border border-violet-500' : 'bg-slate-600 text-slate-400'}`}>
                      {hasGoogleConnection ? 'Connected' : 'Available'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Slack</span>
                    <span className={`px-2 py-1 rounded font-bold ${hasSlackConnection ? 'bg-green-900 text-green-300 border border-green-500' : 'bg-slate-600 text-slate-400'}`}>
                      {hasSlackConnection ? 'Connected' : 'Available'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => changeView('standup')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-colors ${
                    currentView === 'standup' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isSidebarCollapsed ? 'Daily Standup' : ''}
                >
                  <Mic className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!isSidebarCollapsed && 'Daily Standup'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => changeView('checklist')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-colors ${
                    currentView === 'checklist' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isSidebarCollapsed ? 'Checklist' : ''}
                >
                  <FileText className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!isSidebarCollapsed && 'Checklist'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => changeView('goals')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-colors ${
                    currentView === 'goals' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isSidebarCollapsed ? 'Goals & Objectives' : ''}
                >
                  <Target className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!isSidebarCollapsed && 'Goals & Objectives'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => changeView('people')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-colors ${
                    currentView === 'people' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isSidebarCollapsed ? 'People' : ''}
                >
                  <Users className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!isSidebarCollapsed && 'People'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => changeView('analytics')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-colors ${
                    currentView === 'analytics' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isSidebarCollapsed ? 'Analytics' : ''}
                >
                  <BarChart3 className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!isSidebarCollapsed && 'Analytics'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => changeView('settings')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-colors ${
                    currentView === 'settings' ? 'bg-violet-900 text-violet-300 border border-violet-500 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isSidebarCollapsed ? 'Settings' : ''}
                >
                  <Settings className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                  {!isSidebarCollapsed && 'Settings'}
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8" style={{ backgroundColor: '#141414' }}>
          {currentView === 'standup' && (
            <div className="max-w-4xl mx-auto">
              {isGuestMode && (
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
                  <div className="text-blue-300 text-sm">
                    <strong>Guest Mode:</strong> All features work with full data persistence! 
                    Connect Google or Slack above to unlock external integrations like Google Docs, Sheets, Tasks, Calendar, Gmail, and Slack messaging.
                  </div>
                </div>
              )}
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
                          saveDraft(index, e.target.value);
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
            <div className="h-full flex">
              {/* Left Panel - Task List (1/4) */}
              <div className="w-1/4 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-violet-300">Tasks</h2>
                  <span className="bg-violet-900 text-violet-300 px-2 py-1 rounded text-sm font-medium">
                    {checklist.length}
                  </span>
                </div>
                
                {checklist.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-slate-500 mb-2">📝</div>
                    <p className="text-slate-400 text-sm">No tasks yet</p>
                    <p className="text-slate-500 text-xs mt-1">Complete your standup to generate tasks</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Priority Groups */}
                    {[1, 2, 3, 4, 5].map(priority => {
                      const priorityTasks = checklist.filter(task => (task.priority || 5) === priority);
                      if (priorityTasks.length === 0) return null;
                      
                      return (
                        <div key={priority} className="mb-4">
                          <div className="flex items-center mb-2">
                            <span className={`w-3 h-3 rounded-full mr-2 ${
                              priority <= 2 ? 'bg-red-400' :
                              priority <= 3 ? 'bg-yellow-400' : 'bg-green-400'
                            }`}></span>
                            <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                              {priority <= 2 ? 'High' : priority <= 3 ? 'Medium' : 'Low'} Priority
                            </span>
                          </div>
                          
                          {priorityTasks.map((task, index) => (
                            <button
                              key={task.id || index}
                              onClick={() => setSelectedTask(task)}
                              className={`w-full text-left p-3 rounded-lg border transition-all mb-2 ${
                                selectedTask?.id === task.id || (selectedTask === task && !task.id)
                                  ? 'bg-violet-900 border-violet-500 text-violet-300'
                                  : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <h4 className="font-medium text-sm leading-tight pr-2">{task.title}</h4>
                                {task.estimatedTimeMinutes && (
                                  <span className="text-xs text-slate-400 flex-shrink-0">
                                    {task.estimatedTimeMinutes}m
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                                  {task.description}
                                </p>
                              )}
                              {task.stakeholders && task.stakeholders.length > 0 && (
                                <div className="flex items-center mt-2">
                                  <span className="text-xs text-slate-500">👥 {task.stakeholders.length}</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Right Panel - Task Detail (3/4) */}
              <div className="w-3/4 p-6 overflow-y-auto">
                {!selectedTask ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📋</div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a task</h3>
                      <p className="text-slate-400">Choose a task from the left panel to view details and take action</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Task Header */}
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h1 className="text-2xl font-bold text-violet-300 mb-2">{selectedTask.title}</h1>
                          <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              (selectedTask.priority || 5) <= 2 ? 'bg-red-900 text-red-300 border border-red-700' :
                              (selectedTask.priority || 5) <= 3 ? 'bg-yellow-900 text-yellow-300 border border-yellow-700' :
                              'bg-green-900 text-green-300 border border-green-700'
                            }`}>
                              Priority {selectedTask.priority || 'N/A'}
                            </span>
                            {selectedTask.estimatedTimeMinutes && (
                              <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">
                                ⏱️ {selectedTask.estimatedTimeMinutes} min
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              selectedTask.status === 'completed' ? 'bg-green-900 text-green-300' :
                              selectedTask.status === 'in_progress' ? 'bg-blue-900 text-blue-300' :
                              'bg-slate-700 text-slate-300'
                            }`}>
                              {selectedTask.status || 'pending'}
                            </span>
                          </div>
                        </div>
                        <button className="text-slate-400 hover:text-slate-200 p-2">
                          <span className="text-xl">⚙️</span>
                        </button>
                      </div>
                      
                      {selectedTask.description && (
                        <p className="text-slate-300 leading-relaxed">{selectedTask.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Stakeholders */}
                      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center mb-4">
                          <span className="text-xl mr-2">👥</span>
                          <h3 className="text-lg font-semibold text-violet-300">Stakeholders</h3>
                        </div>
                        {selectedTask.stakeholders && selectedTask.stakeholders.length > 0 ? (
                          <div className="space-y-2">
                            {selectedTask.stakeholders.map((stakeholder, index) => (
                              <div key={index} className="flex items-center space-x-2 p-2 bg-slate-700 rounded">
                                <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center text-xs text-white">
                                  {stakeholder[0]?.toUpperCase()}
                                </div>
                                <span className="text-slate-200">{stakeholder}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400">No stakeholders assigned</p>
                        )}
                      </div>

                      {/* Risks */}
                      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center mb-4">
                          <span className="text-xl mr-2">⚠️</span>
                          <h3 className="text-lg font-semibold text-violet-300">Risks</h3>
                        </div>
                        {selectedTask.risks && selectedTask.risks.length > 0 ? (
                          <div className="space-y-2">
                            {selectedTask.risks.map((risk, index) => (
                              <div key={index} className="p-2 bg-red-900/20 border border-red-700 rounded text-red-300 text-sm">
                                {risk}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400">No risks identified</p>
                        )}
                      </div>
                    </div>

                    {/* Live Advice */}
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <span className="text-xl mr-2">💡</span>
                        <h3 className="text-lg font-semibold text-violet-300">Live Advice</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
                          <p className="text-blue-300 text-sm">
                            <strong>Context:</strong> This task is scheduled for {new Date().toLocaleDateString()} during {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} hours.
                          </p>
                        </div>
                        <div className="p-3 bg-green-900/20 border border-green-700 rounded">
                          <p className="text-green-300 text-sm">
                            <strong>Suggestion:</strong> Consider breaking this down into smaller 25-minute focused sessions for better completion rate.
                          </p>
                        </div>
                        {selectedTask.goalAlignment && selectedTask.goalAlignment.length > 0 && (
                          <div className="p-3 bg-violet-900/20 border border-violet-700 rounded">
                            <p className="text-violet-300 text-sm">
                              <strong>Goal Alignment:</strong> This task contributes to: {selectedTask.goalAlignment.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Update History */}
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <span className="text-xl mr-2">📜</span>
                        <h3 className="text-lg font-semibold text-violet-300">Update History</h3>
                      </div>
                      {selectedTask.history && selectedTask.history.length > 0 ? (
                        <div className="space-y-2">
                          {selectedTask.history.map((entry, index) => (
                            <div key={index} className="p-3 bg-slate-700 rounded border-l-4 border-violet-500">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-slate-200 font-medium">{entry.action}</span>
                                <span className="text-slate-400 text-xs">{entry.timestamp}</span>
                              </div>
                              <p className="text-slate-300 text-sm">{entry.details}</p>
                              <span className="text-slate-400 text-xs">by {entry.user}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400">No update history available</p>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <span className="text-xl mr-2">⚡</span>
                        <h3 className="text-lg font-semibold text-violet-300">Quick Actions</h3>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <button className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors">
                          ✅ Mark Complete
                        </button>
                        <button className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                          ▶️ Start Timer
                        </button>
                        <button className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
                          🔄 Update Status
                        </button>
                        <button className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">
                          👥 Add Stakeholder
                        </button>
                        <button className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors">
                          ⚠️ Flag Risk
                        </button>
                        <button className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors">
                          📝 Add Note
                        </button>
                        <button className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-colors">
                          🔗 Link Goal
                        </button>
                        <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors">
                          📤 Share Task
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Goals & Objectives view */}
          {currentView === 'goals' && <GoalsObjectivesView />}

          {currentView === 'people' && <PeopleManagementView />}

          {currentView === 'analytics' && (
            <div className="max-w-7xl mx-auto px-4 py-6">
              {analyticsData.isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-slate-400">Loading analytics data...</div>
                </div>
              ) : analyticsData.error ? (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 mb-8">
                  <div className="text-red-300">{analyticsData.error}</div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Key Metrics Cards - Top Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Today's Focus Score */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-violet-300">Focus Score</h3>
                        <span className="text-2xl">🎯</span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-slate-100">{Math.round(analyticsData.current.focus_score)}%</div>
                        <div className="text-sm text-slate-400">Time on planned tasks</div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className="bg-violet-400 h-2 rounded-full" style={{width: `${Math.round(analyticsData.current.focus_score)}%`}}></div>
                        </div>
                      </div>
                    </div>

                    {/* Completion Rate */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-violet-300">Completion</h3>
                        <span className="text-2xl">✅</span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-slate-100">{Math.round(analyticsData.current.completion_rate)}%</div>
                        <div className="text-sm text-slate-400">Tasks completed today</div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className="bg-green-400 h-2 rounded-full" style={{width: `${Math.round(analyticsData.current.completion_rate)}%`}}></div>
                        </div>
                      </div>
                    </div>

                    {/* Proactiveness Score */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-violet-300">Proactiveness</h3>
                        <span className="text-2xl">⚡</span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-slate-100">{Math.round(analyticsData.current.proactiveness_score)}%</div>
                        <div className="text-sm text-slate-400">Blockers resolved today</div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className="bg-orange-400 h-2 rounded-full" style={{width: `${Math.round(analyticsData.current.proactiveness_score)}%`}}></div>
                        </div>
                      </div>
                    </div>

                    {/* Objective Alignment */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-violet-300">Alignment</h3>
                        <span className="text-2xl">🎯</span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-slate-100">{Math.round(analyticsData.current.alignment_score)}%</div>
                        <div className="text-sm text-slate-400">Tasks aligned to objectives</div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div className="bg-blue-400 h-2 rounded-full" style={{width: `${Math.round(analyticsData.current.alignment_score)}%`}}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Visualizations - Middle Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Weekly Completion Trend */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <h3 className="text-xl font-bold text-violet-300 mb-6">Weekly Completion Trend</h3>
                      <div className="space-y-4">
                        {analyticsData.weekly.map((dayData) => {
                          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          const dayName = dayNames[new Date(dayData.date).getDay()];
                          const completion = Math.round(dayData.completion);
                          return (
                            <div key={dayData.date} className="flex items-center space-x-4">
                              <div className="w-12 text-slate-400 text-sm">{dayName}</div>
                              <div className="flex-1 bg-slate-700 rounded-full h-3">
                                <div 
                                  className="bg-gradient-to-r from-violet-400 to-violet-500 h-3 rounded-full"
                                  style={{width: `${completion}%`}}
                                ></div>
                              </div>
                              <div className="w-12 text-slate-300 text-sm font-medium">{completion}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Apple Health-Style Calendar Heatmap */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <h3 className="text-xl font-bold text-violet-300 mb-6">Performance Heatmap</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-7 gap-2">
                          {analyticsData.calendar.map((dayData) => {
                            const intensity = dayData.completion / 100;
                            const focusScore = dayData.focus / 100;
                            const proactiveness = dayData.proactiveness / 100;
                            return (
                              <div 
                                key={dayData.date} 
                                className={`relative w-8 h-8 rounded-lg border-2 ${
                                  intensity > 0.7 ? 'bg-green-400 border-green-300' :
                                  intensity > 0.4 ? 'bg-green-600 border-green-500' :
                                  intensity > 0.2 ? 'bg-green-800 border-green-700' :
                                  'bg-slate-700 border-slate-600'
                                }`}
                              >
                                {focusScore > 0.8 && (
                                  <div className="absolute inset-1 border-2 border-violet-400 rounded-full"></div>
                                )}
                                {proactiveness > 0.7 && (
                                  <div className="absolute top-0 right-0 w-2 h-2 bg-orange-400 rounded-full"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>4 weeks ago</span>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                              <span>High completion</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 border-2 border-violet-400 rounded-full"></div>
                              <span>Good focus</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                              <span>Proactive</span>
                            </div>
                          </div>
                          <span>Today</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actionable Insights - Bottom Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Objective Progress Tracker */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <h3 className="text-xl font-bold text-violet-300 mb-6">Objective Progress</h3>
                      <div className="space-y-4">
                        {analyticsData.objectives.map((objective) => (
                          <div key={objective.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-200 font-medium">{objective.title}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                new Date(objective.target_date) < new Date(new Date().getTime() + 7*24*60*60*1000) 
                                  ? 'bg-red-900 text-red-300' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {new Date(objective.target_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  objective.progress_percentage > 80 ? 'bg-green-400' :
                                  objective.progress_percentage > 50 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{width: `${objective.progress_percentage}%`}}
                              ></div>
                            </div>
                            <div className="text-sm text-slate-400">{objective.progress_percentage}% complete</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Insights Panel */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <h3 className="text-xl font-bold text-violet-300 mb-6">AI Insights</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                          <div className="flex items-start space-x-3">
                            <span className="text-lg">🧠</span>
                            <div>
                              <h4 className="text-slate-200 font-medium">Today&apos;s Pattern</h4>
                              <p className="text-sm text-slate-400 mt-1">
                                You&apos;re 23% more productive in the mornings. Consider scheduling high-priority tasks before 11 AM.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                          <div className="flex items-start space-x-3">
                            <span className="text-lg">🚧</span>
                            <div>
                              <h4 className="text-slate-200 font-medium">Blockers Alert</h4>
                              <p className="text-sm text-slate-400 mt-1">
                                &quot;Waiting for feedback&quot; appears 3x this week. Consider setting up async check-ins.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                          <div className="flex items-start space-x-3">
                            <span className="text-lg">💡</span>
                            <div>
                              <h4 className="text-slate-200 font-medium">Optimization</h4>
                              <p className="text-sm text-slate-400 mt-1">
                                Break down large tasks into smaller 25-min chunks for better completion rate.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions Panel */}
                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                      <h3 className="text-xl font-bold text-violet-300 mb-6">Quick Actions</h3>
                      <div className="space-y-4">
                        {/* Action Buttons */}
                        <button 
                          onClick={() => changeView('standup')}
                          className="w-full bg-violet-900 text-violet-300 px-4 py-3 rounded-lg border border-violet-500 hover:bg-violet-800 font-medium transition-colors"
                        >
                          🏃‍♂️ Start Daily Standup
                        </button>

                        <button className="w-full bg-slate-700 text-slate-300 px-4 py-3 rounded-lg border border-slate-600 hover:bg-slate-600 font-medium transition-colors">
                          ⏱️ Start Focus Session
                        </button>

                        <button className="w-full bg-slate-700 text-slate-300 px-4 py-3 rounded-lg border border-slate-600 hover:bg-slate-600 font-medium transition-colors">
                          📞 Request Check-in
                        </button>

                        {/* Real-time Elements */}
                        <div className="pt-4 border-t border-slate-600 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Current Task Timer</span>
                            <span className="text-violet-300 font-mono">25:34</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Next Check-in</span>
                            <span className="text-orange-300 font-mono">2h 15m</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Focus Streak</span>
                            <span className="text-green-300 font-mono">🔥 4 days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>
      
      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {modal.type === 'success' && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                )}
                {modal.type === 'error' && (
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">✕</span>
                  </div>
                )}
                {modal.type === 'warning' && (
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">⚠</span>
                  </div>
                )}
                {modal.type === 'info' && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">i</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-200 mb-2">{modal.title}</h3>
                <p className="text-slate-300 text-sm">{modal.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Universal Floating Chat */}
      <FloatingChat 
        currentView={currentView} 
        onChecklistUpdate={handleChecklistUpdate}
      />
    </div>
  );
}