import React from 'react';
import { Shield, Lock, Server, Clock, HardDrive, KeyRound } from 'lucide-react';

interface HomeViewProps {
  onOpenAdminLogin: () => void;
  onOpenDeployment: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onOpenAdminLogin,
  onOpenDeployment,
}) => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-10 lg:p-12 overflow-hidden shadow-2xl backdrop-blur-sm">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-lg bg-neutral-800/80 px-3 py-1 text-xs font-medium text-emerald-400 border border-neutral-700/60">
            <Shield className="h-3.5 w-3.5" />
            <span>Private Video Hosting & Session Engine</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Secure Private Video Hosting
          </h1>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            High-performance direct video hosting with server-enforced viewing sessions. Videos can be shared via isolated links in either permanent Visible mode or ephemeral 10-minute Invisible sessions.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenAdminLogin}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              <KeyRound className="h-4 w-4" />
              <span>Administrator Login</span>
            </button>
            <button
              onClick={onOpenDeployment}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Server className="h-4 w-4 text-neutral-400" />
              <span>Deployment Specs</span>
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 pt-1">
            <Lock className="h-3 w-3 text-neutral-400 shrink-0" />
            <span>
              Tip: You can also click the logo icon <span className="text-emerald-400 font-mono">[🎬]</span> in the header to authenticate.
            </span>
          </p>
        </div>
      </div>

      {/* Security & Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-emerald-400">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">Protected Video Library</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Uploaded videos are completely hidden from public visitors. Only authenticated administrators can view, search, upload, or configure media.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">10-Min Ephemeral Passes</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Invisible mode generates 10-minute server-authoritative streaming passes. Media blocks automatically on expiration while original files stay permanently preserved.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-blue-400">
            <HardDrive className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">Isolated Public Links</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Public links open solely the video player without headers, titles, menus, descriptions, search, or other videos. Zero cross-video enumeration.
          </p>
        </div>
      </div>
    </div>
  );
};
