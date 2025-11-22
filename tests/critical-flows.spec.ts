import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_EMAIL = 'test@example.com';
const TEST_NAME = 'Test User';
const TEST_GEMINI_API_KEY = 'test-gemini-api-key-for-testing';

// Mock responses
const mockGoogleTokenResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  scope: 'openid email profile',
  token_type: 'Bearer',
  id_token: 'mock-id-token'
};

const mockGoogleUserInfo = {
  sub: 'mock-google-id',
  email: TEST_EMAIL,
  name: TEST_NAME,
  picture: 'https://example.com/picture.jpg'
};

// Helper functions
async function mockGoogleAuth(page: Page) {
  // Mock Google OAuth endpoints
  await page.route('**/auth/**', async (route) => {
    const url = route.request().url();
    
    if (url.includes('callback/google')) {
      // Mock successful OAuth callback
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/?session=authenticated'
        }
      });
    } else if (url.includes('signin/google')) {
      // Mock OAuth redirect
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/api/auth/callback/google?code=mock-auth-code'
        }
      });
    } else {
      await route.continue();
    }
  });

  // Mock session endpoint
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-id',
          email: TEST_EMAIL,
          name: TEST_NAME,
          image: 'https://example.com/picture.jpg'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
  });
}

async function mockGeminiAPI(page: Page) {
  // Mock Gemini API configuration
  await page.route('**/api/gemini/config', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasApiKey: true,
          isConfigured: true
        })
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Gemini API key configured successfully'
        })
      });
    }
  });

  // Mock Gemini analysis responses
  await page.route('**/api/standup/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        isOnPoint: true,
        feedback: 'Great response! Very focused and clear.',
        guidingQuestions: [
          'What specific metrics will you use to measure success?',
          'Are there any dependencies that could affect this?'
        ]
      })
    });
  });
}

async function signInUser(page: Page) {
  await mockGoogleAuth(page);
  await mockGeminiAPI(page);
  
  // Go to homepage
  await page.goto('/');
  
  // Click sign in button
  await page.click('text=Sign in with Google');
  
  // Wait for authentication to complete
  await page.waitForURL('**/');
  
  // Should now be on the dashboard
  await expect(page.locator('h1')).toContainText('Chief of Staff');
}

test.describe('Authentication Flow', () => {
  test('should show sign-in page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should show sign-in page
    await expect(page.locator('h1')).toContainText('Chief of Staff');
    await expect(page.locator('text=AI-powered productivity assistant')).toBeVisible();
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
  });

  test('should authenticate user successfully', async ({ page }) => {
    await mockGoogleAuth(page);
    await page.goto('/');
    
    // Click sign in
    await page.click('text=Sign in with Google');
    
    // Should redirect to Gemini config since no API key is set initially
    await expect(page.locator('h2')).toContainText('Configure Gemini API');
  });

  test('should configure Gemini API key', async ({ page }) => {
    await mockGoogleAuth(page);
    await page.goto('/');
    
    // Sign in
    await page.click('text=Sign in with Google');
    
    // Should be on Gemini config page
    await expect(page.locator('h2')).toContainText('Configure Gemini API');
    
    // Enter API key
    await page.fill('input[placeholder*="Gemini API key"]', TEST_GEMINI_API_KEY);
    await page.click('text=Configure API');
    
    // Should now show dashboard
    await expect(page.locator('h1')).toContainText('Chief of Staff');
    await expect(page.locator('nav')).toBeVisible();
  });
});

