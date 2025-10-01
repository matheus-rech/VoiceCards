# 🔄 Anki Synchronization Guide

Keep your VoiceCards and Anki desktop in perfect sync! Study with voice on the go, review on desktop - all progress synchronized.

## 🎯 What This Does

- **Bi-directional sync**: Progress flows both ways between Anki and VoiceCards
- **Smart conflict resolution**: Handles when you study the same card in both places
- **Preserves SRS data**: Ease factor, intervals, and review history stay intact
- **Auto-sync**: Set it and forget it - syncs every 30 minutes
- **Bulk import**: Import entire Anki decks with one click

## 📋 Prerequisites

1. **Anki Desktop** installed on your computer
2. **AnkiConnect add-on** installed (required for API access)
3. **VoiceCards** deployed and running
4. **Same deck** in both systems (or import from Anki)

## 🚀 Step 1: Install AnkiConnect

AnkiConnect enables API access to Anki desktop:

1. Open Anki
2. Tools → Add-ons → Get Add-ons
3. Enter code: `2055492159`
4. Restart Anki

Or install manually:
```bash
# Download from
https://github.com/FooSoft/anki-connect
```

## ⚙️ Step 2: Configure AnkiConnect

1. Tools → Add-ons → AnkiConnect → Config
2. Ensure it's running on port 8765:

```json
{
    "apiKey": null,
    "apiLogPath": null,
    "webBindAddress": "127.0.0.1",
    "webBindPort": 8765,
    "webCorsOriginList": [
        "http://localhost",
        "https://your-app.railway.app"
    ]
}
```

3. Add your VoiceCards URL to `webCorsOriginList`

## 🔗 Step 3: Connect VoiceCards to Anki

### Test Connection
```bash
curl http://localhost:8765 -X POST -d '{"action": "version", "version": 6}'

# Should return: {"result": 6, "error": null}
```

### In VoiceCards
1. Go to Settings → Integrations
2. Enable "Anki Sync"
3. It will auto-detect Anki on localhost:8765

## 📥 Step 4: Import Existing Anki Deck

### Via API
```bash
curl https://your-app.com/api/anki/import \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "deckName": "Spanish Vocabulary"
  }'
```

### Via UI (if you build one)
1. Click "Import from Anki"
2. Select deck from dropdown
3. Click "Import"

This imports:
- All cards (front, back, tags)
- Current SRS state (intervals, ease factors)
- Review history

## 🔄 Step 5: Enable Synchronization

### Manual Sync
```bash
# Sync specific deck
curl https://your-app.com/api/anki/sync \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "deckId": "deck-uuid"
  }'
```

### Auto-Sync
```bash
# Enable auto-sync every 30 minutes
curl https://your-app.com/api/anki/auto-sync \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "intervalMinutes": 30
  }'
```

## 📊 How Sync Works

### Import from Anki → VoiceCards
1. Reads all cards from specified Anki deck
2. Imports cards with current SRS state
3. Creates mappings for future syncs
4. Preserves tags and media references

### Export from VoiceCards → Anki
1. Finds cards with updated reviews
2. Updates Anki cards with new intervals
3. Creates new cards if they don't exist
4. Maintains ease factor calculations

### Bi-directional Sync
1. Compares modification timestamps
2. Newer changes win (configurable)
3. Tracks all changes in sync history
4. Resolves conflicts automatically

## 🔧 Conflict Resolution

When the same card is reviewed in both systems:

### Automatic Strategies

**Newest Wins** (default)
```javascript
conflictStrategy: 'newest'  // Most recent review wins
```

**Anki Priority**
```javascript
conflictStrategy: 'anki'  // Always use Anki's data
```

**VoiceCards Priority**
```javascript
conflictStrategy: 'voicecards'  // Always use VoiceCards data
```

### Manual Resolution
```bash
curl https://your-app.com/api/anki/resolve-conflict \
  -X POST \
  -d '{
    "cardId": "card-uuid",
    "resolution": "use_anki"  // or "use_voicecards" or "merge"
  }'
```

