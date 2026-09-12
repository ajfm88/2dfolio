import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/*.zip'],
    },
  },
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
});

