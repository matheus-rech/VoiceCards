# 🔊 Alexa Skill - Complete Setup & Deployment Guide

Your Alexa skill code is now ready! This guide will walk you through deploying both your MCP server and Alexa skill.

## 📦 What's Been Created

✅ **Complete Alexa Skill Package:**
- `alexa-skill/skill.json` - Skill manifest
- `alexa-skill/interactionModels/` - Voice interaction model
- `alexa-skill/lambda/index.js` - Lambda function code
- `alexa-skill/lambda/package.json` - Dependencies

✅ **Full Voice Interface:**
- Natural language understanding for studying
- 8 custom intents (start, reveal, grade, skip, etc.)
- Smart slot types for difficulty grading
- Conversation flow management

## 🚀 Step 1: Deploy Your MCP Server FIRST

Your Alexa skill needs the MCP server to be live. Let's deploy it now:

### Quick Deploy to Railway (Easiest)
```bash
cd /Users/matheusrech/Downloads/VoiceCards

# Run the deploy script
./deploy.sh

# Choose option 1 (Railway)
# Follow the prompts to set your Supabase credentials
```

### Or Deploy to Render (Free forever)
1. Go to [render.com](https://render.com)
2. Connect your GitHub repo: https://github.com/matheus-rech/VoiceCards
3. Create new Web Service
4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `WEBHOOK_SECRET` (create a random string)

**Note your deployment URL**: You'll need it for Alexa setup
- Railway: `https://your-app.up.railway.app`
- Render: `https://your-app.onrender.com`

## 🎤 Step 2: Deploy Alexa Skill

### A. Install ASK CLI
```bash
# Install Alexa Skills Kit CLI
npm install -g ask-cli

# Configure with your Amazon account
ask configure

# This will open a browser to login
```

### B. Deploy the Skill
```bash
cd alexa-skill

# Deploy everything (skill + Lambda)
ask deploy

# Or deploy separately:
ask deploy --target skill-metadata
ask deploy --target skill-code
ask deploy --target interaction-model
```

### C. Manual Setup (Alternative)

If you prefer the Alexa Developer Console:

1. **Go to**: https://developer.amazon.com/alexa/console/ask
2. **Create Skill**:
   - Name: "Flashcard Tutor"
   - Model: Custom
   - Backend: Provision your own

3. **Interaction Model**:
   - Click "JSON Editor"
   - Copy contents of `alexa-skill/interactionModels/custom/en-US.json`
   - Save and Build

4. **Endpoint**:
   - Service Endpoint Type: AWS Lambda ARN
   - Create Lambda function (see below)

## ⚡ Step 3: Create Lambda Function

### Option A: Using AWS CLI
```bash
cd alexa-skill/lambda

# Install dependencies
npm install

# Create deployment package
zip -r ../lambda-deployment.zip .

# Create Lambda function
aws lambda create-function \
  --function-name flashcardTutorSkill \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://../lambda-deployment.zip \
  --timeout 8 \
  --memory-size 256

# Add Alexa trigger
aws lambda add-permission \
  --function-name flashcardTutorSkill \
  --statement-id alexa-skill \
  --action lambda:InvokeFunction \
  --principal alexa-appkit.amazon.com \
  --event-source-token YOUR_SKILL_ID
```

### Option B: Using AWS Console

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Create function → Author from scratch
3. Function name: `flashcardTutorSkill`
4. Runtime: Node.js 18.x
5. Create function

6. **Add trigger**:
   - Trigger: Alexa Skills Kit
   - Skill ID: (from Alexa Console)

7. **Upload code**:
   ```bash
   cd alexa-skill/lambda
   npm install
   zip -r lambda.zip .
   ```
   Upload lambda.zip in AWS Console

8. **Environment variables**:
   - `MCP_SERVER_URL`: Your deployed server URL
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase key
   - `WEBHOOK_SECRET`: Same as in your MCP deployment

9. Copy the Lambda ARN, paste in Alexa Console endpoint

## 🧪 Step 4: Test Your Skill

### In Alexa Developer Console
1. Go to "Test" tab
2. Enable testing for "Development"
3. Type or speak: "open flashcard tutor"

### Test Conversation
```
You: "Alexa, open flashcard tutor"
Alexa: "Welcome to Flashcard Tutor! Say 'start studying' to begin..."

You: "Start studying"
Alexa: "Here's your first question: What is the capital of France?"

You: "Reveal"
Alexa: "The answer is: Paris. How did you do?"

You: "Easy"
Alexa: "Excellent! Next question..."
```

### On Echo Device
1. Make sure device is linked to your developer account
2. Say: "Alexa, open flashcard tutor"
3. Start studying hands-free!

## 🔧 Step 5: Configure & Customize

### Update Lambda Environment Variables
```javascript
MCP_SERVER_URL = "https://your-deployed-url.com"
SUPABASE_URL = "https://xxxxx.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGc..."
WEBHOOK_SECRET = "your-secret-key"
```

### Customize Voice Responses
Edit `alexa-skill/lambda/index.js` to change:
- Welcome message
- Encouragement phrases
- Progress updates
- Error messages

### Add More Intents
Edit `alexa-skill/interactionModels/custom/en-US.json`:
```json
{
  "name": "CustomIntent",
  "samples": [
    "sample utterance",
    "another way to say it"
  ]
}
```

## 📱 Step 6: Test on Real Device

1. **Enable on your Echo**:
   - Open Alexa app
   - Go to Skills → Your Skills → Dev
   - Enable "Flashcard Tutor"

2. **Voice Commands**:
   - "Alexa, open flashcard tutor"
   - "Alexa, ask flashcard tutor to start studying"
   - "Alexa, tell flashcard tutor to list my decks"

## 🚢 Step 7: Publish (Optional)

### Certification Checklist
- [ ] Complete skill information
- [ ] Add example phrases (3 minimum)
- [ ] Upload skill icons (108x108, 512x512)
- [ ] Pass certification tests
- [ ] Add privacy policy URL

### Submit for Certification
```bash
ask submit --skill-id YOUR_SKILL_ID
```

## 🐛 Troubleshooting

### "Skill doesn't respond"
- Check Lambda logs in CloudWatch
- Verify Lambda has Alexa Skills Kit trigger
- Confirm environment variables are set

### "Can't find cards"
- Verify MCP server is deployed and accessible
- Check Supabase credentials in Lambda
- Test MCP endpoint directly

### "Alexa doesn't understand"
- Check interaction model is built
- Verify intent names match Lambda code
- Test in Alexa Console simulator

## 📊 Monitoring

### CloudWatch Logs
```bash
aws logs tail /aws/lambda/flashcardTutorSkill --follow
```

### Alexa Analytics
- Alexa Developer Console → Analytics
- Track usage, intents, sessions

## 🎯 Quick Commands Reference

```bash
# Deploy everything
cd VoiceCards
./deploy.sh  # Deploy MCP server
cd alexa-skill
ask deploy   # Deploy Alexa skill

# Update Lambda only
cd alexa-skill/lambda
npm run deploy

# Test locally
ask dialog --locale en-US
```

## ✅ Final Checklist

- [ ] MCP Server deployed and accessible
- [ ] Supabase database configured with test data
- [ ] Lambda function created with environment variables
- [ ] Alexa skill created and linked to Lambda
- [ ] Tested in Alexa Console
- [ ] Tested on Echo device
- [ ] All intents working correctly

## 🎉 Success!

Your voice-controlled flashcard system is now live on Alexa! Users can:
- Study hands-free using any Echo device
- Review cards with spaced repetition
- Track progress with voice commands
- Access from Alexa app on phone

Share your skill with friends or publish it to the Alexa Skills Store!

## 📚 Next Steps

1. Add more natural language variations
2. Implement session persistence with DynamoDB
3. Add SSML for better speech synthesis
4. Create skill cards for visual feedback
5. Add multi-language support