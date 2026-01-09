import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4000',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  reporter: 'list',
});
