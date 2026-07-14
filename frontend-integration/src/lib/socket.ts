import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Lazily creates (or returns) a single shared socket connection, authenticated
// with the same JWT the REST API uses. Call disconnectSocket() on logout.
export const getSocket = (): Socket => {
  if (socket && socket.connected) return socket;

  const token = localStorage.getItem('nexus_token');
  const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
    /\/api\/?$/,
    ''
  );

  socket = io(baseURL, {
    auth: { token },
    autoConnect: true,
    transports: ['websocket'],
  });

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
