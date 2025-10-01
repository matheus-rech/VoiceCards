import { CardService } from '../services/card-service.js';
import { DeckService } from '../services/deck-service.js';
import { SRSService } from '../services/srs-service.js';

/**
 * MCP Tool definitions for flashcard system
 * These tools are exposed to AI agents for voice-controlled flashcard review
 */

export const flashcardTools = [
  {
    name: "get_next_card",
    description: "Get the next flashcard due for review. This starts or continues a study session. Returns the front of the card (question) and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user studying"
        },
        deck_id: {
          type: "string",
          description: "Optional: Specific deck to study. If not provided, reviews cards from all decks."
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "reveal_answer",
    description: "Reveal the answer (back) of the current flashcard. Must be called after get_next_card and before grading.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user studying"
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "grade_card",
    description: "Grade the current flashcard based on how well the user knew it. This uses spaced repetition to schedule the next review. Must be called after reveal_answer.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user studying"
        },
        difficulty: {
          type: "string",
          enum: ["again", "hard", "good", "easy"],
          description: "How difficult the card was: 'again' (forgot/wrong), 'hard' (difficult but correct), 'good' (correct with normal effort), 'easy' (too easy)"
        }
      },
      required: ["user_id", "difficulty"]
    }
  },
  {
    name: "skip_card",
    description: "Skip the current card without grading. Useful if the user wants to come back to it later.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user studying"
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "list_decks",
    description: "List all flashcard decks for a user with basic metadata.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user"
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "get_deck_stats",
    description: "Get statistics for a specific deck: total cards, cards due today, new cards, learning cards, mastered cards.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user"
        },
        deck_id: {
          type: "string",
          description: "The ID of the deck"
        }
      },
      required: ["user_id", "deck_id"]
    }
  },
  {
    name: "get_session_stats",
    description: "Get statistics for the current study session: cards reviewed, accuracy, time spent.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The ID of the study session"
        }
      },
      required: ["session_id"]
    }
  },
  {
    name: "end_session",
    description: "End the current study session and get final statistics.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The ID of the study session"
        }
      },
      required: ["session_id"]
    }
  },
  {
    name: "create_deck",
    description: "Create a new flashcard deck.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user"
        },
        name: {
          type: "string",
          description: "Name of the deck"
        },
        description: {
          type: "string",
          description: "Optional description of the deck"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for categorization"
        }
      },
      required: ["user_id", "name"]
    }
  },
  {
    name: "import_cards",
    description: "Import flashcards from text format. Each line should be: front|back|hint (hint is optional)",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The ID of the user"
        },
        deck_name: {
          type: "string",
          description: "Name for the new deck"
        },
        cards_text: {
          type: "string",
          description: "Cards in format: front|back|hint (one per line)"
        }
      },
      required: ["user_id", "deck_name", "cards_text"]
    }
  }
];

/**
 * Handler for MCP tool calls
 */
export async function handleToolCall(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case "get_next_card": {
        const result = await CardService.getNextCard(args.user_id, args.deck_id);
        if (!result) {
          return {
            content: [{
              type: "text",
              text: "No cards due for review. Great job! 🎉"
            }]
          };
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              question: result.card.front,
              hint: result.card.hint,
              deck_name: result.deck_name,
              cards_remaining: result.cards_remaining,
              session_id: result.session_id,
              image_url: result.card.image_url
            }, null, 2)
          }]
        };
      }

      case "reveal_answer": {
        const result = await CardService.revealAnswer(args.user_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              answer: result.answer,
              hint: result.hint
            }, null, 2)
          }]
        };
      }

      case "grade_card": {
        const difficulty = SRSService.parseDifficulty(args.difficulty);
        const result = await CardService.gradeCard(args.user_id, difficulty);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "skip_card": {
        const result = await CardService.skipCard(args.user_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "list_decks": {
        const decks = await DeckService.getUserDecks(args.user_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(decks.map(d => ({
              id: d.id,
              name: d.name,
              description: d.description,
              tags: d.tags
            })), null, 2)
          }]
        };
      }

      case "get_deck_stats": {
        const stats = await DeckService.getDeckStats(args.deck_id, args.user_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(stats, null, 2)
          }]
        };
      }

      case "get_session_stats": {
        const stats = await DeckService.getSessionStats(args.session_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(stats, null, 2)
          }]
        };
      }

      case "end_session": {
        const stats = await DeckService.endSession(args.session_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(stats, null, 2)
          }]
        };
      }

      case "create_deck": {
        const deck = await DeckService.createDeck(
          args.user_id,
          args.name,
          args.description,
          args.tags
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(deck, null, 2)
          }]
        };
      }

      case "import_cards": {
        const result = await DeckService.importCardsFromText(
          args.user_id,
          args.deck_name,
          args.cards_text
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              deck_id: result.deck.id,
              deck_name: result.deck.name,
              cards_imported: result.cards_imported
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error.message
        })
      }],
      isError: true
    };
  }
}
