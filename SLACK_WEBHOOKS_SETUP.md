# Slack Webhooks Setup Guide

This guide explains how to set up Slack webhooks to receive real-time events from your Slack workspace.

## What are Slack Webhooks?

Slack webhooks allow your app to receive real-time notifications when events happen in Slack, such as:
- 📨 New messages in channels or DMs
- 🎭 Reactions added/removed
- 👥 Users joining/leaving channels
- 🆕 New channels created
- 👤 User profile changes
- 🏢 Team member additions

## Setup Instructions

### 1. Configure Your Slack App for Events

1. Go to your [Slack App Management](https://api.slack.com/apps) page
2. Select your Chief of Staff app
3. In the sidebar, click **"Event Subscriptions"**
4. Toggle **"Enable Events"** to **ON**

### 2. Set Your Request URL

**For Development (using ngrok):**
```
https://your-ngrok-url.ngrok.io/api/slack/events
```

**For Production:**
```
https://your-domain.com/api/slack/events
```

> **Note:** Your webhook endpoint must respond to Slack's verification challenge. Our endpoint automatically handles this.

### 3. Subscribe to Bot Events

Add these events to receive the most useful notifications:

#### Message Events
- `message.channels` - Messages in public channels
- `message.groups` - Messages in private channels  
- `message.im` - Direct messages
- `message.mpim` - Group direct messages

#### Reaction Events
- `reaction_added` - When reactions are added to messages
- `reaction_removed` - When reactions are removed

#### Channel Events
- `channel_created` - New public channels
- `channel_deleted` - Deleted channels
- `channel_rename` - Channel name changes
- `group_created` - New private channels
- `group_deleted` - Deleted private channels
- `group_rename` - Private channel renames

#### Member Events
- `member_joined_channel` - User joins a channel
- `member_left_channel` - User leaves a channel

#### User Events
- `team_join` - New team member
- `user_change` - User profile changes

### 4. Environment Variables

Make sure these are set in your `.env` file:

```bash
# Required for webhook verification
SLACK_SIGNING_SECRET=your-slack-signing-secret

# Optional but recommended
SLACK_TEAM_ID=your-slack-team-id

# Your webhook URL (for reference)
SLACK_WEBHOOK_URL=https://your-domain.com/api/slack/events
```

### 5. Development Setup with ngrok

For local development, you'll need to expose your localhost to the internet:

1. **Install ngrok:**
   ```bash
   brew install ngrok  # macOS
   # or download from https://ngrok.com/
   ```

2. **Start your Next.js app:**
   ```bash
   npm run dev
   ```

3. **In another terminal, start ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Update your Slack app's Event Request URL:**
   ```
   https://abc123.ngrok.io/api/slack/events
   ```

6. **Save the configuration** in Slack

### 6. Verify Setup

1. **Check Slack Verification:**
   - Slack will send a verification challenge to your endpoint
   - Our endpoint automatically responds with the challenge
   - You should see ✅ "Verified" in your Slack app settings

2. **Test with a Message:**
   - Send a message in a channel where your app is installed
   - Check the webhook data in your app:
   ```bash
   curl "http://localhost:3000/api/slack/webhooks?action=webhook-stats"
   ```

## Using Webhook Data

### API Endpoints

#### Get Recent Messages
```javascript
const messages = await fetch('/api/slack/webhooks?action=recent-messages&limit=50');
```

#### Get Channel Activity
```javascript
const activity = await fetch('/api/slack/webhooks?action=channel-activity&days=7');
```

#### Get Reaction Analytics
```javascript
const reactions = await fetch('/api/slack/webhooks?action=reaction-analytics&days=30');
```

#### Find People Mentions
```javascript
const mentions = await fetch('/api/slack/webhooks?action=mentions');
```

#### Get Webhook Statistics
```javascript
const stats = await fetch('/api/slack/webhooks?action=webhook-stats');
```

### Example Response - Recent Messages
```json
{
  "messages": [
    {
      "id": "C123-1640995200.123",
      "channel_id": "C123456",
      "channel_name": "general",
      "message_ts": "1640995200.123",
      "sender_id": "U123456",
      "text": "Hey team, project update is ready!",
      "thread_ts": null,
      "created_at": "2024-11-25T10:00:00.000Z"
    }
  ]
}
```

### Example Response - Channel Activity
```json
{
  "activity": [
    {
      "name": "general",
      "channel_id": "C123456",
      "message_count": 45,
      "unique_senders": 8,
      "last_activity": "2024-11-25T09:30:00.000Z"
    }
  ]
}
```

## Database Schema

The webhooks automatically store data in these tables:

### `slack_messages`
- `id` - Unique message identifier
- `user_id` - Your app user ID
- `channel_id` - Slack channel ID  
- `message_ts` - Slack timestamp
- `sender_id` - Message sender's Slack ID
- `text` - Message content
- `thread_ts` - Thread timestamp (if reply)
- `message_type` - 'channel', 'dm', 'group'

### `slack_reactions`
- `id` - Unique reaction identifier
- `channel_id` - Where the reaction happened
- `message_ts` - Which message was reacted to
- `reaction` - Emoji name (e.g., 'thumbsup')
- `reactor_id` - Who added the reaction

### `slack_channels`
- `id` - Unique record identifier
- `channel_id` - Slack channel ID
- `name` - Channel name
- `is_private` - Whether it's a private channel
- `creator_id` - Who created the channel

## Webhook Testing

### Test Webhook Processing
```javascript
// Test the webhook endpoint
const test = await fetch('/api/slack/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'test-webhook' })
});
```

### Clean Up Old Data
```javascript
// Remove data older than 30 days
const cleanup = await fetch('/api/slack/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'cleanup-old-data',
    days: 30
  })
});
```

## Integration with People Database

The webhook system automatically:

1. **Detects Mentions:** Finds when people from your database are mentioned in Slack
2. **Updates Profiles:** Syncs Slack profile changes with your people records  
3. **Tracks Interactions:** Logs when team members communicate in channels

## Security Features

- **Signature Verification:** All webhooks are verified using your Slack signing secret
- **Timestamp Validation:** Prevents replay attacks (5-minute window)
- **User Authorization:** Only processes events for authenticated users

## Troubleshooting

### Common Issues

**Webhook not receiving events:**
- Check your Request URL is correct and accessible
- Verify your SLACK_SIGNING_SECRET is set correctly
- Make sure your app is installed in the workspace
- Check that bot events are properly subscribed

**Verification failed:**
- Ensure your endpoint returns the challenge correctly
- Check for typos in the webhook URL
- Verify your server is running and accessible

**Events not being stored:**
- Check your database connection
- Verify the user is properly associated with the Slack workspace
- Look for errors in the console logs

### Debug Mode

Add logging to see webhook events:
```javascript
// In your webhook endpoint
console.log('Received Slack event:', JSON.stringify(event, null, 2));
```

## Rate Limits

Slack has rate limits for webhook events. Our system handles:
- **Signature verification** to ensure authenticity
- **Event deduplication** to prevent double processing
- **Graceful error handling** for temporary issues

## Production Considerations

1. **Scale:** Webhook events can be high volume in active workspaces
2. **Storage:** Consider archiving old messages periodically  
3. **Performance:** Index your database tables for faster queries
4. **Monitoring:** Set up alerts for webhook processing failures
5. **Backup:** Regularly backup webhook data if important for your workflow

## Next Steps

Once webhooks are working:
- Integrate webhook data with your standup reports
- Build notifications based on mentions
- Create analytics dashboards from channel activity
- Set up automated responses to specific message patterns