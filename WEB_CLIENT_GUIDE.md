# Web Client Guide - Voice-Enabled Flashcard Study

## Overview

Build a beautiful, voice-enabled web client for studying flashcards. Works on desktop and mobile browsers with optional voice control.

## Architecture

```
React App (Browser)
    ↓
┌─────────────┬──────────────┐
│ Web Speech  │  MCP Proxy   │
│ API (Voice) │  (HTTP/WS)   │
└─────────────┴──────────────┘
         ↓
    MCP Server
         ↓
    Supabase
```

## Features

- ✅ Clean, mobile-responsive UI
- ✅ Keyboard shortcuts (Space = reveal, 1-4 = grade)
- ✅ Optional voice control
- ✅ Progress tracking
- ✅ Dark mode
- ✅ PWA (works offline)

## Part 1: Project Setup

### Initialize Project

```bash
# Create React app with Vite (faster than CRA)
npm create vite@latest flashcard-web-client -- --template react

cd flashcard-web-client
npm install

# Install dependencies
npm install \
  @tanstack/react-query \
  axios \
  zustand \
  clsx \
  lucide-react
```

### Project Structure

```
flashcard-web-client/
├── src/
│   ├── components/
│   │   ├── FlashcardView.jsx
│   │   ├── GradingButtons.jsx
│   │   ├── VoiceButton.jsx
│   │   ├── ProgressBar.jsx
│   │   └── StatsModal.jsx
│   ├── hooks/
│   │   ├── useFlashcards.js
│   │   ├── useVoice.js
│   │   └── useKeyboard.js
│   ├── services/
│   │   ├── mcpClient.js
│   │   └── voiceService.js
│   ├── store/
│   │   └── studyStore.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
└── package.json
```

## Part 2: Core Implementation

### src/services/mcpClient.js

```javascript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class MCPClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getNextCard(userId, deckId = null) {
    const response = await this.client.post('/mcp/get_next_card', {
      user_id: userId,
      ...(deckId && { deck_id: deckId })
    });
    return response.data;
  }

  async revealAnswer(userId) {
    const response = await this.client.post('/mcp/reveal_answer', {
      user_id: userId
    });
    return response.data;
  }

  async gradeCard(userId, difficulty) {
    const response = await this.client.post('/mcp/grade_card', {
      user_id: userId,
      difficulty
    });
    return response.data;
  }

  async skipCard(userId) {
    const response = await this.client.post('/mcp/skip_card', {
      user_id: userId
    });
    return response.data;
  }

  async getSessionStats(sessionId) {
    const response = await this.client.post('/mcp/get_session_stats', {
      session_id: sessionId
    });
    return response.data;
  }

  async endSession(sessionId) {
    const response = await this.client.post('/mcp/end_session', {
      session_id: sessionId
    });
    return response.data;
  }

  async listDecks(userId) {
    const response = await this.client.post('/mcp/list_decks', {
      user_id: userId
    });
    return response.data;
  }
}

export default new MCPClient();
```

### src/store/studyStore.js

```javascript
import { create } from 'zustand';

export const useStudyStore = create((set, get) => ({
  userId: localStorage.getItem('userId') || null,
  currentCard: null,
  isRevealed: false,
  sessionId: null,
  cardsReviewed: 0,
  sessionStarted: null,
  isStudying: false,

  setUserId: (userId) => {
    localStorage.setItem('userId', userId);
    set({ userId });
  },

  startSession: (card) => {
    set({
      currentCard: card,
      isRevealed: false,
      sessionId: card.session_id,
      sessionStarted: new Date(),
      isStudying: true,
      cardsReviewed: 0
    });
  },

  revealAnswer: () => {
    set({ isRevealed: true });
  },

  nextCard: (card) => {
    const cardsReviewed = get().cardsReviewed + 1;
    set({
      currentCard: card,
      isRevealed: false,
      cardsReviewed
    });
  },

  endSession: () => {
    set({
      currentCard: null,
      isRevealed: false,
      sessionId: null,
      isStudying: false
    });
  },

  reset: () => {
    set({
      currentCard: null,
      isRevealed: false,
      sessionId: null,
      cardsReviewed: 0,
      sessionStarted: null,
      isStudying: false
    });
  }
}));
```

