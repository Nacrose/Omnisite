import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'e2e', 'skills'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Include only application source — exclude tests, generated files,
      // type definitions, and the seed/data files (which are static data
      // rather than executable logic worth measuring coverage on).
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/types.ts',
        'src/data/**',
        'src/test/setup.ts',
      ],
      // Thresholds are deliberately lenient — current coverage is unknown
      // because no coverage runs existed before this PR. The intent is to
      // ratchet these up over time. Once a baseline is established, raise
      // each by ~5% per sprint until we hit 80% across the board.
      // Set to 0 to avoid breaking CI on first run; promote to non-zero
      // thresholds in a follow-up once `test:coverage` reports a baseline.
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
      // Skip auto-update of thresholds — we want CI to fail on regressions
      // once thresholds are set, not silently ratchet down.
      // `all: true` is set via the `--coverage.all` CLI flag in `test:coverage`.
      // Clean up stale coverage reports before each run
      clean: true,
      // Watermarks for the HTML reporter — green/yellow/red cutoffs
      watermarks: {
        lines: [70, 90],
        functions: [70, 90],
        branches: [70, 90],
        statements: [70, 90],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
