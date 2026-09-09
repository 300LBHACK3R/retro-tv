import { defineConfig } from '@playwright/test';
// Node-only regression checks. No browser or web server is started.
export default defineConfig({ testDir: '.', testMatch: '**/*.unit.ts', workers: 1, reporter: 'list' });