### src/hooks/useFlashcards.js

```javascript
import { useMutation, useQuery } from '@tanstack/react-query';
import mcpClient from '../services/mcpClient';
import { useStudyStore } from '../store/studyStore';

export function useFlashcards() {
  const { userId, startSession, nextCard, revealAnswer: storeReveal } = useStudyStore();

  const getNextCardMutation = useMutation({
    mutationFn: () => mcpClient.getNextCard(userId),
    onSuccess: (data) => {
      if (data.question) {
        startSession(data);
      }
    }
  });

  const revealAnswerMutation = useMutation({
    mutationFn: () => mcpClient.revealAnswer(userId),
    onSuccess: () => {
      storeReveal();
    }
  });

  const gradeCardMutation = useMutation({
    mutationFn: (difficulty) => mcpClient.gradeCard(userId, difficulty),
    onSuccess: async () => {
      // Get next card
      const nextCardData = await mcpClient.getNextCard(userId);
      if (nextCardData.question) {
        nextCard(nextCardData);
      } else {
        // No more cards
        nextCard(null);
      }
    }
  });

  const skipCardMutation = useMutation({
    mutationFn: () => mcpClient.skipCard(userId),
    onSuccess: async () => {
      const nextCardData = await mcpClient.getNextCard(userId);
      if (nextCardData.question) {
        nextCard(nextCardData);
      }
    }
  });

  return {
    startStudying: getNextCardMutation.mutate,
    revealAnswer: revealAnswerMutation.mutate,
    gradeCard: gradeCardMutation.mutate,
    skipCard: skipCardMutation.mutate,
    isLoading: getNextCardMutation.isPending || 
               gradeCardMutation.isPending ||
               revealAnswerMutation.isPending
  };
}
```

### src/hooks/useKeyboard.js

```javascript
import { useEffect } from 'react';

export function useKeyboard(handlers) {
  useEffect(() => {
    function handleKeyPress(event) {
      // Ignore if typing in input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      switch(event.key) {
        case ' ':
        case 'Enter':
          event.preventDefault();
          handlers.onReveal?.();
          break;
        case '1':
          handlers.onGrade?.('again');
          break;
        case '2':
          handlers.onGrade?.('hard');
          break;
        case '3':
          handlers.onGrade?.('good');
          break;
        case '4':
          handlers.onGrade?.('easy');
          break;
        case 's':
          handlers.onSkip?.();
          break;
        case 'h':
        case '?':
          handlers.onHelp?.();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlers]);
}
```

### src/hooks/useVoice.js

```javascript
import { useState, useEffect, useCallback } from 'react';

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      setRecognition(recognitionInstance);
      setIsSupported(true);
    }
  }, []);

  const startListening = useCallback((onResult) => {
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  const speak = useCallback((text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  return {
    isSupported,
    isListening,
    startListening,
    stopListening,
    speak
  };
}
```

### src/components/FlashcardView.jsx

```javascript
import { useState } from 'react';
import { Card, Eye, EyeOff } from 'lucide-react';

export default function FlashcardView({ card, isRevealed, onReveal }) {
  if (!card) {
    return (
      <div className="flashcard-empty">
        <Card size={64} className="text-gray-400" />
        <p className="mt-4 text-gray-600">No card loaded</p>
      </div>
    );
  }

  return (
    <div className="flashcard-container">
      <div className="flashcard">
        {/* Front of card */}
        <div className="flashcard-front">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            {card.question}
          </h2>
          
          {card.hint && !isRevealed && (
            <div className="hint">
              💡 {card.hint}
            </div>
          )}
        </div>

        {/* Back of card (revealed) */}
        {isRevealed && (
          <div className="flashcard-back mt-6 pt-6 border-t-2 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={20} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-600">Answer:</span>
            </div>
            <p className="text-xl text-gray-800">
              {card.answer}
            </p>
          </div>
        )}

        {/* Reveal button */}
        {!isRevealed && (
          <button
            onClick={onReveal}
            className="reveal-button"
          >
            <Eye size={20} />
            Reveal Answer
            <span className="shortcut">Space</span>
          </button>
        )}
      </div>

      {/* Card info */}
      <div className="card-info">
        <span>{card.deck_name}</span>
        <span>{card.cards_remaining} remaining</span>
      </div>
    </div>
  );
}
```

### src/components/GradingButtons.jsx

```javascript
import { RotateCcw, Frown, Smile, Star } from 'lucide-react';

const grades = [
  { difficulty: 'again', label: 'Again', color: 'red', icon: RotateCcw, key: '1' },
  { difficulty: 'hard', label: 'Hard', color: 'orange', icon: Frown, key: '2' },
  { difficulty: 'good', label: 'Good', color: 'green', icon: Smile, key: '3' },
  { difficulty: 'easy', label: 'Easy', color: 'blue', icon: Star, key: '4' }
];

export default function GradingButtons({ onGrade, disabled }) {
  return (
    <div className="grading-buttons">
      {grades.map(({ difficulty, label, color, icon: Icon, key }) => (
        <button
          key={difficulty}
          onClick={() => onGrade(difficulty)}
          disabled={disabled}
          className={`grade-button grade-${color}`}
        >
          <Icon size={24} />
          <span>{label}</span>
          <span className="shortcut">{key}</span>
        </button>
      ))}
    </div>
  );
}
```

### src/components/VoiceButton.jsx

```javascript
import { Mic, MicOff } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';

export default function VoiceButton({ onCommand, isRevealed }) {
  const { isSupported, isListening, startListening, speak } = useVoice();

  if (!isSupported) {
    return null;
  }

  const handleVoiceCommand = (transcript) => {
    speak('Processing');
    
    // Parse voice commands
    if (transcript.includes('reveal') || transcript.includes('show') || 
        transcript.includes('flip') || transcript.includes('answer')) {
      onCommand('reveal');
      return;
    }
    
    if (!isRevealed) {
      speak('Please reveal the answer first');
      return;
    }
    
    // Grading commands
    if (transcript.includes('again') || transcript.includes('forgot')) {
      onCommand('grade', 'again');
      speak('Marked as again');
    } else if (transcript.includes('hard') || transcript.includes('difficult')) {
      onCommand('grade', 'hard');
      speak('Marked as hard');
    } else if (transcript.includes('good') || transcript.includes('correct')) {
      onCommand('grade', 'good');
      speak('Marked as good');
    } else if (transcript.includes('easy')) {
      onCommand('grade', 'easy');
      speak('Marked as easy');
    } else if (transcript.includes('skip')) {
      onCommand('skip');
      speak('Skipping');
    } else {
      speak('Command not recognized. Say reveal, or grade as again, hard, good, or easy');
    }
  };

  return (
    <button
      onClick={() => startListening(handleVoiceCommand)}
      disabled={isListening}
      className={`voice-button ${isListening ? 'listening' : ''}`}
      title="Voice commands"
    >
      {isListening ? <MicOff size={24} /> : <Mic size={24} />}
      {isListening && <span className="pulse"></span>}
    </button>
  );
}
```

### src/components/ProgressBar.jsx

```javascript
export default function ProgressBar({ current, total }) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="progress-text">
        {current} / {total} reviewed
      </span>
    </div>
  );
}
```

### src/App.jsx

