import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { capabilityMiddleware } from '../middleware/capabilities.js';

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.pdata && req.pdata.getUserRole(req.user?.username) === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin privileges required' });
};

/**
 * POST /api/capabilities/generate
 * Admin endpoint to generate capability tokens
 */
router.post('/generate', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { 
            type = 'access', 
            capabilities, 
            description, 
            ttl, 
            maxUses,
            originIP 
        } = req.body;
        
        if (!capabilities) {
            return res.status(400).json({ error: 'Capabilities are required' });
        }
        
        const tokenData = req.app.locals.capabilityManager.generateCapabilityToken(
            req.user.username,
            capabilities,
            { 
                type,
                description,
                ttl: ttl ? ttl * 1000 : undefined, // Convert seconds to ms
                maxUses,
                originIP: originIP || req.ip
            }
        );
        
        // Generate access URL based on token type
        let accessUrl = null;
        if (type === 'guest') {
            accessUrl = `${req.protocol}://${req.get('host')}/guest?token=${tokenData.token}`;
        } else if (type === 'share') {
            accessUrl = `${req.protocol}://${req.get('host')}/share?token=${tokenData.token}`;
        }
        
        res.json({
            success: true,
            token: tokenData.token,
            type: tokenData.type,
            capabilities: tokenData.capabilities,
            expiresAt: tokenData.metadata.expiresAt,
            expiresIn: Math.floor((tokenData.metadata.expiresAt - Date.now()) / 1000),
            accessUrl,
            usage: {
                maxUses: tokenData.metadata.maxUses,
                usageCount: tokenData.metadata.usageCount
            },
            examples: {
                bearer: `Authorization: Bearer ${tokenData.token}`,
                url: accessUrl || `${req.protocol}://${req.get('host')}/api/games?token=${tokenData.token}`
            }
        });
        
    } catch (error) {
        console.error('[CAPABILITY GENERATE] Error:', error);
        res.status(500).json({ error: 'Failed to generate capability token' });
    }
});

/**
 * GET /api/capabilities/list
 * List all active capability tokens (admin only)
 */
router.get('/list', authMiddleware, isAdmin, (req, res) => {
    try {
        const { issuer } = req.query;
        const tokens = req.app.locals.capabilityManager.listTokens(issuer);
        
        res.json({
            success: true,
            count: tokens.length,
            tokens: tokens.map(token => ({
                token: token.token, // Already truncated
                type: token.type,
                issuer: token.issuer,
                capabilities: token.capabilities,
                description: token.metadata.description,
                createdAt: token.metadata.createdAt,
                expiresAt: token.metadata.expiresAt,
                usageCount: token.metadata.usageCount,
                maxUses: token.metadata.maxUses,
                lastUsed: token.metadata.lastUsed
            }))
        });
    } catch (error) {
        console.error('[CAPABILITY LIST] Error:', error);
        res.status(500).json({ error: 'Failed to list tokens' });
    }
});

/**
 * DELETE /api/capabilities/revoke/:token
 * Revoke a capability token (admin only)
 */
router.delete('/revoke/:token', authMiddleware, isAdmin, (req, res) => {
    try {
        const { token } = req.params;
        const revoked = req.app.locals.capabilityManager.revokeToken(token);
        
        if (revoked) {
            res.json({ success: true, message: 'Token revoked successfully' });
        } else {
            res.status(404).json({ error: 'Token not found' });
        }
    } catch (error) {
        console.error('[CAPABILITY REVOKE] Error:', error);
        res.status(500).json({ error: 'Failed to revoke token' });
    }
});

/**
 * POST /api/capabilities/guest-login
 * Convert a guest capability token into a temporary user session
 */
router.post('/guest-login', async (req, res) => {
    try {
        const { token } = req.body;
        const originIP = req.ip;
        
        if (!token || !token.startsWith('cap_')) {
            return res.status(400).json({ error: 'Valid capability token required' });
        }
        
        // Create guest user
        const guestUser = await req.app.locals.capabilityManager.createGuestUser(token, originIP);
        
        // Create session for guest user (similar to regular login)
        const user = { username: guestUser.username };
        
        req.login(user, (err) => {
            if (err) {
                console.error('[GUEST LOGIN] Error during req.login:', err);
                return res.status(500).json({ error: 'Failed to create guest session' });
            }
            
            console.log(`[GUEST LOGIN] Session established for guest: ${guestUser.username}`);
            
            res.json({
                success: true,
                user: {
                    username: guestUser.username,
                    isGuest: true,
                    roles: guestUser.roles,
                    capabilities: req.app.locals.capabilityManager.getTokenInfo(token).capabilities,
                    expiresAt: guestUser.expiresAt
                },
                token: token // Return original capability token for continued use
            });
        });
        
    } catch (error) {
        console.error('[GUEST LOGIN] Error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Example game-specific endpoint protected by capability
 * GET /api/capabilities/games/:gameName
 */
router.get('/games/:gameName', capabilityMiddleware('game:*'), async (req, res) => {
    try {
        const { gameName } = req.params;
        
        // Check specific game access
        if (req.capabilityToken) {
            const hasAccess = req.app.locals.capabilityManager.hasCapability(
                req.capabilityToken.token, 
                'game', 
                gameName
            );
            
            if (!hasAccess) {
                return res.status(403).json({ 
                    error: `Token does not grant access to game: ${gameName}` 
                });
            }
        }
        
        // Regular user permission check for non-token access
        if (req.user && !req.capabilityToken) {
            const userRoles = req.pdata.getUserRoles(req.user.username);
            const hasGameRole = userRoles.some(role => 
                role === 'admin' || role === `game-${gameName}` || role === 'dev'
            );
            
            if (!hasGameRole) {
                return res.status(403).json({ 
                    error: `User does not have access to game: ${gameName}` 
                });
            }
        }
        
        // Fetch game data (implement your game data logic here)
        const gameData = await fetchGameData(gameName, req);
        
        res.json({
            success: true,
            game: gameName,
            data: gameData,
            accessMethod: req.authMethod || 'session'
        });
        
    } catch (error) {
        console.error('[GAME ACCESS] Error:', error);
        res.status(500).json({ error: 'Failed to fetch game data' });
    }
});

/**
 * Fetch game data based on permissions
 */
async function fetchGameData(gameName, req) {
    // This is where you'd implement your actual game data fetching logic
    // For now, return mock data based on access level
    
    const baseData = {
        name: gameName,
        title: `Game: ${gameName}`,
        description: `Access to ${gameName} game content`
    };
    
    // Add more data based on permissions
    if (req.capabilityToken) {
        const capabilities = req.capabilityToken.capabilities;
        
        // Limited data for token access
        return {
            ...baseData,
            accessLevel: 'token',
            availableFeatures: ['play', 'view-scores'],
            tokenExpires: req.capabilityToken.metadata.expiresAt
        };
    }
    
    if (req.user) {
        const userRoles = req.pdata.getUserRoles(req.user.username);
        
        if (userRoles.includes('admin') || userRoles.includes('dev')) {
            // Full access for admin/dev
            return {
                ...baseData,
                accessLevel: 'full',
                availableFeatures: ['play', 'edit', 'admin', 'view-analytics'],
                gameFiles: [`/games/${gameName}/`],
                settings: { editable: true }
            };
        }
        
        // Standard user access
        return {
            ...baseData,
            accessLevel: 'user',
            availableFeatures: ['play', 'view-scores', 'save-progress']
        };
    }
    
    return baseData;
}

export default router;