import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '**/*.browser.ts', fullyParallel: true,
  forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0, workers: 2,
  timeout: 45_000, expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', locale: 'en-CA', timezoneId: 'America/Edmonton', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run start -- --port 3100', url: 'http://localhost:3100', reuseExistingServer: false, timeout: 60_000 },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'android-phone', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
    { name: 'television', use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 } } },
  ],
});
