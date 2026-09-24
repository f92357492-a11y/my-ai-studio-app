import React from 'react';
import { Film, LogOut, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  siteName?: string;
  isAdminLoggedIn: boolean;
  onLogoIconClick: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  siteName = 'Noxius Video',
  isAdminLoggedIn,
  onLogoIconClick,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Clickable Logo Icon + Site Title */}
        <div className="flex items-center gap-3">
          {/* Logo / Icon on the LEFT side of "Noxius Video" - opens Admin Login when clicked */}
          <button
            onClick={onLogoIconClick}
            type="button"
            title={isAdminLoggedIn ? "Admin Dashboard" : "Admin Authentication"}
            aria-label="Admin Access"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 border border-emerald-500/30 text-emerald-400 transition-all cursor-pointer"
          >
            <Film className="h-5 w-5" />
          </button>

          {/* Text Title (Clicking text navigates to Home without exposing credentials) */}
          <button
            onClick={() => onNavigate('/')}
            className="flex flex-col text-left cursor-pointer group"
          >
            <span className="text-base font-semibold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              {siteName}
            </span>
            <span className="text-[11px] text-neutral-400 tracking-wide">
              Private Video Hosting
            </span>
          </button>
        </div>

        {/* Right side navigation */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium">
          {isAdminLoggedIn ? (
            <>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin Session</span>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-rose-950/40 hover:border-rose-900/50 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => onNavigate('/deployment')}
              className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Deployment Specs
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
