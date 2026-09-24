export interface VideoInfo {
  public_token: string;
  title: string;
  description: string;
  access_mode: 'VISIBLE' | 'INVISIBLE';
  status: 'active' | 'disabled';
  thumbnail: string | null;
  mime_type?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  format?: string;
  codec?: string;
  created_at: string;
  smartlink_enabled: boolean;
  adsterra_smartlink: string;
  default_duration_minutes: number;
}

export interface AdminVideo {
  id: string;
  public_token: string;
  title: string;
  description: string;
  filename: string;
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

export interface ViewingSessionData {
  access_mode: 'VISIBLE' | 'INVISIBLE';
  stream_url: string;
  mime_type?: string;
  session_token?: string;
  duration_seconds?: number;
  remaining_seconds?: number;
  expires_at?: string;
  title: string;
}

export interface AdminStats {
  total_videos: number;
  visible_videos: number;
  invisible_videos: number;
  active_sessions: number;
  storage: {
    total_bytes: number;
    file_count: number;
    formatted: string;
  };
}

export interface SiteSettings {
  site_name: string;
  site_logo: string;
  adsterra_smartlink: string;
  smartlink_enabled: boolean;
  default_invisible_duration_minutes: number;
  max_upload_size_mb: number;
  last_updated?: string;
}

export interface ChunkUploadProgress {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  speedBytesPerSec: number;
  estimatedRemainingSec: number;
  statusText: string;
  retryAttempt?: number;
}

export interface UploadSessionState {
  upload_id: string;
  filename: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  title: string;
  access_mode: 'VISIBLE' | 'INVISIBLE';
  last_modified: number;
}
