import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/my-dashboard/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'docs',
  },
  server: {
    port: 3000,
    open: true,
  },
})
