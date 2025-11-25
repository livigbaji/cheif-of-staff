import { WebClient } from '@slack/web-api';
import db from '@/lib/db';

// Slack API client wrapper for Chief of Staff integration
export class SlackAPI {
  private client: WebClient;
  
  constructor(accessToken: string) {
    this.client = new WebClient(accessToken);
  }

  // ==================== USER MANAGEMENT ====================
  
  /**
   * Get user info by user ID
   */
  async getUserInfo(userId: string) {
    try {
      const result = await this.client.users.info({ user: userId });
      return result.user;
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }

  /**
   * Get user by email (for mapping emails to Slack IDs)
   */
  async getUserByEmail(email: string) {
    try {
      const result = await this.client.users.lookupByEmail({ email });
      return result.user;
    } catch (error) {
      console.error('Error looking up user by email:', error);
      throw error;
    }
  }

  /**
   * Get all users in the workspace (for mapping)
   */
  async getAllUsers() {
    try {
      const result = await this.client.users.list();
      return result.members || [];
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  // ==================== DIRECT MESSAGES ====================

  /**
   * Send a direct message to a user
   */
  async sendDirectMessage(userId: string, message: string) {
    try {
      // Open a DM channel with the user
      const dmChannel = await this.client.conversations.open({ users: userId });
      
      if (!dmChannel.channel?.id) {
        throw new Error('Failed to open DM channel');
      }

      // Send the message
      const result = await this.client.chat.postMessage({
        channel: dmChannel.channel.id,
        text: message
      });

      return result;
    } catch (error) {
      console.error('Error sending direct message:', error);
      throw error;
    }
  }

  /**
   * Get direct message history with a user
   */
  async getDirectMessageHistory(userId: string, limit = 50) {
    try {
      // Open a DM channel with the user
      const dmChannel = await this.client.conversations.open({ users: userId });
      
      if (!dmChannel.channel?.id) {
        throw new Error('Failed to open DM channel');
      }

      // Get message history
      const result = await this.client.conversations.history({
        channel: dmChannel.channel.id,
        limit
      });

      return result.messages || [];
    } catch (error) {
      console.error('Error fetching DM history:', error);
      throw error;
    }
  }

  // ==================== CHANNELS ====================

  /**
   * Get list of channels user has access to
   */
  async getChannels() {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel'
      });
      return result.channels || [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
  }

  /**
   * Send message to a channel
   */
  async sendChannelMessage(channelId: string, message: string) {
    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text: message
      });
      return result;
    } catch (error) {
      console.error('Error sending channel message:', error);
      throw error;
    }
  }

  /**
   * Get channel message history
   */
  async getChannelHistory(channelId: string, limit = 50) {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        limit
      });
      return result.messages || [];
    } catch (error) {
      console.error('Error fetching channel history:', error);
      throw error;
    }
  }

  // ==================== THREADS ====================

  /**
   * Reply to a thread
   */
  async replyToThread(channelId: string, threadTs: string, message: string) {
    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text: message,
        thread_ts: threadTs
      });
      return result;
    } catch (error) {
      console.error('Error replying to thread:', error);
      throw error;
    }
  }

  /**
   * Get thread replies
   */
  async getThreadReplies(channelId: string, threadTs: string) {
    try {
      const result = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs
      });
      return result.messages || [];
    } catch (error) {
      console.error('Error fetching thread replies:', error);
      throw error;
    }
  }

  // ==================== SEARCH & CONTEXT ====================

  /**
   * Search messages for context gathering
   */
  async searchMessages(query: string, count = 20) {
    try {
      const result = await this.client.search.messages({
        query,
        count
      });
      return result.messages?.matches || [];
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  /**
   * Get conversation context around a specific message
   */
  async getMessageContext(channelId: string, messageTs: string, contextSize = 5) {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        latest: messageTs,
        inclusive: true,
        limit: contextSize * 2 + 1
      });
      return result.messages || [];
    } catch (error) {
      console.error('Error fetching message context:', error);
      throw error;
    }
  }

  // ==================== REACTIONS ====================

  /**
   * Add reaction to a message
   */
  async addReaction(channelId: string, messageTs: string, reaction: string) {
    try {
      const result = await this.client.reactions.add({
        channel: channelId,
        timestamp: messageTs,
        name: reaction
      });
      return result;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // ==================== WORKSPACE INFO ====================

  /**
   * Get team/workspace information
   */
  async getTeamInfo() {
    try {
      const result = await this.client.team.info();
      return result.team;
    } catch (error) {
      console.error('Error fetching team info:', error);
      throw error;
    }
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create Slack API instance from stored access token
 */
export async function createSlackClient(userId: string): Promise<SlackAPI | null> {
  try {
    // This would fetch the access token from your database
    const integration = db.prepare(`
      SELECT access_token 
      FROM integration_settings 
      WHERE user_id = ? AND service_name = 'slack'
    `).get(userId);

    if (!integration?.access_token) {
      return null;
    }

    return new SlackAPI(integration.access_token);
  } catch (error) {
    console.error('Error creating Slack client:', error);
    return null;
  }
}

/**
 * Map email addresses to Slack user IDs
 */
export async function mapEmailsToSlackIds(emails: string[], slackClient: SlackAPI) {
  const mapping: { [email: string]: string } = {};

  for (const email of emails) {
    try {
      const user = await slackClient.getUserByEmail(email);
      if (user?.id) {
        mapping[email] = user.id;
      }
    } catch {
      console.log(`Could not find Slack user for email: ${email}`);
    }
  }

  return mapping;
}

// ==================== MESSAGE TYPES ====================

export interface SlackMessage {
  type: string;
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  replies?: Array<{ user: string; ts: string }>;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_private: boolean;
  is_member: boolean;
}