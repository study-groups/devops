const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// TOML parser (simple implementation for game.toml files)
function parseToml(content) {
  const result = {};
  let currentSection = result;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Section header [section]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const section = sectionMatch[1];
      result[section] = result[section] || {};
      currentSection = result[section];
      continue;
    }

    // Key = value
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const [, key, rawValue] = kvMatch;
      let value = rawValue.trim();

      // Remove quotes from strings
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Parse numbers
      else if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }
      // Parse arrays
      else if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => {
          v = v.trim();
          if ((v.startsWith('"') && v.endsWith('"')) ||
              (v.startsWith("'") && v.endsWith("'"))) {
            return v.slice(1, -1);
          }
          return v;
        });
      }

      currentSection[key] = value;
    }
  }

  return result;
}

// Discover games from game.toml files in orgs/*/games/
function discoverGames() {
  const games = [];
  const tetraDir = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
  const orgsDir = path.join(tetraDir, 'orgs');

  if (!fs.existsSync(orgsDir)) return games;

  // Scan each org
  for (const org of fs.readdirSync(orgsDir)) {
    const gamesDir = path.join(orgsDir, org, 'games');
    if (!fs.existsSync(gamesDir)) continue;

    // Scan each game directory
    for (const gameDir of fs.readdirSync(gamesDir)) {
      const gamePath = path.join(gamesDir, gameDir);
      if (!fs.statSync(gamePath).isDirectory()) continue;

      // Look for game.toml
      const tomlPath = path.join(gamePath, 'game.toml');
      if (!fs.existsSync(tomlPath)) continue;

      try {
        const content = fs.readFileSync(tomlPath, 'utf-8');
        const parsed = parseToml(content);

        // Flatten [game] section if present
        const gameData = parsed.game || parsed;
        gameData.org = org;
        gameData.path = gamePath;

        games.push(gameData);
      } catch (err) {
        console.error(`[pbase] Failed to parse ${tomlPath}:`, err.message);
      }
    }
  }

  return games;
}

/**
 * PBase API - Game server management service
 * Handles multiplayer game server operations and player management
 */

// Serve gamma-cabinet (redirect to trailing slash for correct relative paths)
router.get('/cabinet', (req, res) => {
  if (!req.originalUrl.endsWith('/')) {
    return res.redirect(301, req.originalUrl + '/');
  }
  const tetraSrc = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
  const cabinetPath = path.join(tetraSrc, 'bash/ansicab/gamma-cabinet.html');
  res.sendFile(cabinetPath);
});

// Serve cabinet static assets (CSS, JS)
router.use('/cabinet/lib', (req, res, next) => {
  const tetraSrc = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
  express.static(path.join(tetraSrc, 'bash/ansicab/lib'))(req, res, next);
});

router.get('/status', (req, res) => {
  const games = discoverGames();
  res.json({
    service: 'pbase-2600',
    status: 'running',
    port: 2600,
    players: 0,
    games: games.length,
    message: 'Multiplayer game server management'
  });
});

router.post('/create', (req, res) => {
  res.json({
    message: 'Game server creation requested (tetra_pbase_create)',
    status: 'pending'
  });
});

router.post('/start', (req, res) => {
  res.json({
    message: 'Game server start requested',
    status: 'pending'
  });
});

router.post('/stop', (req, res) => {
  res.json({
    message: 'Game server stop requested',
    status: 'pending'
  });
});

router.get('/players', (req, res) => {
  res.json({
    players: [],
    active_count: 0
  });
});

// Game list from discovered game.toml files
router.get('/games', (req, res) => {
  const games = discoverGames();
  res.json({
    games,
    count: games.length
  });
});

// Get single game by ID
router.get('/games/:id', (req, res) => {
  const games = discoverGames();
  const game = games.find(g => g.id === req.params.id);
  if (game) {
    res.json(game);
  } else {
    res.status(404).json({ error: 'Game not found' });
  }
});

router.get('/llm-router', (req, res) => {
  res.json({
    status: 'stopped',
    requests: 0,
    queue: 0
  });
});

module.exports = router;
