import React, { useState } from 'react';
import { Lock, User, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { api } from '../api';

interface AdminLoginViewProps {
  onLoginSuccess: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onLoginSuccess,
  onClose,
  isModal = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.adminLogin(username.trim(), password);
      onLoginSuccess();
    } catch (err: any) {
      setError('Access Denied: Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const cardContent = (
    <div className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/95 p-7 sm:p-8 shadow-2xl backdrop-blur-md">
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          aria-label="Close login dialog"
          className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="text-center mb-6">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 mb-3">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">Admin Authentication</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Enter authorized administrator credentials to proceed
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Username
          </label>
          <div className="relative">
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full h-10 pl-9 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
            <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full h-10 pl-9 pr-9 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>Authenticate</span>
          )}
        </button>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="fixed inset-0" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm flex justify-center">
          {cardContent}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-neutral-950 px-4 py-12">
      {cardContent}
    </div>
  );
};
