import { defineConfig } from 'vitest/config';

import { swcPlugin } from './vitest.shared';

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // Integration specs hit the live Twilio API and are run by
    // vitest.integration.config.ts only.
    exclude: ['lib/**/*.integration.test.ts', 'node_modules'],
    // The unit suite is introduced incrementally across this release; an empty
    // run is not a failure.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/**/*.interface.ts'],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
});
