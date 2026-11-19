/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

const BASE = '/form-if-tracker/';

export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: BASE,
        name: 'FORM — IF & Wellness',
        short_name: 'FORM',
        description: 'Personal intermittent fasting & wellness tracker. Private, offline-first.',
        lang: 'th',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0507',
        theme_color: '#0b0507',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