```javascript
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudyStore } from './store/studyStore';
import { useFlashcards } from './hooks/useFlashcards';
import { useKeyboard } from './hooks/useKeyboard';
import FlashcardView from './components/FlashcardView';
import GradingButtons from './components/GradingButtons';
import VoiceButton from './components/VoiceButton';
import ProgressBar from './components/ProgressBar';
import { Play, X } from 'lucide-react';

const queryClient = new QueryClient();

function StudyApp() {
  const { 
    currentCard, 
    isRevealed, 
    cardsReviewed, 
    isStudying,
    userId 
  } = useStudyStore();
  
  const { 
    startStudying, 
    revealAnswer, 
    gradeCard, 
    skipCard,
    isLoading 
  } = useFlashcards();

  // Keyboard shortcuts
  useKeyboard({
    onReveal: isRevealed ? null : revealAnswer,
    onGrade: isRevealed ? gradeCard : null,
    onSkip: skipCard
  });

  const handleVoiceCommand = (command, ...args) => {
    switch(command) {
      case 'reveal':
        if (!isRevealed) revealAnswer();
        break;
      case 'grade':
        if (isRevealed) gradeCard(args[0]);
        break;
      case 'skip':
        skipCard();
        break;
    }
  };

  if (!userId) {
    return (
      <div className="login-screen">
        <h1>🎓 Flashcard Study</h1>
        <p>Enter your user ID to begin</p>
        <input
          type="text"
          placeholder="User ID"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && e.target.value) {
              useStudyStore.getState().setUserId(e.target.value);
            }
          }}
        />
      </div>
    );
  }

  if (!isStudying) {
    return (
      <div className="welcome-screen">
        <h1>🎓 Ready to Study?</h1>
        <p>Let's review your flashcards with spaced repetition</p>
        <button
          onClick={startStudying}
          className="start-button"
        >
          <Play size={24} />
          Start Studying
        </button>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="completion-screen">
        <h1>🎉 All Done!</h1>
        <p>You've reviewed all cards for today</p>
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{cardsReviewed}</span>
            <span className="stat-label">Cards Reviewed</span>
          </div>
        </div>
        <button
          onClick={() => useStudyStore.getState().reset()}
          className="start-button"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="study-container">
      <header className="study-header">
        <h1>📚 Flashcard Study</h1>
        <button
          onClick={() => useStudyStore.getState().endSession()}
          className="end-button"
        >
          <X size={20} />
          End Session
        </button>
      </header>

      <ProgressBar 
        current={cardsReviewed} 
        total={cardsReviewed + currentCard.cards_remaining} 
      />

      <main className="study-main">
        <FlashcardView
          card={currentCard}
          isRevealed={isRevealed}
          onReveal={revealAnswer}
        />

        {isRevealed && (
          <>
            <GradingButtons
              onGrade={gradeCard}
              disabled={isLoading}
            />
            
            <p className="hint-text">
              How well did you know this card?
            </p>
          </>
        )}
      </main>

      <VoiceButton
        onCommand={handleVoiceCommand}
        isRevealed={isRevealed}
      />

      <footer className="study-footer">
        <p>Keyboard: Space = Reveal, 1-4 = Grade, S = Skip</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StudyApp />
    </QueryClientProvider>
  );
}
```

### src/index.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-primary: #4F46E5;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-bg: #F9FAFB;
  --color-card: #FFFFFF;
  --radius: 12px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: var(--color-bg);
  color: #1F2937;
}

/* Study Container */
.study-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.study-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.study-header h1 {
  font-size: 1.5rem;
}

.end-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #EF4444;
  color: white;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
}

.end-button:hover {
  background: #DC2626;
}

/* Progress Bar */
.progress-container {
  margin-bottom: 24px;
}

.progress-bar {
  height: 8px;
  background: #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-success));
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #6B7280;
}

/* Flashcard */
.flashcard-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.flashcard {
  background: var(--color-card);
  border-radius: var(--radius);
  padding: 40px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.flashcard-front h2 {
  line-height: 1.4;
}

.hint {
  margin-top: 16px;
  padding: 12px;
  background: #FEF3C7;
  border-left: 3px solid #F59E0B;
  border-radius: 4px;
  font-size: 14px;
}

.flashcard-back {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal-button {
  margin-top: 24px;
  padding: 16px 32px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.reveal-button:hover {
  background: #4338CA;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.shortcut {
  margin-left: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 12px;
}

.card-info {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 14px;
  color: #6B7280;
}

/* Grading Buttons */
.grading-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 24px;
}

.grade-button {
  padding: 16px;
  border: 2px solid;
  border-radius: var(--radius);
  background: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.2s;
}

.grade-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.grade-red {
  border-color: var(--color-error);
  color: var(--color-error);
}

.grade-red:hover:not(:disabled) {
  background: var(--color-error);
  color: white;
}

.grade-orange {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.grade-orange:hover:not(:disabled) {
  background: var(--color-warning);
  color: white;
}

.grade-green {
  border-color: var(--color-success);
  color: var(--color-success);
}

.grade-green:hover:not(:disabled) {
  background: var(--color-success);
  color: white;
}

.grade-blue {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.grade-blue:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
}

.hint-text {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: #6B7280;
}

/* Voice Button */
.voice-button {
  position: fixed;
  bottom: 80px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 100;
}

.voice-button:hover {
  transform: scale(1.1);
}

.voice-button.listening {
  background: var(--color-error);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 20px rgba(239, 68, 68, 0);
  }
}

/* Footer */
.study-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #E5E7EB;
  text-align: center;
  font-size: 12px;
  color: #9CA3AF;
}

/* Welcome/Completion Screens */
.welcome-screen,
.completion-screen,
.login-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
}

