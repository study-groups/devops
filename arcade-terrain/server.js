/**
 * Arcade-Terrain Server
 *
 * - Static file server for frontend
 * - Stats webhook receiver from GAMMA
 * - Stats API for match history, leaderboards
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GammaStats } from './lib/gamma-stats.js';
import { getGamesList, getGame, getGameFileStream } from './lib/gamepak.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8410;
const PD_DIR = process.env.PD_DIR || path.join(process.env.HOME, 'pj/pd');
const ROOT_DIR = __dirname; // Serve from root, not dist

// Initialize stats collector
const stats = new GammaStats(PD_DIR);
console.log(`[stats] Using PD_DIR: ${PD_DIR}`);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ─────────────────────────────────────────────────────────────
// Request Handler
// ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`${req.method} ${pathname}`);

  // ─── API Routes ───────────────────────────────────────────

  // Webhook receiver (from GAMMA)
  if (req.method === 'POST' && pathname === '/api/webhook') {
    return handleWebhook(req, res);
  }

  // Stats API
  if (pathname === '/api/stats') {
    return json(res, 200, stats.getStats());
  }

  if (pathname === '/api/stats/matches') {
    const gameType = url.searchParams.get('game');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    return json(res, 200, stats.getMatchHistory({ game_type: gameType, status, limit }));
  }

  if (pathname.startsWith('/api/stats/match/')) {
    const matchId = pathname.split('/')[4];
    if (!matchId) return json(res, 400, { error: 'match_id required' });

    const match = stats.getMatchHistory({}).find(m => m.match_id === matchId);
    if (!match) return json(res, 404, { error: 'Match not found' });

    const participations = stats.getMatchParticipations(matchId);
    const scores = stats.getMatchScores(matchId);

    return json(res, 200, { ...match, participations, scores });
  }

  if (pathname === '/api/stats/leaderboard') {
    const gameType = url.searchParams.get('game');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    return json(res, 200, stats.getLeaderboard({ game_type: gameType, limit }));
  }

  if (pathname === '/api/stats/player') {
    const userId = url.searchParams.get('user_id');
    const guestId = url.searchParams.get('guest_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!userId && !guestId) {
      return json(res, 400, { error: 'user_id or guest_id required' });
    }

    return json(res, 200, stats.getPlayerHistory({ user_id: userId, guest_id: guestId, limit }));
  }

  // Health check
  if (pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'arcade-terrain', pd_dir: PD_DIR });
  }

  // ─── Games API (Gamepak) ────────────────────────────────────

  // List all games
  if (pathname === '/api/games') {
    try {
      const games = await getGamesList();
      return json(res, 200, { games });
    } catch (e) {
      console.error('[games] Error:', e.message);
      return json(res, 500, { error: e.message });
    }
  }

  // Get single game by slug
  if (pathname.startsWith('/api/games/') && !pathname.startsWith('/api/game-files/')) {
    const slug = pathname.split('/')[3];
    if (!slug) return json(res, 400, { error: 'slug required' });

    try {
      const game = await getGame(slug);
      if (!game) return json(res, 404, { error: 'Game not found' });
      return json(res, 200, game);
    } catch (e) {
      console.error('[games] Error:', e.message);
      return json(res, 500, { error: e.message });
    }
  }

  // Proxy game files from S3
  if (pathname.startsWith('/api/game-files/')) {
    const filePath = decodeURIComponent(pathname.replace('/api/game-files/', ''));
    if (!filePath) return json(res, 400, { error: 'path required' });

    try {
      const { body, contentType } = await getGameFileStream(filePath);

      // Collect stream into buffer
      const chunks = [];
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Cache: HTML 1min, assets 1hr
      const cacheTime = filePath.endsWith('.html') ? 60 : 3600;

      res.writeHead(200, {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': buffer.length,
        'Cache-Control': `public, max-age=${cacheTime}`,
      });
      res.end(buffer);
      return;
    } catch (e) {
      console.error('[game-files] Error:', e.message);
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        return json(res, 404, { error: 'File not found' });
      }
      return json(res, 500, { error: e.message });
    }
  }

  // ─── Static Files ─────────────────────────────────────────

  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = filePath.split('?')[0];

  let absolutePath = path.join(ROOT_DIR, filePath);

  // Fallback to root dir (for terrain/ etc)
  if (!fs.existsSync(absolutePath)) {
    absolutePath = path.join(__dirname, filePath);
  }

  if (!fs.existsSync(absolutePath)) {
    // SPA fallback - serve index.html for routes without extension
    if (!path.extname(filePath)) {
      return serveFile(path.join(ROOT_DIR, 'index.html'), '.html', res);
    }
    res.writeHead(404);
    res.end(`Not Found: ${filePath}`);
    return;
  }

  const ext = path.extname(absolutePath);
  serveFile(absolutePath, ext, res);
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveFile(filePath, ext, res) {
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });
}

async function handleWebhook(req, res) {
  try {
    const body = await readBody(req);
    const payload = JSON.parse(body);

    console.log(`[webhook] ${payload.event}`, payload.match_id || '');

    const result = stats.handleWebhook(payload);
    return json(res, 200, result);
  } catch (e) {
    console.error('[webhook] Error:', e.message);
    return json(res, 400, { error: e.message });
  }
}

function readBody(req, maxSize = 65536) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxSize) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  Arcade-Terrain`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`\n  API Endpoints:`);
  console.log(`    POST /api/webhook         - GAMMA event receiver`);
  console.log(`    GET  /api/stats           - Stats summary`);
  console.log(`    GET  /api/stats/matches   - Match history`);
  console.log(`    GET  /api/stats/match/:id - Match details`);
  console.log(`    GET  /api/stats/leaderboard - High scores`);
  console.log(`    GET  /api/stats/player    - Player history`);
  console.log(`    GET  /api/games           - List games from S3`);
  console.log(`    GET  /api/games/:slug     - Get game metadata`);
  console.log(`    GET  /api/game-files/*    - Proxy game files from S3`);
  console.log(`\n  GAMMA webhook URL: http://localhost:${PORT}/api/webhook`);
  console.log(`\n  Press Ctrl+C to stop\n`);
});
