import React, { useRef, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  mimeType?: string;
  title: string;
  onEnded?: () => void;
  onError?: (err: any) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  mimeType = 'video/mp4',
  title,
  onEnded,
  onError,
  onTimeUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [formatUnsupported, setFormatUnsupported] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Reload media source when src changes
  useEffect(() => {
    setFormatUnsupported(false);
    setErrorDetails(null);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [src, mimeType]);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = videoRef.current;
    const mediaError = video?.error;

    if (mediaError) {
      if (mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        setFormatUnsupported(true);
        setErrorDetails('This video format is not supported by your browser.');
      } else if (mediaError.code === MediaError.MEDIA_ERR_NETWORK) {
        setErrorDetails('Network connection error while streaming video.');
      } else if (mediaError.code === MediaError.MEDIA_ERR_DECODE) {
        setErrorDetails('Video stream decode failure.');
      }
    }

    if (onError) {
      onError(e);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && onTimeUpdate) {
      onTimeUpdate(video.currentTime, video.duration || 0);
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex items-center justify-center">
      {/* Format or streaming error fallback message */}
      {formatUnsupported && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 p-6 text-center z-20">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            This video format is not supported by your browser.
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm">
            Container / Codec: {mimeType}. Please play in Google Chrome or Android Chrome, or upload standard MP4 (H.264/AAC).
          </p>
        </div>
      )}

      {/* HTML5 Video Player */}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onError={handleError}
        aria-label={title}
        className="w-full h-full object-contain bg-black"
      >
        <source src={src} type={mimeType || 'video/mp4'} />
        Your browser does not support HTML5 video streaming.
      </video>
    </div>
  );
};
