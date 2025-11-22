import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
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
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists
          const existingUser = db.prepare('SELECT * FROM users WHERE google_id = ?').get(user.id);
          
          if (!existingUser) {
            // Create new user
            const userId = uuidv4();
            db.prepare(`
              INSERT INTO users (id, email, name, google_id)
              VALUES (?, ?, ?, ?)
            `).run(userId, user.email, user.name, user.id);

            // Create default user profile
            db.prepare(`
              INSERT INTO user_profiles (id, user_id, who_i_am, who_i_want_to_be)
              VALUES (?, ?, ?, ?)
            `).run(uuidv4(), userId, '', '');
          }

          // Store tokens for Google API access
          if (account.access_token) {
            const userId = existingUser?.id || db.prepare('SELECT id FROM users WHERE google_id = ?').get(user.id)?.id;
            
            // Upsert integration settings
            db.prepare(`
              INSERT OR REPLACE INTO integration_settings 
              (id, user_id, service_name, access_token, refresh_token, settings_json)
              VALUES (?, ?, 'google', ?, ?, ?)
            `).run(
              uuidv4(), 
              userId, 
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
    async session({ session, token }) {
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