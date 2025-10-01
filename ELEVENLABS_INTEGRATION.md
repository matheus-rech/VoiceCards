# ElevenLabs Integration Guide

## Overview

ElevenLabs Conversational AI can directly use your MCP server to enable natural voice-controlled flashcard study. Users can talk to their AI tutor hands-free!

## Architecture

```
User (speaking)
    ↓ (voice)
ElevenLabs WebSocket
    ↓ (audio + transcription)
ElevenLabs Agent
    ↓ (MCP protocol)
Your MCP Server
    ↓ (database queries)
Supabase
```

## Option 1: ElevenLabs Conversational AI (Recommended - Easiest)

### Prerequisites
- ElevenLabs account (has free tier)
- Your MCP server running and accessible
- Your Supabase setup complete

### Step 1: Create Conversational Agent

1. Go to https://elevenlabs.io/app/conversational-ai
2. Click "Create new agent"
3. Configure basic settings:
   - **Name**: Flashcard Study Buddy
   - **Voice**: Choose a friendly voice (e.g., "Rachel", "Josh")
   - **Language**: English (or your preference)

### Step 2: Configure Agent Prompt

In the "System Prompt" section, paste this:

```
You are a friendly and encouraging study assistant helping users review flashcards using spaced repetition. Your goal is to make learning enjoyable and effective, even when users are multitasking (driving, cooking, exercising).

PERSONALITY:
- Warm, patient, and enthusiastic
- Celebrate progress frequently
- Keep explanations clear and concise
- Natural conversational tone (not robotic)
- Adapt to user's energy level

STUDY SESSION FLOW:

1. GREETING & START
   User says: "Let's study" / "Start reviewing" / "Begin session"
   You: Greet warmly, then call get_next_card

2. PRESENT CARD
   - Read the question clearly and at moderate pace
   - If there's a hint, mention it naturally: "Here's a hint: [hint]"
   - Wait for user to think (don't rush)
   - Listen for: "reveal" / "show" / "answer" / "flip card"

3. REVEAL ANSWER
   - Call reveal_answer tool
   - Read the answer clearly
   - Ask: "How did you do?" or "Was that easy for you?"
   - Listen for difficulty rating

4. GRADE CARD
   User will say one of:
   - "again" / "forgot" / "wrong" → Grade as 'again'
   - "hard" / "difficult" → Grade as 'hard'  
   - "good" / "correct" / "got it" → Grade as 'good'
   - "easy" / "too easy" / "simple" → Grade as 'easy'
   
   Call grade_card with appropriate difficulty.
   
   Acknowledge based on difficulty:
   - Again: "No worries, we'll review this again soon"
   - Hard: "Good job working through that!"
   - Good: "Nice work!"
   - Easy: "Excellent! You've really mastered this one"

5. CONTINUE OR FINISH
   - Automatically get next card with get_next_card
   - If no more cards: Celebrate completion!
   - Every 5-10 cards, give encouragement: "You're doing great! [X] cards reviewed"
   - Listen for: "stop" / "pause" / "end session" → Call end_session

VOICE COMMANDS YOU UNDERSTAND:
Starting: "study" / "review" / "practice" / "quiz me"
Revealing: "reveal" / "show" / "flip" / "answer" / "what is it"
Grading: "again" / "hard" / "good" / "easy" (and natural variations)
Skipping: "skip" / "next" / "pass"
Ending: "stop" / "finish" / "done" / "end session"
Help: "help" / "what can I say"

IMPORTANT RULES:
- NEVER read JSON or technical output to the user
- Extract the actual question/answer text from tool responses
- Keep responses conversational, not mechanical
- If user struggles, offer encouragement
- If session is long (20+ cards), suggest a break
- Handle interruptions gracefully
- If user asks for stats, use get_session_stats tool

EXAMPLE DIALOGUE:
User: "Let's study"
You: "Great! Let's review some cards. Here's your first question: What is photosynthesis? Take your time thinking about it."
User: "Um, show me the answer"
You: "The answer is: The process by which plants convert light into chemical energy using chlorophyll. How did you do?"
User: "Good"
You: "Nice work! You'll see this card again in 6 days. Next question: What is the capital of France?"
User: "Paris"
You: "Correct! Let me reveal it officially. [calls reveal_answer] Yes, Paris! Was that easy for you?"
User: "Easy"
You: "Excellent! You've really mastered this one. It'll come back in 10 days. Keep it up!"

You have access to these MCP tools - use them naturally during conversation:
- get_next_card(user_id, deck_id?) - Get next card due
- reveal_answer(user_id) - Show answer
- grade_card(user_id, difficulty) - Grade: "again"/"hard"/"good"/"easy"
- skip_card(user_id) - Skip current card
- get_session_stats(session_id) - Get session stats
- end_session(session_id) - End session and get final stats
- list_decks(user_id) - List available decks
- get_deck_stats(user_id, deck_id) - Deck statistics

Remember: Make learning fun and accessible, even when hands are busy! 🎓
```

