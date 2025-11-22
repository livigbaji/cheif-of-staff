import { Page } from '@playwright/test';

export class TestHelpers {
  static async setupMockSession(page: Page, userOverrides = {}) {
    const defaultUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      ...userOverrides
    };

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: defaultUser,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      });
    });

    await page.route('**/api/gemini/config', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ hasApiKey: true, isConfigured: true })
        });
      }
    });
  }

  static async mockStandupFlow(page: Page) {
    await page.route('**/api/standup', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sessionId: 'test-session-id',
            message: 'Standup session created successfully'
          })
        });
      }
    });

    await page.route('**/api/standup/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isOnPoint: true,
          feedback: 'Great response! Very focused and actionable.',
          guidingQuestions: [
            'What specific deliverables will mark this as complete?',
            'Are there any dependencies that could affect the timeline?'
          ]
        })
      });
    });

    await page.route('**/api/checklist/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'item-1',
              title: 'Complete user authentication module',
              description: 'Implement OAuth2 integration and session management',
              priority: 1,
              estimatedTimeMinutes: 120,
              goalAlignment: ['security', 'user-experience']
            },
            {
              id: 'item-2',
              title: 'Write comprehensive tests',
              description: 'Create unit and integration tests for auth flow',
              priority: 2,
              estimatedTimeMinutes: 90,
              goalAlignment: ['quality', 'reliability']
            }
          ],
          insights: 'Focus on authentication first as it blocks other development work.',
          sessionId: 'test-session-id'
        })
      });
    });
  }

  static async fillStandupQuestions(page: Page, answers?: string[]) {
    const defaultAnswers = [
      'Completed the database schema design and API route implementation',
      'Did not finish writing all the integration tests due to time constraints',
      'Need the QA team to review test coverage requirements',
      'Clear testing guidelines and access to staging environment',
      'QA team was busy with other priorities and testing guidelines were unclear',
      'Complete the authentication module and write comprehensive tests',
      'Unclear requirements and potential conflicts with other team priorities',
      'Need to understand the exact security requirements and compliance standards'
    ];

    const answersToUse = answers || defaultAnswers;
    const textareas = page.locator('textarea');

    for (let i = 0; i < Math.min(8, answersToUse.length); i++) {
      await textareas.nth(i).fill(answersToUse[i]);
    }
  }

  static async waitForApiCall(page: Page, urlPattern: string, method = 'POST') {
    return new Promise((resolve) => {
      page.route(urlPattern, async (route) => {
        if (route.request().method() === method) {
          resolve(route.request());
        }
        await route.continue();
      });
    });
  }

  static generateLongText(baseText: string, repetitions = 3): string {
    return Array(repetitions).fill(baseText).join(' ');
  }

  static async mockApiError(page: Page, endpoint: string, errorCode = 500) {
    await page.route(endpoint, async (route) => {
      await route.fulfill({
        status: errorCode,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
  }

  static async mockApiDelay(page: Page, endpoint: string, delayMs = 2000) {
    await page.route(endpoint, async (route) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await route.continue();
    });
  }

  static async takeScreenshotOnFailure(page: Page, testName: string) {
    try {
      await page.screenshot({
        path: `test-results/${testName}-failure.png`,
        fullPage: true
      });
    } catch (error) {
      console.warn('Failed to take screenshot:', error);
    }
  }
}

export const mockData = {
  users: {
    testUser: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      gemini_api_key: 'test-api-key'
    },
    adminUser: {
      id: 'admin-123',
      email: 'admin@example.com',
      name: 'Admin User',
      gemini_api_key: 'admin-api-key'
    }
  },
  
  goals: [
    {
      id: 'goal-1',
      title: 'Improve Code Quality',
      description: 'Implement comprehensive testing and code review processes',
      type: 'business_objective',
      priority: 1,
      status: 'active'
    },
    {
      id: 'goal-2',
      title: 'Enhance Team Collaboration',
      description: 'Establish better communication protocols and tools',
      type: 'routine',
      priority: 2,
      status: 'active'
    }
  ],

  checklistItems: [
    {
      id: 'item-1',
      title: 'Review pull requests',
      description: 'Review and provide feedback on pending PRs',
      priority: 1,
      estimatedTimeMinutes: 45,
      status: 'pending'
    },
    {
      id: 'item-2',
      title: 'Update documentation',
      description: 'Update API documentation with recent changes',
      priority: 3,
      estimatedTimeMinutes: 60,
      status: 'in_progress'
    }
  ]
};