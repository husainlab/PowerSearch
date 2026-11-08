import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    preact(),
    crx({ manifest }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:      resolve(__dirname, 'src/popup/index.html'),
        onboarding: resolve(__dirname, 'src/onboarding/index.html'),
      },
    },
  },
})
