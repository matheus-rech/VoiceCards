# Supabase Setup Guide - Step by Step

## Part 1: Create Supabase Project (5 minutes)

### Step 1: Sign Up
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email if needed

### Step 2: Create Project
1. Click "New Project"
2. **Organization**: Select or create one
3. **Name**: `flashcard-mcp` (or your choice)
4. **Database Password**: Click "Generate a password" and SAVE IT SOMEWHERE SAFE
5. **Region**: Choose closest to your users (e.g., `us-east-1` for US East Coast)
6. Click "Create new project"
7. ⏰ Wait 2-3 minutes for project to initialize

### Step 3: Get Your Credentials
Once the project is ready:

1. Go to **Settings** (gear icon in sidebar) → **API**
2. You'll see two important values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGc..... (very long string)
```

3. **COPY THESE NOW** - we need them next!

## Part 2: Set Up Database (10 minutes)

### Step 1: Run Main Schema
1. In Supabase dashboard, click **SQL Editor** (in sidebar)
2. Click **"New query"**
3. Open `/tmp/flashcard-mcp/src/database/schema.sql` on your computer
4. Copy ALL the contents
5. Paste into Supabase SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. ✅ You should see "Success. No rows returned"

### Step 2: Run Helper Functions
1. Still in SQL Editor, click **"New query"** again
2. Open `/tmp/flashcard-mcp/src/database/helpers.sql`
3. Copy ALL the contents
4. Paste and click **"Run"**
5. ✅ Another success message

### Step 3: Verify Tables Created
1. Click **Table Editor** in sidebar
2. You should see these tables:
   - ✅ users
   - ✅ decks
   - ✅ cards
   - ✅ card_reviews
   - ✅ study_sessions
   - ✅ user_card_state

If you see all 6 tables, **you're golden!** 🎉

## Part 3: Configure Local Environment (5 minutes)

### Step 1: Set Up Environment Variables

In the `/tmp/flashcard-mcp` directory:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your editor
nano .env  # or: code .env, vim .env, etc.
```

Replace with your actual values:

```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```

Save and close.

### Step 2: Install Dependencies

```bash
cd /tmp/flashcard-mcp
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - MCP server framework
- `@supabase/supabase-js` - Supabase client
- TypeScript and build tools

### Step 3: Build the Project

```bash
npm run build
```

You should see:
```
> flashcard-mcp-server@1.0.0 build
> tsc

[No errors = success!]
```

## Part 4: First Test - Create User & Import Cards (10 minutes)

### Test Script

Create a test file:

```bash
cat > test-setup.js << 'EOF'
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function runTest() {
  console.log('🧪 Testing Flashcard MCP Setup...\n');

  // Step 1: Create a test user
  console.log('1️⃣ Creating test user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'test@flashcard.local',
    password: 'TestPassword123!',
  });

  if (authError && authError.message !== 'User already registered') {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  const userId = authData.user?.id;
  console.log('✅ User ID:', userId, '\n');

  // Step 2: Create user record
  console.log('2️⃣ Creating user record...');
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: 'test@flashcard.local',
      display_name: 'Test User'
    });

  if (userError) {
    console.error('❌ User record error:', userError.message);
  } else {
    console.log('✅ User record created\n');
  }

  // Step 3: Create a test deck
  console.log('3️⃣ Creating test deck...');
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .insert({
      user_id: userId,
      name: 'Quick Start Deck',
      description: 'Test deck for initial setup',
      tags: ['test', 'demo']
    })
    .select()
    .single();

  if (deckError) {
    console.error('❌ Deck error:', deckError.message);
    return;
  }
  console.log('✅ Deck created:', deck.name, '\n');

  // Step 4: Add sample cards
  console.log('4️⃣ Adding sample flashcards...');
  const sampleCards = [
    {
      deck_id: deck.id,
      front: 'What does MCP stand for?',
      back: 'Model Context Protocol',
      hint: 'It connects AI to tools',
      card_order: 0
    },
    {
      deck_id: deck.id,
      front: 'What algorithm does this use for spaced repetition?',
      back: 'SM-2 (SuperMemo 2), same as Anki',
      hint: 'Two letters and a number',
      card_order: 1
    },
    {
      deck_id: deck.id,
      front: 'Name a voice AI that can use MCP tools',
      back: 'ElevenLabs Conversational AI',
      hint: 'Rhymes with heaven',
      card_order: 2
    },
    {
      deck_id: deck.id,
      front: 'What database powers this platform?',
      back: 'Supabase (PostgreSQL)',
      hint: 'Super database',
      card_order: 3
    },
    {
      deck_id: deck.id,
      front: 'How many difficulty levels are there?',
      back: 'Four: Again, Hard, Good, Easy',
      card_order: 4
    }
  ];

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .insert(sampleCards)
    .select();

  if (cardsError) {
    console.error('❌ Cards error:', cardsError.message);
    return;
  }
  console.log(`✅ ${cards.length} cards added\n`);

  // Step 5: Test getting due cards
  console.log('5️⃣ Testing card retrieval...');
  const { data: dueCards, error: dueError } = await supabase
    .rpc('get_due_cards', {
      p_user_id: userId,
      p_deck_id: deck.id
    });

  if (dueError) {
    console.error('❌ Due cards error:', dueError.message);
    return;
  }
  console.log(`✅ Found ${dueCards.length} cards due for review\n`);

  // Step 6: Display first card
  if (dueCards.length > 0) {
    console.log('📝 First Card:');
    console.log('   Q:', dueCards[0].front);
    console.log('   A:', dueCards[0].back);
    if (dueCards[0].hint) console.log('   💡:', dueCards[0].hint);
  }

  console.log('\n✨ Setup complete! Your credentials:');
  console.log('   User ID:', userId);
  console.log('   Deck ID:', deck.id);
  console.log('\n💡 Save these for testing the MCP server!\n');
}

