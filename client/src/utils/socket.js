import { io } from 'socket.io-client';

let socket = null;

// When the app is accessed on port 3000 (Vite dev or Docker client mapped 3000:80),
// connect directly to the backend exposed on port 5000.
const getSocketTarget = () => {
  if (typeof window === 'undefined') return undefined;
  if (window.location.port === '3000') {
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
