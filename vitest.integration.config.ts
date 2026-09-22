import { defineConfig } from 'vitest/config';

import { swcPlugin } from './vitest.shared';

// Live-API suite. Requires real Twilio credentials and sends real messages, so
// it never runs on pull requests, only via manual workflow_dispatch or locally.
export default defineConfig({
  plugins: [swcPlugin],
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.integration.test.ts'],
    testTimeout: 30_000,
  },
});
