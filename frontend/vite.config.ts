import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // three.js bo'lagi katta (~850 KB, gzip ~230 KB), lekin u faqat sahifa yuklangach va kuchli qurilmalarda yuklanadi
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Kutubxonalar alohida bo'laklarda — kam o'zgaradi, brauzer uzoq keshlaydi
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          data: ['@tanstack/react-query', 'i18next', 'react-i18next'],
          // 3D — alohida bo'lak, faqat kerak bo'lganda (sahifa yuklangach) yuklanadi
          three: ['three', '@react-three/fiber'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5080',
      '/uploads': 'http://localhost:5080',
    },
  },
});