test.describe('Daily Standup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await signInUser(page);
  });

  test('should display standup questions', async ({ page }) => {
    // Should be on standup by default
    await expect(page.locator('h2')).toContainText('Daily Standup');
    
    // Should show mode selection
    await expect(page.locator('text=Cadence Mode')).toBeVisible();
    await expect(page.locator('text=Waterfall Mode')).toBeVisible();
    
    // Should show all 8 standup questions
    const questions = [
      'What did you do yesterday?',
      'What were you not able to do yesterday?',
      'Who do you need to do it?',
      'What do you need to do it?',
      'Why were you not able to do it?',
      'What are you doing today?',
      'What could stop you from doing it?',
      'What do you need to understand going into the day?'
    ];

    for (const question of questions) {
      await expect(page.locator(`text=${question}`)).toBeVisible();
    }
  });

  test('should allow text input for standup answers', async ({ page }) => {
    const firstTextarea = page.locator('textarea').first();
    
    // Type answer
    await firstTextarea.fill('Yesterday I completed the user authentication module and fixed several bugs in the dashboard.');
    
    // Verify answer is saved
    await expect(firstTextarea).toHaveValue('Yesterday I completed the user authentication module and fixed several bugs in the dashboard.');
    
    // Should show analyze button
    await expect(page.locator('text=Analyze Answer')).toBeVisible();
  });

  test('should analyze standup responses', async ({ page }) => {
    const firstTextarea = page.locator('textarea').first();
    
    // Fill answer
    await firstTextarea.fill('Yesterday I completed the user authentication module.');
    
    // Click analyze
    await page.click('text=Analyze Answer');
    
    // Should show analysis results
    await expect(page.locator('text=On Point')).toBeVisible();
    await expect(page.locator('text=Great response! Very focused and clear.')).toBeVisible();
    await expect(page.locator('text=Guiding Questions:')).toBeVisible();
  });

  test('should switch between cadence and waterfall modes', async ({ page }) => {
    // Default should be cadence
    await expect(page.locator('button:has-text("Cadence Mode")')).toHaveClass(/bg-blue-600/);
    
    // Switch to waterfall
    await page.click('text=Waterfall Mode');
    await expect(page.locator('button:has-text("Waterfall Mode")')).toHaveClass(/bg-blue-600/);
    
    // Switch back to cadence
    await page.click('text=Cadence Mode');
    await expect(page.locator('button:has-text("Cadence Mode")')).toHaveClass(/bg-blue-600/);
  });

  test('should generate checklist after completing standup', async ({ page }) => {
    // Mock standup and checklist APIs
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

    await page.route('**/api/checklist/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'item-1',
              title: 'Complete authentication testing',
              description: 'Write comprehensive tests for the auth flow',
              priority: 1,
              estimatedTimeMinutes: 120,
              goalAlignment: ['productivity', 'quality']
            },
            {
              id: 'item-2',
              title: 'Fix dashboard bugs',
              description: 'Address the UI issues reported yesterday',
              priority: 2,
              estimatedTimeMinutes: 90,
              goalAlignment: ['quality']
            }
          ],
          insights: 'Focus on completing authentication work first, then tackle the dashboard issues.',
          sessionId: 'test-session-id'
        })
      });
    });

    // Fill all standup questions
    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Completed user authentication module');
    await textareas.nth(1).fill('Could not finish the dashboard styling');
    await textareas.nth(2).fill('Need the design team for final approval');
    await textareas.nth(3).fill('Design specifications and asset files');
    await textareas.nth(4).fill('Design team was unavailable for review');
    await textareas.nth(5).fill('Write tests and fix dashboard bugs');
    await textareas.nth(6).fill('Lack of clear requirements could be a blocker');
    await textareas.nth(7).fill('Need to understand the exact test coverage requirements');

    // Generate checklist
    await page.click('text=Generate Checklist');
    
    // Should navigate to checklist view
    await expect(page.locator('h2')).toContainText('Today\'s Checklist');
    
    // Should show generated checklist items
    await expect(page.locator('text=Complete authentication testing')).toBeVisible();
    await expect(page.locator('text=Fix dashboard bugs')).toBeVisible();
    await expect(page.locator('text=Priority 1')).toBeVisible();
    await expect(page.locator('text=Est. 120 min')).toBeVisible();
  });
});

test.describe('Navigation and UI', () => {
  test.beforeEach(async ({ page }) => {
    await signInUser(page);
  });

  test('should navigate between different sections', async ({ page }) => {
    // Should start on standup
    await expect(page.locator('h2')).toContainText('Daily Standup');
    
    // Navigate to goals
    await page.click('text=Goals & Objectives');
    await expect(page.locator('text=Goals & Objectives view - Coming soon!')).toBeVisible();
    
    // Navigate to people
    await page.click('text=People');
    await expect(page.locator('text=People management view - Coming soon!')).toBeVisible();
    
    // Navigate to analytics
    await page.click('text=Analytics');
    await expect(page.locator('text=Analytics view - Coming soon!')).toBeVisible();
    
    // Navigate to settings
    await page.click('text=Settings');
    await expect(page.locator('text=Settings view - Coming soon!')).toBeVisible();
    
    // Navigate back to standup
    await page.click('text=Daily Standup');
    await expect(page.locator('h2')).toContainText('Daily Standup');
  });

  test('should show user information in header', async ({ page }) => {
    await expect(page.locator('text=Test User')).toBeVisible();
    await expect(page.locator('text=Sign out')).toBeVisible();
  });

  test('should sign out successfully', async ({ page }) => {
    // Mock sign out
    await page.route('**/api/auth/signout', async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/'
        }
      });
    });

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    // Click sign out
    await page.click('text=Sign out');
    
    // Should return to sign-in page
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    await mockGoogleAuth(page);
    await mockGeminiAPI(page);
    await page.goto('/');
    
    // Sign in should work on mobile
    await page.click('text=Sign in with Google');
    
    // Dashboard should be responsive
    await expect(page.locator('h1')).toContainText('Chief of Staff');
    await expect(page.locator('nav')).toBeVisible();
    
    // Standup form should be usable on mobile
    await expect(page.locator('h2')).toContainText('Daily Standup');
    await expect(page.locator('textarea').first()).toBeVisible();
  });
});