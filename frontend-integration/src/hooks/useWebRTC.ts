import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';

// Public STUN server - fine for dev/demo. For production behind strict NATs
// you'd add a TURN server here too (e.g. Twilio, Xirsys, or a self-hosted coturn).
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'room-full' | 'error';

interface UseWebRTCResult {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  status: CallStatus;
  audioEnabled: boolean;
  videoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  endCall: () => void;
}

export const useWebRTC = (roomId: string | null): UseWebRTCResult => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((targetSocketId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const socket = getSocket();

    // Push our local tracks onto the connection
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { targetSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('ended');
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    const socket = getSocket();

    const start = async () => {
      setStatus('connecting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        socket.emit('join-room', { roomId });
      } catch (err) {
        console.error('[webrtc] failed to get local media', err);
        setStatus('error');
      }
    };

    // --- Signaling event handlers ---

    // We're the second person to join: we already know who's here, so we
    // initiate the offer to them.
    const handleExistingMembers = async (members: string[]) => {
      if (members.length === 0) return;
      const targetSocketId = members[0];
      remoteSocketIdRef.current = targetSocketId;

      const pc = createPeerConnection(targetSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { roomId, targetSocketId, offer });
    };

    // We're the first person in the room and someone else just joined -
    // we wait for their offer, so just remember who they are.
    const handleUserJoined = ({ socketId }: { socketId: string }) => {
      remoteSocketIdRef.current = socketId;
    };

    const handleOffer = async ({
      fromSocketId,
      offer,
    }: {
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      remoteSocketIdRef.current = fromSocketId;
      const pc = createPeerConnection(fromSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { targetSocketId: fromSocketId, answer });
    };

    const handleAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[webrtc] failed to add ICE candidate', err);
      }
    };

    const handleUserLeft = () => {
      setRemoteStream(null);
      setStatus('ended');
      pcRef.current?.close();
      pcRef.current = null;
    };

    const handleRoomFull = () => setStatus('room-full');

    socket.on('existing-members', handleExistingMembers);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('room-full', handleRoomFull);

    start();

    return () => {
      cancelled = true;
      socket.off('existing-members', handleExistingMembers);
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('room-full', handleRoomFull);

      socket.emit('leave-room', { roomId });
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [roomId, createPeerConnection]);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !audioEnabled;
    stream.getAudioTracks().forEach((track) => (track.enabled = next));
    setAudioEnabled(next);
    if (roomId) getSocket().emit('toggle-audio', { roomId, enabled: next });
  }, [audioEnabled, roomId]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !videoEnabled;
    stream.getVideoTracks().forEach((track) => (track.enabled = next));
    setVideoEnabled(next);
    if (roomId) getSocket().emit('toggle-video', { roomId, enabled: next });
  }, [videoEnabled, roomId]);

  const endCall = useCallback(() => {
    if (roomId) getSocket().emit('leave-room', { roomId });
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('ended');
  }, [roomId]);

  return { localStream, remoteStream, status, audioEnabled, videoEnabled, toggleAudio, toggleVideo, endCall };
};
