import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { exec } from 'child_process';
import { db, VideoRecord, ViewingSessionRecord, VIDEOS_DIR, THUMBS_DIR, TEMP_CHUNKS_DIR } from './db.js';
import { generateAdminToken, requireAdmin, verifyAdminToken } from './auth.js';

export const apiRouter = express.Router();

// Periodic background cleanup of stale chunks and expired viewing sessions
setInterval(() => {
  db.cleanStaleChunks();
  db.cleanExpiredSessions();
}, 3600000);
setTimeout(() => {
  db.cleanStaleChunks();
  db.cleanExpiredSessions();
}, 5000);

// Single-file fallback Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      cb(null, THUMBS_DIR);
    } else {
      cb(null, VIDEOS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase() || '.mp4';
    const randomHex = crypto.randomBytes(6).toString('hex');
    const prefix = file.fieldname === 'thumbnail' ? 'thumb' : 'vid';
    cb(null, `${prefix}_${Date.now()}_${randomHex}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2048 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
      }
      return cb(new Error('Only image files are allowed for thumbnails'));
    }

    const allowedMimes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-matroska',
      'video/mkv',
      'video/ogg',
    ];
    const allowedExts = ['.mp4', '.webm', '.mov', '.mkv', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Supported formats: MP4, WebM, MOV, MKV'));
    }
  },
});

// Dedicated Resumable Chunk Multer Storage
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadId = (
      (req.query.upload_id as string) ||
      (req.headers['x-upload-id'] as string) ||
      (req.body && req.body.upload_id)
    ) as string;

    if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
      return cb(new Error('Invalid or missing upload session ID'), '');
    }
    const targetDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    if (!fs.existsSync(targetDir)) {
      return cb(new Error('Upload session expired or does not exist'), '');
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const rawIndex = (
      (req.query.chunk_index as string) ||
      (req.headers['x-chunk-index'] as string) ||
      (req.body && req.body.chunk_index)
    ) as string;

    const chunkIndex = parseInt(rawIndex, 10);
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return cb(new Error('Invalid chunk index'), '');
    }
    cb(null, `chunk_${chunkIndex}`);
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 35 * 1024 * 1024, // 35MB per chunk max
  },
});

// Standalone Thumbnail Upload Storage
const thumbStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, THUMBS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `thumb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const thumbUpload = multer({
  storage: thumbStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed for thumbnails'));
    }
  },
});

interface VideoProbeResult {
  valid: boolean;
  error?: string;
  duration_seconds: number;
  width: number;
  height: number;
  codec: string;
  format: string;
  mime_type: string;
}

// Move MP4 moov atom to head for instant streaming / buffering on mobile devices
async function ensureFaststart(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp4' && ext !== '.mov' && ext !== '.m4v') return;
  const tempPath = `${filePath}.faststart.tmp`;
  try {
    await new Promise<void>((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${filePath}" -c copy -movflags +faststart "${tempPath}"`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
      fs.renameSync(tempPath, filePath);
    }
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  }
}

// Thorough video inspection using ffprobe
async function probeVideoFile(
  filePath: string,
  originalFilename?: string
): Promise<VideoProbeResult> {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      error: 'Video file does not exist on storage',
      duration_seconds: 0,
      width: 0,
      height: 0,
      codec: '',
      format: '',
      mime_type: 'video/mp4',
    };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return {
      valid: false,
      error: 'Video file is empty (0 bytes)',
      duration_seconds: 0,
      width: 0,
      height: 0,
      codec: '',
      format: '',
      mime_type: 'video/mp4',
    };
  }

  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name,duration -show_entries format=duration,format_name -of json "${filePath}"`;
    exec(cmd, (err, stdout) => {
      if (err) {
        return resolve({
          valid: false,
          error: 'Corrupted video file or unreadable video container',
          duration_seconds: 0,
          width: 0,
          height: 0,
          codec: '',
          format: '',
          mime_type: 'video/mp4',
        });
      }

      try {
        const data = JSON.parse(stdout || '{}');
        const vStream = data.streams && data.streams[0] ? data.streams[0] : null;
        const formatInfo = data.format || {};

        if (!vStream && !formatInfo.format_name) {
          return resolve({
            valid: false,
            error: 'File does not contain a recognizable video stream',
            duration_seconds: 0,
            width: 0,
            height: 0,
            codec: '',
            format: '',
            mime_type: 'video/mp4',
          });
        }

        const rawDuration = parseFloat(
          vStream?.duration || formatInfo?.duration || '0'
        );
        const duration = isNaN(rawDuration)
          ? 0
          : Math.round(rawDuration * 100) / 100;
        const width = vStream?.width ? parseInt(vStream.width, 10) : 0;
        const height = vStream?.height ? parseInt(vStream.height, 10) : 0;
        const codec = vStream?.codec_name || '';
        const formatName = formatInfo?.format_name || '';

        // Detect precise browser MIME type
        let mimeType = 'video/mp4';
        const ext = path.extname(originalFilename || filePath).toLowerCase();
        if (formatName.includes('webm') || ext === '.webm') {
          mimeType = 'video/webm';
        } else if (formatName.includes('matroska') || ext === '.mkv') {
          mimeType = 'video/x-matroska';
        } else if (formatName.includes('mov') && ext === '.mov') {
          mimeType = 'video/quicktime';
        } else if (formatName.includes('ogg') || ext === '.ogv') {
          mimeType = 'video/ogg';
        } else {
          mimeType = 'video/mp4';
        }

        resolve({
          valid: true,
          duration_seconds: duration,
          width,
          height,
          codec,
          format: formatName,
          mime_type: mimeType,
        });
      } catch (parseErr: any) {
        resolve({
          valid: false,
          error: `Failed to parse video metadata: ${parseErr.message}`,
          duration_seconds: 0,
          width: 0,
          height: 0,
          codec: '',
          format: '',
          mime_type: 'video/mp4',
        });
      }
    });
  });
}

// Helper: generate unique 8-character public token
function generatePublicToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (db.getVideoByToken(token)) {
    return generatePublicToken();
  }
  return token;
}

// HTTP Range Video Streaming Engine
function streamVideoFile(
  filePath: string,
  mimeType: string,
  req: Request,
  res: Response
) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found on storage' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (fileSize === 0) {
    return res.status(500).json({ error: 'Video file on disk is 0 bytes' });
  }

  // Ensure appropriate MIME type
  let contentType = mimeType || 'video/mp4';
  if (
    contentType === 'application/octet-stream' ||
    contentType.startsWith('image/')
  ) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.mkv') contentType = 'video/x-matroska';
    else contentType = 'video/mp4';
  }

  const range = req.headers.range;

  if (range) {
    // Robust parsing for "bytes=start-end", "bytes=start-", or "bytes=-suffix"
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    let start = match[1] ? parseInt(match[1], 10) : NaN;
    let end = match[2] ? parseInt(match[2], 10) : NaN;

    if (isNaN(start) && isNaN(end)) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    if (isNaN(start)) {
      // Suffix range: bytes=-500 means the last 500 bytes
      start = Math.max(0, fileSize - end);
      end = fileSize - 1;
    } else if (isNaN(end)) {
      // Range: bytes=1000- means 1000 to end
      end = fileSize - 1;
    }

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    // Standard 206 headers (notice: Cache-Control public allows Android Chrome byte buffering)
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });

    fileStream.pipe(res);

    req.on('close', () => {
      fileStream.destroy();
    });

    fileStream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    });
  } else {
    // Full content response (initial probe or non-range client)
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    req.on('close', () => {
      fileStream.destroy();
    });

    fileStream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    });
  }
}

// ============================================================
// PUBLIC ROUTES
// ============================================================

// Public settings
apiRouter.get('/settings', (req, res) => {
  const settings = db.getSettings();
  res.json({
    site_name: settings.site_name,
    site_logo: settings.site_logo,
    smartlink_enabled: settings.smartlink_enabled,
    adsterra_smartlink: settings.adsterra_smartlink,
    default_invisible_duration_minutes: settings.default_invisible_duration_minutes,
  });
});

// Protected video endpoint - public access forbidden
apiRouter.get('/videos', requireAdmin, (req, res) => {
  res.redirect('/api/admin/videos');
});

// Serve thumbnails
apiRouter.get('/thumbnails/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const target = path.join(THUMBS_DIR, filename);
  if (fs.existsSync(target)) {
    res.sendFile(target);
  } else {
    res.status(404).send('Thumbnail not found');
  }
});

// Public video info (does not expose file path or internal ID)
apiRouter.get('/video/:token', (req, res) => {
  const token = req.params.token;
  const video = db.getVideoByToken(token);

  if (!video) {
    return res.status(404).json({ error: 'Video not found or link is invalid' });
  }

  if (video.status === 'disabled') {
    return res.status(403).json({
      error: 'This video has been temporarily disabled by the administrator',
      disabled: true,
      title: video.title,
    });
  }

  const settings = db.getSettings();

  res.json({
    public_token: video.public_token,
    title: video.title,
    description: video.description,
    access_mode: video.access_mode,
    status: video.status,
    thumbnail: video.thumbnail,
    mime_type: video.mime_type || 'video/mp4',
    duration_seconds: video.duration_seconds || 0,
    width: video.width || 0,
    height: video.height || 0,
    format: video.format || '',
    codec: video.codec || '',
    created_at: video.created_at,
    smartlink_enabled: settings.smartlink_enabled,
    adsterra_smartlink: settings.adsterra_smartlink,
    default_duration_minutes: settings.default_invisible_duration_minutes,
  });
});

// Create/resume viewing session for a video
apiRouter.post('/video/:token/session', (req, res) => {
  const token = req.params.token;
  const video = db.getVideoByToken(token);

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (video.status === 'disabled') {
    return res.status(403).json({ error: 'This video has been disabled by the administrator' });
  }

  // Increment view counter
  db.incrementVideoViews(video.id);

  if (video.access_mode === 'VISIBLE') {
    // Visible videos have permanent access
    return res.json({
      access_mode: 'VISIBLE',
      stream_url: `/api/video/${video.public_token}/stream`,
      mime_type: video.mime_type || 'video/mp4',
      title: video.title,
    });
  }

  // INVISIBLE VIDEO: Generate a 10-minute temporary viewing session
  const settings = db.getSettings();
  const durationMinutes = settings.default_invisible_duration_minutes || 10;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const session = db.createSession(video.id, video.public_token, durationMinutes, ip, userAgent);

  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)
  );

  // Set browser session cookie for range request streams
  res.cookie(`noxius_session_${video.public_token}`, session.session_token, {
    maxAge: durationMinutes * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });

  res.json({
    access_mode: 'INVISIBLE',
    session_token: session.session_token,
    duration_seconds: session.duration_seconds,
    remaining_seconds: remainingSeconds,
    expires_at: session.expires_at,
    stream_url: `/api/video/session/${session.session_token}/stream`,
    mime_type: video.mime_type || 'video/mp4',
    title: video.title,
  });
});

// Check session status (polling or resume verification)
apiRouter.get('/video/session/:sessionToken/status', (req, res) => {
  const session = db.getSession(req.params.sessionToken);

  if (!session) {
    return res.status(404).json({ error: 'Session not found', expired: true });
  }

  const now = Date.now();
  const expiry = new Date(session.expires_at).getTime();
  const remainingSeconds = Math.max(0, Math.floor((expiry - now) / 1000));

  if (remainingSeconds <= 0 || session.status === 'expired') {
    return res.status(200).json({
      status: 'expired',
      expired: true,
      remaining_seconds: 0,
      expires_at: session.expires_at,
      message: 'এই ভিডিওর viewing session শেষ হয়েছে। আবার প্রবেশ করলে নতুন 10 মিনিটের session শুরু হবে.',
    });
  }

  res.json({
    status: 'active',
    expired: false,
    remaining_seconds: remainingSeconds,
    expires_at: session.expires_at,
  });
});

// Unified handler for /video/stream/:token and /video/:token/stream
function handleVideoTokenStream(req: Request, res: Response) {
  const token = req.params.token;
  const video = db.getVideoByToken(token);

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (video.status === 'disabled') {
    return res.status(403).json({ error: 'Video disabled by administrator' });
  }

  // 1. VISIBLE VIDEO: direct stream allowed
  if (video.access_mode === 'VISIBLE') {
    return streamVideoFile(video.file_path, video.mime_type, req, res);
  }

  // 2. CHECK ADMIN AUTHENTICATION (Allows admin to preview without session limit)
  const authHeader = req.headers.authorization;
  const queryAdminToken = (req.query.admin_token || req.query.token) as string;
  const adminTokenToCheck = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : queryAdminToken;

  if (adminTokenToCheck) {
    const adminPayload = verifyAdminToken(adminTokenToCheck);
    if (adminPayload && adminPayload.role === 'admin') {
      return streamVideoFile(video.file_path, video.mime_type, req, res);
    }
  }

  // 3. INVISIBLE VIDEO: Must verify active 10-minute viewing session on EVERY request / Range chunk
  const sessionToken =
    (req.query.session as string) ||
    (req.query.session_token as string) ||
    (req.headers['x-session-token'] as string) ||
    req.cookies?.[`noxius_session_${token}`];

  let session: ViewingSessionRecord | undefined = undefined;
  if (sessionToken) {
    session = db.getSession(sessionToken);
  }

  // Fallback: If cookie/param was lost, check if client IP has an active session for this video
  if (!session) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    if (ip) {
      const allSessions = db.getSessions();
      const activeForIp = allSessions
        .filter((s) => s.public_token === token && s.status === 'active' && s.ip_address === ip)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (activeForIp.length > 0) {
        const candidate = activeForIp[0];
        if (Date.now() <= new Date(candidate.expires_at).getTime()) {
          session = candidate;
        }
      }
    }
  }

  if (!session) {
    return res.status(403).json({
      error: 'This is an Invisible video. A valid viewing session token is required to stream.',
      expired: true,
    });
  }

  // Check if expired on every chunk / range request
  const now = Date.now();
  const expiry = new Date(session.expires_at).getTime();
  if (now > expiry || session.status === 'expired') {
    return res.status(410).json({
      error: 'Access Expired',
      expired: true,
      message: 'এই ভিডিওর viewing session শেষ হয়েছে। আবার প্রবেশ করলে নতুন 10 মিনিটের session শুরু হবে.',
    });
  }

  // Session is valid and active - stream the video
  streamVideoFile(video.file_path, video.mime_type, req, res);
}

// Support both endpoint patterns: /api/video/:token/stream and /api/video/stream/:token
apiRouter.get('/video/stream/:token', handleVideoTokenStream);
apiRouter.get('/video/:token/stream', handleVideoTokenStream);

// Stream INVISIBLE video with direct session token
apiRouter.get('/video/session/:sessionToken/stream', (req, res) => {
  const sessionToken = req.params.sessionToken;
  const session = db.getSession(sessionToken);

  if (!session) {
    return res.status(403).json({
      error: 'Invalid viewing session token',
      expired: true,
    });
  }

  const now = Date.now();
  const expiry = new Date(session.expires_at).getTime();

  // Strictly enforce server-side expiration on EVERY Range request!
  if (now > expiry || session.status === 'expired') {
    return res.status(410).json({
      error: 'Access Expired',
      expired: true,
      message: 'এই ভিডিওর viewing session শেষ হয়েছে। আবার প্রবেশ করলে নতুন 10 মিনিটের session শুরু হবে.',
    });
  }

  const video = db.getVideoById(session.video_id);
  if (!video) {
    return res.status(404).json({ error: 'Associated video not found' });
  }

  if (video.status === 'disabled') {
    return res.status(403).json({ error: 'Video disabled by administrator' });
  }

  streamVideoFile(video.file_path, video.mime_type, req, res);
});

// Admin video preview stream (Allows admin to watch ANY video without session expiration)
apiRouter.get('/admin/videos/:id/stream', (req, res) => {
  const authHeader = req.headers.authorization;
  const tokenQuery = req.query.token as string;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : tokenQuery;

  if (!token) {
    return res.status(401).json({ error: 'Admin authorization token required' });
  }

  const payload = verifyAdminToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired admin token' });
  }

  const video = db.getVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  streamVideoFile(video.file_path, video.mime_type, req, res);
});

apiRouter.get('/admin/videos/stream/:token', (req, res) => {
  const authHeader = req.headers.authorization;
  const tokenQuery = req.query.token as string;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : tokenQuery;

  if (!token) {
    return res.status(401).json({ error: 'Admin authorization token required' });
  }

  const payload = verifyAdminToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired admin token' });
  }

  const video = db.getVideoByToken(req.params.token);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  streamVideoFile(video.file_path, video.mime_type, req, res);
});

// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

// Admin Login
apiRouter.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = db.getAdmin();
  const configuredUsername = process.env.ADMIN_USERNAME || admin.username;

  if (username.trim() !== configuredUsername) {
    return res.status(401).json({ error: 'Access Denied: Invalid credentials' });
  }

  // Check against ADMIN_PASSWORD env var if set, or stored bcrypt hash
  const envPasswordMatch = Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
  const hashMatch = admin.password_hash ? bcrypt.compareSync(password, admin.password_hash) : false;

  if (!envPasswordMatch && !hashMatch) {
    return res.status(401).json({ error: 'Access Denied: Invalid credentials' });
  }

  const token = generateAdminToken(configuredUsername);

  // Set secure cookie
  res.cookie('noxius_admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });

  res.json({
    success: true,
    token,
    user: {
      username: configuredUsername,
    },
  });
});

// Admin Logout
apiRouter.post('/admin/logout', (req, res) => {
  res.clearCookie('noxius_admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check Admin Status
apiRouter.get('/admin/me', requireAdmin, (req, res) => {
  const admin = db.getAdmin();
  res.json({
    username: admin.username,
    created_at: admin.created_at,
    updated_at: admin.updated_at,
  });
});

// Change Admin Password
apiRouter.post('/admin/change-password', requireAdmin, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const admin = db.getAdmin();
  const passwordMatch = bcrypt.compareSync(current_password, admin.password_hash);

  if (!passwordMatch) {
    return res.status(400).json({ error: 'Current password does not match' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.updateAdminPassword(newHash);

  res.json({ success: true, message: 'Admin password changed successfully' });
});

// ============================================================
// ADMIN DASHBOARD & VIDEO MANAGEMENT
// ============================================================

// Dashboard Stats
apiRouter.get('/admin/stats', requireAdmin, (req, res) => {
  const videos = db.getVideos();
  const totalVideos = videos.length;
  const visibleVideos = videos.filter((v) => v.access_mode === 'VISIBLE').length;
  const invisibleVideos = videos.filter((v) => v.access_mode === 'INVISIBLE').length;
  const activeSessions = db.getActiveSessionsCount();
  const storage = db.getStorageStats();

  const formattedStorage = (storage.totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

  res.json({
    total_videos: totalVideos,
    visible_videos: visibleVideos,
    invisible_videos: invisibleVideos,
    active_sessions: activeSessions,
    storage: {
      total_bytes: storage.totalBytes,
      file_count: storage.fileCount,
      formatted: formattedStorage,
    },
  });
});

// Video list with filter & search
apiRouter.get('/admin/videos', requireAdmin, (req, res) => {
  let list = [...db.getVideos()];
  const q = (req.query.q as string || '').toLowerCase().trim();
  const mode = req.query.mode as string;
  const status = req.query.status as string;

  if (q) {
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.public_token.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    );
  }

  if (mode && (mode === 'VISIBLE' || mode === 'INVISIBLE')) {
    list = list.filter((v) => v.access_mode === mode);
  }

  if (status && (status === 'active' || status === 'disabled')) {
    list = list.filter((v) => v.status === status);
  }

  res.json({ videos: list });
});

// Get single video
apiRouter.get('/admin/videos/:id', requireAdmin, (req, res) => {
  const video = db.getVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  res.json(video);
});

// ============================================================
// CHUNKED & RESUMABLE VIDEO UPLOAD PIPELINE
// ============================================================

// 1. Initialize Upload Session
apiRouter.post('/admin/videos/upload/init', requireAdmin, (req, res) => {
  try {
    const {
      filename,
      file_size,
      mime_type,
      chunk_size,
      total_chunks,
      title,
      description,
      access_mode,
    } = req.body;

    if (!filename || !file_size || !total_chunks) {
      return res.status(400).json({
        error: 'Missing required upload parameters (filename, file_size, total_chunks)',
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Video title is required' });
    }

    const settings = db.getSettings();
    const maxUploadBytes = (settings.max_upload_size_mb || 2048) * 1024 * 1024;

    if (file_size > maxUploadBytes) {
      const allowedMb = settings.max_upload_size_mb || 2048;
      const fileMb = (file_size / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        error: `Video size (${fileMb} MB) exceeds maximum allowed upload size of ${allowedMb} MB`,
        max_upload_size_mb: allowedMb,
      });
    }

    const uploadId = `up_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const uploadDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    fs.mkdirSync(uploadDir, { recursive: true });

    const sessionData = {
      upload_id: uploadId,
      filename: filename.trim(),
      file_size: Number(file_size),
      mime_type: (mime_type || 'video/mp4').trim(),
      chunk_size: Number(chunk_size) || 5 * 1024 * 1024,
      total_chunks: Number(total_chunks),
      title: title.trim(),
      description: (description || '').trim(),
      access_mode: access_mode === 'INVISIBLE' ? 'INVISIBLE' : 'VISIBLE',
      status: 'uploading',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(uploadDir, 'session.json'),
      JSON.stringify(sessionData, null, 2),
      'utf-8'
    );

    res.json({
      success: true,
      upload_id: uploadId,
      chunk_size: sessionData.chunk_size,
      total_chunks: sessionData.total_chunks,
      max_upload_size_mb: settings.max_upload_size_mb || 2048,
      uploaded_chunks: [],
    });
  } catch (err: any) {
    console.error('Upload init error:', err);
    res.status(500).json({ error: err.message || 'Failed to initialize upload session' });
  }
});

