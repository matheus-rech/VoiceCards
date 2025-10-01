# System Architecture Diagram

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   Web    │  │ ElevenLabs│  │  Alexa   │  │  Google  │      │
│  │  React   │  │ ConvAI    │  │  Skill   │  │  Home    │      │
│  │  + Voice │  │           │  │          │  │  Action  │      │
│  └─────┬────┘  └─────┬─────┘  └─────┬────┘  └─────┬────┘      │
│        │             │              │             │            │
└────────┼─────────────┼──────────────┼─────────────┼────────────┘
         │             │              │             │
         │     ┌───────┴──────────────┴─────────┐   │
         │     │                                 │   │
         ▼     ▼                                 ▼   ▼
    ┌─────────────────────────────────────────────────────┐
    │              MCP PROTOCOL LAYER                     │
    │                                                     │
    │   HTTP/WebSocket/stdio communication               │
    │   JSON-RPC 2.0 format                             │
    └─────────────────┬───────────────────────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────────────────────┐
    │            FLASHCARD MCP SERVER                     │
    │         (This Repository - Node.js/TS)              │
    │                                                     │
    │  ┌─────────────────────────────────────────────┐   │
    │  │           MCP Tools (10 total)              │   │
    │  ├─────────────────────────────────────────────┤   │
    │  │ • get_next_card    • reveal_answer          │   │
    │  │ • grade_card       • skip_card              │   │
    │  │ • list_decks       • get_deck_stats         │   │
    │  │ • create_deck      • import_cards           │   │
    │  │ • get_session_stats • end_session           │   │
    │  └─────────────────────────────────────────────┘   │
    │                                                     │
    │  ┌─────────────────────────────────────────────┐   │
    │  │         Core Services                       │   │
    │  ├─────────────────────────────────────────────┤   │
    │  │ • CardService - Card retrieval & grading    │   │
    │  │ • SRSService - SM-2 algorithm logic         │   │
    │  │ • DeckService - Deck & session management   │   │
    │  └─────────────────────────────────────────────┘   │
    └─────────────────┬───────────────────────────────────┘
                      │
                      │ Supabase Client SDK
                      ▼
    ┌─────────────────────────────────────────────────────┐
    │              SUPABASE BACKEND                       │
    │                                                     │
    │  ┌─────────────────────────────────────────────┐   │
    │  │         PostgreSQL Database                 │   │
    │  ├─────────────────────────────────────────────┤   │
    │  │ Tables:                                     │   │
    │  │ • users           • decks                   │   │
    │  │ • cards           • card_reviews            │   │
    │  │ • study_sessions  • user_card_state         │   │
    │  │                                             │   │
    │  │ Functions:                                  │   │
    │  │ • get_due_cards()                           │   │
    │  │ • increment_session_stats()                 │   │
    │  │ • get_daily_stats()                         │   │
    │  └─────────────────────────────────────────────┘   │
    │                                                     │
    │  ┌─────────────────────────────────────────────┐   │
    │  │         Auth (Supabase Auth)                │   │
    │  │ • Email/password                            │   │
    │  │ • Social providers (Google, Apple, etc.)    │   │
    │  │ • Row Level Security (RLS)                  │   │
    │  └─────────────────────────────────────────────┘   │
    │                                                     │
    │  ┌─────────────────────────────────────────────┐   │
    │  │         Storage (Supabase Storage)          │   │
    │  │ • Flashcard images                          │   │
    │  │ • Audio files                               │   │
    │  │ • Anki .apkg files                          │   │
    │  └─────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────┘
```

## Data Flow Example: Study Session

```
1. USER STARTS SESSION
   User: "Start studying"
   ↓
2. CLIENT CALLS MCP
   POST /mcp/get_next_card
   { "user_id": "abc-123" }
   ↓
3. MCP SERVER PROCESSES
   CardService.getNextCard()
   ↓ calls
   Supabase.rpc('get_due_cards')
   ↓
4. DATABASE RETURNS CARDS
   SELECT * FROM cards
   WHERE next_review_at <= NOW()
   ORDER BY next_review_at
   ↓
5. MCP RETURNS TO CLIENT
   {
     "question": "What is photosynthesis?",
     "deck_name": "Biology",
     "cards_remaining": 15,
     "session_id": "xyz-789"
   }
   ↓
6. CLIENT READS QUESTION
   AI: "What is photosynthesis?"
   ↓
7. USER THINKS... THEN:
   User: "Reveal"
   ↓
8. CLIENT CALLS MCP
   POST /mcp/reveal_answer
   { "user_id": "abc-123" }
   ↓
9. MCP RETURNS ANSWER
   {
     "answer": "The process by which plants..."
   }
   ↓
10. CLIENT READS ANSWER
    AI: "The answer is: The process by which..."
    ↓
11. USER GRADES
    User: "Good"
    ↓
12. CLIENT CALLS MCP
    POST /mcp/grade_card
    { "user_id": "abc-123", "difficulty": "good" }
    ↓
13. MCP CALCULATES NEXT REVIEW
    SRSService.calculateNextReview()
    Using SM-2 algorithm:
    - ease_factor = 2.5
    - interval = 6 days
    - next_review = NOW() + 6 days
    ↓
