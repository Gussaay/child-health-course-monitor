import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    // The rules tests need the Firestore emulator, so they are run separately
    // by `npm run test:rules` rather than in the default suite.
    exclude: ['tests/rules/**', 'node_modules/**'],
  },
});
