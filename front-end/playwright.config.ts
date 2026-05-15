import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Global setup
  globalSetup: require.resolve('./test/global-setup.ts'),
  
  // Test suite configuration
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        launchOptions: {
          viewport: { width: 1920, height: 1080 },
        },
      },
    },
  ],
  
  // Test lifecyle
  testDir: './tests/e2e',
  
  // Artifacts and debugging
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure',
  
  // Reporting
  reporter: [['html', { open: 'never' }]],
   
  // Auto-wait for elements
  use: {
    actionTimeout: 5000,
    acceptDownloads: true,
    trace: 'on-first-retry',
  },
  
  // Parallelization
  workers: process.env.WORKERS ? parseInt(process.env.WORKERS) : 1,
  fullyParallel: true,
  
  // Quieting down the logs
  quiet: true,
});