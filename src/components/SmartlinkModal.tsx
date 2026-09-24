import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, Play, ArrowRight } from 'lucide-react';

interface SmartlinkModalProps {
  smartlinkUrl: string;
  videoTitle: string;
  onUnlocked: () => void;
}

export const SmartlinkModal: React.FC<SmartlinkModalProps> = ({
  smartlinkUrl,
  videoTitle,
  onUnlocked,
}) => {
  const [visited, setVisited] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  const handleOpenAd = () => {
    try {
      window.open(smartlinkUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked, continuing:', e);
    }
    setVisited(true);
    setTimerRunning(true);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setTimerRunning(false);
      }
    }, 1000);
  };

  const handleProceed = () => {
    onUnlocked();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Sponsor Verification</h2>
            <p className="text-xs text-neutral-400">One-step gateway to unlock your private video</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-neutral-800/80 bg-neutral-950 p-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Selected Video
          </span>
          <p className="mt-1 text-sm font-medium text-white truncate">{videoTitle}</p>
        </div>

        <div className="mt-4 text-xs text-neutral-400 leading-relaxed space-y-2">
          <p>
            This video is hosted on a secure private node. Clicking below will open our sponsor’s
            page in a new tab to keep this streaming service free.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {!visited ? (
            <button
              onClick={handleOpenAd}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <span>Continue & Open Sponsor</span>
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : timerRunning ? (
            <button
              disabled
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-neutral-800 text-neutral-400 font-medium text-sm cursor-not-allowed"
            >
              <span>Activating Player ({countdown}s)...</span>
            </button>
          ) : (
            <button
              onClick={handleProceed}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/15 cursor-pointer animate-pulse"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Watch Video Now</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 pt-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Adsterra Smartlink Monetization Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