// 2. Query Existing Upload Session (for seamless resume)
apiRouter.get('/admin/videos/upload/session/:uploadId', requireAdmin, (req, res) => {
  const uploadId = req.params.uploadId;
  if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
    return res.status(400).json({ error: 'Invalid upload session ID' });
  }

  const uploadDir = path.join(TEMP_CHUNKS_DIR, uploadId);
  const sessionFile = path.join(uploadDir, 'session.json');

  if (!fs.existsSync(uploadDir) || !fs.existsSync(sessionFile)) {
    return res.status(404).json({ error: 'Upload session not found or expired', expired: true });
  }

  try {
    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    const files = fs.readdirSync(uploadDir);
    const uploadedChunks: number[] = [];
    for (const f of files) {
      const match = f.match(/^chunk_(\d+)$/);
      if (match) uploadedChunks.push(parseInt(match[1], 10));
    }
    uploadedChunks.sort((a, b) => a - b);

    res.json({
      success: true,
      upload_id: uploadId,
      filename: session.filename,
      file_size: session.file_size,
      chunk_size: session.chunk_size,
      total_chunks: session.total_chunks,
      uploaded_chunks: uploadedChunks,
      status: session.status,
    });
  } catch {
    res.status(500).json({ error: 'Failed to read upload session' });
  }
});

