import { defineConfig } from 'vitest/config';

import { swcPlugin } from './vitest.shared.js';

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
    // Codecov Test Analytics ingests JUnit XML to track failure rates, slow
    // tests and flakes. Only emitted under CI so local runs do not litter the
    // working tree with a report nobody reads.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-report.junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/**/*.interface.ts'],
      // Vitest reads these from `coverage.thresholds`. Declared one level up,
      // as they were, the whole block is silently ignored and the suite passes
      // at any coverage at all.
      //
      // Set near the measured figures (100% lines, 94.9% branches) rather than
      // at a round number well below them. A threshold far under actual
      // coverage permits a large regression without failing, which is how the
      // uncovered guard, interceptor and filter shipped in v5.0.0.
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 95,
      },
    },
  },
});
