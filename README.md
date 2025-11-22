# Chief of Staff - AI-Powered Productivity Assistant

A comprehensive AI-powered productivity application that helps you manage daily standups, track goals, maintain checklists, and provides intelligent insights using Google's Gemini AI.

## Features

### 🎤 Smart Daily Standups
- Voice and text input for standup questions
- AI analysis of responses to keep you focused
- Automatic checklist generation based on standup responses

### ✅ Intelligent Checklists
- AI-generated daily task lists
- Two modes: Cadence (interval checks) and Waterfall (time-based scheduling)
- Strike system with risk flagging
- Real-time progress tracking

### 🎯 Goal Alignment
- Set overarching goals, routines, and business objectives
- Every checklist item aligns with your goals
- Track alignment metrics over time

### 👥 People Management
- Profile people you work with
- Factor in biases and communication styles
- Task delegation and assignment tracking

### 📊 Analytics & Insights
- Adherence tracking
- Productivity analytics
- Personal growth recommendations
- Alignment metrics for "better self" goals

### 🔗 Integrations
- Google Calendar for reminders
- Google Tasks API integration
- Slack messaging
- Email notifications
- Stakeholder reporting

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Google Cloud Console account
- Gemini API access

### 1. Clone and Install

```bash
git clone <repository-url>
cd chief-of-staff
npm install
```

### 2. Environment Setup

Copy the environment template:
```bash
cp .env.example .env.local
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Calendar API
   - Google Tasks API
   - Google+ API (for OAuth)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Copy Client ID and Client Secret to your `.env.local`:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. NextAuth Configuration

Generate a random secret for NextAuth:
```bash
openssl rand -base64 32
```

Add to `.env.local`:
```env
NEXTAUTH_SECRET=your-generated-secret
NEXTAUTH_URL=http://localhost:3000
```

### 5. Gemini API Setup

1. Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. You'll configure this through the UI when you first sign in (not in environment variables)

### 6. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Usage

### First Time Setup
1. Sign in with Google
2. Enter your Gemini API key when prompted
3. Configure your user profile

### Daily Workflow
1. **Morning Standup**: Answer the 8 standup questions using voice or text
2. **Get AI Analysis**: Review AI feedback on your responses
3. **Generate Checklist**: Create your daily checklist based on standup responses
4. **Choose Mode**: 
   - **Cadence Mode**: Regular interval check-ins
   - **Waterfall Mode**: Time-based scheduling with Gantt chart
5. **Track Progress**: Check off items throughout the day
6. **Handle Blockers**: Get AI advice on obstacles and time adjustments

### Setting Goals
1. Navigate to "Goals & Objectives"
2. Add your overarching goals, routines, and business objectives
3. Set priorities, deadlines, and cadences
4. All future checklist items will align with these goals

### People Management
1. Go to "People" section
2. Add profiles for colleagues, stakeholders, and team members
3. Include their communication styles, biases, and work functions
4. These profiles influence task assignments and reporting

### Analytics
- View adherence scores and productivity metrics
- Get insights on alignment with your "better self" goals
- Receive AI recommendations for improvement

## Technology Stack

- **Frontend**: Next.js 16, React, TypeScript, TailwindCSS
- **Backend**: Next.js API routes
- **Database**: SQLite with better-sqlite3
- **AI**: Google Gemini AI
- **Authentication**: NextAuth.js with Google OAuth
- **Integrations**: Google APIs, Slack Web API
- **Voice**: Browser Speech Recognition API

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   ├── auth/             # Authentication pages
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── providers.tsx     # Context providers
├── components/           # React components
│   └── Dashboard.tsx     # Main dashboard
├── lib/                  # Utilities
│   ├── db.ts            # Database setup
│   ├── gemini.ts        # Gemini AI service
│   └── utils.ts         # General utilities
└── types/               # TypeScript definitions
    ├── database.ts      # Database types
    ├── global.d.ts      # Global types
    └── next-auth.d.ts   # NextAuth types
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please create an issue in the GitHub repository.
