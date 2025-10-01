# 🎤 ElevenLabs Voice Integration - Complete Setup Guide

Turn your flashcard MCP server into a natural voice conversation AI tutor! This guide will walk you through setting up ElevenLabs Conversational AI with your deployed VoiceCards server.

## 🎯 What You'll Get

- **Natural voice conversations** - Study while driving, cooking, or exercising
- **Smart AI tutor** - Understands context and provides encouragement
- **Hands-free operation** - Complete voice control
- **Real-time progress** - Track your study session live
- **Multiple voices** - Choose from various AI tutors

## 📋 Prerequisites

1. ✅ VoiceCards MCP server deployed (Railway/Render/Vercel)
2. ✅ Supabase database configured
3. ✅ ElevenLabs account (free tier works!)

## 🚀 Step 1: Deploy Your Webhook Endpoint

Your server already includes the ElevenLabs webhook handler! Just note your deployment URL:

- **Railway**: `https://your-app.up.railway.app/api/elevenlabs`
- **Render**: `https://your-app.onrender.com/api/elevenlabs`
- **Vercel**: `https://your-app.vercel.app/api/elevenlabs`

## 🤖 Step 2: Create Your ElevenLabs Agent

### A. Sign Up for ElevenLabs
1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Sign up for free account
3. Go to **Conversational AI** section

### B. Create New Agent
1. Click **"Create Agent"**
2. **Name**: "Flashcard Tutor"
3. **Type**: Select "Custom"

### C. Configure System Prompt
Copy this optimized prompt:

```
You are a friendly, encouraging flashcard tutor helping users study using spaced repetition.

Your personality:
- Warm and supportive, especially when users struggle
- Patient - give users time to think
- Celebratory of progress
- Natural and conversational

Your workflow:
1. Read questions clearly
2. Give 3-5 seconds thinking time
3. Listen for answers
4. Reveal when requested
5. Ask difficulty (easy/good/hard/again)
6. Provide encouragement
7. Continue to next card

Keep responses concise and natural for voice.
```

### D. Set Up Tools/Functions

Add these tools to your agent:

1. **get_next_card**
```json
{
  "name": "get_next_card",
  "description": "Get the next flashcard to study",
  "parameters": {
    "type": "object",
    "properties": {
      "deck_id": {
        "type": "string",
        "description": "Optional deck ID"
      }
    }
  }
}
```