14. DATABASE SAVES REVIEW
    INSERT INTO card_reviews
    (card_id, quality, next_review_at...)
    ↓
15. LOOP: Get next card (back to step 2)
```

## Component Responsibilities

### User Interfaces (Client Layer)
**Responsibility**: Capture user input, render UI, speak/listen
- **Web Client**: Browser-based, keyboard + voice
- **ElevenLabs**: Natural voice conversation
- **Alexa**: Amazon Echo devices
- **Google Home**: Google Assistant devices

**Tech**: React, Web Speech API, SDK integrations

### MCP Server (Business Logic)
**Responsibility**: Core flashcard logic, algorithm, session management
- Implements 10 MCP tools
- Manages study sessions
- Calculates spaced repetition
- Handles card state

**Tech**: Node.js, TypeScript, MCP SDK

### Supabase (Data Layer)
**Responsibility**: Data persistence, auth, file storage
- PostgreSQL database
- Row-level security
- Real-time subscriptions
- File storage for media

**Tech**: PostgreSQL, Supabase Platform

## Communication Protocols

### MCP Protocol (JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_next_card",
    "arguments": {
      "user_id": "abc-123"
    }
  },
  "id": 1
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"question\":\"...\",\"answer\":\"...\"}"
    }]
  },
  "id": 1
}
```

### Supabase Client
```javascript
// Query with RLS
const { data } = await supabase
  .from('cards')
  .select('*')
  .eq('user_id', userId)
  .lte('next_review_at', new Date());

// RLS ensures user only sees their cards
```

## Security Layers

```
┌──────────────────────────────────────┐
│    Client Authentication             │
│  • User login/signup                 │
│  • JWT token storage                 │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│    MCP Server (Stateless)            │
│  • Validates request format          │
│  • No auth (relies on Supabase)      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│    Supabase Auth + RLS               │
│  • JWT verification                  │
│  • Row-level security policies       │
│  • Only user's own data accessible   │
└──────────────────────────────────────┘
```

## Deployment Architecture

### Development
```
Developer Machine
├── MCP Server (localhost:3000)
├── Supabase (cloud)
└── Web Client (localhost:5173)
```

### Production - Small Scale
```
VPS (DigitalOcean $5/mo)
├── MCP Server (PM2)
├── Nginx (reverse proxy)
└── SSL (Let's Encrypt)
    ↓
Supabase (cloud)
```

### Production - Large Scale
```
Load Balancer
├── MCP Server 1 (auto-scale)
├── MCP Server 2 (auto-scale)
└── MCP Server N (auto-scale)
    ↓
Supabase (enterprise)
    ├── Primary DB
    └── Read replicas
```

## Scaling Considerations

### Horizontal Scaling
- MCP servers are stateless → easy to scale
- Add more servers behind load balancer
- Each handles independent requests

### Database Scaling
- Supabase handles automatic scaling
- Add read replicas for high traffic
- Connection pooling (PgBouncer)

### Caching
```javascript
// Cache frequently accessed data
const cache = new NodeCache({ stdTTL: 60 });

// Cache due cards for 1 minute
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

## Monitoring & Observability

```
Logging
├── MCP Server logs (Winston/Pino)
├── Database query logs (Supabase)
└── Client errors (Sentry)

Metrics
├── Request latency
├── Error rates
├── Database query time
└── Active sessions

Alerts
├── Error rate > 5%
├── Response time > 500ms
└── Database connection issues
```

## File Organization

```
/tmp/flashcard-mcp/
├── src/                          # Source code
│   ├── index.ts                  # MCP server entry
│   ├── database/                 # Database layer
│   │   ├── client.ts             # Supabase client
│   │   ├── schema.sql            # Database schema
│   │   └── helpers.sql           # Helper functions
│   ├── services/                 # Business logic
│   │   ├── card-service.ts       # Card operations
│   │   ├── srs-service.ts        # SM-2 algorithm
│   │   └── deck-service.ts       # Deck management
│   ├── tools/                    # MCP tools
│   │   └── flashcard-tools.ts    # Tool definitions
│   └── types/                    # TypeScript types
│       └── index.ts
├── examples/                     # Usage examples
│   └── usage-examples.js
├── docs/                         # Documentation
│   ├── README.md                 # This file
│   ├── QUICK_START.md            # Quick start guide
│   ├── SUPABASE_SETUP.md         # Database setup
│   ├── ELEVENLABS_INTEGRATION.md # Voice AI guide
│   ├── ALEXA_SKILL_ARCHITECTURE.md # Alexa guide
│   ├── WEB_CLIENT_GUIDE.md       # Web client guide
│   └── DEPLOYMENT.md             # Deployment guide
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── .env.example                  # Environment template
```

---

**This architecture enables:**
- ✅ Voice-first UX
- ✅ Multi-platform support
- ✅ Real-time sync
- ✅ Horizontal scaling
- ✅ Secure data access
- ✅ Easy deployment

**Next**: Follow [QUICK_START.md](QUICK_START.md) to build it! 🚀