### Step 3: Connect MCP Server

**Option A: If your MCP server is publicly accessible:**

1. In agent settings, find "Tools" or "Functions" section
2. Add "Custom MCP Server"
3. Enter your server endpoint: `https://your-server.com/mcp`

**Option B: Using ElevenLabs Convai Widget (Easier for Testing):**

Create a simple proxy server:

```javascript
// elevenlabs-proxy.js
import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Start MCP server as child process
const mcpServer = spawn('node', ['dist/index.js'], {
  cwd: '/tmp/flashcard-mcp',
  env: { ...process.env }
});

// Proxy MCP requests
app.post('/mcp/*', async (req, res) => {
  // Forward to MCP server via stdio
  const request = JSON.stringify(req.body) + '\n';
  mcpServer.stdin.write(request);
  
  // Wait for response
  mcpServer.stdout.once('data', (data) => {
    res.json(JSON.parse(data.toString()));
  });
});

app.listen(3000, () => {
  console.log('ElevenLabs proxy running on port 3000');
});
```

### Step 4: Test the Agent

1. In ElevenLabs dashboard, click "Test Agent"
2. Click microphone icon
3. Say: "Let's study"
4. Follow the conversation flow
5. Test commands: reveal, grade as good, etc.

### Step 5: Deploy Widget to Your Website

```html
<!DOCTYPE html>
<html>
<head>
  <title>Voice Flashcard Study</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
    }
    #convai-widget {
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <h1>🎓 Voice Flashcard Study</h1>
  <p>Click the microphone and say "Let's study" to begin!</p>
  
  <!-- ElevenLabs Convai Widget -->
  <div id="convai-widget"></div>

  <script src="https://elevenlabs.io/convai/widget.js"></script>
  <script>
    // Initialize ElevenLabs widget
    window.ElevenLabsConvai.init({
      agentId: 'YOUR_AGENT_ID_HERE', // Get from ElevenLabs dashboard
      containerId: 'convai-widget',
      
      // Pass user context (you'd get this from your auth system)
      context: {
        user_id: 'USER_ID_FROM_YOUR_AUTH'
      },
      
      // Styling
      theme: {
        primaryColor: '#4F46E5',
        backgroundColor: '#FFFFFF'
      }
    });
  </script>
</body>
</html>
```

## Option 2: ElevenLabs WebSocket API (Advanced - Full Control)

For custom integrations where you want complete control:

### Client-Side Implementation

```javascript
// flashcard-elevenlabs-client.js
import WebSocket from 'ws';
import { spawn } from 'child_process';

class FlashcardVoiceClient {
  constructor(apiKey, userId) {
    this.apiKey = apiKey;
    this.userId = userId;
    this.ws = null;
    this.mcpServer = null;
  }

  // Start MCP server
  startMCPServer() {
    this.mcpServer = spawn('node', ['dist/index.js'], {
      cwd: '/tmp/flashcard-mcp',
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'inherit']
    });
    
    this.mcpServer.stdout.on('data', this.handleMCPResponse.bind(this));
  }

  // Connect to ElevenLabs
  async connect(agentId) {
    const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    this.ws.on('open', () => {
      console.log('Connected to ElevenLabs');
      
      // Send initial context
      this.ws.send(JSON.stringify({
        type: 'conversation_initiation',
        conversation_config_override: {
          agent: {
            prompt: {
              tools: this.getMCPTools()
            }
          }
        },
        custom_llm_extra_body: {
          user_id: this.userId
        }
      }));
    });

    this.ws.on('message', this.handleMessage.bind(this));
    this.ws.on('error', console.error);
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'audio':
        // Play audio response
        this.playAudio(message.audio_event.audio_base_64);
        break;
        
      case 'interruption':
        // Handle user interruption
        console.log('User interrupted');
        break;
        
      case 'tool_call':
        // Execute MCP tool
        this.executeMCPTool(message.tool_call);
        break;
    }
  }

  executeMCPTool(toolCall) {
    // Forward to MCP server
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolCall.name,
        arguments: toolCall.arguments
      },
      id: toolCall.id
    };
    
    this.mcpServer.stdin.write(JSON.stringify(request) + '\n');
  }

  handleMCPResponse(data) {
    const response = JSON.parse(data.toString());
    
    // Send result back to ElevenLabs
    this.ws.send(JSON.stringify({
      type: 'tool_response',
      tool_call_id: response.id,
      output: response.result
    }));
  }

  sendAudio(audioBuffer) {
    // Send user's audio to ElevenLabs
    this.ws.send(JSON.stringify({
      type: 'audio',
      audio_event: {
        audio_base_64: audioBuffer.toString('base64')
      }
    }));
  }

  playAudio(base64Audio) {
    // Implement audio playback (browser: Audio API, Node: speaker library)
    const audio = Buffer.from(base64Audio, 'base64');
    // ... play audio
  }

  getMCPTools() {
    return [
      {
        name: 'get_next_card',
        description: 'Get the next flashcard due for review',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            deck_id: { type: 'string' }
          },
          required: ['user_id']
        }
      },
      {
        name: 'reveal_answer',
        description: 'Reveal the answer to current card',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' }
          },
          required: ['user_id']
        }
      },
      {
        name: 'grade_card',
        description: 'Grade the current card',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            difficulty: { 
              type: 'string',
              enum: ['again', 'hard', 'good', 'easy']
            }
          },
          required: ['user_id', 'difficulty']
        }
      }
      // ... other tools
    ];
  }
}

// Usage
const client = new FlashcardVoiceClient(
  'YOUR_ELEVENLABS_API_KEY',
  'YOUR_USER_ID'
);

client.startMCPServer();
await client.connect('YOUR_AGENT_ID');

// Now capture microphone input and send to client.sendAudio()
```

