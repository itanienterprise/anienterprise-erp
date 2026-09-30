import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import obfuscator from 'vite-plugin-javascript-obfuscator'

const removeCrossorigin = () => ({
  name: 'remove-crossorigin',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(/crossorigin(="[^"]*")?/g, '');
  }
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        compact: false
      }
    }),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome 30', 'safari 7', 'ios 7', 'bb 10'],
      renderLegacyChunks: true,
      modernPolyfills: false,
    }),
    removeCrossorigin(),
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
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err?.code === 'EPIPE' || err?.code === 'ECONNRESET') return;
            console.warn('[Socket Proxy]', err?.message || err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              if (err?.code === 'EPIPE' || err?.code === 'ECONNRESET') return;
              console.warn('[Socket WS Error]', err?.message || err);
            });
          });
        }
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend server starting up or unreachable' }));
            }
          });
        }
      },
      '/v': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend server starting up or unreachable' }));
            }
          });
        }
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
        assetFileNames: `s/[hash].[ext]`,
        manualChunks: {
          vendor: ['react', 'react-dom', 'axios', 'crypto-js'],
          export: ['xlsx', 'jspdf', 'jspdf-autotable']
        }
      }
    }
  }
}))
