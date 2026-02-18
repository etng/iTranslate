import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("@tauri-apps")) {
            return "tauri";
          }
          if (id.includes("@uiw") || id.includes("@codemirror")) {
            return "editor";
          }
          if (id.includes("marked") || id.includes("turndown") || id.includes("dompurify")) {
            return "markdown";
          }
          if (id.includes("react") || id.includes("lucide-react")) {
            return "vendor";
          }
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.ts',
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['e2e/**'],
  },
})
