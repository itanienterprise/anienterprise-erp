import { io } from 'socket.io-client';

let socket = null;

// In Vite dev mode, connect directly to backend (port 5000) to bypass Vite's dev-proxy
// WebSocket timeouts (which emit ECONNRESET / ETIMEDOUT when idle or backgrounded).
const getSocketTarget = () => {
  if (typeof window === 'undefined') return undefined;
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return undefined;
};

export const getSocket = () => {
  if (!socket) {
    const target = getSocketTarget();
    socket = io(target || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to real-time server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from real-time server:', reason);
    });

    socket.on('connect_error', (error) => {
      // Gracefully handle reconnection in background
      console.warn('[Socket] Connection error:', error.message);
    });
  }
  return socket;
};
