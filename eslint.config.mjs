import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // TypeScript rules — re-enabled incrementally
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn', // RE-ENABLED as warn
      '@typescript-eslint/ban-ts-comment': 'warn', // RE-ENABLED as warn
      '@typescript-eslint/prefer-as-const': 'off', // deprecated, TS handles it
      '@typescript-eslint/no-unused-disable-directive': 'off', // conflicts with complex configs

      // React rules — re-enabled incrementally
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off', // experimental
      'react/no-unescaped-entities': 'warn', // RE-ENABLED as warn
      'react/display-name': 'off', // noisy for arrow components
      'react/prop-types': 'off', // irrelevant for TS
      'react-compiler/react-compiler': 'off', // requires React Compiler setup

      // Next.js rules
      '@next/next/no-img-element': 'warn', // RE-ENABLED as warn
      '@next/next/no-html-link-for-pages': 'off', // App Router doesn't use this

      // General JavaScript rules — re-enabled incrementally
      'prefer-const': 'warn',
      'no-unused-vars': 'off', // handled by @typescript-eslint
      'no-console': 'warn', // RE-ENABLED as warn
      'no-debugger': 'warn', // RE-ENABLED as warn
      'no-empty': 'warn', // RE-ENABLED as warn
      'no-irregular-whitespace': 'warn', // RE-ENABLED as warn
      'no-case-declarations': 'warn', // RE-ENABLED as warn
      'no-fallthrough': 'warn', // RE-ENABLED as warn
      'no-mixed-spaces-and-tabs': 'warn', // RE-ENABLED as warn
      'no-redeclare': 'warn', // RE-ENABLED as warn
      'no-undef': 'off', // TS handles this; ESLint version conflicts
      'no-unreachable': 'warn',
      'no-useless-escape': 'warn', // RE-ENABLED as warn
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'examples/**',
      'skills',
      'e2e/**',
    ],
  },
]

export default eslintConfig
