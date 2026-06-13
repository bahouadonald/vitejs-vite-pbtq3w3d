import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'

// Plugin pour forcer la copie de .well-known/assetlinks.json
function copyWellKnown() {
  return {
    name: 'copy-well-known',
    writeBundle() {
      try {
        const content = readFileSync('public/.well-known/assetlinks.json', 'utf-8')
        if (!existsSync('dist/.well-known')) {
          mkdirSync('dist/.well-known', { recursive: true })
        }
        writeFileSync('dist/.well-known/assetlinks.json', content)
        console.log('\u2713 assetlinks.json copie dans dist/.well-known/')
      } catch (e) {
        console.error('Erreur copie assetlinks:', e)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), copyWellKnown()],
  build: {
    // Separer Firebase dans son propre chunk : mieux mis en cache, charge en parallele
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
        },
      },
    },
  },
})