// 3. Upload a Single Chunk
apiRouter.post(
  '/admin/videos/upload/chunk',
  requireAdmin,
  chunkUpload.any(),
  (req, res) => {
    try {
      const uploadId = (
        (req.query.upload_id as string) ||
        (req.headers['x-upload-id'] as string) ||
        req.body?.upload_id
      ) as string;

      const rawChunkIndex = (
        (req.query.chunk_index as string) ||
        (req.headers['x-chunk-index'] as string) ||
        req.body?.chunk_index
      ) as string;

      const chunkIndex = parseInt(rawChunkIndex, 10);

      if (!uploadId || isNaN(chunkIndex)) {
        return res.status(400).json({ error: 'Missing upload_id or chunk_index' });
      }

      const uploadDir = path.join(TEMP_CHUNKS_DIR, uploadId);
      const sessionFile = path.join(uploadDir, 'session.json');

      if (!fs.existsSync(uploadDir) || !fs.existsSync(sessionFile)) {
        return res.status(404).json({ error: 'Upload session expired or does not exist' });
      }

      const chunkPath = path.join(uploadDir, `chunk_${chunkIndex}`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(500).json({ error: `Chunk ${chunkIndex} was not saved on disk` });
      }

      // Update session last_updated
      try {
        const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        session.last_updated = new Date().toISOString();
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
      } catch {}

      const files = fs.readdirSync(uploadDir);
      const uploadedChunks: number[] = [];
      for (const f of files) {
        const match = f.match(/^chunk_(\d+)$/);
        if (match) uploadedChunks.push(parseInt(match[1], 10));
      }

      res.json({
        success: true,
        upload_id: uploadId,
        chunk_index: chunkIndex,
        uploaded_count: uploadedChunks.length,
      });
    } catch (err: any) {
      console.error('Chunk upload error:', err);
      res.status(500).json({ error: err.message || 'Chunk upload failed' });
    }
  }
);

