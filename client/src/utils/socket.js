import { io } from 'socket.io-client';

let socket = null;
let hasConnectedOnce = false;

export const getSocket = () => {
  if (!socket) {
    socket = io({
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

    if (typeof window !== 'undefined') {
      window.__ERP_SOCKET__ = socket;
    }

    socket.on('connect', () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_socket_status', { detail: { connected: true, id: socket.id } }));
        if (hasConnectedOnce) {
          window.dispatchEvent(new CustomEvent('erp_data_updated', { detail: { module: 'all', action: 'reconnect' } }));
        }
      }
      hasConnectedOnce = true;
    });

    socket.on('disconnect', (reason) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_socket_status', { detail: { connected: false, reason } }));
      }
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_socket_status', { detail: { connected: false, error: error.message } }));
      }
    });

    // In Socket.IO v4, 'reconnect' is emitted on socket.io (the Manager), not on socket
    if (socket.io) {
      socket.io.on('reconnect', (attempt) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp_socket_status', { detail: { connected: true, id: socket.id } }));
          window.dispatchEvent(new CustomEvent('erp_data_updated', { detail: { module: 'all', action: 'reconnect' } }));
        }
      });
    }

    // Auto-sync when window receives focus or tab becomes visible again
    if (typeof window !== 'undefined') {
      // Auto-reconnect when window receives focus or tab becomes visible again
      let lastFocusSync = Date.now();
      const handleWindowActive = (reason) => {
        const now = Date.now();
        if (socket && !socket.connected) {
          socket.connect();
        } else if (now - lastFocusSync > 10 * 60 * 1000) {
          // Only if away for > 10 minutes and socket was idle, perform a background refresh
          lastFocusSync = now;
          window.dispatchEvent(new CustomEvent('erp_data_updated', { detail: { module: 'all', action: reason } }));
        }
      };

      window.addEventListener('focus', () => handleWindowActive('focus'));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleWindowActive('visible');
        }
      });

      // Liveness watchdog every 15s to guarantee connection stays active
      setInterval(() => {
        if (socket && !socket.connected) {
          socket.connect();
        }
      }, 15000);
    }
  }
  return socket;
};

