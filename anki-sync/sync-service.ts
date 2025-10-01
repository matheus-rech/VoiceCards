/**
 * Synchronization Service for Anki <-> VoiceCards
 * Handles bi-directional sync with conflict resolution
 */

import { AnkiConnectClient } from './anki-connect-client.js';
import { createClient } from '@supabase/supabase-js';
import { Card, CardReview, Deck } from '../types/index.js';

export interface SyncConfig {
  supabaseUrl: string;
  supabaseKey: string;
  ankiConnectUrl?: string;
  syncInterval?: number; // Minutes between auto-sync
  conflictStrategy?: 'newest' | 'anki' | 'voicecards' | 'manual';
}

export interface SyncResult {
  success: boolean;
  imported: {
    decks: number;
    cards: number;
    reviews: number;
  };
  exported: {
    cards: number;
    reviews: number;
  };
  conflicts: Array<{
    type: 'card' | 'review';
    id: string;
    reason: string;
    resolution?: string;
  }>;
  errors: string[];
  timestamp: string;
}

export interface CardMapping {
  id: string;
  voicecard_id: string;
  anki_note_id: number;
  anki_card_id: number;
  deck_id: string;
  last_synced: string;
  sync_enabled: boolean;
}

export class AnkiSyncService {
  private anki: AnkiConnectClient;
  private supabase: any;
  private config: SyncConfig;
  private syncTimer?: NodeJS.Timer;

  constructor(config: SyncConfig) {
    this.config = config;
    this.anki = new AnkiConnectClient(config.ankiConnectUrl);
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Initialize sync service and create necessary tables
   */
  async initialize(): Promise<void> {
    // Check Anki connection
    const isConnected = await this.anki.checkConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Anki. Make sure Anki is running with AnkiConnect installed.');
    }

    // Request permissions
    await this.anki.requestPermission();

    // Create sync mapping table if it doesn't exist
    await this.createSyncTables();

    // Start auto-sync if configured
    if (this.config.syncInterval) {
      this.startAutoSync(this.config.syncInterval);
    }
  }

  /**
   * Create tables for tracking sync mappings
   */
  private async createSyncTables(): Promise<void> {
    const { error } = await this.supabase.rpc('create_anki_sync_tables', {
      sql: `
        -- Table to track Anki <-> VoiceCards mappings
        CREATE TABLE IF NOT EXISTS anki_card_mappings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          voicecard_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          anki_note_id BIGINT NOT NULL,
          anki_card_id BIGINT NOT NULL,
          deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
          last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          sync_enabled BOOLEAN DEFAULT TRUE,

          UNIQUE(voicecard_id),
          UNIQUE(anki_card_id)
        );

        -- Table to track sync history
        CREATE TABLE IF NOT EXISTS anki_sync_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sync_type TEXT NOT NULL, -- 'import', 'export', 'bidirectional'
          sync_result JSONB NOT NULL,
          started_at TIMESTAMP WITH TIME ZONE NOT NULL,
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          success BOOLEAN NOT NULL
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_anki_mappings_voicecard ON anki_card_mappings(voicecard_id);
        CREATE INDEX IF NOT EXISTS idx_anki_mappings_anki ON anki_card_mappings(anki_card_id);
        CREATE INDEX IF NOT EXISTS idx_anki_sync_history_user ON anki_sync_history(user_id, completed_at DESC);
      `
    });

    if (error) {
      console.error('Error creating sync tables:', error);
    }
  }

