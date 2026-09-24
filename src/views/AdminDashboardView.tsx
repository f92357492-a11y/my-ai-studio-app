import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  Eye,
  EyeOff,
  Upload,
  Search,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Play,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { AdminStats, AdminVideo } from '../types';
import { api } from '../api';
import { AdminUploadModal } from './AdminUploadModal';
import { AdminEditModal } from './AdminEditModal';
import { AdminSettingsView } from './AdminSettingsView';
import { VideoPlayer } from '../components/VideoPlayer';

interface AdminDashboardViewProps {
  onLogout: () => void;
  onOpenWatchPage: (token: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onLogout,
  onOpenWatchPage,
}) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'settings'>('videos');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'VISIBLE' | 'INVISIBLE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'disabled'>('ALL');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<AdminVideo | null>(null);
  const [previewVideo, setPreviewVideo] = useState<AdminVideo | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<AdminVideo | null>(null);

  // Copy notification state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, videosData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminVideos({
          q: searchQuery,
          mode: modeFilter !== 'ALL' ? modeFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        }),
      ]);
      setStats(statsData);
      setVideos(videosData);
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, modeFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/v/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleToggleMode = async (video: AdminVideo) => {
    try {
      const updated = await api.toggleVideoMode(video.id);
      setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      api.getAdminStats().then(setStats);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle mode');
    }
  };

  const handleToggleStatus = async (video: AdminVideo) => {
    try {
      const updated = await api.toggleVideoStatus(video.id);
      setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async () => {
    if (!deletingVideo) return;
    try {
      await api.deleteVideo(deletingVideo.id);
      setVideos((prev) => prev.filter((v) => v.id !== deletingVideo.id));
      setDeletingVideo(null);
      api.getAdminStats().then(setStats);
    } catch (err: any) {
      alert(err.message || 'Failed to delete video');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Direct video hosting management · Authenticated Session
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            title="Refresh Data"
            className="p-2.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-semibold transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Video</span>
          </button>

          <button
            onClick={onLogout}
            title="Log Out Administrator"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-rose-950/40 hover:border-rose-900/50 text-neutral-400 hover:text-rose-400 text-xs font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Videos */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Videos</span>
            <Film className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white tabular-nums">
            {stats?.total_videos ?? 0}
          </p>
          <span className="text-[11px] text-neutral-400">Hosted in library</span>
        </div>

        {/* Visible Videos */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Visible
            </span>
            <Eye className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {stats?.visible_videos ?? 0}
          </p>
          <span className="text-[11px] text-neutral-400">Permanent access</span>
        </div>

        {/* Invisible Videos */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Invisible
            </span>
            <EyeOff className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {stats?.invisible_videos ?? 0}
          </p>
          <span className="text-[11px] text-neutral-400">10-min temporary sessions</span>
        </div>

        {/* Active Sessions */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Active Sessions
            </span>
            <Clock className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white tabular-nums">
            {stats?.active_sessions ?? 0}
          </p>
          <span className="text-[11px] text-neutral-400">
            Storage: {stats?.storage.formatted ?? '0 MB'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'videos'
              ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Film className="h-3.5 w-3.5" />
          <span>Videos Management</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'settings'
              ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Platform & Smartlink Settings</span>
        </button>
      </div>

      {/* Tab: Videos Management */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-900/40 p-3 rounded-2xl border border-neutral-800">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, token, description..."
                className="w-full h-10 pl-9 pr-4 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            </div>

            <div className="flex items-center gap-2">
              {/* Mode Filter */}
              <select
                value={modeFilter}
                onChange={(e: any) => setModeFilter(e.target.value)}
                className="h-10 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Modes</option>
                <option value="VISIBLE">Visible Only</option>
                <option value="INVISIBLE">Invisible Only</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="h-10 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>
          </div>

          {/* Videos Table & Cards */}
          {videos.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-neutral-800 bg-neutral-900/40">
              <Film className="mx-auto h-10 w-10 text-neutral-400 mb-3" />
              <p className="text-sm font-semibold text-white">No videos found</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                No videos match your criteria. Upload a new video or clear search filters.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-neutral-950 font-semibold text-xs inline-flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload First Video</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Cards Layout */}
              <div className="md:hidden space-y-3">
                {videos.map((vid) => {
                  const isVisible = vid.access_mode === 'VISIBLE';
                  const isActive = vid.status === 'active';

                  return (
                    <div
                      key={vid.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 space-y-3 shadow-lg"
                    >
                      <div className="flex gap-3">
                        <div
                          onClick={() => setPreviewVideo(vid)}
                          className="relative h-16 w-24 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 shrink-0 cursor-pointer"
                        >
                          {vid.thumbnail ? (
                            <img
                              src={vid.thumbnail}
                              alt={vid.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-neutral-400">
                              <Film className="h-5 w-5" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="h-4 w-4 text-white fill-current" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="text-xs font-semibold text-white truncate">{vid.title}</h4>
                          <p className="text-[10px] text-neutral-400 font-mono">
                            {formatFileSize(vid.file_size)} · {new Date(vid.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              onClick={() => handleToggleMode(vid)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                isVisible
                                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                                  : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                              }`}
                            >
                              {isVisible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                              <span>{vid.access_mode}</span>
                            </button>
                            <button
                              onClick={() => handleToggleStatus(vid)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                                isActive
                                  ? 'bg-neutral-800 border-neutral-700 text-emerald-400'
                                  : 'bg-neutral-800 border-neutral-700 text-rose-400'
                              }`}
                            >
                              <span>{vid.status}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Public Link Bar */}
                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-neutral-950 border border-neutral-800/80">
                        <span className="text-[11px] font-mono text-neutral-300 truncate">
                          {window.location.origin}/v/{vid.public_token}
                        </span>
                        <button
                          onClick={() => handleCopyLink(vid.public_token)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-200 text-xs font-medium shrink-0 flex items-center gap-1"
                        >
                          {copiedToken === vid.public_token ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span className="text-[11px]">Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-800/60">
                        <button
                          onClick={() => onOpenWatchPage(vid.public_token)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Watch</span>
                        </button>
                        <button
                          onClick={() => setEditingVideo(vid)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeletingVideo(vid)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block overflow-x-auto rounded-3xl border border-neutral-800 bg-neutral-900/60 shadow-xl backdrop-blur-sm">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 font-semibold">Video</th>
                    <th className="py-3.5 px-4 font-semibold">Access Mode</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Size</th>
                    <th className="py-3.5 px-4 font-semibold">Created</th>
                    <th className="py-3.5 px-4 font-semibold">Link</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {videos.map((vid) => {
                    const isVisible = vid.access_mode === 'VISIBLE';
                    const isActive = vid.status === 'active';

                    return (
                      <tr key={vid.id} className="hover:bg-neutral-800/30 transition-colors">
                        {/* Video Info & Thumbnail */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => setPreviewVideo(vid)}
                              className="relative h-12 w-20 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 shrink-0 cursor-pointer group"
                            >
                              {vid.thumbnail ? (
                                <img
                                  src={vid.thumbnail}
                                  alt={vid.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-neutral-400">
                                  <Film className="h-5 w-5" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Play className="h-4 w-4 text-white fill-current" />
                              </div>
                            </div>

                            <div className="min-w-0 max-w-xs">
                              <p className="font-semibold text-white truncate text-xs">{vid.title}</p>
                              <span className="font-mono text-[10px] text-neutral-400">
                                Token: {vid.public_token}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Mode badge with toggle */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleMode(vid)}
                            title="Click to toggle Visible / Invisible"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                              isVisible
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60'
                                : 'bg-amber-950/60 border-amber-500/40 text-amber-400 hover:bg-amber-900/60'
                            }`}
                          >
                            {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            <span>{vid.access_mode}</span>
                          </button>
                        </td>

                        {/* Status badge with toggle */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleStatus(vid)}
                            title="Click to toggle Active / Disabled"
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                              isActive
                                ? 'bg-neutral-800 text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-800 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span>{vid.status}</span>
                          </button>
                        </td>

                        {/* File Size */}
                        <td className="py-3 px-4 font-mono text-[11px] text-neutral-400">
                          {formatFileSize(vid.file_size)}
                        </td>

                        {/* Upload Date */}
                        <td className="py-3 px-4 text-[11px] text-neutral-400">
                          {new Date(vid.created_at).toLocaleDateString()}
                        </td>

                        {/* Video Link */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleCopyLink(vid.public_token)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-mono text-[11px] transition-colors"
                          >
                            {copiedToken === vid.public_token ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-neutral-400" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPreviewVideo(vid)}
                              title="Watch Video (Admin Player)"
                              className="p-1.5 rounded-lg text-neutral-300 hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
                            >
                              <Play className="h-4 w-4 fill-current" />
                            </button>
                            <button
                              onClick={() => onOpenWatchPage(vid.public_token)}
                              title="Open Public Watch Page"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingVideo(vid)}
                              title="Edit Video"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingVideo(vid)}
                              title="Delete Video"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <AdminSettingsView
          onLogout={onLogout}
          stats={stats}
          onRefreshStats={() => api.getAdminStats().then(setStats)}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <AdminUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newVideo) => {
            setVideos((prev) => [newVideo, ...prev]);
            api.getAdminStats().then(setStats);
          }}
          onOpenVideo={(token) => {
            setShowUploadModal(false);
            onOpenWatchPage(token);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingVideo && (
        <AdminEditModal
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSuccess={(updated) => {
            setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            api.getAdminStats().then(setStats);
          }}
        />
      )}

      {/* Preview Modal (Admin Player with Full Playback, Seek & Volume) */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-semibold text-white truncate">{previewVideo.title}</h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-neutral-400">
                  <span>Token: {previewVideo.public_token}</span>
                  <span>•</span>
                  <span>{previewVideo.access_mode}</span>
                  {previewVideo.duration_seconds ? (
                    <>
                      <span>•</span>
                      <span>{Math.floor(previewVideo.duration_seconds / 60)}m {Math.floor(previewVideo.duration_seconds % 60)}s</span>
                    </>
                  ) : null}
                  {previewVideo.width && previewVideo.height ? (
                    <>
                      <span>•</span>
                      <span>{previewVideo.width}x{previewVideo.height}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <VideoPlayer
              src={`/api/admin/videos/${previewVideo.id}/stream?token=${localStorage.getItem('noxius_admin_token') || ''}`}
              poster={previewVideo.thumbnail}
              mimeType={previewVideo.mime_type || 'video/mp4'}
              title={previewVideo.title}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">Delete Video Permanently?</h3>
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{deletingVideo.title}"</strong>?
              This will remove the file from disk and cancel any active viewing links.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setDeletingVideo(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-500 hover:bg-rose-400 text-white transition-colors"
              >
                Delete Video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
