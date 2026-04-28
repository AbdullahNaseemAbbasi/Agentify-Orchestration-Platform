module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'prettier'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist/**', 'node_modules/**'],
  rules: {
    // Prettier as ESLint rule — formatting issues become lint errors
    'prettier/prettier': 'error',

    // Allow explicit `any` only with justification (project rule per spec §24.1)
    '@typescript-eslint/no-explicit-any': 'warn',

    // Require explicit return types on exported functions (catches API drift early)
    '@typescript-eslint/explicit-module-boundary-types': 'warn',

    // Allow unused params if prefixed with _ (common pattern in callbacks)
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // NestJS DI relies on decorators, no need for explicit member visibility
    '@typescript-eslint/explicit-member-accessibility': 'off',

    // Empty interfaces are sometimes useful as marker types in NestJS
    '@typescript-eslint/no-empty-interface': 'warn',
  },
};
