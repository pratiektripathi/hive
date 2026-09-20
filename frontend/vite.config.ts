import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/', // ✅ REQUIRED for web hosting

  plugins: [
    react(),
    tailwindcss()
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      cn: path.resolve(__dirname, "./node_modules/@udecode/cn"),
    },
  },
  optimizeDeps: {
    include: [
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
    ],
  },

  server: {
    allowedHosts: ['localhost', '127.0.0.1', 'hive.100xseller.com'],
  },
})
