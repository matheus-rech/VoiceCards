-- Flashcard MCP Database Schema
-- This schema supports spaced repetition learning with voice control

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (integrates with Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decks table
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[], -- For categorization
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Cards table
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL, -- Question/prompt
  back TEXT NOT NULL, -- Answer
  front_audio_url TEXT, -- Optional pre-recorded audio
  back_audio_url TEXT,
  image_url TEXT, -- Optional image
  hint TEXT, -- Optional hint
  tags TEXT[], -- For filtering
  card_order INTEGER, -- Order within deck
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Card reviews table (for SRS algorithm)
-- Based on SM-2 algorithm (Anki's default)
CREATE TABLE card_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- SRS state
  ease_factor FLOAT DEFAULT 2.5, -- Multiplier for interval (1.3 to 2.5+)
  interval INTEGER DEFAULT 0, -- Days until next review
  repetitions INTEGER DEFAULT 0, -- Number of successful reviews in a row
  
  -- Review metadata
  quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 5), -- 0=again, 3=good, 5=easy
  review_time INTEGER, -- Milliseconds taken to answer
  session_id UUID, -- Links to study session
  
  -- Next review calculation
  last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_review_at TIMESTAMP WITH TIME ZONE, -- When card should be shown next
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study sessions table
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
  
  -- Session metadata
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  cards_reviewed INTEGER DEFAULT 0,
  cards_correct INTEGER DEFAULT 0, -- Quality >= 3
  total_review_time INTEGER DEFAULT 0, -- Milliseconds
  
  -- Voice session specific
  voice_enabled BOOLEAN DEFAULT FALSE,
  client_type TEXT -- 'web', 'alexa', 'google_home', 'mobile'
);

-- Current card state (per user, for active sessions)
-- This tracks what card the user is currently viewing
CREATE TABLE user_card_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
  current_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  answer_revealed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_card_reviews_card_id ON card_reviews(card_id);
CREATE INDEX idx_card_reviews_user_id ON card_reviews(user_id);
CREATE INDEX idx_card_reviews_next_review ON card_reviews(user_id, next_review_at);
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_decks_user_id ON decks(user_id);

-- Function to get cards due for review
CREATE OR REPLACE FUNCTION get_due_cards(p_user_id UUID, p_deck_id UUID DEFAULT NULL)
RETURNS TABLE (
  card_id UUID,
  front TEXT,
  back TEXT,
  hint TEXT,
  image_url TEXT,
  last_ease_factor FLOAT,
  last_interval INTEGER,
  last_repetitions INTEGER,
  next_review_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.front,
    c.back,
    c.hint,
    c.image_url,
    COALESCE(cr.ease_factor, 2.5),
    COALESCE(cr.interval, 0),
    COALESCE(cr.repetitions, 0),
    cr.next_review_at
  FROM cards c
  LEFT JOIN LATERAL (
    SELECT ease_factor, interval, repetitions, next_review_at
    FROM card_reviews
    WHERE card_id = c.id AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1
  ) cr ON TRUE
  WHERE 
    c.deck_id = COALESCE(p_deck_id, c.deck_id)
    AND (cr.next_review_at IS NULL OR cr.next_review_at <= NOW())
  ORDER BY 
    cr.next_review_at NULLS FIRST,
    c.card_order,
    c.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_card_state_updated_at BEFORE UPDATE ON user_card_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_card_state ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Decks: users can see their own decks and public decks
CREATE POLICY "Users can view own decks" ON decks FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can create own decks" ON decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON decks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON decks FOR DELETE USING (auth.uid() = user_id);

-- Cards: users can see cards from decks they have access to
CREATE POLICY "Users can view accessible cards" ON cards FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM decks WHERE decks.id = cards.deck_id 
    AND (decks.user_id = auth.uid() OR decks.is_public = true)
  ));

CREATE POLICY "Users can manage cards in own decks" ON cards FOR ALL
  USING (EXISTS (
    SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid()
  ));

-- Reviews: users can only see their own reviews
CREATE POLICY "Users can view own reviews" ON card_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reviews" ON card_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sessions: users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- User card state: users can only see their own state
CREATE POLICY "Users can view own state" ON user_card_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own state" ON user_card_state FOR ALL USING (auth.uid() = user_id);
