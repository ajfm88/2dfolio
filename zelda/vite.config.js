import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // Vite 8's lightningcss minify rejects the ES2022 JS target as a CSS target.
    cssMinify: false,
  },
});