2. **reveal_answer**
```json
{
  "name": "reveal_answer",
  "description": "Show the answer to current flashcard",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

3. **grade_card**
```json
{
  "name": "grade_card",
  "description": "Grade how well user knew the card",
  "parameters": {
    "type": "object",
    "properties": {
      "difficulty": {
        "type": "string",
        "enum": ["again", "hard", "good", "easy"],
        "description": "How difficult was the card"
      }
    },
    "required": ["difficulty"]
  }
}
```

4. **list_decks**
```json
{
  "name": "list_decks",
  "description": "List available flashcard decks",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

5. **get_session_stats**
```json
{
  "name": "get_session_stats",
  "description": "Get current session statistics",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

6. **end_session**
```json
{
  "name": "end_session",
  "description": "End study session and show stats",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

### E. Configure Webhook

1. In agent settings, find **Webhook Configuration**
2. **URL**: Your deployed endpoint (e.g., `https://your-app.railway.app/api/elevenlabs`)
3. **Method**: POST
4. **Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer your-secret-key"
}
```

### F. Voice Settings

1. **Voice**: Choose "Rachel" or your preference
2. **Stability**: 0.7 (natural variation)
3. **Similarity**: 0.8 (consistent voice)
4. **Style**: 0.5 (balanced emotion)

### G. Conversation Settings

- **Initial Message**: "Hi! I'm your flashcard tutor. Say 'start studying' to begin!"
- **Timeout**: 300 seconds
- **Interruption Sensitivity**: 0.8
- **Language**: English

## 🔐 Step 3: Set Environment Variables

Add to your deployment platform:

```bash
WEBHOOK_SECRET=your-secret-key-here
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

**Railway**:
```bash
railway variables set WEBHOOK_SECRET="your-secret"
railway variables set ELEVENLABS_API_KEY="your-api-key"
```

**Render/Vercel**: Add in dashboard environment variables

## 🧪 Step 4: Test Your Voice Tutor

### Option A: ElevenLabs Console
1. In agent page, click **"Test Agent"**
2. Allow microphone access
3. Say "Let's start studying"
4. Agent should respond and fetch cards!

### Option B: Test Client
1. Open `elevenlabs/test-client.html` in browser
2. Enter your Agent ID and API key
3. Click "Connect to ElevenLabs"
4. Start talking!

### Option C: Direct Embed
```html
<iframe
  src="https://elevenlabs.io/app/conversational-ai/embed/YOUR_AGENT_ID"
  width="400"
  height="600"
  frameborder="0"
  allow="microphone">
</iframe>
```

## 💬 Sample Conversations

### Starting a Session
**You**: "Hello"
**AI**: "Hi! I'm your flashcard tutor. Say 'start studying' to begin!"
**You**: "Let's study"
**AI**: "Great! Here's your first question: What is the capital of France?"

### During Study
**You**: "Hmm... Paris?"
**AI**: "That's correct! Paris is the capital of France. How was that - easy, good, or hard?"
**You**: "Pretty easy"
**AI**: "Excellent! You know that one well. Next question: What's 7 times 8?"

### Getting Help
**You**: "I don't know"
**AI**: "No problem! Would you like to reveal the answer?"
**You**: "Yes"
**AI**: "It's 56. We'll review this again soon. How should I mark this?"
**You**: "Again"
**AI**: "No worries! Practice makes perfect. Ready for the next one?"

## 🎨 Advanced Customization

### Multiple Tutors
Create different agents for different subjects:
- **Language Tutor**: Slower speech, pronunciation focus
- **Math Tutor**: Step-by-step problem solving
- **History Tutor**: Storytelling approach

### Custom Voices
1. Clone your own voice (Pro feature)
2. Use different voices for different languages
3. Create character-based tutors (child-friendly, professional, etc.)

### Webhook Enhancements
Add to `api/elevenlabs.js`:
```javascript
// Track streaks
if (difficulty === 'easy' || difficulty === 'good') {
  session.streak++;
  if (session.streak % 5 === 0) {
    return "Great streak! You're on fire!";
  }
}

// Adaptive encouragement
if (session.accuracy < 50) {
  return "You're doing great! Remember, learning takes time.";
}
```

## 📊 Monitoring & Analytics

### Session Tracking
Your webhook automatically tracks:
- Cards reviewed
- Accuracy percentage
- Session duration
- Difficulty distribution

### View Stats
```javascript
// Add to your webhook
console.log('Session Stats:', {
  user: session.userId,
  cards: session.stats.cardsReviewed,
  accuracy: session.stats.accuracy,
  duration: Date.now() - session.startedAt
});
```

## 🚨 Troubleshooting

### "Agent not responding"
- Check webhook URL is correct
- Verify environment variables are set
- Check server logs for errors

### "Can't hear agent"
- Check browser microphone permissions
- Try different browser (Chrome recommended)
- Verify voice settings in agent

### "Tools not working"
- Ensure webhook endpoint is deployed
- Check tool definitions match exactly
- Verify database connection

### "Session not saving"
- Check Supabase credentials
- Verify user_id is being passed
- Check database permissions

## 🎯 Quick Test Checklist

- [ ] Webhook deployed and accessible
- [ ] Agent created with tools configured
- [ ] Environment variables set
- [ ] Microphone permissions granted
- [ ] Test "start studying" command works
- [ ] Cards are fetched from database
- [ ] Grading updates card schedule
- [ ] Session stats are tracked

## 🚀 Next Steps

1. **Customize voice and personality** for your use case
2. **Create multiple agents** for different subjects
3. **Add to your website** with embed code
4. **Share with friends** - they can use their own API key
5. **Track usage** in ElevenLabs dashboard

## 📱 Mobile Access

Use ElevenLabs mobile app:
1. Download ElevenLabs app
2. Sign in with your account
3. Select your Flashcard Tutor agent
4. Study on the go!

## 💡 Pro Tips

1. **Best voices for learning**: Rachel, Antoni, or Domi
2. **Optimal session length**: 10-20 minutes
3. **Background noise**: Agent handles it well with 0.8 sensitivity
4. **Multiple languages**: Create separate agents per language
5. **Batch studying**: Say "Let's do 10 cards" to set goals

## 🎉 Success!

You now have a fully voice-controlled flashcard learning system! Your students can:
- Study hands-free while multitasking
- Get natural, encouraging feedback
- Track their progress in real-time
- Learn more effectively with spaced repetition

**Share your agent URL**: `https://elevenlabs.io/app/conversational-ai/YOUR_AGENT_ID`

Happy studying! 🎓