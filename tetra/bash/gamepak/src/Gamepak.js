/**
 * Gamepak - Package manager for games
 *
 * Like npm but for game assets. Manages game manifests and S3 files.
 */

import { OrgConfig } from './OrgConfig.js';
import { S3Provider } from './S3Provider.js';
import { AccessControl } from './AccessControl.js';
import { UrlResolver } from './UrlResolver.js';

const MANIFEST_KEY = 'games.json';
const MANIFEST_TTL = 60000; // 1 minute cache

export class Gamepak {
  /**
   * Create Gamepak instance for an org
   * @param {string} orgName - Org name (e.g., 'pixeljam-arcade')
   * @returns {Promise<Gamepak>}
   */
  static async forOrg(orgName) {
    const config = OrgConfig.load(orgName);
    config.validate();

    const pak = new Gamepak({
      org: orgName,
      bucket: config.bucket,
      endpoint: config.endpoint,
      credentials: config.credentials,
    });

    return pak;
  }

  /**
   * @param {object} config
   * @param {string} config.org - Org name
   * @param {string} config.bucket - S3 bucket
   * @param {string} config.endpoint - S3 endpoint
   * @param {object} config.credentials - { accessKeyId, secretAccessKey }
   * @param {string} [config.apiGateway] - API gateway path
   */
  constructor(config) {
    this.org = config.org;
    this.s3 = new S3Provider({
      bucket: config.bucket,
      endpoint: config.endpoint,
      credentials: config.credentials,
    });
    this.accessControl = new AccessControl();
    this.urlResolver = new UrlResolver(config.apiGateway || '/api/game-files');

    // Manifest cache
    this._manifest = null;
    this._manifestLoadedAt = 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Manifest Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Load manifest from S3 (cached)
   * @param {boolean} [force=false] - Force reload
   */
  async loadManifest(force = false) {
    const now = Date.now();

    if (!force && this._manifest && (now - this._manifestLoadedAt) < MANIFEST_TTL) {
      return this._manifest;
    }

    try {
      this._manifest = await this.s3.getObjectJson(MANIFEST_KEY);
      this._manifestLoadedAt = now;

      // Update access control with manifest config
      if (this._manifest._config) {
        this.accessControl = new AccessControl(this._manifest._config);
      }

      return this._manifest;
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        // No manifest yet, return empty
        this._manifest = { _config: {}, games: {} };
        this._manifestLoadedAt = now;
        return this._manifest;
      }
      throw err;
    }
  }

  /**
   * Save manifest to S3
   */
  async saveManifest(manifest) {
    await this.s3.putObjectJson(MANIFEST_KEY, manifest);
    this._manifest = manifest;
    this._manifestLoadedAt = Date.now();
  }

  // ─────────────────────────────────────────────────────────────
  // Game Operations (org:game:topic)
  // ─────────────────────────────────────────────────────────────

  /**
   * List all games
   * @param {object} [options]
   * @param {boolean} [options.showHidden] - Include hidden games
   * @param {object} [options.user] - Filter by user access
   */
  async list(options = {}) {
    const manifest = await this.loadManifest();
    let games = Object.values(manifest.games || {});

    // Filter hidden
    if (!options.showHidden) {
      games = games.filter(g => g.show !== false);
    }

    // Filter by access
    if (options.user) {
      games = games.filter(g => this.canAccess(g, options.user).allowed);
    }

    return games;
  }

  /**
   * Get a game or game topic
   * @param {string} slug - Game slug
   * @param {string} [topic] - Optional topic (e.g., 'controls', 'permissions')
   */
  async get(slug, topic = null) {
    const manifest = await this.loadManifest();
    const game = manifest.games?.[slug];

    if (!game) return null;
    if (!topic) return game;

    return game[topic];
  }

  /**
   * Set a game topic
   * @param {string} slug - Game slug
   * @param {string} topic - Topic key (e.g., 'controls', 'permissions')
   * @param {any} value - Topic value
   */
  async set(slug, topic, value) {
    const manifest = await this.loadManifest(true); // Force reload

    if (!manifest.games) {
      manifest.games = {};
    }

    if (!manifest.games[slug]) {
      manifest.games[slug] = { slug };
    }

    manifest.games[slug][topic] = value;

    await this.saveManifest(manifest);

    return manifest.games[slug];
  }

  /**
   * Add or update a complete game
   * @param {string} slug - Game slug
   * @param {object} game - Full game object
   */
  async setGame(slug, game) {
    const manifest = await this.loadManifest(true);

    if (!manifest.games) {
      manifest.games = {};
    }

    manifest.games[slug] = { ...game, slug };

    await this.saveManifest(manifest);

    return manifest.games[slug];
  }

  /**
   * Remove a game from manifest
   */
  async remove(slug) {
    const manifest = await this.loadManifest(true);

    if (manifest.games?.[slug]) {
      delete manifest.games[slug];
      await this.saveManifest(manifest);
      return true;
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // Access Control
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if user can access game
   */
  canAccess(game, user) {
    return this.accessControl.checkAccess(game, user);
  }

  // ─────────────────────────────────────────────────────────────
  // URL Resolution
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve game URL
   */
  async resolve(slug, user, variant = 'default') {
    const game = await this.get(slug);
    if (!game) {
      throw new Error(`Game not found: ${slug}`);
    }

    // Check access first
    const access = this.canAccess(game, user);
    if (!access.allowed) {
      throw new Error(access.reason);
    }

    return this.urlResolver.resolve(game, user, variant);
  }

  // ─────────────────────────────────────────────────────────────
  // S3 File Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Get signed URL for a file
   */
  async getSignedUrl(path, expiresIn = 7200) {
    return this.s3.getSignedUrl(path, expiresIn);
  }

  /**
   * Get file stream (for proxying)
   */
  async getFileStream(path) {
    return this.s3.getObject(path);
  }

  /**
   * Upload a file
   */
  async uploadFile(path, content, options = {}) {
    return this.s3.putObject(path, content, options);
  }

  /**
   * List files under a prefix
   */
  async listFiles(prefix) {
    return this.s3.listObjects(prefix);
  }

  // ─────────────────────────────────────────────────────────────
  // Publish (like npm publish)
  // ─────────────────────────────────────────────────────────────

  /**
   * Publish a game version
   * @param {string} slug - Game slug
   * @param {string} localDir - Local directory with game files
   * @param {string} version - Version string (e.g., '1.2.0')
   * @param {object} [options]
   * @param {object} [options.metadata] - Additional metadata to merge
   */
  async publish(slug, localDir, version, options = {}) {
    const { readdirSync, readFileSync, statSync } = await import('fs');
    const { join, relative } = await import('path');

    const s3Prefix = `${slug}/${version}`;

    // Recursively upload files
    const uploadDir = async (dir, prefix) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const localPath = join(dir, entry.name);
        const s3Key = `${prefix}/${entry.name}`;

        if (entry.isDirectory()) {
          await uploadDir(localPath, s3Key);
        } else {
          const content = readFileSync(localPath);
          await this.s3.putObject(s3Key, content);
        }
      }
    };

    await uploadDir(localDir, s3Prefix);

    // Update manifest
    const game = await this.get(slug) || { slug, name: slug };

    game.engine = {
      ...game.engine,
      path: `${s3Prefix}/index.html`,
      version,
    };

    if (options.metadata) {
      Object.assign(game, options.metadata);
    }

    await this.setGame(slug, game);

    return {
      slug,
      version,
      path: s3Prefix,
      game,
    };
  }
}
