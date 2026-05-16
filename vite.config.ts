import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    {
      name: 'copy-404-html',
      writeBundle() {
        fs.copyFileSync(
          path.resolve(__dirname, 'dist/index.html'), 
          path.resolve(__dirname, 'dist/404.html')
        );
        console.log('📄 Copied dist/index.html to dist/404.html for GitHub Pages SPA routing.');
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Therapie-Safe: TEN Rezepte',
        short_name: 'TEN Rezepte',
        description: 'Offline-fähiges Portal für TEN Rezepte',
        theme_color: '#F8F6F2',
        background_color: '#F8F6F2',
        display: 'standalone',
        icons: [
          {
            src: 'image_062b03.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
})