  /**
   * Import a complete deck from Anki
   */
  async importDeckFromAnki(
    userId: string,
    ankiDeckName: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      imported: { decks: 0, cards: 0, reviews: 0 },
      exported: { cards: 0, reviews: 0 },
      conflicts: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Import deck from Anki
      const ankiData = await this.anki.importDeck(ankiDeckName);

      // Check if deck already exists
      const { data: existingDeck } = await this.supabase
        .from('decks')
        .select('id')
        .eq('user_id', userId)
        .eq('name', ankiDeckName)
        .single();

      let deckId: string;

      if (existingDeck) {
        deckId = existingDeck.id;
        // Update existing deck
        await this.supabase
          .from('decks')
          .update({
            description: ankiData.deck.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', deckId);
      } else {
        // Create new deck
        const { data: newDeck, error } = await this.supabase
          .from('decks')
          .insert({
            ...ankiData.deck,
            user_id: userId
          })
          .select()
          .single();

        if (error) throw error;
        deckId = newDeck.id;
        result.imported.decks = 1;
      }

      // Import cards
      for (const card of ankiData.cards) {
        // Check if card already exists (by front text)
        const { data: existingCard } = await this.supabase
          .from('cards')
          .select('id')
          .eq('deck_id', deckId)
          .eq('front', card.front)
          .single();

        if (existingCard) {
          // Update existing card
          await this.supabase
            .from('cards')
            .update({
              back: card.back,
              hint: card.hint,
              tags: card.tags,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCard.id);

          result.conflicts.push({
            type: 'card',
            id: existingCard.id,
            reason: 'Card already exists',
            resolution: 'Updated with Anki data'
          });
        } else {
          // Create new card
          const { data: newCard, error } = await this.supabase
            .from('cards')
            .insert({
              ...card,
              deck_id: deckId
            })
            .select()
            .single();

          if (error) throw error;
          result.imported.cards++;

          // Create mapping
          await this.supabase
            .from('anki_card_mappings')
            .insert({
              voicecard_id: newCard.id,
              anki_note_id: 0, // Will be set on first sync back
              anki_card_id: 0, // Will be set on first sync back
              deck_id: deckId
            });
        }
      }

      // Import reviews (SRS data)
      for (const review of ankiData.reviews) {
        if (review.card_id) {
          const { error } = await this.supabase
            .from('card_reviews')
            .insert({
              ...review,
              user_id: userId
            });

          if (!error) {
            result.imported.reviews++;
          }
        }
      }

      result.success = true;

    } catch (error: any) {
      result.errors.push(error.message);
    }

    // Save sync history
    await this.saveSyncHistory(userId, 'import', result);

    return result;
  }

  /**
   * Export VoiceCards progress to Anki
   */
  async exportProgressToAnki(
    userId: string,
    deckId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      imported: { decks: 0, cards: 0, reviews: 0 },
      exported: { cards: 0, reviews: 0 },
      conflicts: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Get deck info
      const { data: deck } = await this.supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single();

      if (!deck) throw new Error('Deck not found');

      // Get all cards with their mappings
      const { data: cards } = await this.supabase
        .from('cards')
        .select(`
          *,
          anki_card_mappings (
            anki_card_id,
            anki_note_id
          )
        `)
        .eq('deck_id', deckId);

      // Get recent reviews
      const { data: reviews } = await this.supabase
        .from('card_reviews')
        .select('*')
        .eq('user_id', userId)
        .in('card_id', cards.map((c: any) => c.id))
        .order('created_at', { ascending: false });

      // Group reviews by card (get most recent for each)
      const latestReviews = new Map<string, any>();
      for (const review of reviews) {
        if (!latestReviews.has(review.card_id)) {
          latestReviews.set(review.card_id, review);
        }
      }

      // Export each card's progress
      for (const card of cards) {
        const review = latestReviews.get(card.id);
        if (!review) continue;

        if (card.anki_card_mappings?.[0]?.anki_card_id) {
          // Card has Anki mapping - update it
          try {
            await this.anki.exportProgress(
              [{
                voiceCardId: card.id,
                ankiCardId: card.anki_card_mappings[0].anki_card_id
              }],
              [review]
            );
            result.exported.reviews++;
          } catch (error: any) {
            result.conflicts.push({
              type: 'review',
              id: review.id,
              reason: `Failed to export: ${error.message}`
            });
          }
        } else {
          // No mapping - create new card in Anki
          try {
            const ankiCardId = await this.anki.addCard(
              deck.name,
              card.front,
              card.back,
              card.tags || []
            );

            // Save mapping
            await this.supabase
              .from('anki_card_mappings')
              .insert({
                voicecard_id: card.id,
                anki_note_id: ankiCardId,
                anki_card_id: ankiCardId,
                deck_id: deckId
              });

            result.exported.cards++;
          } catch (error: any) {
            result.errors.push(`Failed to create card in Anki: ${error.message}`);
          }
        }
      }

      result.success = true;

    } catch (error: any) {
      result.errors.push(error.message);
    }

    // Save sync history
    await this.saveSyncHistory(userId, 'export', result);

    return result;
  }

  /**
   * Perform bi-directional sync
   */
  async syncBidirectional(
    userId: string,
    deckId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      imported: { decks: 0, cards: 0, reviews: 0 },
      exported: { cards: 0, reviews: 0 },
      conflicts: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Get deck info
      const { data: deck } = await this.supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single();

      if (!deck) throw new Error('Deck not found');

      // Get mappings
      const { data: mappings } = await this.supabase
        .from('anki_card_mappings')
        .select('*')
        .eq('deck_id', deckId)
        .eq('sync_enabled', true);

      // Get VoiceCards reviews
      const { data: voiceReviews } = await this.supabase
        .from('card_reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Sync with Anki
      const syncResult = await this.anki.syncProgress(
        deck.name,
        voiceReviews,
        mappings.map((m: CardMapping) => ({
          voiceCardId: m.voicecard_id,
          ankiCardId: m.anki_card_id
        }))
      );

      result.imported.reviews = syncResult.imported;
      result.exported.reviews = syncResult.exported;
      result.conflicts = syncResult.conflicts.map(c => ({
        type: 'review' as const,
        id: c.cardId,
        reason: c.reason
      }));

      // Update last sync time
      for (const mapping of mappings) {
        await this.supabase
          .from('anki_card_mappings')
          .update({ last_synced: new Date().toISOString() })
          .eq('id', mapping.id);
      }

      result.success = true;

    } catch (error: any) {
      result.errors.push(error.message);
    }

    // Save sync history
    await this.saveSyncHistory(userId, 'bidirectional', result);

    return result;
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(intervalMinutes: number): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      // Get all users with Anki sync enabled
      const { data: users } = await this.supabase
        .from('user_settings')
        .select('user_id, anki_sync_deck_id')
        .eq('anki_sync_enabled', true);

      for (const user of users || []) {
        if (user.anki_sync_deck_id) {
          await this.syncBidirectional(user.user_id, user.anki_sync_deck_id);
        }
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Save sync history
   */
  private async saveSyncHistory(
    userId: string,
    syncType: 'import' | 'export' | 'bidirectional',
    result: SyncResult
  ): Promise<void> {
    await this.supabase
      .from('anki_sync_history')
      .insert({
        user_id: userId,
        sync_type: syncType,
        sync_result: result,
        started_at: new Date(Date.now() - 60000).toISOString(), // Approximate
        completed_at: result.timestamp,
        success: result.success
      });
  }

  /**
   * Get sync history for a user
   */
  async getSyncHistory(
    userId: string,
    limit: number = 10
  ): Promise<any[]> {
    const { data } = await this.supabase
      .from('anki_sync_history')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(
    cardId: string,
    resolution: 'use_anki' | 'use_voicecards' | 'merge'
  ): Promise<void> {
    // Implementation depends on conflict type
    // This is a placeholder for conflict resolution logic
    switch (resolution) {
      case 'use_anki':
        // Overwrite VoiceCards data with Anki data
        break;
      case 'use_voicecards':
        // Overwrite Anki data with VoiceCards data
        break;
      case 'merge':
        // Merge data from both sources
        break;
    }
  }
}