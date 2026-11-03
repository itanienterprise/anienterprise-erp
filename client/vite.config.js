import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import obfuscator from 'vite-plugin-javascript-obfuscator'

const logger = createLogger();
const originalLoggerError = logger.error;
logger.error = (msg, options) => {
  // Suppress normal/idle WebSocket disconnect errors from Vite dev proxy (tab sleep, tab close, network idle)
  if (
    typeof msg === 'string' &&
    (msg.includes('ws proxy') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('EPIPE'))
  ) {
    return;
  }
  originalLoggerError(msg, options);
};

const removeCrossorigin = () => ({
  name: 'remove-crossorigin',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(/crossorigin(="[^"]*")?/g, '');
  }
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  customLogger: logger,
  plugins: [
    react({
      babel: {
        compact: false
      }
    }),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11'],
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
          proxy.on('error', () => {
            // Silently absorb transient disconnects on proxy
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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')) return 'vendor-pdf';
            if (id.includes('@capacitor')) return 'vendor-capacitor';
            if (id.includes('socket.io-client')) return 'vendor-socket';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('crypto-js')) return 'vendor-crypto';
            return 'vendor-core';
          }
          if (id.includes('/components/modules/')) {
            if (id.includes('/LCManagement/')) return 'module-lc';
            if (id.includes('/Sale/')) return 'module-sale';
            if (id.includes('/StockManagement/')) return 'module-stock';
            if (id.includes('/Customer/')) return 'module-customer';
            if (id.includes('/Order/')) return 'module-order';
            if (id.includes('/Purchase/') || id.includes('/PurchaseReceive/')) return 'module-purchase';
            if (id.includes('/PaymentCollection/') || id.includes('/PayToCustomer/')) return 'module-payments';
            if (id.includes('/Bank/')) return 'module-bank';
            if (id.includes('/Employee/')) return 'module-employee';
            if (id.includes('/Warehouse/') || id.includes('/Transfer/')) return 'module-warehouse';
            if (id.includes('/IPManagement/') || id.includes('/PI/') || id.includes('/PackingList/')) return 'module-ip-pi';
          }
        }
      }
    }
  }
}))
