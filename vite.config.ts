import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.BACKEND_PORT || '3006';
const CLIENT_PORT = parseInt(process.env.CLIENT_PORT || '3005', 10);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: CLIENT_PORT,
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
