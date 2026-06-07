import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Plugin pour copier .well-known qui est ignoré par défaut
function copyWellKnown() {
  return {
    name: 'copy-well-known',
    closeBundle() {
      const src = 'public/.well-known/assetlinks.json'
      if (existsSync(src)) {
        if (!existsSync('dist/.well-known')) mkdirSync('dist/.well-known', { recursive: true })
        copyFileSync(src, 'dist/.well-known/assetlinks.json')
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyWellKnown()],
  publicDir: 'public',
})
