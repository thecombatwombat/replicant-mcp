import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      enabled: false, // Only enable with --coverage flag
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/index.ts', // Barrel exports
        'src/types/**', // Type definitions
        '**/*.d.ts',
        'tests/**',
      ],
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary', 'clover'],

      thresholds: {
        lines: 68, // Current: 68.71%
        branches: 60, // Current: 60.49%
        functions: 63, // Current: 63.17%
        statements: 70, // Current: 70.1%
        perFile: false,
      },
    },
  },
});
