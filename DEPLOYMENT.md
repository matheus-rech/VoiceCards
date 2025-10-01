# Deployment Guide

## Supabase Setup (Detailed)

### 1. Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and name
4. Select region (closest to users)
5. Generate strong database password
6. Wait for project initialization (~2 minutes)

### 2. Run Database Migrations

1. Go to SQL Editor in Supabase dashboard
2. Click "New Query"
3. Copy contents of `src/database/schema.sql`
4. Click "Run"
5. Verify tables created in Table Editor
6. Copy contents of `src/database/helpers.sql`
7. Run this as well

### 3. Configure Authentication

1. Go to Authentication → Providers
2. Enable "Email" provider
3. (Optional) Configure other providers (Google, GitHub, etc.)
4. Go to Authentication → URL Configuration
5. Add your site URL and redirect URLs

### 4. Get API Credentials

1. Go to Settings → API
2. Copy "Project URL" → This is `SUPABASE_URL`
3. Copy "anon public" key → This is `SUPABASE_ANON_KEY`
4. Save these to `.env` file

### 5. Configure Storage (Optional - for images/audio)

1. Go to Storage
2. Create bucket: "flashcard-media"
3. Set bucket to public or private as needed
4. Configure CORS if needed for web clients

### 6. Set Up Row Level Security (Production)

The schema includes RLS policies, but verify:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show rowsecurity = true for all tables
```

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Setup Steps

```bash
# 1. Clone/create project
cd flashcard-mcp

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Build
npm run build

# 5. Test
npm start
```

### Testing with MCP Inspector

```bash
# Install inspector
npm install -g @modelcontextprotocol/inspector

# Run server with inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

Then open browser to inspector URL and test tools.

## Production Deployment

### Option 1: Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t flashcard-mcp .
docker run -e SUPABASE_URL=$SUPABASE_URL \
           -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
           flashcard-mcp
```

### Option 2: Cloud Function / Serverless

The MCP server can run as a persistent service or be invoked via cloud functions.

**AWS Lambda:**
```bash
# Install AWS SDK
npm install @aws-sdk/client-lambda

# Deploy using Serverless Framework or SAM
```

**Google Cloud Run:**
```bash
# Build
npm run build

# Deploy
gcloud run deploy flashcard-mcp \
  --source . \
  --set-env-vars SUPABASE_URL=$SUPABASE_URL,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

### Option 3: VPS (DigitalOcean, Linode, etc.)

```bash
# 1. SSH into server
ssh user@your-server.com

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone project
git clone your-repo
cd flashcard-mcp

# 4. Install and build
npm install
npm run build

# 5. Install PM2 for process management
npm install -g pm2

# 6. Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'flashcard-mcp',
    script: './dist/index.js',
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'your-url',
      SUPABASE_ANON_KEY: 'your-key'
    }
  }]
}
EOF

# 7. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Integrating with Voice Platforms

### ElevenLabs Conversational AI

1. Go to ElevenLabs dashboard
2. Create new Conversational AI agent
3. In agent settings, add MCP server:

```json
{
  "tools": {
    "flashcards": {
      "type": "mcp",
      "endpoint": "your-mcp-server-url",
      "tools": [
        "get_next_card",
        "reveal_answer", 
        "grade_card",
        "skip_card"
      ]
    }
  }
}
```

4. Configure agent prompt (see `examples/usage-examples.js`)
5. Test in ElevenLabs playground

### Alexa Skill

1. Create new Alexa Skill in developer console
2. Choose "Custom" model
3. Add invocation name: "flashcard tutor"
4. Add intents:

```json
{
  "intents": [
    { "name": "StartStudyIntent" },
    { "name": "RevealAnswerIntent" },
    { "name": "GradeCardIntent", "slots": [
      { "name": "difficulty", "type": "DIFFICULTY_TYPE" }
    ]},
    { "name": "SkipCardIntent" }
  ]
}
```

5. Create Lambda function that calls MCP server
6. Link Lambda to Alexa skill

### Google Assistant Action

Similar to Alexa, but using Dialogflow:

1. Create Dialogflow agent
2. Add intents matching voice commands
3. Create webhook that calls MCP server
4. Deploy to Google Assistant

## Web Client with WebRTC

Create a web client that uses WebRTC for voice:

```javascript
// Initialize WebRTC
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Connect to voice service (e.g., ElevenLabs WebSocket)
const ws = new WebSocket('wss://api.elevenlabs.io/v1/convai');

// Send audio
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
// ... process audio and send to WebSocket

// Receive audio responses
ws.onmessage = (event) => {
  // Play audio response
  const audio = new Audio(event.data);
  audio.play();
};

// MCP calls happen server-side via the voice AI
```

## Security Considerations

### 1. Environment Variables

Never commit `.env` to git:

```bash
# Verify .env is in .gitignore
cat .gitignore | grep .env
```

### 2. Supabase RLS

Verify Row Level Security is working:

```sql
-- Test as anonymous user
SET ROLE anon;
SELECT * FROM cards; -- Should return nothing

-- Test as authenticated user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid';
SELECT * FROM cards; -- Should return only user's cards
```

### 3. API Keys

- Use service role key only server-side
- Use anon key for client-side (it's safe with RLS)
- Rotate keys if compromised

### 4. Rate Limiting

Consider adding rate limiting to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

## Monitoring

### Supabase Dashboard

- Monitor database size and usage
- Check API request counts
- View real-time database activity

### Application Logs

```bash
# With PM2
pm2 logs flashcard-mcp

# With Docker
docker logs -f container-id

# With cloud providers
# Use their native logging (CloudWatch, Stackdriver, etc.)
```

### Metrics to Track

- Cards reviewed per day
- Session completion rate
- Average session length
- User retention
- Error rates

## Backup and Disaster Recovery

### Database Backups

Supabase automatically backs up your database:
- Daily backups for 7 days (free tier)
- Point-in-time recovery (paid plans)

Manual backup:

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Using pg_dump
pg_dump -h db.your-project.supabase.co \
        -U postgres \
        -d postgres \
        > backup.sql
```

### Restore from Backup

```bash
psql -h db.your-project.supabase.co \
     -U postgres \
     -d postgres \
     < backup.sql
```

## Scaling Considerations

### Database

- Supabase free tier: 500MB database, 50K API requests
- Paid plans offer more resources
- Consider read replicas for high traffic

### MCP Server

- Single instance handles ~1000 concurrent users
- Use load balancer for horizontal scaling
- Consider serverless for variable load

### Media Storage

- Store images/audio in Supabase Storage
- Use CDN for better performance (Cloudflare, AWS CloudFront)
- Optimize images before upload

## Troubleshooting

### Common Issues

**"Database not initialized" error:**
```bash
# Check env variables are set
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Verify they're correct in Supabase dashboard
```

**"Failed to fetch cards" error:**
```sql
-- Check if schema is applied
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should show: users, decks, cards, card_reviews, etc.
```

**RLS blocking queries:**
```sql
-- Temporarily disable to test
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;

-- Then re-enable and fix policies
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
```

**Voice assistant not calling tools:**
- Check MCP server is running and accessible
- Verify tool definitions match expected format
- Check logs for errors

## Support

For issues:
1. Check logs first
2. Review Supabase dashboard for errors
3. Test tools with MCP Inspector
4. Open GitHub issue with logs and steps to reproduce

---

Happy deploying! 🚀
