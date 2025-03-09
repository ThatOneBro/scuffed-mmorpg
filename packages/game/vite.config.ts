import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@scuffed-mmorpg/common': resolve(__dirname, '../common/src')
    }
  },
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
}); 