// 4. Standalone Thumbnail Upload for Session
apiRouter.post(
  '/admin/videos/upload/thumbnail',
  requireAdmin,
  thumbUpload.single('thumbnail'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' });
    }
    const thumbnailUrl = `/api/thumbnails/${req.file.filename}`;
    res.json({ success: true, thumbnail_url: thumbnailUrl, filename: req.file.filename });
  }
);

// 5. Finalize & Assemble Uploaded Chunks
apiRouter.post('/admin/videos/upload/complete', requireAdmin, async (req, res) => {
  const { upload_id, thumbnail_url, title, description, access_mode } = req.body;

  if (!upload_id) {
    return res.status(400).json({ error: 'upload_id is required' });
  }

  const uploadDir = path.join(TEMP_CHUNKS_DIR, upload_id);
  const sessionFile = path.join(uploadDir, 'session.json');

  if (!fs.existsSync(uploadDir) || !fs.existsSync(sessionFile)) {
    return res.status(404).json({ error: 'Upload session does not exist or has expired' });
  }

  let session: any;
  try {
    session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
  } catch {
    return res.status(500).json({ error: 'Failed to read upload session' });
  }

  if (session.status === 'completed') {
    return res.status(409).json({ error: 'Upload session already finalized' });
  }

  // A. Verify every chunk exists from 0 to total_chunks - 1
  const missingChunks: number[] = [];
  let totalChunkBytes = 0;

  for (let i = 0; i < session.total_chunks; i++) {
    const chunkPath = path.join(uploadDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      missingChunks.push(i);
    } else {
      const cstat = fs.statSync(chunkPath);
      totalChunkBytes += cstat.size;
    }
  }

  if (missingChunks.length > 0) {
    return res.status(400).json({
      error: `Missing ${missingChunks.length} chunk(s) (${missingChunks.slice(0, 5).join(', ')}${
        missingChunks.length > 5 ? '...' : ''
      }). Please retry missing chunks.`,
      missing_chunks: missingChunks,
    });
  }

  // B. Prepare target file in VIDEO_STORAGE
  const safeExt = path.extname(session.filename).toLowerCase() || '.mp4';
  const publicToken = generatePublicToken();
  const videoId = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const finalFilename = `${videoId}${safeExt}`;
  const finalFilePath = path.join(VIDEOS_DIR, finalFilename);

  // C. Assemble chunks using buffered file streams (zero whole-file memory consumption)
  try {
    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 0; i < session.total_chunks; i++) {
      const chunkPath = path.join(uploadDir, `chunk_${i}`);
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.on('error', (err) =>
          reject(new Error(`Failed reading chunk ${i}: ${err.message}`))
        );
        readStream.on('end', () => resolve());
        readStream.pipe(writeStream, { end: false });
      });
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) =>
        reject(new Error(`Failed writing assembled file: ${err.message}`))
      );
    });

    // D. Verify final file exists and size > 0
    if (!fs.existsSync(finalFilePath)) {
      throw new Error('Server could not finalize video: final file was not created on storage');
    }

    const stat = fs.statSync(finalFilePath);
    if (stat.size === 0) {
      try {
        fs.unlinkSync(finalFilePath);
      } catch {}
      throw new Error('Server could not finalize video: assembled file size is 0 bytes');
    }

    // E. Optimize container for instant progressive streaming (MP4 faststart)
    await ensureFaststart(finalFilePath);

    // F. Video Verification and Metadata Probe
    const probe = await probeVideoFile(finalFilePath, session.filename);
    if (!probe.valid) {
      try {
        fs.unlinkSync(finalFilePath);
      } catch {}
      return res.status(400).json({
        error: `Video validation failed: ${probe.error || 'unreadable media stream'}`,
      });
    }

    const updatedStat = fs.statSync(finalFilePath);

    // G. Generate Thumbnail Poster ONLY (separated from video file)
    let finalThumbnail = thumbnail_url || null;
    if (!finalThumbnail) {
      const thumbName = `thumb_auto_${Date.now()}_${publicToken}.jpg`;
      const thumbDest = path.join(THUMBS_DIR, thumbName);
      try {
        await new Promise<void>((resolve) => {
          exec(
            `ffmpeg -y -ss 00:00:01 -i "${finalFilePath}" -vframes 1 -q:v 2 "${thumbDest}"`,
            (err) => {
              if (!err && fs.existsSync(thumbDest)) {
                finalThumbnail = `/api/thumbnails/${thumbName}`;
              }
              resolve();
            }
          );
        });
      } catch (e) {
        console.warn('Thumbnail generation skipped:', e);
      }
    }

    const validMode =
      (access_mode || session.access_mode) === 'INVISIBLE' ? 'INVISIBLE' : 'VISIBLE';
    const finalTitle = (title || session.title).trim();
    const finalDesc = (description !== undefined ? description : session.description).trim();

    // H. Create Database Record with real video metadata
    const videoRecord: VideoRecord = {
      id: videoId,
      public_token: publicToken,
      title: finalTitle,
      description: finalDesc,
      filename: finalFilename,
      file_path: finalFilePath,
      mime_type: probe.mime_type || session.mime_type || 'video/mp4',
      file_size: updatedStat.size,
      thumbnail: finalThumbnail,
      duration_seconds: probe.duration_seconds,
      width: probe.width,
      height: probe.height,
      format: probe.format,
      codec: probe.codec,
      access_mode: validMode,
      status: 'active',
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      db.addVideo(videoRecord);
    } catch (dbErr: any) {
      try {
        fs.unlinkSync(finalFilePath);
      } catch {}
      return res.status(500).json({
        error:
          'Video uploaded but metadata could not be saved to database. Please retry safely.',
      });
    }

    // H. Clean up temporary chunks immediately (Requirement 9)
    try {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Failed to clean up temp chunks directory:', cleanupErr);
    }

    // I. Return successful JSON response (Requirement 3)
    res.status(201).json({
      success: true,
      video_id: videoRecord.id,
      public_token: videoRecord.public_token,
      message: 'Video uploaded successfully',
      video: videoRecord,
      public_url: `/v/${videoRecord.public_token}`,
    });
  } catch (assembleErr: any) {
    console.error('Finalize video error:', assembleErr);
    try {
      if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
    } catch {}
    res.status(500).json({
      error: `Server could not finalize the video: ${
        assembleErr.message || 'Internal assembly error'
      }`,
    });
  }
});

