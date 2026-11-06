import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test-setup.js', globals: true },
  server: {
    port: 5173,
    // changeOrigin must stay false: the API's CORS check compares the browser's Origin with the Host header,
    // and the shorthand form would rewrite Host to :4000 and make every sign-in from :5173 fail.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
      '/health': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
});
