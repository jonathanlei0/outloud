import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: 'src/background.ts',
          content: 'src/content/content.ts',
          popup: 'src/popup/popup.html'
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background.js';
            if (chunkInfo.name === 'content') return 'content.js';
            return '[name].js';
          },
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      },
      copyPublicDir: true
    },
    publicDir: 'public',
    define: {
      // Inject environment variables at build time
      __CARTESIA_API_KEY__: JSON.stringify(env.CARTESIA_API_KEY || '')
    }
  };
}); 