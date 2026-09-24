import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './views/HomeView';
import { WatchView } from './views/WatchView';
import { AdminLoginView } from './views/AdminLoginView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { FeaturesView } from './views/FeaturesView';
import { DeploymentGuideModal } from './views/DeploymentGuideModal';
import { api } from './api';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [showDeploymentModal, setShowDeploymentModal] = useState<boolean>(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [siteName, setSiteName] = useState<string>('Noxius Video');

  // Verify admin session & fetch site settings
  useEffect(() => {
    api.checkAdminAuth().then(setIsAdminLoggedIn);
    api.getPublicSettings().then((s) => {
      if (s.site_name) setSiteName(s.site_name);
    });

    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminLogout = async () => {
    await api.adminLogout();
    setIsAdminLoggedIn(false);
    navigateTo('/');
  };

  // ============================================================
  // ROUTE 1: /v/:token (PUBLIC VIDEO LINK MUST BE VIDEO-ONLY)
  // Dedicated standalone player without any website branding/nav
  // ============================================================
  const watchMatch = currentPath.match(/^\/v\/([a-zA-Z0-9_-]+)/);
  const activeVideoToken = watchMatch ? watchMatch[1] : null;

  if (activeVideoToken) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 font-sans">
        <WatchView token={activeVideoToken} />
      </div>
    );
  }

  // ============================================================
  // ROUTE 2: /admin
  // If authenticated: Admin Dashboard & Library
  // If unauthenticated: Admin Login Page
  // ============================================================
  if (currentPath === '/admin') {
    if (isAdminLoggedIn) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
          <Navbar
            currentPath={currentPath}
            onNavigate={navigateTo}
            siteName={siteName}
            isAdminLoggedIn={true}
            onLogoIconClick={() => navigateTo('/')}
            onLogout={handleAdminLogout}
          />
          <main className="flex-1">
            <AdminDashboardView
              onLogout={handleAdminLogout}
              onOpenWatchPage={(token) => navigateTo(`/v/${token}`)}
            />
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
        <Navbar
          currentPath={currentPath}
          onNavigate={navigateTo}
          siteName={siteName}
          isAdminLoggedIn={false}
          onLogoIconClick={() => setShowAdminLoginModal(true)}
        />
        <main className="flex-1 flex items-center justify-center">
          <AdminLoginView
            onLoginSuccess={() => {
              setIsAdminLoggedIn(true);
              navigateTo('/');
            }}
          />
        </main>
      </div>
    );
  }

  // ============================================================
  // ROUTE 3: / (HOMEPAGE)
  // If Admin Logged In: Displays the Uploaded Video Library directly
  // If Unauthenticated: Displays clean private landing (no video list)
  // Clicking the logo icon in the Navbar opens Admin Login modal
  // ============================================================
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar
        currentPath={currentPath}
        onNavigate={(path) => {
          if (path === '/deployment') {
            setShowDeploymentModal(true);
          } else {
            navigateTo(path);
          }
        }}
        siteName={siteName}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogoIconClick={() => {
          if (!isAdminLoggedIn) {
            setShowAdminLoginModal(true);
          } else {
            navigateTo('/');
          }
        }}
        onLogout={handleAdminLogout}
      />

      <main className="flex-1">
        {isAdminLoggedIn ? (
          /* When authenticated as admin, homepage displays the Video Library & Management */
          <AdminDashboardView
            onLogout={handleAdminLogout}
            onOpenWatchPage={(token) => navigateTo(`/v/${token}`)}
          />
        ) : currentPath === '/features' ? (
          <FeaturesView />
        ) : (
          /* When unauthenticated, homepage does NOT show video library or token inputs */
          <HomeView
            onOpenAdminLogin={() => setShowAdminLoginModal(true)}
            onOpenDeployment={() => setShowDeploymentModal(true)}
          />
        )}
      </main>

      {/* Admin Login Modal (Triggered when clicking the logo icon in the header) */}
      {showAdminLoginModal && (
        <AdminLoginView
          isModal
          onClose={() => setShowAdminLoginModal(false)}
          onLoginSuccess={() => {
            setIsAdminLoggedIn(true);
            setShowAdminLoginModal(false);
            navigateTo('/');
          }}
        />
      )}

      {/* Deployment Specifications Modal */}
      {showDeploymentModal && (
        <DeploymentGuideModal onClose={() => setShowDeploymentModal(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/80 py-8 text-neutral-500 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">{siteName}</span>
            <span>— Private Video Hosting Platform</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <button
              onClick={() => setShowDeploymentModal(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Deployment Guide
            </button>
            <span>·</span>
            <span>Server-Authoritative Sessions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
