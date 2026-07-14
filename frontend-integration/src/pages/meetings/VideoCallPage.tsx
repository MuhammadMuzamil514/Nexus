import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { useWebRTC } from '../../hooks/useWebRTC';

export const VideoCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const { localStream, remoteStream, status, audioEnabled, videoEnabled, toggleAudio, toggleVideo, endCall } =
    useWebRTC(roomId ?? null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const handleEnd = () => {
    endCall();
    navigate('/meetings');
  };

  const statusLabel: Record<string, string> = {
    idle: '',
    connecting: 'Connecting...',
    connected: '',
    ended: 'Call ended',
    'room-full': 'This call room is already full',
    error: 'Could not access your camera or microphone',
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col">
      <div className="flex-1 relative">
        {/* Remote video fills the frame */}
        {remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <p>{statusLabel[status] || 'Waiting for the other participant to join...'}</p>
          </div>
        )}

        {/* Local video, picture-in-picture */}
        <div className="absolute bottom-6 right-6 w-48 h-32 rounded-lg overflow-hidden border-2 border-gray-700 bg-gray-800 shadow-lg">
          {localStream ? (
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
              Camera off
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 py-4 flex items-center justify-center gap-4">
        <Button
          variant={audioEnabled ? 'ghost' : 'error'}
          size="lg"
          className={`rounded-full !p-3 ${audioEnabled ? '!bg-gray-700 hover:!bg-gray-600' : ''}`}
          onClick={toggleAudio}
        >
          {audioEnabled ? <Mic size={20} className="text-white" /> : <MicOff size={20} />}
        </Button>

        <Button
          variant={videoEnabled ? 'ghost' : 'error'}
          size="lg"
          className={`rounded-full !p-3 ${videoEnabled ? '!bg-gray-700 hover:!bg-gray-600' : ''}`}
          onClick={toggleVideo}
        >
          {videoEnabled ? <VideoIcon size={20} className="text-white" /> : <VideoOff size={20} />}
        </Button>

        <Button variant="error" size="lg" className="rounded-full !p-3" onClick={handleEnd}>
          <PhoneOff size={20} />
        </Button>
      </div>
    </div>
  );
};