runTest().catch(console.error);
EOF
```

### Run the Test

```bash
# Install dotenv for the test
npm install dotenv

# Run test
node test-setup.js
```

**Expected Output:**
```
🧪 Testing Flashcard MCP Setup...

1️⃣ Creating test user...
✅ User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

2️⃣ Creating user record...
✅ User record created

3️⃣ Creating test deck...
✅ Deck created: Quick Start Deck

4️⃣ Adding sample flashcards...
✅ 5 cards added

5️⃣ Testing card retrieval...
✅ Found 5 cards due for review

📝 First Card:
   Q: What does MCP stand for?
   A: Model Context Protocol
   💡: It connects AI to tools

✨ Setup complete! Your credentials:
   User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Deck ID: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy

💡 Save these for testing the MCP server!
```

**Save those IDs!** You'll need them for the next test.

## Part 5: Test MCP Server (5 minutes)

### Start the Server

```bash
npm start
```

You should see:
```
[MCP] Flashcard MCP Server starting...
[MCP] Connected to Supabase
[MCP] Ready to handle requests
```

### Test with MCP Inspector

Open a NEW terminal (keep server running) and run:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web interface. Test these tools:

1. **list_tools** - See all 10 available tools
2. **get_next_card** - Use your user_id from above
3. **reveal_answer** - Use same user_id
4. **grade_card** - Grade it as "good"

### Manual Test Script

Or test with this script:

```bash
cat > test-mcp.js << 'EOF'
// This simulates what an AI agent would do
import { handleToolCall } from './dist/tools/flashcard-tools.js';

const USER_ID = 'PASTE_YOUR_USER_ID_HERE';

async function testMCPFlow() {
  console.log('🧪 Testing MCP Tool Flow...\n');

  // Get next card
  console.log('1️⃣ Getting next card...');
  let result = await handleToolCall('get_next_card', { user_id: USER_ID });
  console.log(result.content[0].text, '\n');

  // Reveal answer
  console.log('2️⃣ Revealing answer...');
  result = await handleToolCall('reveal_answer', { user_id: USER_ID });
  console.log(result.content[0].text, '\n');

  // Grade card
  console.log('3️⃣ Grading as "good"...');
  result = await handleToolCall('grade_card', { 
    user_id: USER_ID, 
    difficulty: 'good' 
  });
  console.log(result.content[0].text, '\n');

  console.log('✅ MCP flow test complete!');
}

testMCPFlow().catch(console.error);
EOF
```

Edit the file to add your USER_ID, then:

```bash
node test-mcp.js
```

## ✅ Checklist

- [ ] Supabase project created
- [ ] Database schema applied
- [ ] Helper functions added
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Project built successfully
- [ ] Test user created
- [ ] Sample deck imported
- [ ] Cards retrievable
- [ ] MCP server starts
- [ ] Tools work in inspector

## 🎉 You're Ready!

If all checkboxes are ✅, your platform is working! 

**Next steps:**
1. Set up ElevenLabs integration (see ELEVENLABS_INTEGRATION.md)
2. Build Alexa Skill (see ALEXA_SKILL_ARCHITECTURE.md)
3. Create web client (see WEB_CLIENT_GUIDE.md)

## 🐛 Troubleshooting

**"Module not found" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**"Database not initialized":**
- Check .env file has correct values
- Verify SUPABASE_URL doesn't have trailing slash
- Test connection: `curl $SUPABASE_URL`

**"User already registered" during test:**
- This is fine! Just means you already ran the test
- Use the user_id from the error message

**RLS blocking queries:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Temporarily disable for debugging
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
-- Run your test
-- Then re-enable!
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
```

**No cards returned:**
```sql
-- Check cards exist
SELECT COUNT(*) FROM cards;

-- Check reviews
SELECT * FROM card_reviews LIMIT 5;

-- Manually set next_review_at to now
UPDATE card_reviews SET next_review_at = NOW();
```

Need help? Check the logs:
- MCP server: stdout/stderr
- Supabase: Dashboard → Logs
- Database: SQL Editor → Run `SELECT * FROM logs;`
