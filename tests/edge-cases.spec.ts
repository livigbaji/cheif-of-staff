import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-utils';

test.describe('Edge Cases and Stress Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestHelpers.setupMockSession(page);
    await TestHelpers.mockStandupFlow(page);
  });

  test('should handle rapid consecutive API calls', async ({ page }) => {
    await page.goto('/');

    // Fill multiple answers quickly
    const textareas = page.locator('textarea');
    
    // Fill and analyze multiple questions rapidly
    for (let i = 0; i < 3; i++) {
      await textareas.nth(i).fill(`Answer ${i + 1} - rapid fire testing`);
      page.click(`button:near(textarea >> nth=${i}) >> text=Analyze Answer`).catch(() => {
        // Some requests might fail due to rapid firing, which is expected
      });
    }

    // Should still be functional
    await expect(page.locator('h2')).toContainText('Daily Standup');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto('/');

    // Navigate to different sections
    await page.click('text=Goals & Objectives');
    await expect(page.locator('text=Goals & Objectives view')).toBeVisible();

    // Go back
    await page.goBack();
    await expect(page.locator('h2')).toContainText('Daily Standup');

    // Go forward
    await page.goForward();
    await expect(page.locator('text=Goals & Objectives view')).toBeVisible();
  });

  test('should handle page refresh during standup', async ({ page }) => {
    await page.goto('/');

    // Fill some answers
    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.fill('Work completed yesterday');

    // Refresh the page
    await page.reload();

    // Should still show the standup interface
    await expect(page.locator('h2')).toContainText('Daily Standup');
    
    // Previous data won't persist across refresh (expected behavior)
    // but the interface should remain functional
    await firstTextarea.fill('New answer after refresh');
    await expect(firstTextarea).toHaveValue('New answer after refresh');
  });

  test('should handle multiple browser tabs', async ({ context }) => {
    // Create two tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await TestHelpers.setupMockSession(page1);
    await TestHelpers.setupMockSession(page2);
    await TestHelpers.mockStandupFlow(page1);
    await TestHelpers.mockStandupFlow(page2);

    // Navigate to app in both tabs
    await page1.goto('/');
    await page2.goto('/');

    // Both should work independently
    await expect(page1.locator('h2')).toContainText('Daily Standup');
    await expect(page2.locator('h2')).toContainText('Daily Standup');

    // Fill different data in each tab
    await page1.locator('textarea').first().fill('Tab 1 answer');
    await page2.locator('textarea').first().fill('Tab 2 answer');

    // Verify independence
    await expect(page1.locator('textarea').first()).toHaveValue('Tab 1 answer');
    await expect(page2.locator('textarea').first()).toHaveValue('Tab 2 answer');
  });

  test('should handle extremely long text inputs', async ({ page }) => {
    await page.goto('/');

    const longText = TestHelpers.generateLongText(
      'This is a very long response that simulates a user who provides extensive detail about their work, challenges, and plans. It includes multiple sentences with complex information about technical tasks, interpersonal communications, project dependencies, and strategic considerations that might affect the overall success of the initiatives.',
      10
    );

    const textarea = page.locator('textarea').first();
    
    // Fill with extremely long text
    await textarea.fill(longText);
    
    // Should handle long text without crashing
    await expect(textarea).toHaveValue(longText);
    
    // Should still be able to analyze
    await page.click('text=Analyze Answer');
    await expect(page.locator('text=Great response')).toBeVisible({ timeout: 10000 });
  });

  test('should handle special characters and emojis', async ({ page }) => {
    await page.goto('/');

    const specialText = 'Yesterday I worked on: 🚀 Authentication module with OAuth2 💻, fixed bugs in the dashboard 🐛, reviewed PRs 👀, and met with the team 👥. Challenges: ⚠️ API rate limits & database connection issues 🔌. Today: ✅ Complete testing & deployment 🚢';

    const textarea = page.locator('textarea').first();
    await textarea.fill(specialText);

    // Should handle special characters properly
    await expect(textarea).toHaveValue(specialText);
    
    // Analysis should work with special characters
    await page.click('text=Analyze Answer');
    await expect(page.locator('text=Great response')).toBeVisible();
  });

  test('should handle rapid mode switching', async ({ page }) => {
    await page.goto('/');

    // Rapidly switch between modes
    for (let i = 0; i < 5; i++) {
      await page.click('text=Waterfall Mode');
      await page.click('text=Cadence Mode');
    }

    // Should remain stable
    await expect(page.locator('h2')).toContainText('Daily Standup');
    await expect(page.locator('button:has-text("Cadence Mode")')).toHaveClass(/bg-blue-600/);
  });

  test('should handle API timeout scenarios', async ({ page }) => {
    // Mock slow API response
    await TestHelpers.mockApiDelay(page, '**/api/standup/analyze', 5000);
    
    await page.goto('/');

    const textarea = page.locator('textarea').first();
    await textarea.fill('Test answer for timeout scenario');
    
    // Click analyze and immediately try to do other actions
    page.click('text=Analyze Answer');
    
    // Should still allow other interactions while waiting
    await page.click('text=Waterfall Mode');
    await expect(page.locator('button:has-text("Waterfall Mode")')).toHaveClass(/bg-blue-600/);
  });

  test('should gracefully handle browser storage limitations', async ({ page }) => {
    await page.goto('/');

    // Fill localStorage to near capacity (this simulates storage pressure)
    await page.evaluate(() => {
      try {
        const largeData = 'x'.repeat(1000000); // 1MB of data
        for (let i = 0; i < 5; i++) {
          localStorage.setItem(`large_data_${i}`, largeData);
        }
      } catch (error) {
        // Storage quota exceeded - expected in some cases
      }
    });

    // App should still function normally
    const textarea = page.locator('textarea').first();
    await textarea.fill('Testing with storage pressure');
    await expect(textarea).toHaveValue('Testing with storage pressure');
  });

  test('should handle voice recognition errors gracefully', async ({ page }) => {
    // Mock speech recognition with error
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        continuous = true;
        interimResults = true;
        lang = 'en-US';
        onresult: ((event: any) => void) | null = null;
        onerror: ((event: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          // Simulate error after starting
          setTimeout(() => {
            if (this.onerror) {
              this.onerror({ error: 'no-speech' });
            }
          }, 100);
        }

        stop() {
          if (this.onend) {
            this.onend();
          }
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('/');

    // Try voice input (should handle error gracefully)
    const voiceButton = page.locator('button:has([class*="lucide-mic"])').first();
    await voiceButton.click();

    // Should not crash the app
    await expect(page.locator('h2')).toContainText('Daily Standup');
    
    // Should be able to continue with text input
    const textarea = page.locator('textarea').first();
    await textarea.fill('Fallback to text input after voice error');
    await expect(textarea).toHaveValue('Fallback to text input after voice error');
  });
});

