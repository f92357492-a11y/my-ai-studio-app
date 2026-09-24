-- ============================================================
-- NOXIUS VIDEO HOSTING & PRIVATE SHARING PLATFORM
-- Database Schema for PostgreSQL & SQLite
-- ============================================================

-- Table: admins
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: videos
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(64) PRIMARY KEY,
    public_token VARCHAR(32) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    thumbnail TEXT,
    duration_seconds REAL DEFAULT 0,
    access_mode VARCHAR(20) NOT NULL CHECK (access_mode IN ('VISIBLE', 'INVISIBLE')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid lookup by token and mode
CREATE INDEX IF NOT EXISTS idx_videos_public_token ON videos(public_token);
CREATE INDEX IF NOT EXISTS idx_videos_access_mode ON videos(access_mode);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- Table: sessions (Temporary 10-Minute Viewing Sessions)
-- Note: Expired sessions may be purged, but underlying videos are NEVER deleted.
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    public_token VARCHAR(32) NOT NULL,
    session_token VARCHAR(128) UNIQUE NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 600,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
    user_agent TEXT,
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial seed data
INSERT INTO settings (key, value) VALUES
    ('site_name', 'Noxius Video'),
    ('site_logo', ''),
    ('adsterra_smartlink', 'https://www.profitableratecpmnetwork.com/hdkjs77b?key=c3356c7e4bb7b947eca2122ea103e099'),
    ('smartlink_enabled', 'true'),
    ('default_invisible_duration_minutes', '10'),
    ('max_upload_size_mb', '1024')
ON CONFLICT (key) DO NOTHING;
