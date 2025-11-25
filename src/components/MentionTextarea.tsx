import React, { useState, useRef, useEffect } from 'react';

interface Person {
  id: string;
  name: string;
  email?: string;
  slack_id?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  people?: Person[];
}

const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
  people = []
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [suggestionPosition, setSuggestionPosition] = useState({ x: 0, y: 0 });

  // Calculate suggestion position based on cursor
  const updateSuggestionPosition = () => {
    if (!textareaRef.current) return;
    
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines.length - 1;
    
    // Approximate position
    const x = 10; // Simple offset from left
    const y = (currentLine * 24) + 30; // Line height approximation
    
    setSuggestionPosition({ x, y });
  };

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursor);
    
    // Find @ mentions
    const textBeforeCursor = newValue.substring(0, cursor);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.substring(1).toLowerCase();
      const filtered = people.filter(person => 
        person.name.toLowerCase().includes(query) ||
        (person.email && person.email.toLowerCase().includes(query))
      );
      
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setSelectedIndex(0);
        setShowSuggestions(true);
        setMentionStart(cursor - lastWord.length);
        updateSuggestionPosition();
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex]);
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Insert selected mention
  const selectSuggestion = (person: Person) => {
    if (!textareaRef.current) return;
    
    const beforeMention = value.substring(0, mentionStart);
    const afterCursor = value.substring(cursorPosition);
    const mentionText = `@${person.name}`;
    const newValue = beforeMention + mentionText + afterCursor;
    const newCursorPos = mentionStart + mentionText.length;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart || 0)}
        placeholder={placeholder}
        className={`w-full ${className || ''}`}
        rows={rows}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
          style={{
            left: `${suggestionPosition.x}px`,
            top: `${suggestionPosition.y + 30}px`, // Position below current line
            minWidth: '200px'
          }}
        >
          {suggestions.map((person, index) => (
            <div
              key={person.id}
              className={`px-3 py-2 cursor-pointer flex items-center space-x-2 ${
                index === selectedIndex 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => selectSuggestion(person)}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                {person.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-medium">{person.name}</div>
                {person.email && (
                  <div className="text-xs opacity-75">{person.email}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Show helper text when @ is typed */}
      {value.endsWith('@') && people.length > 0 && (
        <div className="absolute bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 px-3 py-2 text-sm text-slate-300"
             style={{ left: `${x}px`, top: `${y + 30}px` }}>
          Start typing to mention someone...
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;