import { SRSParams, SRSResult, Difficulty } from '../types/index.js';

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on Anki's implementation of the SuperMemo 2 algorithm
 * 
 * Quality ratings:
 * 0 - Complete blackout (AGAIN)
 * 2 - Incorrect response but remembered (HARD)
 * 3 - Correct response with serious difficulty (GOOD)
 * 5 - Perfect response (EASY)
 */

export class SRSService {
  // Minimum ease factor to prevent cards from becoming too difficult
  private static readonly MIN_EASE_FACTOR = 1.3;
  
  // Default starting ease factor
  private static readonly DEFAULT_EASE_FACTOR = 2.5;

  // Initial intervals for new cards (in days)
  private static readonly INITIAL_INTERVALS = {
    [Difficulty.AGAIN]: 0, // Show again in current session (minutes in practice)
    [Difficulty.HARD]: 1,   // 1 day
    [Difficulty.GOOD]: 1,   // 1 day
    [Difficulty.EASY]: 4    // 4 days
  };

  // Ease factor adjustments based on quality
  private static readonly EASE_ADJUSTMENTS = {
    [Difficulty.AGAIN]: -0.2,
    [Difficulty.HARD]: -0.15,
    [Difficulty.GOOD]: 0,
    [Difficulty.EASY]: 0.15
  };

  /**
   * Calculate next review parameters based on quality rating
   */
  public static calculateNextReview(
    params: SRSParams,
    quality: Difficulty
  ): SRSResult {
    let { ease_factor, interval, repetitions } = params;

    // If quality is AGAIN (0), reset the card
    if (quality === Difficulty.AGAIN) {
      return {
        ease_factor: Math.max(
          SRSService.MIN_EASE_FACTOR,
          ease_factor + SRSService.EASE_ADJUSTMENTS[quality]
        ),
        interval: 0, // Show again soon (in practice: 10 minutes)
        repetitions: 0,
        next_review_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      };
    }

    // First review of a new card
    if (repetitions === 0) {
      interval = SRSService.INITIAL_INTERVALS[quality];
      repetitions = 1;
    } 
    // Second review
    else if (repetitions === 1) {
      if (quality === Difficulty.HARD) {
        interval = 1; // Keep at 1 day if hard
      } else if (quality === Difficulty.GOOD) {
        interval = 6; // 6 days if good
      } else if (quality === Difficulty.EASY) {
        interval = 10; // 10 days if easy
      }
      repetitions = 2;
    }
    // Subsequent reviews - use the ease factor
    else {
      if (quality === Difficulty.HARD) {
        interval = Math.round(interval * 1.2); // Increase by 20%
      } else if (quality === Difficulty.GOOD) {
        interval = Math.round(interval * ease_factor);
      } else if (quality === Difficulty.EASY) {
        interval = Math.round(interval * ease_factor * 1.3); // Extra boost for easy
      }
      repetitions += 1;
    }

    // Adjust ease factor based on quality
    ease_factor += SRSService.EASE_ADJUSTMENTS[quality];
    ease_factor = Math.max(SRSService.MIN_EASE_FACTOR, ease_factor);

    // Calculate next review date
    const next_review_at = new Date();
    next_review_at.setDate(next_review_at.getDate() + interval);

    return {
      ease_factor,
      interval,
      repetitions,
      next_review_at
    };
  }

  /**
   * Get default SRS parameters for a new card
   */
  public static getDefaultParams(): SRSParams {
    return {
      ease_factor: SRSService.DEFAULT_EASE_FACTOR,
      interval: 0,
      repetitions: 0
    };
  }

  /**
   * Convert text difficulty to numeric value
   */
  public static parseDifficulty(difficulty: string): Difficulty {
    const normalized = difficulty.toLowerCase().trim();
    
    switch (normalized) {
      case 'again':
      case 'forgot':
      case 'fail':
      case 'wrong':
        return Difficulty.AGAIN;
      
      case 'hard':
      case 'difficult':
        return Difficulty.HARD;
      
      case 'good':
      case 'correct':
      case 'ok':
      case 'okay':
        return Difficulty.GOOD;
      
      case 'easy':
      case 'simple':
      case 'perfect':
        return Difficulty.EASY;
      
      default:
        return Difficulty.GOOD; // Default to GOOD if unclear
    }
  }

  /**
   * Get human-readable description of next review timing
   */
  public static getReviewTimingDescription(interval: number): string {
    if (interval === 0) {
      return "10 minutes";
    } else if (interval === 1) {
      return "1 day";
    } else if (interval < 30) {
      return `${interval} days`;
    } else if (interval < 365) {
      const months = Math.round(interval / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.round(interval / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  }
}
