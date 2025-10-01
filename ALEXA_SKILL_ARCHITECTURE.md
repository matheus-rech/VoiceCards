# Alexa Skill Architecture Guide

## Overview

Build an Alexa Skill that lets users study flashcards completely hands-free. Users can say "Alexa, open Flashcard Tutor" and start reviewing.

## Architecture

```
User → Alexa Device
    ↓ (voice)
Amazon Alexa Service
    ↓ (JSON request)
AWS Lambda Function
    ↓ (MCP protocol OR HTTP API)
Your MCP Server
    ↓ (database queries)
Supabase
```

## Prerequisites

- Amazon Developer Account (free)
- AWS Account (Lambda has free tier)
- Your MCP server running (or accessible via API)
- Completed Supabase setup

## Part 1: Skill Architecture

### Interaction Model

```
Invocation: "Alexa, open Flashcard Tutor"
           "Alexa, ask Flashcard Tutor to start studying"

Intents:
├── StartStudyIntent: "start studying", "begin", "let's study"
├── RevealAnswerIntent: "reveal", "show answer", "flip card"
├── GradeCardIntent: "again", "hard", "good", "easy"
├── SkipCardIntent: "skip", "next card"
├── StatsIntent: "how am I doing", "show stats"
├── EndSessionIntent: "stop", "finish", "end session"
├── AMAZON.HelpIntent: Built-in help
├── AMAZON.CancelIntent: Built-in cancel
└── AMAZON.StopIntent: Built-in stop
```

### Session State Management

```javascript
{
  sessionId: "uuid",
  userId: "alexa-user-id-mapped-to-your-user",
  currentCard: {
    id: "card-uuid",
    question: "What is photosynthesis?",
    revealed: false
  },
  cardsReviewed: 12,
  sessionStarted: "2025-09-29T10:00:00Z"
}
```

## Part 2: Create Alexa Skill

### Step 1: Create Skill in Developer Console

1. Go to https://developer.amazon.com/alexa/console/ask
2. Click "Create Skill"
3. Configure:
   - **Skill name**: Flashcard Tutor
   - **Primary locale**: English (US)
   - **Model**: Custom
   - **Hosting**: Provision your own
   - **Backend**: AWS Lambda

### Step 2: Define Interaction Model

Go to "Build" tab → "Interaction Model" → "JSON Editor"

Paste this interaction model:

```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "flashcard tutor",
      "intents": [
        {
          "name": "StartStudyIntent",
          "slots": [
            {
              "name": "DeckName",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "start studying",
            "begin",
            "let's study",
            "start",
            "review cards",
            "quiz me",
            "study {DeckName}",
            "review {DeckName} deck"
          ]
        },
        {
          "name": "RevealAnswerIntent",
          "slots": [],
          "samples": [
            "reveal",
            "show answer",
            "flip card",
            "what is it",
            "tell me",
            "show me"
          ]
        },
        {
          "name": "GradeCardIntent",
          "slots": [
            {
              "name": "Difficulty",
              "type": "DifficultyType"
            }
          ],
          "samples": [
            "{Difficulty}",
            "grade as {Difficulty}",
            "that was {Difficulty}",
            "mark it {Difficulty}"
          ]
        },
        {
          "name": "SkipCardIntent",
          "slots": [],
          "samples": [
            "skip",
            "skip this card",
            "next card",
            "pass",
            "skip this one"
          ]
        },
        {
          "name": "StatsIntent",
          "slots": [],
          "samples": [
            "how am I doing",
            "show stats",
            "my progress",
            "session stats",
            "how many cards"
          ]
        },
        {
          "name": "EndSessionIntent",
          "slots": [],
          "samples": [
            "finish",
            "end session",
            "done studying",
            "that's all"
          ]
        },
        {
          "name": "AMAZON.HelpIntent",
          "samples": []
        },
        {
          "name": "AMAZON.CancelIntent",
          "samples": []
        },
        {
          "name": "AMAZON.StopIntent",
          "samples": []
        },
        {
          "name": "AMAZON.NavigateHomeIntent",
          "samples": []
        }
      ],
      "types": [
        {
          "name": "DifficultyType",
          "values": [
            {
              "name": {
                "value": "again"
              },
              "id": "AGAIN"
            },
            {
              "name": {
                "value": "hard"
              },
              "id": "HARD"
            },
            {
              "name": {
                "value": "good"
              },
              "id": "GOOD"
            },
            {
              "name": {
                "value": "easy"
              },
              "id": "EASY"
            }
          ]
        }
      ]
    }
  }
}
```

