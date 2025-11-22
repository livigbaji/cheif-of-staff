import { test, expect, Page } from '@playwright/test';

// Helper to set up authenticated session with mocked APIs
async function setupAuthenticatedSession(page: Page) {
  // Mock all necessary APIs
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User'
        }
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

  await page.route('**/api/goals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        goals: [
          {
            id: 'goal-1',
            title: 'Improve Code Quality',
            type: 'business_objective',
            priority: 1,
            status: 'active'
          }
        ]
      })
    });
  });

  await page.goto('/');
}

test.describe('API Integration Tests', () => {
  test('should handle Gemini API responses correctly', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock Gemini analysis API
    await page.route('**/api/standup/analyze', async (route) => {
      const requestBody = await route.request().postDataJSON();
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isOnPoint: requestBody.answer.length > 10,
          feedback: requestBody.answer.length > 10 
            ? 'Good detailed response!' 
            : 'Please provide more detail.',
          guidingQuestions: [
            'What specific outcomes were achieved?',
            'What metrics can you use to measure this?'
          ]
        })
      });
    });

    // Fill an answer
    const textarea = page.locator('textarea').first();
    await textarea.fill('Completed authentication module implementation with full test coverage');
    
    // Analyze the response
    await page.click('text=Analyze Answer');
    
    // Check the analysis result
    await expect(page.locator('text=Good detailed response!')).toBeVisible();
    await expect(page.locator('text=On Point')).toBeVisible();
  });

  test('should handle checklist generation API', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock standup creation
    await page.route('**/api/standup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          message: 'Standup session created successfully'
        })
      });
    });

    // Mock checklist generation
    await page.route('**/api/checklist/generate', async (route) => {
      const requestBody = await route.request().postDataJSON();
      expect(requestBody.sessionId).toBe('test-session-123');
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'item-1',
              title: 'Complete user authentication testing',
              description: 'Write comprehensive end-to-end tests',
              priority: 1,
              estimatedTimeMinutes: 90,
              goalAlignment: ['quality', 'productivity']
            }
          ],
          insights: 'Focus on testing critical authentication flows first.',
          sessionId: 'test-session-123'
        })
      });
    });

    // Fill standup questions
    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Worked on authentication module');
    await textareas.nth(1).fill('Did not complete all tests');
    await textareas.nth(2).fill('QA team for test review');
    await textareas.nth(3).fill('Test scenarios and edge cases');
    await textareas.nth(4).fill('Unclear requirements for edge cases');
    await textareas.nth(5).fill('Complete authentication testing');
    await textareas.nth(6).fill('Missing test data could block progress');
    await textareas.nth(7).fill('Need clarification on security requirements');

    // Generate checklist
    await page.click('text=Generate Checklist');
    
    // Verify checklist is displayed
    await expect(page.locator('h2')).toContainText('Today\'s Checklist');
    await expect(page.locator('text=Complete user authentication testing')).toBeVisible();
    await expect(page.locator('text=Priority 1')).toBeVisible();
    await expect(page.locator('text=Est. 90 min')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock API error for Gemini analysis
    await page.route('**/api/standup/analyze', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    // Fill an answer
    const textarea = page.locator('textarea').first();
    await textarea.fill('Test answer');
    
    // Try to analyze (should handle error gracefully)
    await page.click('text=Analyze Answer');
    
    // The UI should still be functional even if the API fails
    await expect(textarea).toHaveValue('Test answer');
  });
});

test.describe('Voice Input Tests', () => {
  test('should show voice input buttons', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Voice buttons should be visible next to textareas
    const voiceButtons = page.locator('button:has([data-testid="mic-icon"], .lucide-mic)');
    await expect(voiceButtons.first()).toBeVisible();
  });

  test('should handle voice input state changes', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock speech recognition API
    await page.addInitScript(() => {
      // Mock SpeechRecognition API
      class MockSpeechRecognition {
        continuous = true;
        interimResults = true;
        lang = 'en-US';
        onresult: ((event: any) => void) | null = null;
        onerror: (() => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          // Simulate speech recognition result
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                resultIndex: 0,
                results: [
                  [{ transcript: 'This is a test voice input' }]
                ]
              });
            }
          }, 100);
        }

        stop() {
          setTimeout(() => {
            if (this.onend) {
              this.onend();
            }
          }, 50);
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    // Click voice button
    const voiceButton = page.locator('button:has([data-testid="mic-icon"], .lucide-mic)').first();
    await voiceButton.click();

    // Should show microphone-off icon when listening
    await expect(page.locator('.lucide-mic-off').first()).toBeVisible({ timeout: 1000 });
    
    // Should populate textarea with voice input
    await expect(page.locator('textarea').first()).toHaveValue('This is a test voice input');
  });
});

test.describe('Checklist Management Tests', () => {
  test('should display empty checklist state', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Navigate to checklist
    await page.click('text=Checklist');
    
    // Should show empty state
    await expect(page.locator('text=Complete your standup to generate checklist items.')).toBeVisible();
  });

  test('should update checklist item status', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock checklist with items
    await page.route('**/api/checklist', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'item-1',
                title: 'Review authentication code',
                description: 'Check for security vulnerabilities',
                priority: 1,
                status: 'pending',
                estimatedTimeMinutes: 60
              }
            ]
          })
        });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Checklist item updated successfully' })
        });
      }
    });

    // Navigate to checklist
    await page.click('text=Checklist');
    
    // Should show checklist item
    await expect(page.locator('text=Review authentication code')).toBeVisible();
    await expect(page.locator('text=Priority 1')).toBeVisible();
  });
});

test.describe('Data Persistence Tests', () => {
  test('should persist standup answers across navigation', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Fill first question
    const textarea = page.locator('textarea').first();
    await textarea.fill('Worked on user authentication yesterday');

    // Navigate away and back
    await page.click('text=Goals & Objectives');
    await page.click('text=Daily Standup');

    // Answer should still be there
    await expect(textarea).toHaveValue('Worked on user authentication yesterday');
  });

  test('should handle session expiration', async ({ page }) => {
    // Start with valid session
    await setupAuthenticatedSession(page);

    // Simulate session expiration
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });

    // Reload page
    await page.reload();

    // Should redirect to sign-in
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
  });
});