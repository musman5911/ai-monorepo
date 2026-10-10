import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Allow importing from the dairy app's src (shared muf twins are identical)
      '@dairy': path.resolve(__dirname, 'dairy_farm/client/src'),
    },
  },
});
