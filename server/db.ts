import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface VideoRecord {
  id: string;
  public_token: string;
  title: string;
  description: string;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  thumbnail: string | null;
  duration_seconds: number;
  width?: number;
  height?: number;
  format?: string;
  codec?: string;
  access_mode: 'VISIBLE' | 'INVISIBLE';
  status: 'active' | 'disabled';
  views: number;
  created_at: string;
  updated_at: string;
}

export interface ViewingSessionRecord {
  session_id: string;
  video_id: string;
  public_token: string;
  session_token: string;
  duration_seconds: number;
  created_at: string;
  expires_at: string;
  status: 'active' | 'expired';
  user_agent?: string;
  ip_address?: string;
}

export interface SiteSettings {
  site_name: string;
  site_logo: string;
  adsterra_smartlink: string;
  smartlink_enabled: boolean;
  default_invisible_duration_minutes: number;
  max_upload_size_mb: number;
  last_updated: string;
}

export interface AdminUser {
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchema {
  videos: VideoRecord[];
  sessions: ViewingSessionRecord[];
  settings: SiteSettings;
  admin: AdminUser;
}

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const DB_FILE = path.resolve(DATA_DIR, 'db.json');
export const VIDEOS_DIR = path.resolve(process.cwd(), 'uploads/videos');
export const THUMBS_DIR = path.resolve(process.cwd(), 'uploads/thumbnails');
export const TEMP_CHUNKS_DIR = path.resolve(process.cwd(), 'uploads/temp_chunks');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });
  if (!fs.existsSync(TEMP_CHUNKS_DIR)) fs.mkdirSync(TEMP_CHUNKS_DIR, { recursive: true });
}

export class Database {
  private data: DatabaseSchema;

