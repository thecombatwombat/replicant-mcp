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
        'src/cli/**', // Thin CLI wrappers (excluded from complexity checks too)
        '**/*.d.ts',
        'tests/**',
      ],
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary', 'clover'],

      thresholds: {
        lines: 68,
        branches: 60,
        functions: 60,
        statements: 67,
        perFile: false,
      },
    },
  },
});