Click "Save Model" → "Build Model"

## Part 3: Create Lambda Function

### Step 1: Set Up Lambda

Create file structure:
```
alexa-flashcard-skill/
├── index.js          # Main handler
├── mcpClient.js      # MCP client
├── package.json
└── utils.js          # Helper functions
```

### package.json

```json
{
  "name": "alexa-flashcard-skill",
  "version": "1.0.0",
  "dependencies": {
    "ask-sdk-core": "^2.13.0",
    "ask-sdk-model": "^1.44.0",
    "axios": "^1.6.0"
  }
}
```

### mcpClient.js

```javascript
// MCP Client for Lambda
const axios = require('axios');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;

class MCPClient {
  static async callTool(toolName, args) {
    try {
      const response = await axios.post(MCP_SERVER_URL, {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now()
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return JSON.parse(response.data.result.content[0].text);
    } catch (error) {
      console.error('MCP call failed:', error);
      throw error;
    }
  }

  static async getNextCard(userId, deckId = null) {
    return this.callTool('get_next_card', { 
      user_id: userId,
      ...(deckId && { deck_id: deckId })
    });
  }

  static async revealAnswer(userId) {
    return this.callTool('reveal_answer', { user_id: userId });
  }

  static async gradeCard(userId, difficulty) {
    return this.callTool('grade_card', { 
      user_id: userId, 
      difficulty 
    });
  }

  static async skipCard(userId) {
    return this.callTool('skip_card', { user_id: userId });
  }

  static async getSessionStats(sessionId) {
    return this.callTool('get_session_stats', { session_id: sessionId });
  }

  static async endSession(sessionId) {
    return this.callTool('end_session', { session_id: sessionId });
  }

  static async listDecks(userId) {
    return this.callTool('list_decks', { user_id: userId });
  }
}

module.exports = MCPClient;
```

### utils.js

```javascript
// Helper utilities
function getUserId(handlerInput) {
  // Map Alexa user ID to your internal user ID
  // In production, this would query your user database
  const alexaUserId = handlerInput.requestEnvelope.session.user.userId;
  
  // For now, use a mapping or create user on first use
  // You'd typically have a DynamoDB table: alexaUserId -> internalUserId
  return process.env.DEFAULT_USER_ID || alexaUserId;
}

function getSessionAttribute(handlerInput, key) {
  const attributes = handlerInput.attributesManager.getSessionAttributes();
  return attributes[key];
}

function setSessionAttribute(handlerInput, key, value) {
  const attributes = handlerInput.attributesManager.getSessionAttributes();
  attributes[key] = value;
  handlerInput.attributesManager.setSessionAttributes(attributes);
}

function buildSpeechResponse(handlerInput, speechText, repromptText = null, shouldEndSession = false) {
  const responseBuilder = handlerInput.responseBuilder;
  
  responseBuilder.speak(speechText);
  
  if (repromptText) {
    responseBuilder.reprompt(repromptText);
  }
  
  if (shouldEndSession) {
    responseBuilder.withShouldEndSession(true);
  }
  
  return responseBuilder.getResponse();
}

module.exports = {
  getUserId,
  getSessionAttribute,
  setSessionAttribute,
  buildSpeechResponse
};
```

### index.js

```javascript
const Alexa = require('ask-sdk-core');
const MCPClient = require('./mcpClient');
const { getUserId, getSessionAttribute, setSessionAttribute, buildSpeechResponse } = require('./utils');

// Launch Request Handler
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speakOutput = 'Welcome to Flashcard Tutor! Ready to study? Say "start studying" to begin, or "help" for more options.';
    const repromptText = 'Say "start studying" to begin reviewing your flashcards.';
    
    return buildSpeechResponse(handlerInput, speakOutput, repromptText);
  }
};

// Start Study Intent
const StartStudyIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StartStudyIntent';
  },
  async handle(handlerInput) {
    const userId = getUserId(handlerInput);
    
    try {
      const cardData = await MCPClient.getNextCard(userId);
      
      if (!cardData || !cardData.question) {
        return buildSpeechResponse(
          handlerInput,
          'Great news! You have no cards due for review right now. Check back later!',
          null,
          true
        );
      }

      // Save state
      setSessionAttribute(handlerInput, 'sessionId', cardData.session_id);
      setSessionAttribute(handlerInput, 'currentCard', cardData);
      setSessionAttribute(handlerInput, 'cardsReviewed', 0);
      
      let speakOutput = `Let's study! Here's your first question: ${cardData.question}.`;
      
      if (cardData.hint) {
        speakOutput += ` Here's a hint: ${cardData.hint}.`;
      }
      
      speakOutput += ' Take your time. Say "reveal" when you\'re ready for the answer.';
      
      const repromptText = 'Say "reveal" to see the answer, or "skip" to skip this card.';
      
      return buildSpeechResponse(handlerInput, speakOutput, repromptText);
      
    } catch (error) {
      console.error('Error starting study:', error);
      return buildSpeechResponse(
        handlerInput,
        'Sorry, I had trouble loading your flashcards. Please try again later.',
        null,
        true
      );
    }
  }
};

