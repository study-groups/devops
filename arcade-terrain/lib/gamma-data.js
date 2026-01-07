/**
 * arcade-data.js
 * Row-based JSON tables for match/score/player data
 *
 * Design: SQL-portable structure
 * - Each .json file = table (array of row objects)
 * - Foreign keys via match_id field
 * - Single-threaded writes = no locking needed
 *
 * Tables:
 *   matches.json  - { match_id, game_type, status, created_at, created_by }
 *   players.json  - { match_id, slot, user_id, guest_id, name }
 *   scores.json   - { match_id, timestamp, slot, score, event }
 *
 * SQLite migration:
 *   INSERT INTO matches SELECT * FROM json_each(readfile('matches.json'))
 */

import fs from 'fs';
import path from 'path';

// 4-letter code generation (no I, O to avoid confusion with 1, 0)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateMatchCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return code;
}

function validateMatchCode(code) {
  return /^[A-Z]{4}$/.test(code);
}

class ArcadeData {
  constructor(pdDir) {
    if (!pdDir) {
      throw new Error('PD_DIR is required');
    }
    this.pdDir = pdDir;
    this.tablesDir = path.join(pdDir, 'arcade', 'tables');
    this._ensureDirectories();
    this._ensureTables();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.tablesDir)) {
      fs.mkdirSync(this.tablesDir, { recursive: true });
    }
  }

  _ensureTables() {
    // Initialize empty tables if they don't exist
    for (const table of ['matches', 'players', 'scores']) {
      const p = this._tablePath(table);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, '[]');
      }
    }
  }

  _tablePath(table) {
    return path.join(this.tablesDir, `${table}.json`);
  }

  // ─────────────────────────────────────────────────────────────
  // Table I/O (single-threaded, read-modify-write)
  // ─────────────────────────────────────────────────────────────

  _readTable(table) {
    const data = fs.readFileSync(this._tablePath(table), 'utf-8');
    return JSON.parse(data);
  }

  _writeTable(table, rows) {
    fs.writeFileSync(this._tablePath(table), JSON.stringify(rows, null, 2));
  }

  // ─────────────────────────────────────────────────────────────
  // MATCHES table
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new match
   * @param {Object} opts
   * @param {string} opts.gameType - e.g., "gamma", "tetris"
   * @param {string} [opts.matchId] - Custom 4-letter code (auto-gen if omitted)
   * @param {string} [opts.createdBy] - Username of operator
   * @returns {Object} Created match row
   */
  createMatch({ gameType, matchId, createdBy = null }) {
    if (!gameType) {
      throw new Error('gameType is required');
    }

    const matches = this._readTable('matches');

    // Generate or validate match code
    if (matchId) {
      if (!validateMatchCode(matchId)) {
        throw new Error('Match ID must be 4 uppercase letters');
      }
      if (matches.some(m => m.match_id === matchId)) {
        throw new Error(`Match ${matchId} already exists`);
      }
    } else {
      let attempts = 0;
      do {
        matchId = generateMatchCode();
        attempts++;
        if (attempts > 100) {
          throw new Error('Could not generate unique match code');
        }
      } while (matches.some(m => m.match_id === matchId));
    }

    const row = {
      match_id: matchId,
      game_type: gameType,
      status: 'pending',
      created_at: new Date().toISOString(),
      created_by: createdBy
    };

    matches.push(row);
    this._writeTable('matches', matches);
    return row;
  }

  getMatch(matchId) {
    const matches = this._readTable('matches');
    return matches.find(m => m.match_id === matchId) || null;
  }

  updateMatchStatus(matchId, status) {
    if (!['pending', 'active', 'completed'].includes(status)) {
      throw new Error('Invalid status');
    }
    const matches = this._readTable('matches');
    const match = matches.find(m => m.match_id === matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }
    match.status = status;
    this._writeTable('matches', matches);
    return match;
  }

  listMatches({ status, gameType } = {}) {
    let matches = this._readTable('matches');
    if (status) matches = matches.filter(m => m.status === status);
    if (gameType) matches = matches.filter(m => m.game_type === gameType);
    return matches;
  }

  // ─────────────────────────────────────────────────────────────
  // PLAYERS table (FK: match_id)
  // ─────────────────────────────────────────────────────────────

  /**
   * Add a player to a match
   * @param {string} matchId
   * @param {Object} opts
   * @param {string} [opts.userId] - Registered user
   * @param {string} [opts.guestId] - Anonymous guest UUID
   * @param {string} [opts.name] - Display name
   * @returns {Object} Created player row
   */
  addPlayer(matchId, { userId = null, guestId = null, name = null }) {
    const match = this.getMatch(matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    const players = this._readTable('players');
    const matchPlayers = players.filter(p => p.match_id === matchId);

    if (matchPlayers.length >= 8) {
      throw new Error('Match is full (8 players max)');
    }

    const slot = matchPlayers.length;
    const row = {
      match_id: matchId,
      slot,
      user_id: userId,
      guest_id: guestId,
      name: name || `Player ${slot + 1}`
    };

    players.push(row);
    this._writeTable('players', players);
    return row;
  }

  getMatchPlayers(matchId) {
    const players = this._readTable('players');
    return players
      .filter(p => p.match_id === matchId)
      .sort((a, b) => a.slot - b.slot);
  }

  // ─────────────────────────────────────────────────────────────
  // SCORES table (FK: match_id) - time series
  // ─────────────────────────────────────────────────────────────

  /**
   * Record a score event
   * @param {string} matchId
   * @param {Object} opts
   * @param {number} opts.slot - Player slot (0-7)
   * @param {number} opts.score - Score value
   * @param {string} [opts.event] - Event type: update, final, bonus
   * @returns {Object} Created score row
   */
  recordScore(matchId, { slot, score, event = 'update' }) {
    const match = this.getMatch(matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    const players = this.getMatchPlayers(matchId);
    if (slot < 0 || slot >= players.length) {
      throw new Error(`Invalid player slot ${slot}`);
    }

    const scores = this._readTable('scores');
    const row = {
      match_id: matchId,
      timestamp: new Date().toISOString(),
      slot,
      score,
      event
    };

    scores.push(row);
    this._writeTable('scores', scores);
    return row;
  }

  getMatchScores(matchId) {
    const scores = this._readTable('scores');
    return scores
      .filter(s => s.match_id === matchId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Get latest score per player for a match
   */
  getMatchLatestScores(matchId) {
    const scores = this.getMatchScores(matchId);
    const latest = {};
    for (const s of scores) {
      latest[s.slot] = s; // Overwrites with latest
    }
    return Object.values(latest).sort((a, b) => a.slot - b.slot);
  }

  // ─────────────────────────────────────────────────────────────
  // Aggregations (JOIN-style queries)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get full match with players and latest scores
   * Simulates: SELECT * FROM matches
   *            JOIN players ON ...
   *            JOIN (SELECT DISTINCT ON ...) scores ON ...
   */
  getMatchFull(matchId) {
    const match = this.getMatch(matchId);
    if (!match) return null;

    const players = this.getMatchPlayers(matchId);
    const latestScores = this.getMatchLatestScores(matchId);

    // Merge scores into players
    const playersWithScores = players.map(p => {
      const scoreRow = latestScores.find(s => s.slot === p.slot);
      return {
        ...p,
        score: scoreRow?.score ?? null,
        last_score_at: scoreRow?.timestamp ?? null
      };
    });

    return {
      ...match,
      players: playersWithScores,
      player_count: players.length
    };
  }

  /**
   * Leaderboard: top scores across all matches for a game type
   */
  getLeaderboard(gameType, limit = 10) {
    const matches = this.listMatches({ gameType });
    const matchIds = new Set(matches.map(m => m.match_id));

    const scores = this._readTable('scores');
    const players = this._readTable('players');

    // Build player lookup
    const playerMap = {};
    for (const p of players) {
      playerMap[`${p.match_id}:${p.slot}`] = p;
    }

    // Get max score per player per match
    const maxScores = {};
    for (const s of scores) {
      if (!matchIds.has(s.match_id)) continue;
      const key = `${s.match_id}:${s.slot}`;
      if (!maxScores[key] || s.score > maxScores[key].score) {
        maxScores[key] = s;
      }
    }

    // Build leaderboard entries
    const entries = Object.entries(maxScores).map(([key, scoreRow]) => {
      const player = playerMap[key];
      return {
        match_id: scoreRow.match_id,
        slot: scoreRow.slot,
        score: scoreRow.score,
        player_name: player?.name || `Player ${scoreRow.slot + 1}`,
        user_id: player?.user_id,
        guest_id: player?.guest_id,
        timestamp: scoreRow.timestamp
      };
    });

    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export { ArcadeData, generateMatchCode, validateMatchCode };
