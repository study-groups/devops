import crypto from 'crypto';
import { validatePDataToken } from './auth.js';

// Enhanced token store with capabilities
const capabilityTokenStore = new Map();
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Cleanup expired tokens
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of capabilityTokenStore.entries()) {
        if (data.expiresAt < now) {
            capabilityTokenStore.delete(token);
            console.log(`[CAPABILITY CLEANUP] Removed expired token: ${token.substring(0, 8)}...`);
        }
    }
}, TOKEN_CLEANUP_INTERVAL);

/**
 * Capability-based token system
 * Tokens grant specific permissions to resources/endpoints
 */
export class CapabilityManager {
    constructor(pdata) {
        this.pdata = pdata;
    }

    /**
     * Generate a capability token with specific permissions
     * @param {string} issuer - Username of admin creating the token
     * @param {Object} capabilities - What the token can access
     * @param {Object} options - Token options
     */
    generateCapabilityToken(issuer, capabilities, options = {}) {
        const token = `cap_${crypto.randomBytes(32).toString('hex')}`;
        const expiresAt = Date.now() + (options.ttl || 24 * 60 * 60 * 1000); // 24h default
        
        const tokenData = {
            token,
            issuer,
            type: options.type || 'access', // 'access', 'guest', 'share'
            capabilities: this.normalizeCapabilities(capabilities),
            metadata: {
                description: options.description || 'Capability Token',
                createdAt: Date.now(),
                expiresAt,
                originIP: options.originIP,
                maxUses: options.maxUses,
                usageCount: 0,
                lastUsed: null
            }
        };

        capabilityTokenStore.set(token, tokenData);
        
        console.log(`[CAPABILITY] Generated token ${token.substring(0, 12)}... by ${issuer}:`, {
            type: tokenData.type,
            capabilities: Object.keys(capabilities),
            expires: new Date(expiresAt).toISOString()
        });

        return tokenData;
    }

    /**
     * Normalize capabilities into a standard format
     */
    normalizeCapabilities(capabilities) {
        const normalized = {};
        
        // Games access
        if (capabilities.games) {
            normalized.games = Array.isArray(capabilities.games) ? capabilities.games : [capabilities.games];
        }
        
        // Endpoint access  
        if (capabilities.endpoints) {
            normalized.endpoints = Array.isArray(capabilities.endpoints) ? capabilities.endpoints : [capabilities.endpoints];
        }
        
        // File system access
        if (capabilities.paths) {
            normalized.paths = capabilities.paths; // {path: [permissions]}
        }
        
        // Special permissions
        if (capabilities.special) {
            normalized.special = capabilities.special; // ['create_guest', 'bypass_auth', etc.]
        }

        return normalized;
    }

    /**
     * Validate if a token has a specific capability
     */
    hasCapability(token, capabilityType, resource) {
        const tokenData = capabilityTokenStore.get(token);
        if (!tokenData) return false;
        
        // Check expiration
        if (tokenData.metadata.expiresAt < Date.now()) {
            capabilityTokenStore.delete(token);
            return false;
        }
        
        // Check usage limits
        if (tokenData.metadata.maxUses && tokenData.metadata.usageCount >= tokenData.metadata.maxUses) {
            return false;
        }

        const capabilities = tokenData.capabilities;
        
        switch (capabilityType) {
            case 'game':
                return capabilities.games && capabilities.games.includes(resource);
                
            case 'endpoint':
                return capabilities.endpoints && this.matchEndpoint(capabilities.endpoints, resource);
                
            case 'path':
                return capabilities.paths && this.matchPath(capabilities.paths, resource);
                
            case 'special':
                return capabilities.special && capabilities.special.includes(resource);
                
            default:
                return false;
        }
    }

    /**
     * Record token usage
     */
    recordUsage(token, context = {}) {
        const tokenData = capabilityTokenStore.get(token);
        if (tokenData) {
            tokenData.metadata.usageCount++;
            tokenData.metadata.lastUsed = Date.now();
            console.log(`[CAPABILITY USAGE] Token ${token.substring(0, 12)}... used: ${tokenData.metadata.usageCount}/${tokenData.metadata.maxUses || '∞'}`);
        }
    }

