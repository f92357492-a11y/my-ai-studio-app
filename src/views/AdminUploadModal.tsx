import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileVideo,
  Image,
  Eye,
  EyeOff,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { api } from '../api';
import { AdminVideo, ChunkUploadProgress } from '../types';

interface AdminUploadModalProps {
  onClose: () => void;
  onSuccess: (video: AdminVideo) => void;
  onOpenVideo: (token: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

function formatRemainingTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 5) return '< 5s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export const AdminUploadModal: React.FC<AdminUploadModalProps> = ({
  onClose,
  onSuccess,
  onOpenVideo,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessMode, setAccessMode] = useState<'VISIBLE' | 'INVISIBLE'>('INVISIBLE');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ChunkUploadProgress>({
    percent: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    currentChunk: 0,
    totalChunks: 0,
    speedBytesPerSec: 0,
    estimatedRemainingSec: 0,
    statusText: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<AdminVideo | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
      if (!title) {
        const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    }
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setThumbnailFile(e.target.files[0]);
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);
    setError('Upload cancelled by user.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file from your device.');
      return;
    }
    if (!title.trim()) {
      setError('Video title is required.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const res = await api.uploadVideoChunked(
        file,
        {
          title: title.trim(),
          description: description.trim(),
          access_mode: accessMode,
          thumbnailFile,
        },
        (prog) => {
          setUploadProgress(prog);
        },
        abortController.signal
      );

      setUploadedVideo(res.video);
      onSuccess(res.video);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        setError('Upload was cancelled.');
      } else {
        setError(err.message || 'Video upload failed');
      }
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = () => {
    if (!uploadedVideo) return;
    const url = `${window.location.origin}/v/${uploadedVideo.public_token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6 shadow-2xl my-6 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Upload New Video</h2>
              <p className="text-xs text-neutral-400">Resumable high-speed chunked upload</p>
            </div>
          </div>
          {!uploading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Upload Success View */}
        {uploadedVideo ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Video Published Successfully!</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Your video is stored permanently on the server with token{' '}
              <span className="font-mono font-semibold text-emerald-400">
                {uploadedVideo.public_token}
              </span>
              .
            </p>

            {/* Generated Link Box */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 text-left space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Generated Public Clean Watch Link
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-neutral-300 truncate">
                  {window.location.origin}/v/{uploadedVideo.public_token}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors shrink-0"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onOpenVideo(uploadedVideo.public_token)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-semibold transition-colors shadow-lg shadow-emerald-500/15"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open Watch Page</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Error Banner */}
            {error && (
              <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>✕ Upload Failed</span>
                </div>
                <p className="text-xs text-rose-200/90 pl-6 leading-relaxed break-words">
                  {error}
                </p>
              </div>
            )}

            {/* Video File Picker */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Video File <span className="text-rose-400">*</span>
              </label>
              {/* Native mobile file picker - Requirement 6 */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={handleVideoSelect}
                className="hidden"
              />

              <div
                onClick={() => !uploading && videoInputRef.current?.click()}
                className={`group flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-colors ${
                  uploading
                    ? 'border-neutral-800 bg-neutral-950/30 opacity-60 cursor-not-allowed'
                    : 'border-neutral-700 hover:border-emerald-500/60 bg-neutral-950/50 hover:bg-neutral-950/80 cursor-pointer'
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-3 text-left w-full">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                      <FileVideo className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                      <p className="text-[11px] text-neutral-400 font-mono">
                        {formatBytes(file.size)} · {file.type || 'video'}
                      </p>
                    </div>
                    {!uploading && (
                      <span className="text-[11px] text-emerald-400 font-medium shrink-0 hover:underline">
                        Change
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-neutral-400 group-hover:text-emerald-400 mb-2 transition-colors" />
                    <p className="text-xs font-medium text-neutral-200 text-center">
                      Select video from gallery, files, or storage
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Supports MP4, WebM, MOV, MKV (up to 2GB)
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Video Title */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Video Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={uploading}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Class Session 01..."
                className="w-full h-10 px-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                disabled={uploading}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary or instructions..."
                className="w-full p-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none disabled:opacity-50"
              />
            </div>

            {/* Access Mode Selector */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Access Mode <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setAccessMode('VISIBLE')}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    accessMode === 'VISIBLE'
                      ? 'border-emerald-500/80 bg-emerald-950/20'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className={`h-4 w-4 ${accessMode === 'VISIBLE' ? 'text-emerald-400' : 'text-neutral-400'}`} />
                    <span className="text-xs font-bold text-white">VISIBLE</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    Permanent access. No countdown timer.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setAccessMode('INVISIBLE')}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    accessMode === 'INVISIBLE'
                      ? 'border-amber-500/80 bg-amber-950/20'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <EyeOff className={`h-4 w-4 ${accessMode === 'INVISIBLE' ? 'text-amber-400' : 'text-neutral-400'}`} />
                    <span className="text-xs font-bold text-white">INVISIBLE</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    10-min temporary viewing pass. Stored permanently.
                  </p>
                </button>
              </div>
            </div>

            {/* Optional Thumbnail */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Custom Thumbnail (Optional, auto-extracted if empty)
              </label>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={handleThumbnailSelect}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => thumbInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-xs text-neutral-300 transition-colors w-full disabled:opacity-50"
              >
                <Image className="h-4 w-4 text-neutral-400" />
                <span className="truncate">
                  {thumbnailFile ? thumbnailFile.name : 'Choose cover image...'}
                </span>
              </button>
            </div>

            {/* Live Chunked Upload Progress Dashboard - Requirements 14 & 15 */}
            {uploading && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 font-medium">Upload Progress</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums text-sm">
                      {uploadProgress.percent}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-neutral-800 overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-150 rounded-full ${
                        uploadProgress.percent === 100 ? 'bg-emerald-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>

                {/* Real-time stats grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-300">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
                    <span className="text-neutral-400">Uploaded</span>
                    <span className="tabular-nums">
                      {formatBytes(uploadProgress.uploadedBytes)} / {formatBytes(uploadProgress.totalBytes || (file ? file.size : 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
                    <span className="text-neutral-400">Chunk</span>
                    <span className="tabular-nums">
                      {uploadProgress.currentChunk} / {uploadProgress.totalChunks || 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
                    <span className="text-neutral-400">Speed</span>
                    <span className="text-emerald-400 tabular-nums">
                      {formatSpeed(uploadProgress.speedBytesPerSec)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
                    <span className="text-neutral-400">Remaining</span>
                    <span className="tabular-nums">
                      {formatRemainingTime(uploadProgress.estimatedRemainingSec)}
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs text-neutral-300 min-w-0 pr-2">
                    {uploadProgress.percent === 100 ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Upload Complete</span>
                      </span>
                    ) : (
                      <>
                        <div className="h-3 w-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span className="truncate text-neutral-300">
                          {uploadProgress.statusText || 'Uploading chunks...'}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              {!uploading && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={uploading || !file}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-colors disabled:opacity-50 shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>Uploading ({uploadProgress.percent}%)...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 fill-current" />
                    <span>Upload & Publish Video</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