// Reveal Answer Intent
const RevealAnswerIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RevealAnswerIntent';
  },
  async handle(handlerInput) {
    const userId = getUserId(handlerInput);
    const currentCard = getSessionAttribute(handlerInput, 'currentCard');
    
    if (!currentCard) {
      return buildSpeechResponse(
        handlerInput,
        'You don\'t have an active card. Say "start studying" to begin.',
        'Say "start studying" to begin reviewing.'
      );
    }
    
    try {
      const answerData = await MCPClient.revealAnswer(userId);
      
      // Update card state
      currentCard.revealed = true;
      setSessionAttribute(handlerInput, 'currentCard', currentCard);
      
      const speakOutput = `The answer is: ${answerData.answer}. How did you do? Say "again" if you forgot, "hard" if it was difficult, "good" if you got it right, or "easy" if it was too easy.`;
      const repromptText = 'Say "again", "hard", "good", or "easy" to grade this card.';
      
      return buildSpeechResponse(handlerInput, speakOutput, repromptText);
      
    } catch (error) {
      console.error('Error revealing answer:', error);
      return buildSpeechResponse(
        handlerInput,
        'Sorry, I had trouble revealing the answer. Please try again.',
        'Say "reveal" to try again.'
      );
    }
  }
};

// Grade Card Intent
const GradeCardIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GradeCardIntent';
  },
  async handle(handlerInput) {
    const userId = getUserId(handlerInput);
    const currentCard = getSessionAttribute(handlerInput, 'currentCard');
    
    if (!currentCard || !currentCard.revealed) {
      return buildSpeechResponse(
        handlerInput,
        'Please reveal the answer first by saying "reveal".',
        'Say "reveal" to see the answer.'
      );
    }
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const difficulty = slots.Difficulty?.value?.toLowerCase() || 'good';
    
    try {
      const gradeResult = await MCPClient.gradeCard(userId, difficulty);
      
      // Update stats
      let cardsReviewed = getSessionAttribute(handlerInput, 'cardsReviewed') || 0;
      cardsReviewed++;
      setSessionAttribute(handlerInput, 'cardsReviewed', cardsReviewed);
      
      // Get next card
      const nextCard = await MCPClient.getNextCard(userId);
      
      let speakOutput = '';
      
      // Acknowledge grading
      switch(difficulty) {
        case 'again':
          speakOutput = 'No worries, you\'ll see this again soon. ';
          break;
        case 'hard':
          speakOutput = 'Good job working through that! ';
          break;
        case 'good':
          speakOutput = 'Nice work! ';
          break;
        case 'easy':
          speakOutput = 'Excellent! You\'ve mastered this one. ';
          break;
      }
      
      // Provide encouragement every 5 cards
      if (cardsReviewed % 5 === 0) {
        speakOutput += `You've reviewed ${cardsReviewed} cards so far. Great job! `;
      }
      
      // Next card or end
      if (nextCard && nextCard.question) {
        setSessionAttribute(handlerInput, 'currentCard', nextCard);
        
        speakOutput += `Next question: ${nextCard.question}.`;
        if (nextCard.hint) {
          speakOutput += ` Hint: ${nextCard.hint}.`;
        }
        speakOutput += ' Say "reveal" when ready.';
        
        return buildSpeechResponse(handlerInput, speakOutput, 'Say "reveal" for the answer.');
        
      } else {
        speakOutput += `Awesome! You've completed all your cards for now. You reviewed ${cardsReviewed} cards today. Keep up the great work!`;
        
        return buildSpeechResponse(handlerInput, speakOutput, null, true);
      }
      
    } catch (error) {
      console.error('Error grading card:', error);
      return buildSpeechResponse(
        handlerInput,
        'Sorry, I had trouble saving your grade. Please try again.',
        'Say "again", "hard", "good", or "easy".'
      );
    }
  }
};

