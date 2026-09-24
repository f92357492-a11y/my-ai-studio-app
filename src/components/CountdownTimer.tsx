import React, { useEffect, useState, useRef } from 'react';

interface CountdownTimerProps {
  initialSeconds: number;
  expiresAt?: string;
  onExpire: () => void;
  onSyncCheck?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  initialSeconds,
  expiresAt,
  onExpire,
  onSyncCheck,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const expiredHandledRef = useRef<boolean>(false);

  useEffect(() => {
    expiredHandledRef.current = false;
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (expiresAt) {
        const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        setSecondsLeft(remaining);

        if (remaining <= 0 && !expiredHandledRef.current) {
          expiredHandledRef.current = true;
          clearInterval(timer);
          onExpire();
        }
      } else {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (!expiredHandledRef.current) {
              expiredHandledRef.current = true;
              clearInterval(timer);
              onExpire();
            }
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    const syncInterval = setInterval(() => {
      if (onSyncCheck) onSyncCheck();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
    };
  }, [expiresAt, onExpire, onSyncCheck]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLow = secondsLeft <= 120;

  return (
    <div className="flex items-center justify-end w-full pb-2">
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tabular-nums border transition-colors ${
          isLow
            ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
            : 'bg-neutral-900/90 border-neutral-800 text-neutral-300'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isLow ? 'bg-rose-400 animate-pulse' : 'bg-amber-400 animate-pulse'
          }`}
        />
        <span>{formattedTime} remaining</span>
      </div>
    </div>
  );
};
