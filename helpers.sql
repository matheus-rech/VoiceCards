-- Additional helper functions for the flashcard MCP server
-- Run this after the main schema.sql

-- Function to increment session stats atomically
CREATE OR REPLACE FUNCTION increment_session_stats(
  p_session_id UUID,
  p_correct BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE study_sessions
  SET 
    cards_reviewed = cards_reviewed + 1,
    cards_correct = CASE WHEN p_correct THEN cards_correct + 1 ELSE cards_correct END
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's daily stats
CREATE OR REPLACE FUNCTION get_daily_stats(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  cards_reviewed INTEGER,
  cards_correct INTEGER,
  accuracy_percentage INTEGER,
  study_time_minutes INTEGER,
  decks_studied INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ss.cards_reviewed)::INTEGER, 0) as cards_reviewed,
    COALESCE(SUM(ss.cards_correct)::INTEGER, 0) as cards_correct,
    CASE 
      WHEN SUM(ss.cards_reviewed) > 0 
      THEN ROUND((SUM(ss.cards_correct)::FLOAT / SUM(ss.cards_reviewed)::FLOAT) * 100)::INTEGER
      ELSE 0 
    END as accuracy_percentage,
    COALESCE(
      SUM(
        EXTRACT(EPOCH FROM (COALESCE(ss.ended_at, NOW()) - ss.started_at)) / 60
      )::INTEGER, 
      0
    ) as study_time_minutes,
    COUNT(DISTINCT ss.deck_id)::INTEGER as decks_studied
  FROM study_sessions ss
  WHERE 
    ss.user_id = p_user_id 
    AND DATE(ss.started_at) = p_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's study streak
CREATE OR REPLACE FUNCTION get_study_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  streak INTEGER := 0;
  current_date DATE := CURRENT_DATE;
  has_activity BOOLEAN;
BEGIN
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM study_sessions
      WHERE user_id = p_user_id
      AND DATE(started_at) = current_date
    ) INTO has_activity;
    
    IF has_activity THEN
      streak := streak + 1;
      current_date := current_date - INTERVAL '1 day';
    ELSE
      -- Allow one day gap for today
      IF current_date = CURRENT_DATE THEN
        current_date := current_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN streak;
END;
$$ LANGUAGE plpgsql;

-- View for deck statistics
CREATE OR REPLACE VIEW deck_stats_view AS
SELECT 
  d.id as deck_id,
  d.user_id,
  d.name as deck_name,
  COUNT(DISTINCT c.id) as total_cards,
  COUNT(DISTINCT CASE 
    WHEN cr.next_review_at IS NULL OR cr.next_review_at <= NOW() 
    THEN c.id 
  END) as cards_due,
  COUNT(DISTINCT CASE 
    WHEN cr.card_id IS NULL 
    THEN c.id 
  END) as cards_new,
  COUNT(DISTINCT CASE 
    WHEN cr.interval > 0 AND cr.interval < 21 
    THEN c.id 
  END) as cards_learning,
  COUNT(DISTINCT CASE 
    WHEN cr.interval >= 21 
    THEN c.id 
  END) as cards_mastered
FROM decks d
LEFT JOIN cards c ON c.deck_id = d.id
LEFT JOIN LATERAL (
  SELECT card_id, interval, next_review_at
  FROM card_reviews
  WHERE card_id = c.id AND user_id = d.user_id
  ORDER BY created_at DESC
  LIMIT 1
) cr ON TRUE
GROUP BY d.id, d.user_id, d.name;

-- Grant access to the view
GRANT SELECT ON deck_stats_view TO authenticated;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_card_reviews_user_next_review 
  ON card_reviews(user_id, next_review_at) 
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date 
  ON study_sessions(user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_cards_deck_order 
  ON cards(deck_id, card_order);
