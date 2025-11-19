/**
 * @file tetraConfig.js
 * @description TETRA configuration reader and resolver
 */

import fs from 'fs/promises';
import toml from '@iarna/toml';

export class TetraConfig {
    constructor(configPath, secretsPath) {
        this.configPath = configPath;
        this.secretsPath = secretsPath;
        this.config = null;
        this.secrets = {};
        this.loaded = false;
        this.errors = [];
    }

    async load() {
        try {
            console.log('[TetraConfig] Loading from:', this.configPath);
            
            const configContent = await fs.readFile(this.configPath, 'utf8');
            this.config = toml.parse(configContent);
            
            try {
                const secretsContent = await fs.readFile(this.secretsPath, 'utf8');
                this.secrets = this.parseEnv(secretsContent);
            } catch (error) {
                console.warn('[TetraConfig] No secrets.env:', error.message);
            }
            
            this.loaded = true;
            console.log('[TetraConfig] Loaded successfully');
            return true;
        } catch (error) {
            this.errors.push(error.message);
            console.error('[TetraConfig] Load error:', error);
            throw error;
        }
    }

    parseEnv(content) {
        const secrets = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            
            const match = trimmed.match(/^([^=]+)=(.+)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                secrets[key] = value;
            }
        });
        return secrets;
    }

    resolve(value) {
        if (typeof value !== 'string') return value;
        return value.replace(/\${([^}]+)}/g, (match, key) => {
            return this.secrets[key] || process.env[key] || match;
        });
    }

    getPublishingConfigs() {
        if (!this.loaded) throw new Error('Not loaded');
        if (!this.config.publishing) return [];
        
        return Object.entries(this.config.publishing).map(([name, cfg]) => ({
            id: name,
            name: name,
            symbol: cfg.symbol || `@${name}`,
            type: cfg.type || 'spaces',
            bucket: this.resolve(cfg.bucket),
            endpoint: this.resolve(cfg.endpoint),
            region: this.resolve(cfg.region),
            prefix: cfg.prefix || '',
            baseUrl: this.resolve(cfg.base_url),
            accessKey: this.resolve(cfg.access_key),
            secretKey: this.resolve(cfg.secret_key),
            theme: cfg.theme || 'default',
            themeUrl: cfg.theme_url ? this.resolve(cfg.theme_url) : '',
            inlineCss: cfg.inline_css !== false,
            description: cfg.description || '',
            source: 'tetra.toml'
        }));
    }

    // For the debug panel
    getDebugInfo() {
        return {
            loaded: this.loaded,
            configPath: this.configPath,
            secretsPath: this.secretsPath,
            errors: this.errors,
            hasConfig: !!this.config,
            secretKeys: Object.keys(this.secrets),
            publishingConfigCount: this.config?.publishing ? Object.keys(this.config.publishing).length : 0,
            environmentCount: this.config?.environments ? Object.keys(this.config.environments).length : 0
        };
    }
}

export default TetraConfig;
