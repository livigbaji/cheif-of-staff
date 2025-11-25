# Slack Integration Guide

This guide explains how to set up and use the Slack integration in Chief of Staff.

## Setup Instructions

### 1. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Give it a name like "Chief of Staff" and select your workspace

### 2. Configure OAuth & Permissions

1. In your app, go to "OAuth & Permissions" in the sidebar
2. Under "Redirect URLs", add:
   ```
   http://localhost:3000/api/auth/callback/slack
   ```
   For production, use your actual domain.

3. Under "User Token Scopes", add these scopes:
   - `channels:read` - View channels
   - `channels:history` - Read channel messages
   - `chat:write` - Send messages to channels/DMs
   - `im:read` - View DMs
   - `im:history` - Read DM messages
   - `im:write` - Send DMs
   - `users:read` - Read user profiles
   - `users:read.email` - Read user emails for mapping
   - `mpim:read` - Read group DMs
   - `mpim:history` - Read group DM messages
   - `groups:read` - Read private channels
   - `groups:history` - Read private channel messages
   - `reactions:read` - Read message reactions
   - `reactions:write` - Add/remove reactions
   - `files:read` - Access shared files
   - `team:read` - Read team info
   - `search:read` - Search messages for context

### 3. Install to Workspace

1. Click "Install to Workspace"
2. Authorize the app

### 4. Get Credentials

1. From "Basic Information", copy:
   - Client ID → `SLACK_CLIENT_ID`
   - Client Secret → `SLACK_CLIENT_SECRET`

2. Add these to your `.env` file

## API Endpoints

### Messages (`/api/slack/messages`)

#### Get Messages
```http
GET /api/slack/messages?type=dm&targetId=U123456&limit=50
GET /api/slack/messages?type=channel&targetId=C123456&limit=50
```

#### Send Messages
```http
POST /api/slack/messages
{
  "type": "dm",
  "targetId": "U123456", // User ID for DM
  "message": "Hello from Chief of Staff!"
}

POST /api/slack/messages
{
  "type": "channel",
  "targetId": "C123456", // Channel ID
  "message": "Update from Chief of Staff"
}

POST /api/slack/messages
{
  "type": "thread",
  "targetId": "C123456", // Channel ID
  "threadTs": "1234567890.123456", // Thread timestamp
  "message": "Reply to thread"
}
```

### Users (`/api/slack/users`)

#### Get All Users
```http
GET /api/slack/users?action=all
```

#### Map People to Slack Users
```http
GET /api/slack/users?action=map-people
```

#### Look Up Specific User
```http
GET /api/slack/users?action=lookup&email=user@example.com
GET /api/slack/users?action=lookup&userId=U123456
```

#### Sync Slack Users with People Database
```http
POST /api/slack/users
{
  "action": "sync-people"
}
```

### Workspace (`/api/slack/workspace`)

#### Get Channels
```http
GET /api/slack/workspace?action=channels
```

#### Get Team Info
```http
GET /api/slack/workspace?action=team-info
```

#### Search Messages
```http
GET /api/slack/workspace?action=search&query=project update&count=20
```

### Threads (`/api/slack/threads`)

#### Get Thread Replies
```http
GET /api/slack/threads?channelId=C123456&messageTs=1234567890.123456&action=replies
```

#### Get Message Context
```http
GET /api/slack/threads?channelId=C123456&messageTs=1234567890.123456&action=context&contextSize=5
```

#### Add Reaction
```http
POST /api/slack/threads
{
  "action": "add-reaction",
  "channelId": "C123456",
  "messageTs": "1234567890.123456",
  "reaction": "thumbsup"
}
```

### Webhooks (`/api/slack/webhooks`) 🆕

#### Get Recent Messages from Webhooks
```http
GET /api/slack/webhooks?action=recent-messages&limit=50
GET /api/slack/webhooks?action=recent-messages&channelId=C123456
```

