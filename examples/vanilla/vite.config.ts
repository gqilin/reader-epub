import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
  },
  resolve: {
    alias: {
      'epub-reader': resolve(__dirname, '../../src/index.ts'),
    },
  },
});