### Browser Implementation

```html
<!DOCTYPE html>
<html>
<head>
  <title>Voice Flashcards</title>
</head>
<body>
  <button id="start-button">Start Studying</button>
  <div id="status"></div>

  <script>
    let audioContext;
    let mediaStream;
    let processor;
    let ws;

    document.getElementById('start-button').onclick = async () => {
      // Get microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext({ sampleRate: 16000 });
      
      // Connect to your backend proxy (which connects to ElevenLabs)
      ws = new WebSocket('wss://your-backend.com/voice');
      
      ws.onopen = () => {
        document.getElementById('status').textContent = 'Connected! Say "Let\'s study"';
        
        // Send audio to backend
        const source = audioContext.createMediaStreamSource(mediaStream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          const audioData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
          }
          ws.send(int16.buffer);
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
      };
      
      // Receive and play audio responses
      ws.onmessage = async (event) => {
        const audioData = await event.data.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(audioData);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      };
    };
  </script>
</body>
</html>
```

## Option 3: Simple HTTP API (No Real-Time Voice)

If you want text-based conversation first:

```javascript
// simple-api-wrapper.js
import express from 'express';
import { handleToolCall } from './dist/tools/flashcard-tools.js';

const app = express();
app.use(express.json());

// Chat endpoint that ElevenLabs can call
app.post('/chat', async (req, res) => {
  const { message, user_id, session_id } = req.body;
  
  // Simple command parsing
  const command = message.toLowerCase().trim();
  
  let response;
  
  if (command.includes('study') || command.includes('start')) {
    const result = await handleToolCall('get_next_card', { user_id });
    const card = JSON.parse(result.content[0].text);
    response = `Here's your question: ${card.question}`;
  }
  else if (command.includes('reveal') || command.includes('show')) {
    const result = await handleToolCall('reveal_answer', { user_id });
    const answer = JSON.parse(result.content[0].text);
    response = `The answer is: ${answer.answer}`;
  }
  else if (command.includes('again') || command.includes('hard') || 
           command.includes('good') || command.includes('easy')) {
    const difficulty = ['again', 'hard', 'good', 'easy']
      .find(d => command.includes(d)) || 'good';
    await handleToolCall('grade_card', { user_id, difficulty });
    response = `Got it! Getting your next card...`;
  }
  
  res.json({ response });
});

app.listen(3000);
```

## Testing Your Integration

### Test Conversation Flow

```bash
# Test 1: Start session
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "lets study", "user_id": "YOUR_USER_ID"}'

# Test 2: Reveal answer
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "reveal", "user_id": "YOUR_USER_ID"}'

# Test 3: Grade
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "good", "user_id": "YOUR_USER_ID"}'
```

## Production Deployment

### Deploy to Vercel/Netlify (Frontend + Proxy)

```javascript
// api/elevenlabs-proxy.js (Serverless function)
export default async function handler(req, res) {
  // Forward to your MCP server
  const response = await fetch(process.env.MCP_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  
  const data = await response.json();
  res.json(data);
}
```

### Environment Variables

```bash
ELEVENLABS_API_KEY=your_key
ELEVENLABS_AGENT_ID=your_agent_id
MCP_SERVER_URL=https://your-mcp-server.com
```

## Tips for Best Voice UX

1. **Keep responses under 3 sentences** - Voice is different from text
2. **Use natural pauses** - Give users time to think
3. **Confirm actions** - "Got it, grading as good..."
4. **Celebrate often** - "Great job!", "You're on fire!"
5. **Handle errors gracefully** - "Sorry, didn't catch that. Say reveal to see the answer."
6. **Provide context** - "Card 5 of 20 remaining"

## Troubleshooting

**Agent not calling tools:**
- Check tool definitions match exactly
- Verify MCP server is accessible
- Check agent logs in ElevenLabs dashboard

**Audio quality issues:**
- Use 16kHz sample rate
- Check microphone permissions
- Test on different browsers

**Latency too high:**
- Deploy MCP server closer to users
- Use ElevenLabs' turbo mode
- Optimize database queries

Ready to test it live! 🎤✨
