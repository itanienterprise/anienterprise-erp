import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/queryClient'
import { initApkDownloadInterceptor } from './utils/apkDownloadBridge'
import './App.css'
import App from './App.jsx'

// Initialize transparent file download interceptor for Android APK
initApkDownloadInterceptor();

// Register PDF Service Worker for custom filename downloads & preview
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/pdf-service-worker.js').catch((err) => {
      console.warn('PDF ServiceWorker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

