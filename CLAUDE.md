# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceCards is a voice-controlled flashcard learning platform built on the Model Context Protocol (MCP). It enables hands-free spaced repetition learning through various voice interfaces including Alexa, ElevenLabs, and web clients. This is an MCP server implementation that provides 10 tools for managing flashcard study sessions.

## Commands

```bash
# Install dependencies
npm install

# Build TypeScript code
npm run build

# Start MCP server
npm start

# Development mode (watch for changes)
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Architecture

### Tech Stack
- **Runtime**: Node.js 18+ with ES modules
- **Language**: TypeScript 5.3
- **MCP Framework**: @modelcontextprotocol/sdk v1.0.0
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Algorithm**: SM-2 Spaced Repetition (same as Anki)

### Project Structure

The codebase is currently in a flat structure (needs organization into proper directories):

```
/
├── index2.ts              # Main MCP server entry point
├── flashcard-tools.ts     # MCP tool definitions and handlers
├── card-service.ts        # Card retrieval and grading logic
├── srs-service.ts         # SM-2 spaced repetition algorithm
├── client.ts              # Supabase database client
├── index.ts               # Type definitions
├── schema.sql             # PostgreSQL database schema
└── helpers.sql            # Database helper functions
```

### Core Services

**MCP Server (index2.ts)**
- Initializes database connection with Supabase
- Registers 10 flashcard management tools
- Handles JSON-RPC 2.0 communication via stdio transport

**CardService (card-service.ts)**
- `getNextCard()`: Retrieves next due card using spaced repetition
- `revealAnswer()`: Shows card back/answer
- `gradeCard()`: Updates card schedule based on difficulty
- `skipCard()`: Skips without grading
- Manages user card state in database

**SRSService (srs-service.ts)**
- Implements SM-2 algorithm with Anki-compatible intervals
- Quality ratings: again (0), hard (2), good (3), easy (5)
- Calculates next review date based on performance
- Maintains ease factor and repetition count

### MCP Tools

| Tool | Purpose | Required Args |
|------|---------|---------------|
| `get_next_card` | Start/continue session | user_id, deck_id? |
| `reveal_answer` | Show answer | user_id |
| `grade_card` | Grade difficulty | user_id, difficulty |
| `skip_card` | Skip without grading | user_id |
| `list_decks` | List all decks | user_id |
| `get_deck_stats` | Deck statistics | user_id, deck_id |
| `get_session_stats` | Session metrics | session_id |
| `end_session` | End + final stats | session_id |
| `create_deck` | Create new deck | user_id, name |
| `import_cards` | Bulk import | user_id, deck_name, cards_text |

### Database Schema

Six main tables with Row-Level Security:
- `users`: User accounts
- `decks`: Flashcard decks
- `cards`: Individual flashcards
- `card_reviews`: Review history and SRS data
- `study_sessions`: Session tracking
- `user_card_state`: Current card state

Key stored procedures:
- `get_due_cards()`: Retrieves cards ready for review
- `increment_session_stats()`: Updates session metrics
- `get_daily_stats()`: Aggregates daily statistics

## Configuration

Environment variables (required in .env):
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

## Development Workflow

### Type System
The project uses strict TypeScript with comprehensive type definitions in `index.ts`. All MCP tool inputs and outputs are strongly typed using JSON Schema.

### Error Handling
All tool handlers wrap operations in try-catch blocks and return structured error responses compatible with MCP protocol.

### Logging
Server logs to stderr with `[MCP]` prefix for debugging (visible in MCP Inspector).

## Integration Points

### Supabase Setup
1. Database must be initialized with `schema.sql` and `helpers.sql`
2. Row-Level Security policies ensure users only access their own data
3. Real-time subscriptions available for live updates

### Voice Clients
The MCP server is designed to work with:
- **ElevenLabs**: Natural AI conversation (see ELEVENLABS_INTEGRATION.md)
- **Alexa Skills**: Lambda + skill kit (see ALEXA_SKILL_ARCHITECTURE.md)
- **Web Client**: React with Web Speech API (see WEB_CLIENT_GUIDE.md)

### Import Format
Cards can be imported via `import_cards` tool using pipe-delimited format:
```
front|back|hint
question1|answer1|optional hint
question2|answer2
```