  constructor() {
    ensureDirectories();
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        return parsed;
      } catch (e) {
        console.error('Error loading db.json, generating default state:', e);
      }
    }

    const defaultAdminHash = process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_HASH.trim().length > 10
      ? process.env.ADMIN_PASSWORD_HASH
      : bcrypt.hashSync('XNFAHIMNOXIUS', 10);

    const defaultState: DatabaseSchema = {
      admin: {
        username: process.env.ADMIN_USERNAME || 'Noxiusvideo',
        password_hash: defaultAdminHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      settings: {
        site_name: 'Noxius Video',
        site_logo: '',
        adsterra_smartlink: process.env.ADSTERRA_SMARTLINK || 'https://www.profitableratecpmnetwork.com/hdkjs77b?key=c3356c7e4bb7b947eca2122ea103e099',
        smartlink_enabled: process.env.SMARTLINK_ENABLED !== 'false',
        default_invisible_duration_minutes: Number(process.env.DEFAULT_EXPIRY_MINUTES) || 10,
        max_upload_size_mb: 1024,
        last_updated: new Date().toISOString(),
      },
      videos: [],
      sessions: [],
    };

    // Seed default sample videos if files exist
    const visiblePath = path.resolve(VIDEOS_DIR, 'sample_visible.mp4');
    const invisiblePath = path.resolve(VIDEOS_DIR, 'sample_invisible.mp4');

    if (fs.existsSync(visiblePath)) {
      const stats = fs.statSync(visiblePath);
      defaultState.videos.push({
        id: 'v_visible_sample_01',
        public_token: 'V1S1BL3E',
        title: 'Master Class: Architectural Systems (Visible Demo)',
        description: 'Permanent access video showcase. Demonstrating permanent availability via generated link.',
        filename: 'sample_visible.mp4',
        file_path: visiblePath,
        mime_type: 'video/mp4',
        file_size: stats.size,
        thumbnail: '/api/thumbnails/sample_visible.jpg',
        duration_seconds: 10,
        access_mode: 'VISIBLE',
        status: 'active',
        views: 42,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      });
    }

    if (fs.existsSync(invisiblePath)) {
      const stats = fs.statSync(invisiblePath);
      defaultState.videos.push({
        id: 'v_invisible_sample_02',
        public_token: '1NV1S1BL',
        title: 'Confidential Security Briefing (10-Min Session Demo)',
        description: 'Temporary access demo. Video remains stored permanently, but watch session expires strictly in 10 minutes. Subsequent visits issue new 10-minute viewing passes.',
        filename: 'sample_invisible.mp4',
        file_path: invisiblePath,
        mime_type: 'video/mp4',
        file_size: stats.size,
        thumbnail: '/api/thumbnails/sample_invisible.jpg',
        duration_seconds: 15,
        access_mode: 'INVISIBLE',
        status: 'active',
        views: 18,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      });
    }

    this.save(defaultState);
    return defaultState;
  }

  private save(data: DatabaseSchema) {
    ensureDirectories();
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  public getAdmin(): AdminUser {
    return this.data.admin;
  }

  public updateAdminPassword(newPasswordHash: string): boolean {
    this.data.admin.password_hash = newPasswordHash;
    this.data.admin.updated_at = new Date().toISOString();
    this.save(this.data);
    return true;
  }

  public getSettings(): SiteSettings {
    const envMaxMb = Number(process.env.MAX_UPLOAD_SIZE_MB);
    return {
      ...this.data.settings,
      max_upload_size_mb: !isNaN(envMaxMb) && envMaxMb > 0 ? envMaxMb : (this.data.settings.max_upload_size_mb || 2048),
    };
  }

  public updateSettings(partial: Partial<SiteSettings>): SiteSettings {
    this.data.settings = {
      ...this.data.settings,
      ...partial,
      last_updated: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.settings;
  }

  public getVideos(): VideoRecord[] {
    return this.data.videos;
  }

  public getVideoById(id: string): VideoRecord | undefined {
    return this.data.videos.find((v) => v.id === id);
  }

  public getVideoByToken(token: string): VideoRecord | undefined {
    return this.data.videos.find((v) => v.public_token.toLowerCase() === token.toLowerCase());
  }

  public addVideo(video: VideoRecord): VideoRecord {
    this.data.videos.unshift(video);
    this.save(this.data);
    return video;
  }

  public updateVideo(id: string, updates: Partial<VideoRecord>): VideoRecord | null {
    const idx = this.data.videos.findIndex((v) => v.id === id);
    if (idx === -1) return null;

    this.data.videos[idx] = {
      ...this.data.videos[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.videos[idx];
  }

  public incrementVideoViews(id: string): void {
    const vid = this.data.videos.find((v) => v.id === id);
    if (vid) {
      vid.views = (vid.views || 0) + 1;
      this.save(this.data);
    }
  }

  public deleteVideo(id: string): boolean {
    const idx = this.data.videos.findIndex((v) => v.id === id);
    if (idx === -1) return false;

    const vid = this.data.videos[idx];
    // Remove video file from disk if it exists
    if (fs.existsSync(vid.file_path)) {
      try {
        fs.unlinkSync(vid.file_path);
      } catch (e) {
        console.error('Failed to unlink video file:', e);
      }
    }

    this.data.videos.splice(idx, 1);
    // Remove associated sessions
    this.data.sessions = this.data.sessions.filter((s) => s.video_id !== id);
    this.save(this.data);
    return true;
  }

  // Session management for INVISIBLE videos
  public createSession(
    videoId: string,
    publicToken: string,
    durationMinutes: number,
    ip?: string,
    userAgent?: string
  ): ViewingSessionRecord {
    const now = new Date();
    const durationSeconds = Math.max(60, durationMinutes * 60);
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

    const session: ViewingSessionRecord = {
      session_id: `ses_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      video_id: videoId,
      public_token: publicToken,
      session_token: crypto.randomBytes(32).toString('hex'),
      duration_seconds: durationSeconds,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
      ip_address: ip,
      user_agent: userAgent,
    };

    this.data.sessions.push(session);
    this.save(this.data);
    return session;
  }

  public getSession(sessionToken: string): ViewingSessionRecord | undefined {
    const session = this.data.sessions.find((s) => s.session_token === sessionToken);
    if (!session) return undefined;

    // Check expiration based on server time
    const now = Date.now();
    const expiry = new Date(session.expires_at).getTime();

    if (now > expiry && session.status === 'active') {
      session.status = 'expired';
      this.save(this.data);
    }

    return session;
  }

  public getSessions(): ViewingSessionRecord[] {
    return this.data.sessions || [];
  }

  public getActiveSessionsCount(): number {
    const now = Date.now();
    return this.data.sessions.filter((s) => {
      const exp = new Date(s.expires_at).getTime();
      return exp > now && s.status === 'active';
    }).length;
  }

  public cleanExpiredSessions(): number {
    const now = Date.now();
    const beforeCount = this.data.sessions.length;
    // Filter out expired sessions older than 24 hours
    this.data.sessions = this.data.sessions.filter((s) => {
      const exp = new Date(s.expires_at).getTime();
      return now - exp < 24 * 3600 * 1000;
    });
    const purged = beforeCount - this.data.sessions.length;
    if (purged > 0) this.save(this.data);
    return purged;
  }

  public getStorageStats() {
    let totalBytes = 0;
    let fileCount = 0;

    for (const vid of this.data.videos) {
      if (fs.existsSync(vid.file_path)) {
        try {
          const stats = fs.statSync(vid.file_path);
          totalBytes += stats.size;
          fileCount++;
        } catch {
          totalBytes += vid.file_size || 0;
        }
      } else {
        totalBytes += vid.file_size || 0;
      }
    }

    return { totalBytes, fileCount };
  }

  public cleanStaleChunks(): number {
    if (!fs.existsSync(TEMP_CHUNKS_DIR)) return 0;
    const now = Date.now();
    let cleaned = 0;
    try {
      const entries = fs.readdirSync(TEMP_CHUNKS_DIR);
      for (const entry of entries) {
        const entryPath = path.join(TEMP_CHUNKS_DIR, entry);
        try {
          const stats = fs.statSync(entryPath);
          // Older than 24 hours
          if (stats.isDirectory() && now - stats.mtimeMs > 24 * 3600 * 1000) {
            fs.rmSync(entryPath, { recursive: true, force: true });
            cleaned++;
          }
        } catch {}
      }
    } catch (e) {
      console.error('Error cleaning stale chunks:', e);
    }
    return cleaned;
  }
}

export const db = new Database();