## 📈 Monitoring Sync

### View Sync History
```bash
curl https://your-app.com/api/anki/history/user-id
```

Returns:
```json
{
  "history": [
    {
      "sync_type": "bidirectional",
      "started_at": "2024-01-15T10:00:00Z",
      "completed_at": "2024-01-15T10:00:05Z",
      "success": true,
      "sync_result": {
        "imported": { "reviews": 5 },
        "exported": { "reviews": 3 },
        "conflicts": []
      }
    }
  ]
}
```

### Check Sync Status
```bash
curl https://your-app.com/api/anki/status
```

## 🎯 Usage Scenarios

### Scenario 1: Daily Workflow
1. **Morning**: Review cards on phone with voice (VoiceCards)
2. **Commute**: Continue studying hands-free (VoiceCards)
3. **Office**: Quick review on desktop (Anki)
4. **Evening**: Deep study session (Anki)
5. **All progress synced automatically!**

### Scenario 2: Shared Studying
1. Import shared Anki deck
2. Study with voice when convenient
3. Export progress back to share with study group
4. Everyone stays synchronized

### Scenario 3: Multi-Device
1. Anki on desktop
2. VoiceCards on phone (voice)
3. VoiceCards on Alexa (hands-free)
4. All devices stay in sync

## 🛠️ Advanced Configuration

### Custom Sync Fields
```javascript
// Map additional Anki fields
const fieldMappings = {
  'Front': 'front',
  'Back': 'back',
  'Extra': 'hint',
  'Source': 'tags[0]',
  'Image': 'image_url'
};
```

### Media Sync
```javascript
// Sync images and audio
const mediaSync = {
  images: true,
  audio: true,
  baseUrl: 'https://your-media-server.com'
};
```

### Selective Sync
```javascript
// Only sync certain tags
const syncFilter = {
  tags: ['important', 'exam'],
  modifiedAfter: '2024-01-01',
  onlyDue: true
};
```

## 🚨 Troubleshooting

### "Cannot connect to Anki"
- Ensure Anki is running
- Check AnkiConnect is installed
- Verify port 8765 is not blocked
- Check firewall settings

### "Sync conflicts detected"
- Review conflict resolution strategy
- Check modification timestamps
- Use manual resolution if needed

### "Cards not syncing"
- Verify deck names match exactly
- Check card mappings in database
- Ensure sync is enabled for deck

### "Performance issues"
- Limit sync to specific decks
- Increase sync interval
- Use batch operations

## 📊 Database Schema

The sync system adds these tables:

```sql
-- Card mappings
CREATE TABLE anki_card_mappings (
  id UUID PRIMARY KEY,
  voicecard_id UUID REFERENCES cards(id),
  anki_note_id BIGINT,
  anki_card_id BIGINT,
  deck_id UUID REFERENCES decks(id),
  last_synced TIMESTAMP,
  sync_enabled BOOLEAN
);

-- Sync history
CREATE TABLE anki_sync_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  sync_type TEXT,
  sync_result JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  success BOOLEAN
);
```

## 🎉 Benefits

1. **Study anywhere**: Voice on mobile, desktop at home
2. **Never lose progress**: All reviews synchronized
3. **Best of both**: Anki's features + voice control
4. **Backup**: Data in two places
5. **Flexibility**: Choose your study method

## 🔒 Security

- AnkiConnect only accepts local connections by default
- Add authentication if exposing to network
- Use HTTPS for VoiceCards API
- Encrypt sensitive data in transit

## 📱 Mobile Anki Apps

Works with:
- AnkiDroid (Android) - via AnkiWeb sync
- AnkiMobile (iOS) - via AnkiWeb sync
- Anki Desktop → AnkiWeb → Mobile → VoiceCards

## 🚀 Next Steps

1. **Set up AnkiConnect** on your desktop
2. **Import your decks** to VoiceCards
3. **Enable auto-sync** for seamless experience
4. **Start studying** with voice!

Your Anki cards are now voice-enabled! 🎉