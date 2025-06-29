/**
 * pjaSdk.module.js - PJA Games SDK Compatibility Layer
 * 
 * This file restores the original pjaSdk.module.js functionality that was
 * removed during the logging system refactor. It provides the initializeGameClient
 * function that existing games depend on.
 * 
 * This is a compatibility wrapper around the new gameClient.js SDK.
 */

// Import the new game client implementation
import { initializeGameClient, GameClient, GAME_API_ACTIONS } from './gameClient.js';

// Export everything with the original pjaSdk interface
export {
    initializeGameClient,
    GameClient,
    GAME_API_ACTIONS
};

// Also make it available globally for non-module usage
window.initializeGameClient = initializeGameClient;
window.GameClient = GameClient;
window.GAME_API_ACTIONS = GAME_API_ACTIONS;

// Legacy PJA SDK namespace
window.pjaSdk = {
    initializeGameClient,
    GameClient,
    GAME_API_ACTIONS,
    
    // Legacy method names for backward compatibility
    initialize: initializeGameClient,
    createClient: (options) => new GameClient(options)
};

console.log('[pjaSdk.module.js] Compatibility layer loaded - original SDK functionality restored'); 