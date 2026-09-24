import React, { useEffect, useState, useCallback } from 'react';
import { VideoInfo, ViewingSessionData } from '../types';
import { api } from '../api';
import { VideoPlayer } from '../components/VideoPlayer';
import { CountdownTimer } from '../components/CountdownTimer';
import { SmartlinkModal } from '../components/SmartlinkModal';
import { Clock, RotateCcw, AlertTriangle } from 'lucide-react';

interface WatchViewProps {
  token: string;
}

export const WatchView: React.FC<WatchViewProps> = ({ token }) => {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [sessionData, setSessionData] = useState<ViewingSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [showSmartlinkModal, setShowSmartlinkModal] = useState<boolean>(false);

  const startSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsExpired(false);
      const session = await api.startVideoSession(token);
      setSessionData(session);
    } catch (err: any) {
      console.warn('Session start error:', err);
      setError(err.message || 'Unable to start video session');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load video metadata and initiate session/smartlink
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setIsExpired(false);

    api
      .getVideoInfo(token)
      .then((info) => {
        if (!isMounted) return;
        setVideoInfo(info);

        const unlockKey = `noxius_ad_unlocked_${token}`;
        const hasUnlocked = sessionStorage.getItem(unlockKey) === 'true';

        if (info.smartlink_enabled && !hasUnlocked && info.adsterra_smartlink) {
          setShowSmartlinkModal(true);
          setLoading(false);
        } else {
          startSession();
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Video not found or unavailable');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, startSession]);

  const handleSmartlinkUnlocked = () => {
    const unlockKey = `noxius_ad_unlocked_${token}`;
    sessionStorage.setItem(unlockKey, 'true');
    setShowSmartlinkModal(false);
    startSession();
  };

  const handleSessionExpire = () => {
    setIsExpired(true);
  };

  const handleRestartSession = () => {
    startSession();
  };

  // State 1: Loading
  if (loading && !videoInfo && !sessionData) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // State 2: Error / Video Not Found / Disabled
  if (error && !videoInfo) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black p-4 text-center">
        <div className="max-w-sm space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-base font-semibold text-white">Video Unavailable</h1>
          <p className="text-xs text-neutral-500">
            This video link is invalid, expired, or has been temporarily disabled.
          </p>
        </div>
      </div>
    );
  }

  const isVisibleMode = videoInfo?.access_mode === 'VISIBLE';

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black p-2 sm:p-4 md:p-6 select-none">
      {/* Optional Smartlink Gateway */}
      {showSmartlinkModal && videoInfo && (
        <SmartlinkModal
          smartlinkUrl={videoInfo.adsterra_smartlink}
          videoTitle={videoInfo.title}
          onUnlocked={handleSmartlinkUnlocked}
        />
      )}

      {/* Standalone Player Container */}
      <div className="w-full max-w-5xl flex flex-col items-center justify-center">
        {/* Invisible Mode: Minimal Countdown only (disappears when session expires) */}
        {!isVisibleMode && sessionData && !isExpired && (
          <CountdownTimer
            initialSeconds={sessionData.remaining_seconds || 600}
            expiresAt={sessionData.expires_at}
            onExpire={handleSessionExpire}
          />
        )}

        {/* Expired State */}
        {isExpired ? (
          <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/90 p-8 sm:p-12 text-center max-w-lg shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
              <Clock className="h-7 w-7" />
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Access Expired
            </h2>

            <p className="mt-3 text-xs sm:text-sm text-neutral-300 leading-relaxed">
              এই ভিডিওর viewing session শেষ হয়েছে। আবার প্রবেশ করলে নতুন 10 মিনিটের session শুরু হবে.
            </p>

            <div className="mt-6 flex justify-center">
              <button
                onClick={handleRestartSession}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Start New Session</span>
              </button>
            </div>
          </div>
        ) : sessionData ? (
          /* Video Player only */
          <div className="w-full rounded-xl overflow-hidden shadow-2xl bg-black border border-neutral-900/60">
            <VideoPlayer
              src={sessionData.stream_url}
              poster={videoInfo?.thumbnail}
              mimeType={videoInfo?.mime_type || sessionData.mime_type || 'video/mp4'}
              title={videoInfo?.title || 'Video'}
              onError={() => {
                if (sessionData.session_token) {
                  api.checkSessionStatus(sessionData.session_token).then((res) => {
                    if (res.expired) setIsExpired(true);
                  });
                }
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
