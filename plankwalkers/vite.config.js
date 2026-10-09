import { defineConfig } from 'vite';
import { pwaPlugin } from './tools/pwa-plugin.mjs';

export default defineConfig({
  plugins: [pwaPlugin()],
  server: {
    watch: {
      ignored: ['**/*.zip'],
    },
  },
  test: {
    include: ['src/**/*.test.js', 'tools/**/*.test.js'],
    environment: 'node',
  },
});

