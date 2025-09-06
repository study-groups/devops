// AuthSrv.js
// A Plan 9-inspired Namespace+Token Engine for PData

import crypto from 'crypto';
import path from 'path';
import minimatch from 'minimatch';

class AuthSrv {
  constructor(options = {}) {
    this.secret = options.secret || 'change_this_secret';
    this.mountTemplates = options.mountTemplates || {}; // { role/user: { ~alias: /real/path } }
    this.assetSets = options.assetSets || {};           // { setName: [glob1, glob2, ...] }
  }

  // Create a signed, expiring token for a user session
  createToken({ username, roles, caps, mounts = {}, ttl = 3600 }) {
    const exp = Date.now() + ttl * 1000;
    const payload = { username, roles, caps, mounts, exp };
    payload.sig = this._sign(payload);
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  // Validate and parse a token
  validateToken(tokenB64) {
    const payload = JSON.parse(Buffer.from(tokenB64, 'base64').toString());
    const { sig, ...unsigned } = payload;
    if (sig !== this._sign(unsigned)) throw new Error('Invalid signature');
    if (payload.exp < Date.now()) throw new Error('Token expired');
    return unsigned;
  }

  // Check if token grants op (e.g., 'read', 'write') for a vpath (virtual path)
  tokenHasCap(token, op, vpath) {
    for (const cap of token.caps) {
      // e.g. cap: "r:~arcade/games/cheap-golf/*"
      const colonIndex = cap.indexOf(':');
      if (colonIndex === -1) continue;
      const capOp = cap.substring(0, colonIndex);
      const capPath = cap.substring(colonIndex + 1);
      if (!capOp || !capPath) continue;
      if (this._capMatch(token, capOp, capPath, op, vpath)) return true;
    }
    return false;
  }

  // DEPRECATED: This logic has been moved to FileManager._resolveVirtualPath
  // resolvePath(token, vpath) {
  //   // CRITICAL SECURITY: Validate path format to prevent literal ~ directory creation
  //   if (vpath && vpath.includes('~') && !vpath.startsWith('~')) {
  //     throw new Error(`Invalid path format: literal '~' characters are forbidden except at the start of virtual paths. Path: ${vpath}`);
  //   }
    
  //   // Additional security: prevent path traversal attacks
  //   if (vpath && (vpath.includes('../') || vpath.includes('..\\') || vpath === '..' || vpath.endsWith('/..'))) {
  //     throw new Error(`Invalid path: path traversal detected. Path: ${vpath}`);
  //   }

  //   // Handle root mount access (e.g., '.' or '' maps to mount root)
  //   if (!vpath || vpath === '.' || vpath === '/') {
  //     // Return the first mount root for empty/root requests
  //     const mountEntries = Object.entries(token.mounts);
  //     if (mountEntries.length > 0) {
  //       return mountEntries[0][1]; // Return the path of the first mount
  //     }
  //   }

  //   // Handle direct alias access (e.g., '~system' or '~home')
  //   if (token.mounts[vpath]) {
  //     return token.mounts[vpath];
  //   }

  //   // Handle path within mount (e.g., '~data/users' or '~/data/projects/gridranger/docs')
  //   for (const [alias, realRoot] of Object.entries(token.mounts)) {
  //     if (vpath.startsWith(alias + '/')) {
  //       return realRoot + vpath.slice(alias.length);
  //     }
  //   }
    
  //   // Handle implicit path mapping for users without explicit aliases
  //   if (!vpath.startsWith('~')) {
  //     // For relative paths, try to map to user's home mount first
  //     const userHomeMounts = Object.entries(token.mounts).filter(([alias]) => alias.startsWith('~/data/'));
  //     if (userHomeMounts.length > 0) {
  //       const [homeAlias, homeRoot] = userHomeMounts[0];
  //       return path.join(homeRoot, vpath);
  //     }
      
  //     // Fallback to ~data if available
  //     if (token.mounts['~data']) {
  //       return path.join(token.mounts['~data'], vpath);
  //     }
      
  //     // Last resort: try ~system for admin users
  //     if (token.mounts['~system']) {
  //       return path.join(token.mounts['~system'], vpath);
  //     }
  //   }
    
  //   throw new Error(`No valid mount for path: ${vpath}`);
  // }

  // -------- Internals --------

  _sign(payload) {
    return crypto.createHmac('sha256', this.secret)
      .update(JSON.stringify(payload)).digest('hex');
  }

  _capMatch(token, capOp, capPath, op, vpath) {
    // op: "read", "write", "exec", etc -> single char for capOp ('r','w','x',...)
    if (op[0] !== capOp[0]) return false;

    // Asset set expansion (if capPath is @assets:<set>)
    if (capPath.startsWith('@assets:')) {
      const setName = capPath.slice(8);
      const patterns = this.assetSets[setName] || [];
      return patterns.some(glob => minimatch(vpath, glob));
    }

    // Mount alias expansion (e.g., ~arcade)
    const expandedCapPath = this._expandAlias(token, capPath);
    const expandedVPath   = this._expandAlias(token, vpath);

    // Wildcard match (using minimatch)
    return minimatch(expandedVPath, expandedCapPath);
  }

  _expandAlias(token, path) {
    for (const [alias, realRoot] of Object.entries(token.mounts)) {
      if (path.startsWith(alias)) {
        return realRoot + path.slice(alias.length);
      }
    }
    return path;
  }

  // Utility: create mounts for a session based on user/roles
  static buildMounts(username, roles, templates) {
    // templates: { role/user: { ~alias: /real } }
    const mounts = {};
    for (const r of roles.concat([username])) {
      const t = templates[r];
      if (t) Object.assign(mounts, t);
    }
    return mounts;
  }

  // Utility: expand asset sets in a capability list
  static expandCaps(caps, assetSets) {
    // e.g. ["r:@assets:premium_games"] -> expand to globs for matching
    return caps.flatMap(cap => {
      if (!cap.includes('@assets:')) return [cap];
      const [capOp, assetRef] = cap.split(':', 2);
      const setName = assetRef.replace('@assets:', '');
      const patterns = assetSets[setName] || [];
      return patterns.map(glob => `${capOp}:${glob}`);
    });
  }
}

export { AuthSrv };
