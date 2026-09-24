import React from 'react';
import { Shield } from 'lucide-react';

export const FeaturesView: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
          <Shield className="h-3.5 w-3.5" />
          <span>System Security Architecture</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          How Noxius Video Enforces Ephemeral Access
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
          Detailed technical breakdown of how VISIBLE and INVISIBLE access modes function across
          storage, session generation, and streaming layers.
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visible Architecture */}
        <div className="rounded-3xl border border-emerald-500/30 bg-neutral-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Mode A: VISIBLE
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">Permanent Access</span>
          </div>

          <h2 className="text-lg font-bold text-white">Permanent Availability</h2>
          <ul className="text-xs text-neutral-300 space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>
                <strong>Zero Expiry:</strong> Link remains permanently available. Never disappears or expires automatically.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>
                <strong>Direct Streaming:</strong> Clients receive direct HTTP 206 chunked video streaming via public token.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>
                <strong>Persistent Storage:</strong> File remains safely in persistent storage unless explicitly deleted by administrator.
              </span>
            </li>
          </ul>
        </div>

        {/* Invisible Architecture */}
        <div className="rounded-3xl border border-amber-500/30 bg-neutral-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Mode B: INVISIBLE
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">10-Min Ephemeral Pass</span>
          </div>

          <h2 className="text-lg font-bold text-white">Temporary Viewing Pass</h2>
          <ul className="text-xs text-neutral-300 space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>Never Auto-Deleted:</strong> Underlying video file is <em>never deleted</em> from the website or server automatically.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>10-Minute Viewing Session:</strong> When a user opens the link, a temporary session token is issued for exactly 10 minutes.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>Server-Authoritative Clock:</strong> Expiration is calculated on the server. Changing device clocks does not bypass security.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>Session Expiry & Re-entry:</strong> At 00:00, media streaming is blocked and playback stops. Re-entering starts a fresh 10-minute pass.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Security Pillars */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Core Security Invariants</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-neutral-300">
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <div className="text-emerald-400 font-bold">HTTP 206 Partial Streaming</div>
            <p className="text-neutral-400 leading-relaxed">
              Enables seekable scrubbing without forcing whole-file downloads, conserving bandwidth and memory.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <div className="text-emerald-400 font-bold">Salted Bcrypt Auth</div>
            <p className="text-neutral-400 leading-relaxed">
              Admin credentials are never stored in plain text or exposed to frontend JavaScript bundles.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <div className="text-emerald-400 font-bold">Adsterra Monetization</div>
            <p className="text-neutral-400 leading-relaxed">
              Configurable Smartlink gateway supports monetization without intrusive user deception.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