// 6. Cancel Upload & Clean Up Temporary Chunks
apiRouter.post('/admin/videos/upload/cancel', requireAdmin, (req, res) => {
  const { upload_id } = req.body;
  if (upload_id && /^[a-zA-Z0-9_-]+$/.test(upload_id)) {
    const uploadDir = path.join(TEMP_CHUNKS_DIR, upload_id);
    if (fs.existsSync(uploadDir)) {
      try {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      } catch {}
    }
  }
  res.json({ success: true, message: 'Upload cancelled and temporary chunks deleted' });
});

// Single-request upload fallback
apiRouter.post(
  '/admin/videos/upload',
  requireAdmin,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || !files.video || files.video.length === 0) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const videoFile = files.video[0];
      const thumbnailFile = files.thumbnail && files.thumbnail.length > 0 ? files.thumbnail[0] : null;

      const { title, description, access_mode } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Video title is required' });
      }

      const validMode = access_mode === 'INVISIBLE' ? 'INVISIBLE' : 'VISIBLE';
      const publicToken = generatePublicToken();
      const videoId = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Optimize container for instant progressive streaming (MP4 faststart)
      await ensureFaststart(videoFile.path);

      // Verify and probe uploaded file
      const probe = await probeVideoFile(videoFile.path, videoFile.originalname);
      if (!probe.valid) {
        try {
          fs.unlinkSync(videoFile.path);
        } catch {}
        return res.status(400).json({
          error: `Video validation failed: ${probe.error || 'unreadable media stream'}`,
        });
      }

      const updatedStat = fs.statSync(videoFile.path);
      let thumbnailPath = thumbnailFile ? `/api/thumbnails/${thumbnailFile.filename}` : null;

      // If no custom thumbnail was uploaded, extract poster from 1st second
      if (!thumbnailPath) {
        const thumbName = `thumb_auto_${Date.now()}_${publicToken}.jpg`;
        const thumbDest = path.join(THUMBS_DIR, thumbName);
        try {
          await new Promise<void>((resolve) => {
            exec(
              `ffmpeg -y -ss 00:00:01 -i "${videoFile.path}" -vframes 1 -q:v 2 "${thumbDest}"`,
              (err) => {
                if (!err && fs.existsSync(thumbDest)) {
                  thumbnailPath = `/api/thumbnails/${thumbName}`;
                }
                resolve();
              }
            );
          });
        } catch (e) {
          console.warn('Auto thumbnail generation skipped:', e);
        }
      }

      const videoRecord: VideoRecord = {
        id: videoId,
        public_token: publicToken,
        title: title.trim(),
        description: (description || '').trim(),
        filename: videoFile.filename,
        file_path: videoFile.path,
        mime_type: probe.mime_type || videoFile.mimetype || 'video/mp4',
        file_size: updatedStat.size,
        thumbnail: thumbnailPath,
        duration_seconds: probe.duration_seconds,
        width: probe.width,
        height: probe.height,
        format: probe.format,
        codec: probe.codec,
        access_mode: validMode,
        status: 'active',
        views: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.addVideo(videoRecord);

      res.status(201).json({
        success: true,
        message: 'Video uploaded and published successfully',
        video: videoRecord,
        public_url: `/v/${publicToken}`,
      });
    } catch (err: any) {
      console.error('Upload handler error:', err);
      res.status(500).json({ error: err.message || 'Video upload failed' });
    }
  }
);

