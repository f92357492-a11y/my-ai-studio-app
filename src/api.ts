import {
  AdminStats,
  AdminVideo,
  ChunkUploadProgress,
  SiteSettings,
  VideoInfo,
  ViewingSessionData,
} from './types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('noxius_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Public APIs
  async getVideoInfo(token: string): Promise<VideoInfo> {
    const res = await fetch(`${API_BASE}/video/${token}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch video details' }));
      throw new Error(err.error || 'Video not found');
    }
    return res.json();
  },

  async startVideoSession(token: string): Promise<ViewingSessionData> {
    const res = await fetch(`${API_BASE}/video/${token}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to start viewing session' }));
      throw new Error(err.error || 'Failed to start session');
    }
    return res.json();
  },

  async checkSessionStatus(sessionToken: string): Promise<{
    status: 'active' | 'expired';
    expired: boolean;
    remaining_seconds: number;
    expires_at: string;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/video/session/${sessionToken}/status`);
    if (!res.ok) {
      return { status: 'expired', expired: true, remaining_seconds: 0, expires_at: '' };
    }
    return res.json();
  },

  async getPublicSettings(): Promise<Partial<SiteSettings>> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json();
  },

  // Admin Authentication
  async adminLogin(username: string, password: string): Promise<{ token: string; user: { username: string } }> {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }
    if (data.token) {
      localStorage.setItem('noxius_admin_token', data.token);
    }
    return data;
  },

  async adminLogout(): Promise<void> {
    localStorage.removeItem('noxius_admin_token');
    await fetch(`${API_BASE}/admin/logout`, { method: 'POST' }).catch(() => {});
  },

  async checkAdminAuth(): Promise<boolean> {
    const token = localStorage.getItem('noxius_admin_token');
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/admin/me`, {
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async changeAdminPassword(current_password: string, new_password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to change password');
    }
  },

  // Admin Dashboard & Videos
  async getAdminStats(): Promise<AdminStats> {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  },

  async getAdminVideos(params?: { q?: string; mode?: string; status?: string }): Promise<AdminVideo[]> {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.mode) query.append('mode', params.mode);
    if (params?.status) query.append('status', params.status);

    const res = await fetch(`${API_BASE}/admin/videos?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch videos');
    const data = await res.json();
    return data.videos || [];
  },

  async uploadVideo(
    formData: FormData,
    onProgress?: (percent: number, loaded: number, total: number) => void
  ): Promise<{ success: boolean; video: AdminVideo; public_url: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/admin/videos/upload`);

      const token = localStorage.getItem('noxius_admin_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent, event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during video upload'));
      };

      xhr.send(formData);
    });
  },

  async uploadVideoChunked(
    file: File,
    meta: {
      title: string;
      description?: string;
      access_mode: 'VISIBLE' | 'INVISIBLE';
      thumbnailFile?: File | null;
    },
    onProgress?: (progress: ChunkUploadProgress) => void,
    signal?: AbortSignal
  ): Promise<{ success: boolean; video: AdminVideo; public_url: string; video_id: string; public_token: string }> {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const sessionKey = `noxius_upload_${encodeURIComponent(file.name)}_${file.size}_${file.lastModified}`;

    let uploadId = '';
    const uploadedChunks = new Set<number>();

    onProgress?.({
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      currentChunk: 1,
      totalChunks,
      speedBytesPerSec: 0,
      estimatedRemainingSec: 0,
      statusText: 'Initializing upload session...',
    });

    // 1. Check if there is an existing session to resume
    const savedUploadId = localStorage.getItem(sessionKey);
    if (savedUploadId) {
      try {
        const checkRes = await fetch(`${API_BASE}/admin/videos/upload/session/${encodeURIComponent(savedUploadId)}`, {
          headers: getAuthHeaders(),
          signal,
        });
        if (checkRes.ok) {
          const sessionData = await checkRes.json();
          if (sessionData.total_chunks === totalChunks && sessionData.status === 'uploading') {
            uploadId = savedUploadId;
            (sessionData.uploaded_chunks || []).forEach((idx: number) => uploadedChunks.add(idx));
          }
        }
      } catch {
        // Fall back to init
      }
    }

    // 2. If no valid session, initialize new one
    if (!uploadId) {
      const initRes = await fetch(`${API_BASE}/admin/videos/upload/init`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          filename: file.name,
          file_size: file.size,
          mime_type: file.type || 'video/mp4',
          chunk_size: CHUNK_SIZE,
          total_chunks: totalChunks,
          title: meta.title,
          description: meta.description || '',
          access_mode: meta.access_mode,
        }),
        signal,
      });

      if (!initRes.ok) {
        let errMsg = `Failed to initialize upload (${initRes.status})`;
        try {
          const errData = await initRes.json();
          if (errData.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }

      const initData = await initRes.json();
      uploadId = initData.upload_id;
      localStorage.setItem(sessionKey, uploadId);
    }

    // 3. Upload thumbnail if provided
    let thumbnailUrl: string | null = null;
    if (meta.thumbnailFile) {
      try {
        const thumbFormData = new FormData();
        thumbFormData.append('thumbnail', meta.thumbnailFile);
        const token = localStorage.getItem('noxius_admin_token');
        const thumbRes = await fetch(`${API_BASE}/admin/videos/upload/thumbnail`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: thumbFormData,
          signal,
        });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          thumbnailUrl = thumbData.thumbnail_url;
        }
      } catch (e) {
        console.warn('Thumbnail upload warning:', e);
      }
    }

    // 4. Chunk upload loop with retries & exponential backoff
    const uploadStartTime = Date.now();
    let sessionBytesUploaded = 0;
    for (const chunkIdx of uploadedChunks) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      sessionBytesUploaded += (end - start);
    }

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) {
        throw new Error('Upload aborted by user');
      }

      if (uploadedChunks.has(chunkIndex)) {
        continue;
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);
      const chunkSize = end - start;

      let chunkSuccess = false;
      let attempt = 0;
      const MAX_RETRIES = 3;

      while (!chunkSuccess && attempt <= MAX_RETRIES) {
        if (signal?.aborted) {
          throw new Error('Upload aborted by user');
        }

        try {
          await new Promise<void>((resolveChunk, rejectChunk) => {
            const xhr = new XMLHttpRequest();
            const token = localStorage.getItem('noxius_admin_token');

            xhr.open(
              'POST',
              `${API_BASE}/admin/videos/upload/chunk?upload_id=${encodeURIComponent(uploadId)}&chunk_index=${chunkIndex}`
            );

            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.setRequestHeader('X-Upload-Id', uploadId);
            xhr.setRequestHeader('X-Chunk-Index', String(chunkIndex));

            if (signal) {
              signal.addEventListener('abort', () => xhr.abort());
            }

            if (xhr.upload && onProgress) {
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const currentTotalUploaded = sessionBytesUploaded + e.loaded;
                  const elapsedSeconds = (Date.now() - uploadStartTime) / 1000;
                  const speed = elapsedSeconds > 0.2 ? currentTotalUploaded / elapsedSeconds : 0;
                  const remainingBytes = Math.max(0, file.size - currentTotalUploaded);
                  const estSeconds = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
                  const percent = Math.min(99, Math.round((currentTotalUploaded / file.size) * 99));

                  onProgress({
                    percent,
                    uploadedBytes: currentTotalUploaded,
                    totalBytes: file.size,
                    currentChunk: chunkIndex + 1,
                    totalChunks,
                    speedBytesPerSec: speed,
                    estimatedRemainingSec: estSeconds,
                    statusText: `Uploading chunk ${chunkIndex + 1} of ${totalChunks}...`,
                  });
                }
              };
            }

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolveChunk();
              } else {
                let errDetail = `Server error HTTP ${xhr.status}`;
                try {
                  const parsed = JSON.parse(xhr.responseText);
                  if (parsed.error) errDetail = parsed.error;
                } catch {}
                rejectChunk(new Error(errDetail));
              }
            };

            xhr.onerror = () => rejectChunk(new Error('Network connection error'));
            xhr.ontimeout = () => rejectChunk(new Error('Request timed out'));

            const chunkFormData = new FormData();
            chunkFormData.append('chunk', chunkBlob, `chunk_${chunkIndex}`);
            chunkFormData.append('upload_id', uploadId);
            chunkFormData.append('chunk_index', String(chunkIndex));

            xhr.send(chunkFormData);
          });

          chunkSuccess = true;
          uploadedChunks.add(chunkIndex);
          sessionBytesUploaded += chunkSize;
        } catch (err: any) {
          attempt++;
          if (attempt > MAX_RETRIES) {
            throw new Error(
              `Chunk ${chunkIndex + 1} failed after ${MAX_RETRIES} attempts: ${err.message}`
            );
          }

          const backoffDelay = Math.pow(2, attempt) * 1000;
          onProgress?.({
            percent: Math.min(99, Math.round((sessionBytesUploaded / file.size) * 99)),
            uploadedBytes: sessionBytesUploaded,
            totalBytes: file.size,
            currentChunk: chunkIndex + 1,
            totalChunks,
            speedBytesPerSec: 0,
            estimatedRemainingSec: 0,
            statusText: `Connection interrupted. Retrying chunk ${chunkIndex + 1} (attempt ${attempt}/${MAX_RETRIES})...`,
            retryAttempt: attempt,
          });

          await new Promise((r) => setTimeout(r, backoffDelay));
        }
      }
    }

    // 5. All Chunks Uploaded -> Assembling & Verification
    onProgress?.({
      percent: 99,
      uploadedBytes: file.size,
      totalBytes: file.size,
      currentChunk: totalChunks,
      totalChunks,
      speedBytesPerSec: 0,
      estimatedRemainingSec: 0,
      statusText: 'Assembling & verifying video on server...',
    });

    const completeRes = await fetch(`${API_BASE}/admin/videos/upload/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        upload_id: uploadId,
        thumbnail_url: thumbnailUrl,
        title: meta.title,
        description: meta.description,
        access_mode: meta.access_mode,
      }),
      signal,
    });

    if (!completeRes.ok) {
      let errMsg = `Failed to finalize video (${completeRes.status})`;
      try {
        const errJson = await completeRes.json();
        if (errJson.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    const finalData = await completeRes.json();
    if (!finalData.success) {
      throw new Error(finalData.error || 'Server did not confirm video finalization');
    }

    // 6. Only now report 100% / Upload Complete
    onProgress?.({
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      currentChunk: totalChunks,
      totalChunks,
      speedBytesPerSec: 0,
      estimatedRemainingSec: 0,
      statusText: '✓ Upload Complete',
    });

    localStorage.removeItem(sessionKey);
    return finalData;
  },

  async cancelChunkedUpload(uploadId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/admin/videos/upload/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ upload_id: uploadId }),
      });
    } catch {}
  },

  async updateVideo(
    id: string,
    updates: { title?: string; description?: string; access_mode?: 'VISIBLE' | 'INVISIBLE'; status?: 'active' | 'disabled' }
  ): Promise<AdminVideo> {
    const res = await fetch(`${API_BASE}/admin/videos/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update video');
    return data.video;
  },

  async toggleVideoMode(id: string): Promise<AdminVideo> {
    const res = await fetch(`${API_BASE}/admin/videos/${id}/toggle-mode`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle mode');
    return data.video;
  },

  async toggleVideoStatus(id: string): Promise<AdminVideo> {
    const res = await fetch(`${API_BASE}/admin/videos/${id}/toggle-status`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle status');
    return data.video;
  },

  async deleteVideo(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/videos/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete video');
    }
  },

  async getAdminSettings(): Promise<SiteSettings> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateAdminSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update settings');
    return data.settings;
  },

  async cleanExpiredSessions(): Promise<number> {
    const res = await fetch(`${API_BASE}/admin/sessions/clean`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.purged_count || 0;
  },
};
