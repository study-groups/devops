/**
 * @file client/devtools/modules/CacheManager.js
 * @description Manages cache-related utilities for the DevTools panel.
 */

import { logMessage } from '/client/log/index.js';

export class CacheManager {
    constructor(container) {
        this.container = container;
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="cache-manager section">
                <div class="status-list">
                    <dl>
                        <dt>Cache Status:</dt>
                        <dd id="cache-status">Unknown</dd>
                    </dl>
                </div>
                <div class="actions-grid">
                    <div class="action-item">
                        <button id="clear-css-cache" class="btn btn-sm">Clear CSS Cache</button>
                        <p class="description">Removes all stored CSS stylesheets, forcing them to be re-downloaded.</p>
                    </div>
                    <div class="action-item">
                        <button id="hard-refresh" class="btn btn-sm">Hard Refresh</button>
                        <p class="description">Clears caches and performs a full page reload, bypassing the browser cache.</p>
                    </div>
                    <div class="action-item">
                        <button id="show-cache-status" class="btn btn-sm">Show Cache Status</button>
                        <p class="description">Outputs a detailed breakdown of cached items to the browser console.</p>
                    </div>
                </div>
            </div>
            <style>
                .status-list { 
                    margin-bottom: 20px; 
                    background: #f9f9f9; 
                    padding: 12px; 
                    border-radius: 4px;
                }
                .status-list dl { 
                    display: flex; 
                    align-items: center; 
                    margin: 0;
                }
                .status-list dt { 
                    font-weight: 600; 
                    margin-right: 8px; 
                }
                .status-list dd { 
                    margin: 0; 
                    font-family: monospace;
                    background: #eee;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                .actions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 16px;
                }
                .action-item .btn {
                    width: 100%;
                    margin-bottom: 8px;
                }
                .action-item .description {
                    font-size: 11px;
                    color: #666;
                    margin: 0;
                }
            </style>
        `;

        this.attachEventListeners();
        this.updateCacheStatus();
    }

    attachEventListeners() {
        this.container.querySelector('#clear-css-cache').addEventListener('click', () => this.clearCssCache());
        this.container.querySelector('#hard-refresh').addEventListener('click', () => this.hardRefresh());
        this.container.querySelector('#show-cache-status').addEventListener('click', () => this.showCacheStatus());
    }

    updateCacheStatus() {
        const statusElement = this.container.querySelector('#cache-status');
        if (statusElement) {
            const cacheKeys = Object.keys(localStorage).filter(key => 
                key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
            );
            statusElement.textContent = `${cacheKeys.length} cached items`;
        }
    }

    clearCssCache() {
        logMessage('Clearing CSS caches...', 'info', 'DEV_TOOLS');
        // This function would ideally come from a shared CSS management utility
        // For now, we'll just log it.
        console.log('Clearing CSS Cache...');
        
        const cssKeys = Object.keys(localStorage).filter(key => key.includes('css') || key.includes('styles'));
        cssKeys.forEach(key => {
            logMessage(`Clearing cache key: ${key}`, 'debug', 'DEV_TOOLS');
            localStorage.removeItem(key);
        });
        
        this.updateCacheStatus();
        logMessage('CSS caches cleared', 'info', 'DEV_TOOLS');
    }

    hardRefresh() {
        logMessage('Performing hard refresh...', 'info', 'DEV_TOOLS');
        // This would also involve service workers etc. in a real app
        setTimeout(() => {
            window.location.reload(true);
        }, 100);
    }

    showCacheStatus() {
        const cacheKeys = Object.keys(localStorage).filter(key => 
            key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
        );
        
        console.group('Cache Status');
        console.log('localStorage cache keys:', cacheKeys);
        console.groupEnd();
        
        logMessage('Cache status displayed in console', 'info', 'DEV_TOOLS');
        this.updateCacheStatus();
    }

    destroy() {
        this.container.innerHTML = '';
    }
} 