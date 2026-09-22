import { defineConfig } from 'vitest/config';

// The rules tests talk to the Firestore emulator, so they are a separate suite:
// `npm run test:rules` starts the emulator around them. They use the Node
// environment because @firebase/rules-unit-testing drives the emulator's REST
// and gRPC endpoints directly, not a browser SDK.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
