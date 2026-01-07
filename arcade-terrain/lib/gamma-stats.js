/**
 * gamma-stats.js
 * Persistent stats collector for GAMMA match lifecycle events
 *
 * Receives webhooks from GAMMA and stores:
 * - Match history (all matches ever created)
 * - Player participation (who played what)
 * - Scores (time series, high scores)
 *
 * Data model: Row-based JSON tables (SQL-portable)
 *
 * Tables:
 *   match_history.json   - { match_id, game_type, created_at, closed_at, duration_ms, player_count }
 *   participations.json  - { match_id, slot, player_name, user_id, guest_id, joined_at, left_at }
 *   scores.json          - { match_id, slot, score, timestamp, event }
 *
 * SQLite migration note:
 *   Each JSON array maps directly to a SQL table.
 *   Foreign keys via match_id. Indexes on match_id, game_type, user_id.
 */

import fs from 'fs';
import path from 'path';

class GammaStats {
  constructor(pdDir) {
    if (!pdDir) {
      throw new Error('PD_DIR is required');
    }
    this.pdDir = pdDir;
    this.tablesDir = path.join(pdDir, 'gamma', 'tables');
    this._ensureDirectories();
    this._ensureTables();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.tablesDir)) {
      fs.mkdirSync(this.tablesDir, { recursive: true });
    }
  }

  _ensureTables() {
    for (const table of ['match_history', 'participations', 'scores']) {
      const p = this._tablePath(table);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, '[]');
      }
    }
  }

  _tablePath(table) {
    return path.join(this.tablesDir, `${table}.json`);
  }

  _readTable(table) {
    const data = fs.readFileSync(this._tablePath(table), 'utf-8');
    return JSON.parse(data);
  }

  _writeTable(table, rows) {
    fs.writeFileSync(this._tablePath(table), JSON.stringify(rows, null, 2));
  }

  // ─────────────────────────────────────────────────────────────
  // Webhook event handlers
  // ─────────────────────────────────────────────────────────────

  /**
   * Process incoming webhook from GAMMA
   */
  handleWebhook(payload) {
    const { event, timestamp } = payload;

    switch (event) {
      case 'match:created':
        return this._onMatchCreated(payload, timestamp);
      case 'player:joined':
        return this._onPlayerJoined(payload, timestamp);
      case 'player:left':
        return this._onPlayerLeft(payload, timestamp);
      case 'match:closed':
        return this._onMatchClosed(payload, timestamp);
      case 'score:update':
        return this._onScoreUpdate(payload, timestamp);
      default:
        console.warn(`[gamma-stats] Unknown event: ${event}`);
        return { ok: false, error: 'Unknown event' };
    }
  }

  _onMatchCreated({ match_id, game_type, max_players, port }, timestamp) {
    const history = this._readTable('match_history');

    // Check if already exists (idempotency)
    if (history.some(m => m.match_id === match_id)) {
      return { ok: true, action: 'already_exists' };
    }

    history.push({
      match_id,
      game_type,
      max_players,
      port,
      created_at: timestamp,
      closed_at: null,
      duration_ms: null,
      player_count: 0,
      status: 'active'
    });

    this._writeTable('match_history', history);
    return { ok: true, action: 'created' };
  }

  _onPlayerJoined({ match_id, game_type, slot, player_name, user_id, guest_id }, timestamp) {
    const participations = this._readTable('participations');

    // Check for existing participation in this slot
    const existing = participations.find(p =>
      p.match_id === match_id && p.slot === slot && !p.left_at
    );

    if (existing) {
      return { ok: true, action: 'already_joined' };
    }

    participations.push({
      match_id,
      game_type,
      slot,
      player_name: player_name || `Player ${slot}`,
      user_id: user_id || null,
      guest_id: guest_id || null,
      joined_at: timestamp,
      left_at: null
    });

    this._writeTable('participations', participations);

    // Update player count in match history
    const history = this._readTable('match_history');
    const match = history.find(m => m.match_id === match_id);
    if (match) {
      match.player_count = participations.filter(p =>
        p.match_id === match_id && !p.left_at
      ).length;
      this._writeTable('match_history', history);
    }

    return { ok: true, action: 'joined' };
  }

  _onPlayerLeft({ match_id, slot }, timestamp) {
    const participations = this._readTable('participations');

    const participation = participations.find(p =>
      p.match_id === match_id && p.slot === slot && !p.left_at
    );

    if (!participation) {
      return { ok: true, action: 'not_found' };
    }

    participation.left_at = timestamp;
    this._writeTable('participations', participations);

    // Update player count in match history
    const history = this._readTable('match_history');
    const match = history.find(m => m.match_id === match_id);
    if (match) {
      match.player_count = participations.filter(p =>
        p.match_id === match_id && !p.left_at
      ).length;
      this._writeTable('match_history', history);
    }

    return { ok: true, action: 'left' };
  }

  _onMatchClosed({ match_id, game_type, player_count, duration_ms }, timestamp) {
    const history = this._readTable('match_history');
    const match = history.find(m => m.match_id === match_id);

    if (!match) {
      // Match was created before stats collector started - create entry now
      history.push({
        match_id,
        game_type,
        max_players: null,
        port: null,
        created_at: null,
        closed_at: timestamp,
        duration_ms,
        player_count,
        status: 'closed'
      });
    } else {
      match.closed_at = timestamp;
      match.duration_ms = duration_ms;
      match.status = 'closed';
      if (player_count !== undefined) {
        match.player_count = player_count;
      }
    }

    this._writeTable('match_history', history);

    // Mark all participations as left
    const participations = this._readTable('participations');
    let updated = false;
    for (const p of participations) {
      if (p.match_id === match_id && !p.left_at) {
        p.left_at = timestamp;
        updated = true;
      }
    }
    if (updated) {
      this._writeTable('participations', participations);
    }

    return { ok: true, action: 'closed' };
  }

  _onScoreUpdate({ match_id, slot, score, event_type }, timestamp) {
    const scores = this._readTable('scores');

    scores.push({
      match_id,
      slot,
      score,
      event: event_type || 'update',
      timestamp
    });

    this._writeTable('scores', scores);
    return { ok: true, action: 'recorded' };
  }

  // ─────────────────────────────────────────────────────────────
  // Query methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Get match history with optional filters
   */
  getMatchHistory({ game_type, status, limit = 100 } = {}) {
    let matches = this._readTable('match_history');

    if (game_type) {
      matches = matches.filter(m => m.game_type === game_type);
    }
    if (status) {
      matches = matches.filter(m => m.status === status);
    }

    // Sort by created_at descending
    matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return matches.slice(0, limit);
  }

  /**
   * Get participations for a match
   */
  getMatchParticipations(match_id) {
    const participations = this._readTable('participations');
    return participations
      .filter(p => p.match_id === match_id)
      .sort((a, b) => a.slot - b.slot);
  }

  /**
   * Get player history (all matches a user/guest participated in)
   */
  getPlayerHistory({ user_id, guest_id, limit = 50 } = {}) {
    const participations = this._readTable('participations');

    let filtered = participations;
    if (user_id) {
      filtered = filtered.filter(p => p.user_id === user_id);
    } else if (guest_id) {
      filtered = filtered.filter(p => p.guest_id === guest_id);
    }

    // Sort by joined_at descending
    filtered.sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at));

    return filtered.slice(0, limit);
  }

  /**
   * Get scores for a match
   */
  getMatchScores(match_id) {
    const scores = this._readTable('scores');
    return scores
      .filter(s => s.match_id === match_id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Get leaderboard (top scores by game type)
   */
  getLeaderboard({ game_type, limit = 20 } = {}) {
    const scores = this._readTable('scores');
    const participations = this._readTable('participations');
    const matches = this._readTable('match_history');

    // Build lookup maps
    const matchMap = Object.fromEntries(matches.map(m => [m.match_id, m]));
    const participationMap = {};
    for (const p of participations) {
      participationMap[`${p.match_id}:${p.slot}`] = p;
    }

    // Filter by game type if specified
    let filtered = scores;
    if (game_type) {
      const validMatchIds = new Set(
        matches.filter(m => m.game_type === game_type).map(m => m.match_id)
      );
      filtered = scores.filter(s => validMatchIds.has(s.match_id));
    }

    // Get max score per player per match
    const maxScores = {};
    for (const s of filtered) {
      const key = `${s.match_id}:${s.slot}`;
      if (!maxScores[key] || s.score > maxScores[key].score) {
        maxScores[key] = s;
      }
    }

    // Build leaderboard entries
    const entries = Object.entries(maxScores).map(([key, scoreRow]) => {
      const participation = participationMap[key];
      const match = matchMap[scoreRow.match_id];
      return {
        match_id: scoreRow.match_id,
        game_type: match?.game_type,
        slot: scoreRow.slot,
        score: scoreRow.score,
        player_name: participation?.player_name || `Player ${scoreRow.slot}`,
        user_id: participation?.user_id,
        guest_id: participation?.guest_id,
        timestamp: scoreRow.timestamp
      };
    });

    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get stats summary
   */
  getStats() {
    const matches = this._readTable('match_history');
    const participations = this._readTable('participations');
    const scores = this._readTable('scores');

    const gameTypes = [...new Set(matches.map(m => m.game_type))];

    return {
      total_matches: matches.length,
      active_matches: matches.filter(m => m.status === 'active').length,
      total_participations: participations.length,
      total_scores: scores.length,
      game_types: gameTypes,
      matches_by_game: gameTypes.map(gt => ({
        game_type: gt,
        count: matches.filter(m => m.game_type === gt).length
      }))
    };
  }
}

export { GammaStats };
