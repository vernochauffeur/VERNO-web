import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// index.html keeps a <!-- FAQ_SCHEMA --> placeholder: scripts/prerender.mjs
// fills it per page with FAQPage data for the questions that page shows.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
