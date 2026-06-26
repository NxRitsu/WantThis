import { defineConfig } from 'vite'

// Le site est servi sous https://<user>.github.io/WantThis/
// => base doit correspondre au nom du repo pour que les chemins soient corrects.
export default defineConfig({
  base: '/WantThis/',
  build: {
    outDir: 'dist',
  },
})