// Edit video details
apiRouter.put('/admin/videos/:id', requireAdmin, (req, res) => {
  const { title, description, access_mode, status } = req.body;
  const updates: Partial<VideoRecord> = {};

  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description.trim();
  if (access_mode && (access_mode === 'VISIBLE' || access_mode === 'INVISIBLE')) {
    updates.access_mode = access_mode;
  }
  if (status && (status === 'active' || status === 'disabled')) {
    updates.status = status;
  }

  const updated = db.updateVideo(req.params.id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Video not found' });
  }

  res.json({ success: true, video: updated });
});

// Toggle access mode (VISIBLE <-> INVISIBLE)
apiRouter.post('/admin/videos/:id/toggle-mode', requireAdmin, (req, res) => {
  const video = db.getVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const newMode = video.access_mode === 'VISIBLE' ? 'INVISIBLE' : 'VISIBLE';
  const updated = db.updateVideo(video.id, { access_mode: newMode });

  res.json({
    success: true,
    video: updated,
    message: `Mode updated to ${newMode}. Video remains securely stored.`,
  });
});

// Toggle status (active <-> disabled)
apiRouter.post('/admin/videos/:id/toggle-status', requireAdmin, (req, res) => {
  const video = db.getVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const newStatus = video.status === 'active' ? 'disabled' : 'active';
  const updated = db.updateVideo(video.id, { status: newStatus });

  res.json({
    success: true,
    video: updated,
    message: `Video is now ${newStatus}.`,
  });
});

