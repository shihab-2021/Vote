import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'https://vote-rvg4.onrender.com',
    },
  },
})



// import path from 'path'
// import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite'
// import { defineConfig } from 'vite'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   resolve: {
//     alias: {
//       '@': path.resolve(import.meta.dirname, './src'),
//     },
//   },
//   server: {
//     proxy: {
//       '/api': 'http://localhost:8000',
//       // '/api': 'https://vote-rvg4.onrender.com',
//     },
//   },
// })
