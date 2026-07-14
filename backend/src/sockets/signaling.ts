import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

interface AuthedSocket extends Socket {
  userId?: string;
}

// Tracks who is currently in which room so we can tell a newcomer who's
// already there, and clean up properly when someone disconnects.
const roomMembers = new Map<string, Set<string>>(); // roomId -> Set<socketId>

export const initSignalingServer = (httpServer: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Auth handshake: client connects with `auth: { token }`. Reject anyone
  // without a valid JWT before letting them touch a room.
  io.use((socket: AuthedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    console.log(`[signaling] socket connected: ${socket.id} (user ${socket.userId})`);

    // --- Join a call room (roomId = the meeting's roomId from the Meeting model) ---
    socket.on('join-room', ({ roomId }: { roomId: string }) => {
      socket.join(roomId);

      if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
      const members = roomMembers.get(roomId)!;

      // Simple 1:1 call cap for this basic implementation
      if (members.size >= 2) {
        socket.emit('room-full');
        return;
      }

      // Tell the newcomer who's already in the room (so they know to
      // initiate the WebRTC offer)
      const existingMembers = Array.from(members);
      socket.emit('existing-members', existingMembers);

      members.add(socket.id);

      // Tell everyone else in the room someone new joined
      socket.to(roomId).emit('user-joined', { socketId: socket.id, userId: socket.userId });
    });

    // --- Relay WebRTC signaling payloads verbatim between peers ---
    socket.on('offer', ({ roomId, targetSocketId, offer }) => {
      io.to(targetSocketId).emit('offer', { fromSocketId: socket.id, offer });
    });

    socket.on('answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('answer', { fromSocketId: socket.id, answer });
    });

    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('ice-candidate', { fromSocketId: socket.id, candidate });
    });

    // --- Call controls ---
    socket.on('toggle-audio', ({ roomId, enabled }) => {
      socket.to(roomId).emit('peer-toggle-audio', { socketId: socket.id, enabled });
    });

    socket.on('toggle-video', ({ roomId, enabled }) => {
      socket.to(roomId).emit('peer-toggle-video', { socketId: socket.id, enabled });
    });

    socket.on('leave-room', ({ roomId }) => {
      leaveRoom(socket, roomId, io);
    });

    socket.on('disconnect', () => {
      // Clean up from every room this socket was tracked in
      for (const [roomId, members] of roomMembers.entries()) {
        if (members.has(socket.id)) {
          leaveRoom(socket, roomId, io);
        }
      }
      console.log(`[signaling] socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

function leaveRoom(socket: AuthedSocket, roomId: string, io: SocketIOServer) {
  socket.leave(roomId);
  const members = roomMembers.get(roomId);
  if (members) {
    members.delete(socket.id);
    if (members.size === 0) roomMembers.delete(roomId);
  }
  socket.to(roomId).emit('user-left', { socketId: socket.id });
}
