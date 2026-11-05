import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', '_headers'],
        manifest: {
          id: '/',
          name: 'InkFlow Studio',
          short_name: 'InkFlow',
          description: 'Estudio de dibujo e ilustración digital móvil profesional acelerado por WebGPU y WebAssembly en formato PWA nativa.',
          theme_color: '#121316',
          background_color: '#121316',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,webmanifest}'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB para soportar SQLite Wasm y binarios
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Scripts, estilos y workers
              urlPattern: ({ request }) => 
                request.destination === 'script' || 
                request.destination === 'style' || 
                request.destination === 'worker',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.wasm$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'wasm-binary-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: '/index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm'],
    },
    esbuild: {
      // Poda agresiva de logs y sentencias debugger estilo R8 de Android
      drop: process.env.NODE_ENV === 'production' || process.env.CI ? ['console', 'debugger'] : [],
      legalComments: 'none',
      treeShaking: true,
    },
    build: {
      target: 'es2022',
      sourcemap: false, // Desactivar source maps para no duplicar el tamaño en producción
      cssMinify: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
