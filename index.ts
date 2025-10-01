// Type definitions for flashcard MCP server

export interface User {
  id: string;
  email: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  tags?: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  front_audio_url?: string;
  back_audio_url?: string;
  image_url?: string;
  hint?: string;
  tags?: string[];
  card_order?: number;
  created_at: string;
  updated_at: string;
}

export interface CardReview {
  id: string;
  card_id: string;
  user_id: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  quality: number; // 0-5 scale
  review_time?: number;
  session_id?: string;
  last_reviewed_at: string;
  next_review_at?: string;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  deck_id?: string;
  started_at: string;
  ended_at?: string;
  cards_reviewed: number;
  cards_correct: number;
  total_review_time: number;
  voice_enabled: boolean;
  client_type?: string;
}

export interface UserCardState {
  user_id: string;
  deck_id?: string;
  current_card_id?: string;
  session_id?: string;
  answer_revealed: boolean;
  started_at: string;
  updated_at: string;
}

export interface DueCard extends Card {
  last_ease_factor: number;
  last_interval: number;
  last_repetitions: number;
  next_review_at?: string;
}

// MCP Tool response types
export interface CardResponse {
  card: Card;
  deck_name: string;
  cards_remaining: number;
  session_id: string;
  answer_revealed: boolean;
}

export interface GradeResult {
  success: boolean;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  message: string;
}

export interface SessionStats {
  session_id: string;
  deck_name: string;
  cards_reviewed: number;
  cards_correct: number;
  accuracy_percentage: number;
  average_review_time_seconds: number;
  duration_minutes: number;
}

// Grade difficulty levels
export enum Difficulty {
  AGAIN = 0,      // Forgot, show again soon
  HARD = 2,       // Difficult, but remembered
  GOOD = 3,       // Correct with normal effort
  EASY = 5        // Too easy, longer interval
}

// SRS algorithm parameters
export interface SRSParams {
  ease_factor: number;
  interval: number;
  repetitions: number;
}

export interface SRSResult {
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_at: Date;
}
