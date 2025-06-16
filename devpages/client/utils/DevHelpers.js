/**
 * Development Helper Utilities
 * Functions to help with development workflow and debugging
 */

import { clearCssCache } from './CssManager.js';
import { logMessage } from '/client/log/index.js';

/**
 * Clear all application caches and force refresh
 */
export function hardRefresh() {
    logMessage('🔄 Performing hard refresh...', 'info', 'DEV_HELPERS');
    
    // Clear CSS cache
    clearCssCache();
    
    // Clear browser caches if available
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => registration.unregister());
        });
    }
    
    // Clear localStorage cache keys
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('timestamp') || key.includes('devpages_css')
    );
    cacheKeys.forEach(key => localStorage.removeItem(key));
    
    // Force page reload with cache bypass
    setTimeout(() => {
        window.location.reload(true);
    }, 100);
}

/**
 * Clear only CSS-related caches
 */
export function clearAllCssCache() {
    logMessage('🎨 Clearing CSS caches...', 'info', 'DEV_HELPERS');
    clearCssCache();
    
    // Clear CSS-related localStorage
    const cssKeys = Object.keys(localStorage).filter(key => 
        key.includes('css') || key.includes('styles')
    );
    cssKeys.forEach(key => {
        logMessage(`Clearing cache key: ${key}`, 'debug', 'DEV_HELPERS');
        localStorage.removeItem(key);
    });
}

/**
 * Show current cache status
 */
export function showCacheStatus() {
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
    );
    
    console.group('📊 Cache Status');
    console.log('🗄️ localStorage cache keys:', cacheKeys);
    console.log('🌍 Location:', window.location.href);
    console.log('🔄 Dev mode:', !window.location.hostname.includes('production'));
    console.groupEnd();
}

// Development tools are now available in Settings Panel instead of keyboard shortcuts

// Expose to window for console access
window.devHelpers = {
    hardRefresh,
    clearAllCssCache,
    showCacheStatus
}; 