// Skip Card Intent
const SkipCardIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SkipCardIntent';
  },
  async handle(handlerInput) {
    const userId = getUserId(handlerInput);
    
    try {
      await MCPClient.skipCard(userId);
      const nextCard = await MCPClient.getNextCard(userId);
      
      if (nextCard && nextCard.question) {
        setSessionAttribute(handlerInput, 'currentCard', nextCard);
        
        let speakOutput = `Skipping. Next question: ${nextCard.question}.`;
        if (nextCard.hint) {
          speakOutput += ` Hint: ${nextCard.hint}.`;
        }
        
        return buildSpeechResponse(handlerInput, speakOutput, 'Say "reveal" for the answer.');
        
      } else {
        return buildSpeechResponse(
          handlerInput,
          'No more cards for now. Great work today!',
          null,
          true
        );
      }
      
    } catch (error) {
      console.error('Error skipping card:', error);
      return buildSpeechResponse(
        handlerInput,
        'Sorry, I had trouble skipping that card.',
        'Say "skip" to try again.'
      );
    }
  }
};

// Stats Intent
const StatsIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StatsIntent';
  },
  async handle(handlerInput) {
    const sessionId = getSessionAttribute(handlerInput, 'sessionId');
    
    if (!sessionId) {
      return buildSpeechResponse(
        handlerInput,
        'You haven\'t started studying yet. Say "start studying" to begin.',
        'Say "start studying" to begin.'
      );
    }
    
    try {
      const stats = await MCPClient.getSessionStats(sessionId);
      
      const speakOutput = `So far in this session, you've reviewed ${stats.cards_reviewed} cards with ${stats.accuracy_percentage}% accuracy. Keep going!`;
      
      return buildSpeechResponse(handlerInput, speakOutput, 'Say "next card" to continue.');
      
    } catch (error) {
      const cardsReviewed = getSessionAttribute(handlerInput, 'cardsReviewed') || 0;
      const speakOutput = `You've reviewed ${cardsReviewed} cards so far this session.`;
      
      return buildSpeechResponse(handlerInput, speakOutput);
    }
  }
};

// End Session Intent
const EndSessionIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'EndSessionIntent';
  },
  async handle(handlerInput) {
    const sessionId = getSessionAttribute(handlerInput, 'sessionId');
    const cardsReviewed = getSessionAttribute(handlerInput, 'cardsReviewed') || 0;
    
    if (sessionId) {
      try {
        const stats = await MCPClient.endSession(sessionId);
        
        const speakOutput = `Great study session! You reviewed ${stats.cards_reviewed} cards with ${stats.accuracy_percentage}% accuracy in ${stats.duration_minutes} minutes. See you next time!`;
        
        return buildSpeechResponse(handlerInput, speakOutput, null, true);
        
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }
    
    const speakOutput = `Thanks for studying! You reviewed ${cardsReviewed} cards. Keep up the good work!`;
    return buildSpeechResponse(handlerInput, speakOutput, null, true);
  }
};

// Help Intent
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speakOutput = 'Flashcard Tutor helps you study using spaced repetition. Say "start studying" to begin. During a card, say "reveal" to see the answer, then grade it as "again", "hard", "good", or "easy". You can also say "skip", "stats", or "stop" anytime. What would you like to do?';
    
    return buildSpeechResponse(handlerInput, speakOutput, 'Say "start studying" to begin.');
  }
};

// Cancel and Stop Intents
const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return EndSessionIntentHandler.handle(handlerInput);
  }
};

// Session End Handler
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended: ${JSON.stringify(handlerInput.requestEnvelope.request.reason)}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

// Error Handler
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error(`Error handled: ${error.message}`);
    console.error(error.stack);
    
    const speakOutput = 'Sorry, I had trouble processing that. Please try again.';
    
    return buildSpeechResponse(handlerInput, speakOutput, speakOutput);
  }
};

// Export Lambda handler
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    StartStudyIntentHandler,
    RevealAnswerIntentHandler,
    GradeCardIntentHandler,
    SkipCardIntentHandler,
    StatsIntentHandler,
    EndSessionIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
