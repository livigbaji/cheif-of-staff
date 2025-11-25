import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import SlackProvider from 'next-auth/providers/slack';
import { NextAuthOptions } from 'next-auth';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks'
        }
      }
    }),
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile'
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'slack') {
        try {
          const userIdValue = account.provider === 'slack' ? account.providerAccountId : user.id;
          
          // First, try to find existing user by email for account linking
          const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(user.email);
          
          let userId: string;
          
          if (existingUser) {
            // User exists, link the new provider
            userId = existingUser.id;
            
            if (account.provider === 'google' && !existingUser.google_id) {
              // Link Google account
              db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(user.id, userId);
            } else if (account.provider === 'slack' && !existingUser.slack_id) {
              // Link Slack account  
              db.prepare('UPDATE users SET slack_id = ? WHERE id = ?').run(userIdValue, userId);
            }
          } else {
            // Create new user
            userId = uuidv4();
            if (account.provider === 'google') {
              db.prepare(`
                INSERT INTO users (id, email, name, google_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(userId, user.email, user.name, user.id, new Date().toISOString(), new Date().toISOString());
            } else if (account.provider === 'slack') {
              db.prepare(`
                INSERT INTO users (id, email, name, slack_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(userId, user.email, user.name, userIdValue, new Date().toISOString(), new Date().toISOString());
            }

            // Create default user profile
            db.prepare(`
              INSERT INTO user_profiles (id, user_id, who_i_am, who_i_want_to_be)
              VALUES (?, ?, ?, ?)
            `).run(uuidv4(), userId, '', '');
          }

          // Store tokens for API access
          if (account.access_token) {
            // Upsert integration settings
            db.prepare(`
              INSERT OR REPLACE INTO integration_settings 
              (id, user_id, service_name, access_token, refresh_token, settings_json)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              uuidv4(), 
              userId, 
              account.provider,
              account.access_token, 
              account.refresh_token || '',
              JSON.stringify({ scope: account.scope })
            );
          }

          return true;
        } catch (error) {
          console.error('Error during sign in:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(session.user.email);
        if (user) {
          session.user.id = user.id;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };