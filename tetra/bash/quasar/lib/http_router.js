/**
 * HTTP Router - REST API handlers for Quasar server
 *
 * Routes:
 * - /api/status - Server status
 * - /api/screen - Current screen content
 * - /api/lobby/* - Match lobby operations
 * - /api/matches/* - Match management
 * - /api/scores/* - Leaderboards
 * - /api/monogram/* - Player identity
 * - Static files from browser/
 */

const fs = require('fs');
const path = require('path');

const STATIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/quasar.js': 'quasar.js',
  '/tia-worklet.js': 'tia-worklet.js',
  '/terminal.js': 'terminal.js',
  '/presets.js': 'presets.js',
  '/fonts/FiraCode-Regular.woff2': 'fonts/FiraCode-Regular.woff2',
  '/fonts/fonts.css': 'fonts/fonts.css',
  '/lobby': 'lobby.html',
  '/lobby.html': 'lobby.html',
  '/lobby-test.html': 'lobby-test.html',
  '/browser/lobby-test.html': 'lobby-test.html',
  '/config/channels.json': 'config/channels.json'
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2'
};

class HTTPRouter {
  constructor(server, options = {}) {
    this.server = server;
    this.browserDir = options.browserDir || path.join(__dirname, '..', 'browser');
  }

  /**
   * Handle HTTP request
   */
  handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // API Routes
    if (url.pathname === '/api/status') {
      return this.apiStatus(res);
    }

    if (url.pathname === '/api/screen') {
      return this.apiScreen(res);
    }

    if (url.pathname === '/api/screen.png') {
      return this.apiScreenPng(res);
    }

    // Match system API routes
    if (url.pathname.startsWith('/api/lobby')) {
      return this.handleLobbyAPI(req, res, url);
    }

    if (url.pathname.startsWith('/api/matches')) {
      return this.handleMatchesAPI(req, res, url);
    }

    if (url.pathname.startsWith('/api/scores')) {
      return this.handleScoresAPI(req, res, url);
    }

    if (url.pathname.startsWith('/api/monogram')) {
      return this.handleMonogramAPI(req, res, url);
    }

