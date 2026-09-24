import React, { useState, useEffect } from 'react';
import {
  Save,
  Key,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Shield,
  Clock,
} from 'lucide-react';
import { SiteSettings, AdminStats } from '../types';
import { api } from '../api';

interface AdminSettingsViewProps {
  onLogout: () => void;
  stats?: AdminStats | null;
  onRefreshStats: () => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  onLogout,
  stats,
  onRefreshStats,
}) => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Purge sessions state
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminSettings();
      setSettings(data);
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setSavingSettings(true);
      setSettingsMsg(null);
      const updated = await api.updateAdminSettings(settings);
      setSettings(updated);
      setSettingsMsg({ type: 'success', text: 'System settings updated successfully.' });
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      setChangingPass(true);
      await api.changeAdminPassword(currentPassword, newPassword);
      setPassMsg({ type: 'success', text: 'Admin password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setChangingPass(false);
    }
  };

  const handleCleanSessions = async () => {
    try {
      setPurging(true);
      const purged = await api.cleanExpiredSessions();
      setPurgeMsg(`Purged ${purged} expired temporary session token(s) from log.`);
      onRefreshStats();
    } catch (err: any) {
      setPurgeMsg('Cleanup failed: ' + err.message);
    } finally {
      setPurging(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="py-12 flex justify-center">
        <div className="h-8 w-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* General Settings */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">General & Monetization Settings</h2>
            <p className="text-xs text-neutral-400">Configure branding, session duration, and Adsterra Smartlink</p>
          </div>
        </div>

        {settingsMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs ${
              settingsMsg.type === 'success'
                ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
                : 'border-rose-900/60 bg-rose-950/40 text-rose-300'
            }`}
          >
            {settingsMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{settingsMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Site Name
              </label>
              <input
                type="text"
                value={settings.site_name}
                onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                className="w-full h-10 px-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Default Invisible Duration
              </label>
              <select
                value={settings.default_invisible_duration_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_invisible_duration_minutes: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes (Default)</option>
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
              </select>
            </div>
          </div>

          {/* Adsterra Smartlink configuration */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Adsterra Smartlink Gateway</span>
                <p className="text-[11px] text-neutral-400">
                  When enabled, visitors must view the sponsored link before accessing the video
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() =>
                  setSettings({ ...settings, smartlink_enabled: !settings.smartlink_enabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  settings.smartlink_enabled ? 'bg-emerald-500' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.smartlink_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Ad Smartlink URL
              </label>
              <input
                type="url"
                value={settings.adsterra_smartlink}
                onChange={(e) =>
                  setSettings({ ...settings, adsterra_smartlink: e.target.value })
                }
                placeholder="https://www.profitableratecpmnetwork.com/..."
                className="w-full h-10 px-3.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-semibold transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              {savingSettings ? (
                <div className="h-3.5 w-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Platform Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Storage Information & Purge */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Storage & Session Management</h2>
            <p className="text-xs text-neutral-400">View disk storage and purge expired session logs</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="text-[11px] text-neutral-400 font-medium">Video Files Stored</span>
            <p className="text-xl font-bold font-mono text-white mt-1">
              {stats?.storage.file_count ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="text-[11px] text-neutral-400 font-medium">Disk Space Consumed</span>
            <p className="text-xl font-bold font-mono text-white mt-1">
              {stats?.storage.formatted ?? '0 MB'}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="text-[11px] text-neutral-400 font-medium">Active Temporary Sessions</span>
            <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {stats?.active_sessions ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-neutral-800 bg-neutral-950">
          <div>
            <span className="text-xs font-semibold text-white">Clean Expired Sessions</span>
            <p className="text-[11px] text-neutral-400">
              Prunes expired token records from database. <strong className="text-emerald-400">Never</strong> deletes any video files.
            </p>
          </div>
          <button
            onClick={handleCleanSessions}
            disabled={purging}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
            <span>{purging ? 'Purging...' : 'Purge Expired Sessions'}</span>
          </button>
        </div>

        {purgeMsg && (
          <p className="mt-2 text-xs text-emerald-400 font-medium">{purgeMsg}</p>
        )}
      </div>

      {/* Admin Password Change */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Change Admin Password</h2>
            <p className="text-xs text-neutral-400">Update the administrator password with secure bcrypt salt</p>
          </div>
        </div>

        {passMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs ${
              passMsg.type === 'success'
                ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
                : 'border-rose-900/60 bg-rose-950/40 text-rose-300'
            }`}
          >
            {passMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{passMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-6 space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-10 px-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={changingPass}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-semibold transition-colors cursor-pointer shadow-md disabled:opacity-50"
          >
            {changingPass ? (
              <div className="h-3.5 w-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
