/**
 * OrgConfig - Load org configuration from tetra.toml + secrets.env
 *
 * Follows the tsm pattern:
 * - Read tetra.toml for config
 * - Load secrets.env for sensitive values
 * - Resolve $VAR references
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseToml } from '@iarna/toml';

export class OrgConfig {
  /**
   * Load config for an org
   * @param {string} orgName - Org name (e.g., 'pixeljam-arcade', 'tetra')
   * @param {string} [tetraDir] - Override TETRA_DIR (default: ~/tetra)
   * @returns {OrgConfig}
   */
  static load(orgName, tetraDir = null) {
    const baseDir = tetraDir || process.env.TETRA_DIR || join(process.env.HOME, 'tetra');
    const orgDir = join(baseDir, 'orgs', orgName);

    if (!existsSync(orgDir)) {
      throw new Error(`Org directory not found: ${orgDir}`);
    }

    // Load tetra.toml
    const tomlPath = join(orgDir, 'tetra.toml');
    if (!existsSync(tomlPath)) {
      throw new Error(`tetra.toml not found: ${tomlPath}`);
    }

    const tomlContent = readFileSync(tomlPath, 'utf-8');
    const config = parseToml(tomlContent);

    // Load secrets.env
    const secretsPath = join(orgDir, 'secrets.env');
    const secrets = existsSync(secretsPath)
      ? OrgConfig.parseEnvFile(secretsPath)
      : {};

    // Resolve $VAR references in config
    const resolved = OrgConfig.resolveSecrets(config, secrets);

    return new OrgConfig(orgName, orgDir, resolved, secrets);
  }

  /**
   * Parse a .env file into key-value pairs
   */
  static parseEnvFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const result = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * Resolve $VAR and ${VAR} references in config using secrets
   */
  static resolveSecrets(config, secrets) {
    const resolve = (obj) => {
      if (typeof obj === 'string') {
        // Replace ${VAR} or $VAR with value from secrets
        if (obj.startsWith('${') && obj.endsWith('}')) {
          const varName = obj.slice(2, -1);
          return secrets[varName] || process.env[varName] || obj;
        }
        if (obj.startsWith('$')) {
          const varName = obj.slice(1);
          return secrets[varName] || process.env[varName] || obj;
        }
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(resolve);
      }

      if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = resolve(value);
        }
        return result;
      }

      return obj;
    };

    return resolve(config);
  }

  constructor(orgName, orgDir, config, secrets) {
    this.orgName = orgName;
    this.orgDir = orgDir;
    this.config = config;
    this.secrets = secrets;
  }

  /**
   * Get games config section
   */
  get games() {
    return this.config.games || {};
  }

  /**
   * Get storage config (storage.s3 or games.s3)
   */
  get storage() {
    return this.config.storage?.s3 || this.config.games?.s3 || {};
  }

  /**
   * Get S3 bucket name
   * Looks in: games.bucket, games.categories.*.s3_bucket, storage.s3.default_bucket
   */
  get bucket() {
    // Direct games.bucket
    if (this.games.bucket) return this.games.bucket;

    // From categories (first one with s3_bucket)
    const categories = this.games.categories || {};
    for (const cat of Object.values(categories)) {
      if (cat.s3_bucket) return cat.s3_bucket;
    }

    // From storage.s3
    return this.storage.default_bucket;
  }

  /**
   * Get S3 endpoint
   * Looks in: games.endpoint, games.s3.endpoint, storage.s3.endpoint
   */
  get endpoint() {
    return this.games.endpoint || this.games.s3?.endpoint || this.storage.endpoint;
  }

  /**
   * Get S3 credentials
   * Looks in: games.s3, storage.s3, secrets
   */
  get credentials() {
    const s3 = this.games.s3 || {};
    const spaces = this.storage;

    return {
      accessKeyId: s3.access_key || spaces.access_key || this.secrets.DO_SPACES_KEY,
      secretAccessKey: s3.secret_key || spaces.secret_key || this.secrets.DO_SPACES_SECRET,
    };
  }

  /**
   * Validate that required config is present
   */
  validate() {
    const errors = [];

    if (!this.bucket) {
      errors.push('games.bucket is required in tetra.toml');
    }
    if (!this.endpoint) {
      errors.push('games.endpoint is required in tetra.toml');
    }
    if (!this.credentials.accessKeyId) {
      errors.push('DO_SPACES_KEY not found in secrets.env or config');
    }
    if (!this.credentials.secretAccessKey) {
      errors.push('DO_SPACES_SECRET not found in secrets.env or config');
    }

    if (errors.length > 0) {
      throw new Error(`OrgConfig validation failed:\n  ${errors.join('\n  ')}`);
    }

    return true;
  }
}