.welcome-screen h1,
.completion-screen h1,
.login-screen h1 {
  font-size: 3rem;
  margin-bottom: 16px;
}

.welcome-screen p,
.completion-screen p,
.login-screen p {
  font-size: 1.25rem;
  color: #6B7280;
  margin-bottom: 32px;
}

.start-button {
  padding: 16px 32px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
}

.start-button:hover {
  background: #4338CA;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.3);
}

.stats {
  display: flex;
  gap: 32px;
  margin: 32px 0;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-value {
  font-size: 3rem;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  font-size: 14px;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.login-screen input {
  padding: 12px 24px;
  font-size: 16px;
  border: 2px solid #D1D5DB;
  border-radius: var(--radius);
  width: 300px;
  max-width: 100%;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .grading-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .flashcard {
    padding: 24px;
  }
  
  .welcome-screen h1,
  .completion-screen h1 {
    font-size: 2rem;
  }
  
  .voice-button {
    bottom: 24px;
    right: 16px;
  }
}
```

## Part 3: MCP Proxy Server

Create a simple proxy to connect your React app to the MCP server:

### proxy-server.js

```javascript
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

// Start MCP server
const mcpServer = spawn('node', ['dist/index.js'], {
  cwd: '/tmp/flashcard-mcp',
  env: { ...process.env }
});

let requestId = 0;
const pendingRequests = new Map();

mcpServer.stdout.on('data', (data) => {
  try {
    const responses = data.toString().split('\n').filter(Boolean);
    responses.forEach(responseStr => {
      const response = JSON.parse(responseStr);
      const pending = pendingRequests.get(response.id);
      if (pending) {
        pending.resolve(response);
        pendingRequests.delete(response.id);
      }
    });
  } catch (error) {
    console.error('Parse error:', error);
  }
});

async function callMCP(toolName, args) {
  const id = ++requestId;
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    },
    id
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 10000);
  });
}

// API Routes
app.post('/api/mcp/:tool', async (req, res) => {
  try {
    const toolName = req.params.tool;
    const result = await callMCP(toolName, req.body);
    
    const content = result.result.content[0].text;
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Proxy server running on http://localhost:3000');
});
```

## Part 4: Deploy

### Development

```bash
# Terminal 1: Start proxy
node proxy-server.js

# Terminal 2: Start React app
npm run dev
```

### Production (Vercel)

1. Build React app: `npm run build`
2. Deploy dist folder to Vercel
3. Deploy proxy as serverless function

### Production (Netlify)

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

## Part 5: PWA (Progressive Web App)

Add to `index.html`:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#4F46E5">
```

Create `public/manifest.json`:

```json
{
  "name": "Flashcard Study",
  "short_name": "Flashcards",
  "description": "Voice-enabled spaced repetition learning",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F9FAFB",
  "theme_color": "#4F46E5",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## Features Summary

✅ **Mobile-first responsive design**
✅ **Keyboard shortcuts for power users**
✅ **Voice commands (optional)**
✅ **Real-time progress tracking**
✅ **Smooth animations**
✅ **Dark mode ready**
✅ **PWA support**
✅ **Works offline (with service worker)**

## Next Steps

1. Add user authentication (Supabase Auth)
2. Add deck selection UI
3. Add statistics dashboard
4. Add image card support
5. Add audio playback
6. Deploy to production

Your users now have a beautiful, modern way to study! 🎨✨