// Delete Video manually
apiRouter.delete('/admin/videos/:id', requireAdmin, (req, res) => {
  const success = db.deleteVideo(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Video not found' });
  }
  res.json({ success: true, message: 'Video and associated storage deleted successfully' });
});

// Admin Settings
apiRouter.get('/admin/settings', requireAdmin, (req, res) => {
  const settings = db.getSettings();
  res.json(settings);
});

apiRouter.put('/admin/settings', requireAdmin, (req, res) => {
  const {
    site_name,
    site_logo,
    adsterra_smartlink,
    smartlink_enabled,
    default_invisible_duration_minutes,
    max_upload_size_mb,
  } = req.body;

  const updates: any = {};
  if (site_name !== undefined) updates.site_name = site_name.trim();
  if (site_logo !== undefined) updates.site_logo = site_logo.trim();
  if (adsterra_smartlink !== undefined) updates.adsterra_smartlink = adsterra_smartlink.trim();
  if (smartlink_enabled !== undefined) updates.smartlink_enabled = Boolean(smartlink_enabled);
  if (default_invisible_duration_minutes !== undefined) {
    updates.default_invisible_duration_minutes = Math.max(1, Number(default_invisible_duration_minutes));
  }
  if (max_upload_size_mb !== undefined) {
    updates.max_upload_size_mb = Math.max(10, Number(max_upload_size_mb));
  }

  const updatedSettings = db.updateSettings(updates);
  res.json({ success: true, settings: updatedSettings });
});

// Session purge trigger
apiRouter.post('/admin/sessions/clean', requireAdmin, (req, res) => {
  const purged = db.cleanExpiredSessions();
  res.json({ success: true, purged_count: purged });
});
