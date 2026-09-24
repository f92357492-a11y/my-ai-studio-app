import React, { useState } from 'react';
import { X, Save, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AdminVideo } from '../types';
import { api } from '../api';

interface AdminEditModalProps {
  video: AdminVideo;
  onClose: () => void;
  onSuccess: (updated: AdminVideo) => void;
}

export const AdminEditModal: React.FC<AdminEditModalProps> = ({
  video,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description || '');
  const [accessMode, setAccessMode] = useState<'VISIBLE' | 'INVISIBLE'>(video.access_mode);
  const [status, setStatus] = useState<'active' | 'disabled'>(video.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updated = await api.updateVideo(video.id, {
        title: title.trim(),
        description: description.trim(),
        access_mode: accessMode,
        status,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Video Settings</h2>
            <p className="text-xs font-mono text-neutral-400">Token: {video.public_token}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-2">
              Access Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccessMode('VISIBLE')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  accessMode === 'VISIBLE'
                    ? 'border-emerald-500 bg-emerald-950/30'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">VISIBLE</span>
                </div>
                <p className="text-[11px] text-neutral-400">Permanent video access</p>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('INVISIBLE')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  accessMode === 'INVISIBLE'
                    ? 'border-amber-500 bg-amber-950/30'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <EyeOff className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">INVISIBLE</span>
                </div>
                <p className="text-[11px] text-neutral-400">10-minute temporary sessions</p>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">
              Note: Changing mode never deletes the video file. Stored permanently.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-2">Status</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
                  status === 'active'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatus('disabled')}
                className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
                  status === 'disabled'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                Disabled
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-colors shadow-md"
            >
              {loading ? (
                <div className="h-3.5 w-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
