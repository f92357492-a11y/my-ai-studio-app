import React, { useState } from 'react';
import { X, Server, Terminal, Copy, Check, Database, ShieldCheck, HardDrive } from 'lucide-react';

interface DeploymentGuideModalProps {
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'vps' | 'nginx' | 'docker' | 'db'>('vps');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const vpsScript = `# 1. Update and install Node.js 22 & FFmpeg
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs ffmpeg git

# 2. Clone repository & configure directories
git clone <YOUR_REPO_URL> /var/www/noxius-video
cd /var/www/noxius-video
mkdir -p uploads/videos uploads/thumbnails data
chmod -R 755 uploads data

# 3. Environment configuration
cp .env.example .env
nano .env  # set SECRET_KEY, ADMIN_PASSWORD_HASH, etc.

# 4. Install dependencies and build frontend
npm install
npm run build

# 5. Start with PM2 Process Manager for auto-restart
sudo npm install -g pm2
pm2 start server.ts --name noxius-video --interpreter tsx
pm2 startup
pm2 save`;

  const nginxScript = `# /etc/nginx/sites-available/noxiusvideo.com
server {
    server_name noxiusvideo.com www.noxiusvideo.com;

    # Allow large video uploads (up to 2GB)
    client_max_body_size 2048M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Enable byte range streaming buffering bypass
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}

# Enable site and issue free SSL certificate
sudo ln -s /etc/nginx/sites-available/noxiusvideo.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d noxiusvideo.com -d www.noxiusvideo.com`;

  const dbScript = `-- PostgreSQL Production Migration (schema.sql)
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(64) PRIMARY KEY,
    public_token VARCHAR(32) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    thumbnail TEXT,
    duration_seconds REAL DEFAULT 0,
    access_mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    video_id VARCHAR(64) REFERENCES videos(id) ON DELETE CASCADE,
    public_token VARCHAR(32) NOT NULL,
    session_token VARCHAR(128) UNIQUE NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 600,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Production Deployment Guide</h2>
              <p className="text-xs text-neutral-400">VPS, Domain, Nginx Reverse Proxy, SSL & Database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 pt-4 border-b border-neutral-800 pb-3">
          <button
            onClick={() => setActiveTab('vps')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'vps'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            VPS & System Setup
          </button>
          <button
            onClick={() => setActiveTab('nginx')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'nginx'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Nginx & SSL
          </button>
          <button
            onClick={() => setActiveTab('db')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'db'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Database & Storage
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs text-neutral-300">
          {activeTab === 'vps' && (
            <div className="space-y-3">
              <p className="text-neutral-400">
                Commands to install runtime, compile the applet, and keep it active indefinitely via PM2:
              </p>
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                <button
                  onClick={() => copyCode(vpsScript, 1)}
                  className="absolute right-3 top-3 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  {copiedIndex === 1 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre>{vpsScript}</pre>
              </div>
            </div>
          )}

          {activeTab === 'nginx' && (
            <div className="space-y-3">
              <p className="text-neutral-400">
                Nginx reverse proxy configuration supporting HTTP 206 video range seeking and 2GB uploads:
              </p>
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                <button
                  onClick={() => copyCode(nginxScript, 2)}
                  className="absolute right-3 top-3 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  {copiedIndex === 2 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre>{nginxScript}</pre>
              </div>
            </div>
          )}

          {activeTab === 'db' && (
            <div className="space-y-3">
              <p className="text-neutral-400">
                Database schema with indexed public tokens and ephemeral sessions:
              </p>
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                <button
                  onClick={() => copyCode(dbScript, 3)}
                  className="absolute right-3 top-3 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  {copiedIndex === 3 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre>{dbScript}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
