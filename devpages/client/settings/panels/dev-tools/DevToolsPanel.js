/**
 * client/settings/DevToolsPanel.js
 * Development tools panel for cache management and debugging
 */

import { panelRegistry } from '../../core/panelRegistry.js';
import { clearCssCache } from '/client/utils/CssManager.js';
import { logMessage } from '/client/log/index.js';

export class DevToolsPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.contentElement = null;
    
    this.createContent();
    logMessage('DevToolsPanel instance created.', 'debug', 'DEV_TOOLS');
  }

  createContent() {
    this.contentElement = document.createElement('div');
    this.contentElement.classList.add('settings-section-content');
    
    // Create cache status display
    const statusDiv = document.createElement('div');
    statusDiv.classList.add('dev-tools-status');
    statusDiv.innerHTML = `
      <div class="status-item">
        <strong>Cache Status:</strong>
        <span id="cache-status">Unknown</span>
      </div>
      <div class="status-item">
        <strong>Dev Mode:</strong>
        <span id="dev-mode-status">${!window.location.hostname.includes('production') ? 'Enabled' : 'Disabled'}</span>
      </div>
    `;
    
    // Create buttons container
    const buttonsDiv = document.createElement('div');
    buttonsDiv.classList.add('dev-tools-buttons');
    
    // Clear CSS Cache button
    const clearCssBtn = document.createElement('button');
    clearCssBtn.classList.add('settings-button', 'dev-tool-button');
    clearCssBtn.textContent = '🎨 Clear CSS Cache';
    clearCssBtn.title = 'Clear all CSS caches and refresh stylesheets';
    clearCssBtn.addEventListener('click', () => this.clearCssCache());
    
    // Hard Refresh button
    const hardRefreshBtn = document.createElement('button');
    hardRefreshBtn.classList.add('settings-button', 'dev-tool-button');
    hardRefreshBtn.textContent = '🔄 Hard Refresh';
    hardRefreshBtn.title = 'Clear all caches and reload the page';
    hardRefreshBtn.addEventListener('click', () => this.hardRefresh());
    
    // Show Cache Status button
    const showStatusBtn = document.createElement('button');
    showStatusBtn.classList.add('settings-button', 'dev-tool-button');
    showStatusBtn.textContent = '📊 Show Cache Status';
    showStatusBtn.title = 'Show detailed cache information in console';
    showStatusBtn.addEventListener('click', () => this.showCacheStatus());
    
    buttonsDiv.appendChild(clearCssBtn);
    buttonsDiv.appendChild(hardRefreshBtn);
    buttonsDiv.appendChild(showStatusBtn);
    
    this.contentElement.appendChild(statusDiv);
    this.contentElement.appendChild(buttonsDiv);
    this.containerElement.appendChild(this.contentElement);
    
    // Update cache status display
    this.updateCacheStatus();
  }

  // Development tool methods
  clearCssCache() {
    logMessage('🎨 Clearing CSS caches...', 'info', 'DEV_TOOLS');
    clearCssCache();
    
    // Clear CSS-related localStorage
    const cssKeys = Object.keys(localStorage).filter(key => 
        key.includes('css') || key.includes('styles')
    );
    cssKeys.forEach(key => {
        logMessage(`Clearing cache key: ${key}`, 'debug', 'DEV_TOOLS');
        localStorage.removeItem(key);
    });
    
    this.updateCacheStatus();
    logMessage('✅ CSS caches cleared', 'info', 'DEV_TOOLS');
  }

  hardRefresh() {
    logMessage('🔄 Performing hard refresh...', 'info', 'DEV_TOOLS');
    
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

  showCacheStatus() {
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
    );
    
    console.group('📊 Cache Status');
    console.log('🗄️ localStorage cache keys:', cacheKeys);
    console.log('🌍 Location:', window.location.href);
    console.log('🔄 Dev mode:', !window.location.hostname.includes('production'));
    console.groupEnd();
    
    logMessage('📊 Cache status displayed in console', 'info', 'DEV_TOOLS');
    this.updateCacheStatus();
  }

  updateCacheStatus() {
    const statusElement = document.getElementById('cache-status');
    if (statusElement) {
      const cacheKeys = Object.keys(localStorage).filter(key => 
          key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
      );
      statusElement.textContent = `${cacheKeys.length} cached items`;
    }
  }

  destroy() {
    logMessage('Destroying DevToolsPanel...', 'debug', 'DEV_TOOLS');
    if (this.contentElement && this.contentElement.parentNode) {
      this.contentElement.parentNode.removeChild(this.contentElement);
    }
    this.contentElement = null;
    this.containerElement = null;
  }
}

// Register this panel with the registry
panelRegistry.register({
  id: 'dev-tools-container',
  title: 'Development Tools',
  component: DevToolsPanel,
  order: 70,
  defaultCollapsed: true
}); 