    // Serve static files
    const filename = STATIC_FILES[url.pathname];
    if (filename) {
      return this.serveFile(res, filename);
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Serve static file from browser directory
   */
  serveFile(res, filename) {
    const filePath = path.join(this.browserDir, filename);
    const ext = path.extname(filename);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end(`File not found: ${filename}`);
      } else {
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        res.end(content);
      }
    });
  }

  /**
   * GET /api/status - Server status
   */
  apiStatus(res) {
    const s = this.server;
    const status = {
      status: 'ok',
      uptime: Date.now() - s.stats.startedAt,
      clients: s.clients.size,
      gameSources: s.gameSources.size,
      stats: s.stats,
      soundState: s.soundState
    };

    if (s.matchRegistry) {
      status.matches = s.matchRegistry.getStats();
    }
    if (s.matchmaker) {
      status.queues = s.matchmaker.getQueueStats();
    }
    if (s.doctor) {
      status.health = s.doctor.getSystemHealth();
    }
    if (s.monogramManager) {
      status.monograms = s.monogramManager.getGlobalStats();
    }

    this.jsonResponse(res, 200, status);
  }

  /**
   * GET /api/screen - Current screen content
   */
  apiScreen(res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(this.server.currentScreen || '(no screen data)');
  }

  /**
   * GET /api/screen.png - Screen as image (placeholder)
   */
  apiScreenPng(res) {
    const screen = this.server.currentScreen || '(no screen data)';
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'X-Screen-Cols': 60,
      'X-Screen-Rows': 24
    });
    res.end(screen);
  }

  /**
   * /api/lobby/* - Match lobby operations
   */
  handleLobbyAPI(req, res, url) {
    const s = this.server;
    if (!s.matchmaker) {
      return this.jsonResponse(res, 503, { error: 'Match system not available' });
    }

    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (parts[2] === 'status') {
        return this.jsonResponse(res, 200, {
          queues: s.matchmaker.getQueueStats(),
          matches: s.matchRegistry.stats
        });
      }
    }

    if (req.method === 'POST') {
      return this.parseBody(req, res, (body) => {
        if (parts[2] === 'queue') {
          const { gameType, playerId, name } = body;
          const monogram = s.monogramManager.assign(playerId);
          const result = s.matchmaker.enqueue(playerId, gameType, { name, monogram });
          return this.jsonResponse(res, 200, { ...result, monogram });
        }

        if (parts[2] === 'dequeue') {
          const { playerId } = body;
          s.matchmaker.dequeue(playerId);
          return this.jsonResponse(res, 200, { success: true });
        }

        if (parts[2] === 'private') {
          const { gameType, playerId, name } = body;
          const monogram = s.monogramManager.assign(playerId);
          const result = s.matchmaker.createPrivate(gameType, playerId, { name, monogram });
          return this.jsonResponse(res, 200, { ...result, monogram });
        }

        if (parts[2] === 'join') {
          const { inviteCode, playerId, name } = body;
          const monogram = s.monogramManager.assign(playerId);
          const result = s.matchmaker.joinPrivate(inviteCode, playerId, { name, monogram });
          if (result.error) {
            return this.jsonResponse(res, 400, result);
          }
          return this.jsonResponse(res, 200, { ...result, monogram });
        }

        return this.jsonResponse(res, 400, { error: 'Unknown lobby action' });
      });
    }

    return this.jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  /**
   * /api/matches/* - Match management
   */
  handleMatchesAPI(req, res, url) {
    const s = this.server;
    if (!s.matchRegistry) {
      return this.jsonResponse(res, 503, { error: 'Match system not available' });
    }

    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (parts.length === 2) {
        const matches = s.matchRegistry.list();
        return this.jsonResponse(res, 200, { matches });
      }

      if (parts.length >= 3) {
        const matchId = parseInt(parts[2].replace('0x', ''), 16);
        const match = s.matchRegistry.get(matchId);
        if (!match) {
          return this.jsonResponse(res, 404, { error: 'Match not found' });
        }
        return this.jsonResponse(res, 200, {
          id: match.idHex,
          gameType: match.gameType,
          state: match.state,
          players: match.players.filter(p => p.id).map(p => ({
            slot: p.slot,
            monogram: p.monogram,
            name: p.name
          })),
          config: match.config
        });
      }
    }

    if (req.method === 'POST') {
      return this.parseBody(req, res, (body) => {
        if (parts.length >= 4 && parts[3] === 'start') {
          const matchId = parseInt(parts[2].replace('0x', ''), 16);
          const match = s.matchRegistry.get(matchId);
          if (!match) {
            return this.jsonResponse(res, 404, { error: 'Match not found' });
          }
          const result = match.start();
          if (result.error) {
            return this.jsonResponse(res, 400, result);
          }
          return this.jsonResponse(res, 200, { success: true, state: match.state });
        }

        if (parts.length >= 4 && parts[3] === 'leave') {
          const { playerId } = body;
          s.matchRegistry.leave(playerId);
          return this.jsonResponse(res, 200, { success: true });
        }

        if (parts.length >= 4 && parts[3] === 'input') {
          const matchId = parseInt(parts[2].replace('0x', ''), 16);
          const match = s.matchRegistry.get(matchId);
          if (!match) {
            return this.jsonResponse(res, 404, { error: 'Match not found' });
          }
          match.recordInput(body.playerId, body.input);
          return this.jsonResponse(res, 200, { success: true });
        }

        return this.jsonResponse(res, 400, { error: 'Unknown match action' });
      });
    }

    return this.jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  /**
   * /api/scores/* - Leaderboards
   */
  handleScoresAPI(req, res, url) {
    const s = this.server;
    if (!s.scoreManager) {
      return this.jsonResponse(res, 503, { error: 'Score system not available' });
    }

    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (parts.length === 2) {
        return this.jsonResponse(res, 200, s.scoreManager.getStats());
      }

      if (parts.length >= 3) {
        const gameType = parts[2];
        const count = parseInt(url.searchParams.get('count') || '10');
        const period = url.searchParams.get('period') || 'allTime';

        const leaderboard = s.scoreManager.getLeaderboard(gameType, period, count);
        if (leaderboard.error) {
          return this.jsonResponse(res, 400, leaderboard);
        }
        return this.jsonResponse(res, 200, leaderboard);
      }
    }

    return this.jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  /**
   * /api/monogram/* - Player identity
   */
  handleMonogramAPI(req, res, url) {
    const s = this.server;
    if (!s.monogramManager) {
      return this.jsonResponse(res, 503, { error: 'Monogram system not available' });
    }

    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (parts.length === 2 || parts[2] === 'stats') {
        return this.jsonResponse(res, 200, s.monogramManager.getGlobalStats());
      }

      if (parts.length >= 3 && parts[2] !== 'stats') {
        const monogram = parts[2].toUpperCase();
        const data = s.monogramManager.get(monogram);
        if (!data) {
          return this.jsonResponse(res, 404, { error: 'Monogram not found' });
        }
        return this.jsonResponse(res, 200, data.toJSON());
      }
    }

    if (req.method === 'POST') {
      return this.parseBody(req, res, (body) => {
        if (parts[2] === 'claim') {
          const { monogram, passphrase } = body;
          const result = s.monogramManager.claim(monogram, passphrase);
          if (result.error) {
            return this.jsonResponse(res, 400, result);
          }
          return this.jsonResponse(res, 200, result);
        }

        if (parts[2] === 'verify') {
          const { monogram, passphrase } = body;
          const result = s.monogramManager.verify(monogram, passphrase);
          return this.jsonResponse(res, 200, result);
        }

        return this.jsonResponse(res, 400, { error: 'Unknown monogram action' });
      });
    }

    return this.jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  /**
   * Send JSON response
   */
  jsonResponse(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Parse request body as JSON
   */
  parseBody(req, res, callback) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        callback(JSON.parse(body || '{}'));
      } catch (e) {
        this.jsonResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
  }

  toJSON() {
    return {
      routes: Object.keys(STATIC_FILES).concat([
        '/api/status',
        '/api/screen',
        '/api/lobby/*',
        '/api/matches/*',
        '/api/scores/*',
        '/api/monogram/*'
      ])
    };
  }
}

module.exports = { HTTPRouter, STATIC_FILES, MIME_TYPES };