```

## Part 4: Deploy Lambda Function

### Option 1: AWS CLI Deployment

```bash
# Install dependencies
cd alexa-flashcard-skill
npm install

# Package
zip -r function.zip .

# Create Lambda function
aws lambda create-function \
  --function-name alexa-flashcard-skill \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --environment Variables="{MCP_SERVER_URL=https://your-mcp-server.com,DEFAULT_USER_ID=your-test-user-id}"

# Get ARN
aws lambda get-function --function-name alexa-flashcard-skill
```

### Option 2: AWS Console Deployment

1. Go to AWS Lambda Console
2. Create function
3. Runtime: Node.js 18.x
4. Upload zip file
5. Add environment variables:
   - `MCP_SERVER_URL`
   - `DEFAULT_USER_ID`
6. Copy function ARN

### Configure Alexa Skill Endpoint

1. Go back to Alexa Developer Console
2. "Build" tab → "Endpoint"
3. Select "AWS Lambda ARN"
4. Paste your Lambda ARN
5. Save

## Part 5: Testing

### Test in Alexa Simulator

1. Go to "Test" tab in Alexa Developer Console
2. Enable testing
3. Type or say:
   - "Open flashcard tutor"
   - "Start studying"
   - "Reveal"
   - "Good"
   - "Next card"

### Test on Physical Device

1. Go to Alexa app on your phone
2. Find "Flashcard Tutor" in dev skills
3. Enable it
4. Say: "Alexa, open flashcard tutor"

## Part 6: Publishing (Optional)

### Certification Requirements

1. **Privacy Policy**: Required if you collect data
2. **Testing Instructions**: How Amazon should test
3. **Icons**: 108x108 and 512x512 PNG
4. **Description**: What your skill does
5. **Example Phrases**: 3 ways to invoke

### Submit for Certification

1. Complete all fields in "Distribution" tab
2. Fill privacy/compliance section
3. Click "Submit for Review"
4. Wait 3-7 days for approval

## Advanced Features

### User Account Linking

Link Alexa users to your auth system:

```javascript
// Check if user is linked
const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;

if (!accessToken) {
  return handlerInput.responseBuilder
    .speak('Please link your account in the Alexa app.')
    .withLinkAccountCard()
    .getResponse();
}

// Use access token to get user from your API
const user = await getUserByToken(accessToken);
```

### Persistent Attributes (DynamoDB)

Store user progress across sessions:

```javascript
const Alexa = require('ask-sdk-core');
const persistenceAdapter = require('ask-sdk-dynamodb-persistence-adapter');

const skillBuilder = Alexa.SkillBuilders.custom()
  .withPersistenceAdapter(
    new persistenceAdapter.DynamoDbPersistenceAdapter({
      tableName: 'FlashcardSkillUsers',
      createTable: true
    })
  );

// Save data
const attributes = await handlerInput.attributesManager.getPersistentAttributes();
attributes.lastStudyDate = new Date().toISOString();
handlerInput.attributesManager.setPersistentAttributes(attributes);
await handlerInput.attributesManager.savePersistentAttributes();
```

### APL (Visual Cards)

For Echo Show devices:

```javascript
if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
  handlerInput.responseBuilder.addDirective({
    type: 'Alexa.Presentation.APL.RenderDocument',
    document: {
      type: 'APL',
      version: '1.8',
      mainTemplate: {
        items: [{
          type: 'Text',
          text: cardData.question,
          fontSize: '50dp'
        }]
      }
    }
  });
}
```

## Troubleshooting

**"There was a problem with the requested skill's response":**
- Check Lambda logs in CloudWatch
- Verify MCP server is accessible from Lambda
- Check timeout settings (increase if needed)

**Skill not responding:**
- Verify Lambda ARN in skill configuration
- Check Lambda permissions (Alexa must be able to invoke)
- Test Lambda directly in AWS console

**MCP calls failing:**
- Ensure MCP_SERVER_URL is correct
- Check VPC settings if MCP server is private
- Verify SSL certificates

## Cost Estimate

- **Alexa Skill**: Free
- **Lambda**: Free tier = 1M requests/month
- **Typical usage**: ~0.001¢ per interaction
- **1000 daily users**: ~$1-2/month

## Next Steps

1. ✅ Deploy Lambda with your MCP server URL
2. ✅ Test in Alexa simulator
3. ✅ Test on your Echo device
4. Add account linking
5. Submit for certification
6. Launch! 🚀

Your users can now study hands-free while cooking, driving, or working out! 🎓