test.describe('Data Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestHelpers.setupMockSession(page);
  });

  test('should validate standup form completion', async ({ page }) => {
    await page.goto('/');

    // Try to generate checklist without filling all questions
    const generateButton = page.locator('text=Generate Checklist');
    await expect(generateButton).toBeDisabled();

    // Fill one question
    await page.locator('textarea').first().fill('Some answer');
    
    // Should still be disabled
    await expect(generateButton).toBeDisabled();

    // Fill all questions
    await TestHelpers.fillStandupQuestions(page);
    
    // Should now be enabled
    await expect(generateButton).toBeEnabled();
  });

  test('should handle empty API responses', async ({ page }) => {
    // Mock empty responses
    await page.route('**/api/standup/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await page.goto('/');

    const textarea = page.locator('textarea').first();
    await textarea.fill('Test answer');
    
    // Should handle empty analysis response gracefully
    await page.click('text=Analyze Answer');
    
    // App should remain functional
    await expect(textarea).toHaveValue('Test answer');
  });

  test('should handle malformed checklist data', async ({ page }) => {
    await TestHelpers.mockStandupFlow(page);
    
    // Override with malformed checklist response
    await page.route('**/api/checklist/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            // Missing required fields
            { title: 'Incomplete item' },
            // Invalid priority
            { title: 'Invalid priority', priority: 'high' },
            // Null values
            { title: null, description: 'Null title' }
          ]
        })
      });
    });

    await page.goto('/');
    
    await TestHelpers.fillStandupQuestions(page);
    await page.click('text=Generate Checklist');

    // Should handle malformed data gracefully
    await expect(page.locator('h2')).toContainText('Today\'s Checklist');
  });
});