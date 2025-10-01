import { getDatabase } from '../database/client.js';
import { Card, DueCard, UserCardState, CardResponse, GradeResult, Difficulty } from '../types/index.js';
import { SRSService } from './srs-service.js';

export class CardService {
  /**
   * Get the next card due for review for a user
   */
  public static async getNextCard(userId: string, deckId?: string): Promise<CardResponse | null> {
    const db = getDatabase();

    // Get current state
    const { data: state } = await db
      .from('user_card_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If user has a current card that hasn't been graded, return it
    if (state?.current_card_id && !state.answer_revealed) {
      const { data: card } = await db
        .from('cards')
        .select('*, decks!inner(name)')
        .eq('id', state.current_card_id)
        .single();

      if (card) {
        const cardsRemaining = await this.getCardsRemainingCount(userId, deckId);
        return {
          card: card as any,
          deck_name: (card as any).decks.name,
          cards_remaining: cardsRemaining,
          session_id: state.session_id || '',
          answer_revealed: false
        };
      }
    }

    // Get next due card using the database function
    const { data: dueCards, error } = await db
      .rpc('get_due_cards', {
        p_user_id: userId,
        p_deck_id: deckId || null
      });

    if (error || !dueCards || dueCards.length === 0) {
      return null; // No cards due
    }

    const nextCard = dueCards[0] as DueCard;

    // Get deck name
    const { data: deck } = await db
      .from('decks')
      .select('name')
      .eq('id', nextCard.deck_id)
      .single();

    // Get or create session
    const sessionId = state?.session_id || await this.createSession(userId, deckId);

    // Update user state
    await db
      .from('user_card_state')
      .upsert({
        user_id: userId,
        deck_id: deckId || nextCard.deck_id,
        current_card_id: nextCard.id,
        session_id: sessionId,
        answer_revealed: false,
        updated_at: new Date().toISOString()
      });

    const cardsRemaining = await this.getCardsRemainingCount(userId, deckId);

    return {
      card: nextCard,
      deck_name: deck?.name || 'Unknown Deck',
      cards_remaining: cardsRemaining,
      session_id: sessionId,
      answer_revealed: false
    };
  }

  /**
   * Reveal the answer for the current card
   */
  public static async revealAnswer(userId: string): Promise<{ success: boolean; answer: string; hint?: string }> {
    const db = getDatabase();

    const { data: state } = await db
      .from('user_card_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!state || !state.current_card_id) {
      throw new Error('No active card to reveal');
    }

    if (state.answer_revealed) {
      throw new Error('Answer already revealed');
    }

    // Get the card
    const { data: card } = await db
      .from('cards')
      .select('back, hint')
      .eq('id', state.current_card_id)
      .single();

    if (!card) {
      throw new Error('Card not found');
    }

    // Update state
    await db
      .from('user_card_state')
      .update({ 
        answer_revealed: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return {
      success: true,
      answer: card.back,
      hint: card.hint
    };
  }

  /**
   * Grade the current card and move to next
   */
  public static async gradeCard(userId: string, difficulty: Difficulty): Promise<GradeResult> {
    const db = getDatabase();

    const { data: state } = await db
      .from('user_card_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!state || !state.current_card_id) {
      throw new Error('No active card to grade');
    }

    if (!state.answer_revealed) {
      throw new Error('Must reveal answer before grading');
    }

    // Get previous review data for this card
    const { data: lastReview } = await db
      .from('card_reviews')
      .select('ease_factor, interval, repetitions')
      .eq('card_id', state.current_card_id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate next review using SRS algorithm
    const srsParams = lastReview || SRSService.getDefaultParams();
    const srsResult = SRSService.calculateNextReview(srsParams, difficulty);

    // Create review record
    const { error: reviewError } = await db
      .from('card_reviews')
      .insert({
        card_id: state.current_card_id,
        user_id: userId,
        ease_factor: srsResult.ease_factor,
        interval: srsResult.interval,
        repetitions: srsResult.repetitions,
        quality: difficulty,
        session_id: state.session_id,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: srsResult.next_review_at.toISOString()
      });

    if (reviewError) {
      throw new Error(`Failed to save review: ${reviewError.message}`);
    }

    // Update session stats
    if (state.session_id) {
      await this.updateSessionStats(state.session_id, difficulty >= Difficulty.GOOD);
    }

    // Clear current card state
    await db
      .from('user_card_state')
      .update({ 
        current_card_id: null,
        answer_revealed: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return {
      success: true,
      next_review_at: srsResult.next_review_at.toISOString(),
      interval_days: srsResult.interval,
      ease_factor: srsResult.ease_factor,
      message: `Card will be reviewed again in ${SRSService.getReviewTimingDescription(srsResult.interval)}`
    };
  }

  /**
   * Skip the current card without grading
   */
  public static async skipCard(userId: string): Promise<{ success: boolean }> {
    const db = getDatabase();

    await db
      .from('user_card_state')
      .update({ 
        current_card_id: null,
        answer_revealed: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return { success: true };
  }

  /**
   * Get count of cards remaining in current session
   */
  private static async getCardsRemainingCount(userId: string, deckId?: string): Promise<number> {
    const db = getDatabase();

    const { data, error } = await db
      .rpc('get_due_cards', {
        p_user_id: userId,
        p_deck_id: deckId || null
      });

    if (error || !data) return 0;
    return data.length;
  }

  /**
   * Create a new study session
   */
  private static async createSession(userId: string, deckId?: string): Promise<string> {
    const db = getDatabase();

    const { data, error } = await db
      .from('study_sessions')
      .insert({
        user_id: userId,
        deck_id: deckId,
        voice_enabled: true,
        client_type: 'mcp'
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error('Failed to create session');
    }

    return data.id;
  }

  /**
   * Update session statistics
   */
  private static async updateSessionStats(sessionId: string, correct: boolean): Promise<void> {
    const db = getDatabase();

    await db.rpc('increment_session_stats', {
      p_session_id: sessionId,
      p_correct: correct
    }).catch(() => {
      // Fallback to manual update if RPC doesn't exist
      db.from('study_sessions')
        .update({ 
          cards_reviewed: db.raw('cards_reviewed + 1'),
          cards_correct: correct ? db.raw('cards_correct + 1') : db.raw('cards_correct')
        })
        .eq('id', sessionId);
    });
  }
}