#### Get Channel Activity Analytics
```http
GET /api/slack/webhooks?action=channel-activity&days=7
```

#### Get Reaction Analytics
```http
GET /api/slack/webhooks?action=reaction-analytics&days=30
```

#### Find People Mentions
```http
GET /api/slack/webhooks?action=mentions
```

#### Get Webhook Statistics
```http
GET /api/slack/webhooks?action=webhook-stats
```

#### Test Webhook Processing
```http
POST /api/slack/webhooks
{
  "action": "test-webhook"
}
```

### Events (`/api/slack/events`) 🆕

This endpoint receives real-time events from Slack webhooks:
- Automatically processes incoming messages, reactions, and channel events
- Stores data for analytics and mention tracking
- Verifies webhook signatures for security

## Features

### 1. Direct Messages
- Send DMs to any user in your workspace
- Read DM history with specific users
- Perfect for quick communications and follow-ups

### 2. Channel Management
- Read messages from public and private channels
- Send messages to channels you're a member of
- Get channel lists and metadata

### 3. Thread Replies
- Reply to specific message threads
- Get all replies in a thread
- Maintain conversation context

### 4. User Mapping
- Automatically map email addresses to Slack user IDs
- Sync Slack users with your People database
- Look up users by email or Slack ID
- Enable quick messaging to people in your database

### 5. Search & Context
- Search across all messages for specific terms
- Get conversation context around specific messages
- Find relevant discussions and decisions

### 6. Reactions
- Add reactions to messages
- Read existing reactions
- Express quick feedback

## Usage Examples

### Send a DM to a Person from Your Database
```javascript
// 1. First, sync Slack users with your people database
await fetch('/api/slack/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'sync-people' })
});

// 2. Send DM using the person's Slack ID
const person = await fetch('/api/people').then(r => r.json());
const personWithSlack = person.find(p => p.slack_id);

await fetch('/api/slack/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'dm',
    targetId: personWithSlack.slack_id,
    message: 'Following up on our conversation about the project timeline.'
  })
});
```

### Get Conversation Context
```javascript
// Get recent DMs with a specific person
const messages = await fetch(`/api/slack/messages?type=dm&targetId=${slackUserId}&limit=20`)
  .then(r => r.json());

// Search for specific topics
const searchResults = await fetch(`/api/slack/workspace?action=search&query=project deadline`)
  .then(r => r.json());
```

## Integration with People Database

The Slack integration automatically:
1. Maps email addresses from your People database to Slack user IDs
2. Updates people records with Slack IDs for quick messaging
3. Enables contextual communication based on your relationships

This allows you to:
- Quickly send messages to people in your network
- Pull conversation context when planning interactions
- Track communication patterns with key contacts

## Security Notes

- All API calls require authentication
- Only users who have connected their Slack account can use these features
- Access is limited to channels and users the connected account can normally access
- Tokens are stored securely in the database
- Webhook requests are verified using Slack's signing secret to ensure authenticity

## Webhook Setup

For real-time event processing, see the comprehensive [Slack Webhooks Setup Guide](./SLACK_WEBHOOKS_SETUP.md) which covers:

- Setting up Event Subscriptions in your Slack app
- Configuring your webhook endpoint URL
- Subscribing to relevant bot events
- Testing and debugging webhook events
- Using webhook data for analytics and automation

The webhook system enables:
- 📨 Real-time message tracking
- 🎭 Reaction monitoring  
- 👥 Channel activity analytics
- 🔍 Automatic mention detection
- 📊 Engagement insights

## Next Steps

1. **Complete OAuth Setup**: Follow the setup instructions above
2. **Test Basic Functions**: Try sending a DM and reading channel messages
3. **Sync Your People**: Use the people mapping features to connect your team
4. **Set Up Webhooks**: Enable real-time events for enhanced functionality
5. **Integrate with Standups**: Use Slack data to enhance your daily reports