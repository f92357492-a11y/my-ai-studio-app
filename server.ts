import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Body parsing and cookies
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Mount API routes
  app.use('/api', apiRouter);

  // In development, hook up Vite middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built frontend assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Noxius Video] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Noxius Video] Mode: ${isProd ? 'Production' : 'Development'}`);
  });

  // Resilient chunked upload timeout configuration
  server.keepAliveTimeout = 120000; // 120s
  server.headersTimeout = 125000;   // 125s
  if ('requestTimeout' in server) {
    (server as any).requestTimeout = 300000; // 300s
  }
}

startServer().catch((err) => {
  console.error('[Noxius Video] Failed to start server:', err);
  process.exit(1);
});