    /**
     * Create a guest user based on token and IP
     */
    async createGuestUser(token, originIP) {
        const tokenData = capabilityTokenStore.get(token);
        if (!tokenData || !this.hasCapability(token, 'special', 'create_guest')) {
            throw new Error('Token cannot create guest users');
        }

        // Generate unique guest username based on IP and timestamp
        const ipHash = crypto.createHash('md5').update(originIP).digest('hex').substring(0, 8);
        const timestamp = Date.now().toString(36);
        const guestUsername = `guest-${ipHash}-${timestamp}`;
        
        // Create guest user with limited permissions
        const guestRoles = ['guest'];
        if (tokenData.capabilities.games) {
            // Add game-specific roles
            tokenData.capabilities.games.forEach(game => {
                guestRoles.push(`game-${game}`);
            });
        }

        // Add guest user to PData system
        const tempPassword = crypto.randomBytes(16).toString('hex');
        await this.pdata.addUser(guestUsername, tempPassword, guestRoles);
        
        console.log(`[GUEST CREATION] Created guest user: ${guestUsername} with roles:`, guestRoles);
        
        return {
            username: guestUsername,
            password: tempPassword,
            roles: guestRoles,
            token: token,
            expiresAt: tokenData.metadata.expiresAt
        };
    }

    /**
     * Match endpoint patterns
     */
    matchEndpoint(allowedEndpoints, requestedEndpoint) {
        return allowedEndpoints.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(requestedEndpoint);
            }
            return pattern === requestedEndpoint;
        });
    }

    /**
     * Match path patterns with permissions
     */
    matchPath(allowedPaths, requestedPath) {
        for (const [pathPattern, permissions] of Object.entries(allowedPaths)) {
            if (this.pathMatches(pathPattern, requestedPath)) {
                return permissions;
            }
        }
        return null;
    }

    pathMatches(pattern, path) {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(path);
        }
        return path.startsWith(pattern);
    }

    /**
     * Get token info (for admin/debugging)
     */
    getTokenInfo(token) {
        const tokenData = capabilityTokenStore.get(token);
        if (!tokenData) return null;
        
        return {
            ...tokenData,
            token: token.substring(0, 12) + '...' // Hide full token
        };
    }

    /**
     * List all active tokens (admin only)
     */
    listTokens(issuer = null) {
        const tokens = [];
        for (const [token, data] of capabilityTokenStore.entries()) {
            if (data.metadata.expiresAt > Date.now()) {
                if (!issuer || data.issuer === issuer) {
                    tokens.push({
                        ...data,
                        token: token.substring(0, 12) + '...'
                    });
                }
            }
        }
        return tokens;
    }

    /**
     * Revoke a token
     */
    revokeToken(token) {
        const existed = capabilityTokenStore.has(token);
        if (existed) {
            const tokenData = capabilityTokenStore.get(token);
            capabilityTokenStore.delete(token);
            console.log(`[CAPABILITY REVOKE] Token ${token.substring(0, 12)}... revoked by request`);
        }
        return existed;
    }
}

/**
 * Enhanced auth middleware that supports capability tokens
 */
export function capabilityMiddleware(requiredCapability = null) {
    return async (req, res, next) => {
        console.log(`[CAPABILITY MIDDLEWARE] Checking for capability: ${requiredCapability}`);
        
        // Check for capability token in URL params (for guest links)
        const urlToken = req.query.token || req.params.token;
        
        // Check for capability token in headers
        const authHeader = req.headers.authorization;
        let token = null;
        
        if (authHeader && authHeader.startsWith('Bearer cap_')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        } else if (urlToken && urlToken.startsWith('cap_')) {
            token = urlToken;
        }
        
        if (token && token.startsWith('cap_')) {
            console.log(`[CAPABILITY MIDDLEWARE] Found capability token: ${token.substring(0, 12)}...`);
            
            const tokenData = req.app.locals.capabilityManager.getTokenInfo(token);
            if (!tokenData) {
                return res.status(401).json({ error: 'Invalid or expired capability token' });
            }
            
            // Check required capability if specified
            if (requiredCapability) {
                const [type, resource] = requiredCapability.split(':');
                if (!req.app.locals.capabilityManager.hasCapability(token, type, resource)) {
                    return res.status(403).json({ error: `Token lacks required capability: ${requiredCapability}` });
                }
            }
            
            // Record usage
            req.app.locals.capabilityManager.recordUsage(token, { 
                endpoint: req.originalUrl,
                ip: req.ip 
            });
            
            // Attach token info to request
            req.capabilityToken = tokenData;
            req.authMethod = 'capability';
            
            // For guest tokens, create temporary user context
            if (tokenData.type === 'guest') {
                req.user = { 
                    username: `guest-token-${token.substring(4, 12)}`,
                    isGuest: true,
                    capabilities: tokenData.capabilities
                };
            }
            
            return next();
        }
        
        // Fall back to regular auth middleware
        // Import and call the original authMiddleware
        const { authMiddleware } = await import('./auth.js');
        return authMiddleware(req, res, next);
    };
}