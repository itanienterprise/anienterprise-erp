import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import obfuscator from 'vite-plugin-javascript-obfuscator'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome 30', 'safari 9', 'ios_saf 9'],
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
    // TEMPORARILY DISABLED: The javascript-obfuscator is causing Docker to run out of memory (ResourceExhausted).
    // If you need obfuscation in production, you must allocate more memory (e.g., 8GB) to your Docker Desktop VM.
    /*
    mode === 'production' ? obfuscator({
      include: [/\.(js|ts|jsx|tsx)$/],
      exclude: [/node_modules/],
      apply: 'build',
      debugger: true,
      options: {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: true,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayCallsTransform: false,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
      }
    }) : null
    */
  ].filter(Boolean),
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/v': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    assetsDir: 's',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        entryFileNames: `s/[hash].js`,
        chunkFileNames: `s/[hash].js`,
        assetFileNames: `s/[hash].[ext]`
      }
    }
  }
}))
