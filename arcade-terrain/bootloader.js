/**
 * PJA Bootloader
 * Four-phase initialization for Pixeljam Arcade
 *
 * Phases:
 *   1. bootPreInit  - Namespace, environment, loading screen
 *   2. bootCore     - Store, theme, auth validation
 *   3. bootSecondary - Components, router, websocket
 *   4. bootFinalize - Hide loading, dispatch ready event
 */

// ============================================================================
// Phase 1: Pre-Initialization
// ============================================================================

function bootPreInit() {
  console.log('[PJA] Phase 1: bootPreInit');

  // Initialize global namespace
  window.PJA = {
    version: '2.0.0',
    initialized: null,

    // Services registry
    services: {
      store: null,
      theme: null,
      auth: null,
      games: null,
      websocket: null,
      router: null
    },

    // Component registry
    components: {},

    // Page registry
    pages: {},

    // Bootloader state
    bootloader: {
      phase: 'preInit',
      startTime: performance.now(),
      errors: []
    },

    // Debug utilities
    debug: {
      enabled: localStorage.getItem('pja-debug') === 'true',
      log(...args) {
        if (this.enabled) console.log('[PJA:DEBUG]', ...args);
      }
    }
  };

  // Environment detection
  PJA.env = {
    isDev: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    hasTouch: 'ontouchstart' in window,
    theme: document.documentElement.getAttribute('data-theme') || 'lava'
  };

  updateLoadingProgress(10, 'Environment ready');
  return Promise.resolve();
}

// ============================================================================
// Phase 2: Core Services
// ============================================================================

async function bootCore() {
  console.log('[PJA] Phase 2: bootCore');
  PJA.bootloader.phase = 'core';
  updateLoadingProgress(20, 'Loading core services...');

  try {
    // Import and initialize store
    const { createStore } = await import('@store/createStore.js');
    PJA.services.store = createStore();
    updateLoadingProgress(35, 'Store initialized');

    // Import and initialize theme service
    const { ThemeService } = await import('@services/ThemeService.js');
    PJA.services.theme = ThemeService;
    ThemeService.init();
    updateLoadingProgress(50, 'Theme service ready');

    // Import auth service (validation happens async)
    const { AuthService } = await import('@services/AuthService.js');
    PJA.services.auth = AuthService;
    updateLoadingProgress(60, 'Auth service ready');

  } catch (error) {
    console.error('[PJA] bootCore failed:', error);
    PJA.bootloader.errors.push({ phase: 'core', error });
    throw error;
  }

  return Promise.resolve();
}

// ============================================================================
// Phase 3: Secondary Services
// ============================================================================

async function bootSecondary() {
  console.log('[PJA] Phase 3: bootSecondary');
  PJA.bootloader.phase = 'secondary';
  updateLoadingProgress(65, 'Loading components...');

  try {
    // Import router
    const { Router } = await import('@core/Router.js');
    PJA.services.router = Router;
    updateLoadingProgress(75, 'Router ready');

    // Import event delegation
    const { EventDelegation } = await import('@core/EventDelegation.js');
    EventDelegation.init();
    updateLoadingProgress(80, 'Events ready');

    // Initialize router (sets up routes and handles current hash)
    Router.init();
    updateLoadingProgress(90, 'Routes configured');

  } catch (error) {
    console.error('[PJA] bootSecondary failed:', error);
    PJA.bootloader.errors.push({ phase: 'secondary', error });
    throw error;
  }

  return Promise.resolve();
}

// ============================================================================
// Phase 4: Finalization
// ============================================================================

async function bootFinalize() {
  console.log('[PJA] Phase 4: bootFinalize');
  PJA.bootloader.phase = 'finalize';
  updateLoadingProgress(95, 'Finalizing...');

  // Calculate boot time
  const bootTime = performance.now() - PJA.bootloader.startTime;
  PJA.initialized = new Date().toISOString();

  // Show app, hide loading screen
  const app = document.getElementById('pja-app');
  const loading = document.getElementById('pja-loading');

  updateLoadingProgress(100, 'Ready');

  // Slight delay for visual feedback
  await new Promise(resolve => setTimeout(resolve, 200));

  loading.classList.add('fade-out');
  app.classList.add('loaded');

  // Remove loading screen after transition
  setTimeout(() => {
    loading.remove();
  }, 300);

  // Dispatch ready event
  window.dispatchEvent(new CustomEvent('pja:ready', {
    detail: {
      bootTime,
      version: PJA.version,
      theme: PJA.env.theme
    }
  }));

  console.log(`[PJA] Boot complete in ${bootTime.toFixed(0)}ms`);
  PJA.bootloader.phase = 'complete';

  return Promise.resolve();
}

// ============================================================================
// Utilities
// ============================================================================

function updateLoadingProgress(percent, status) {
  const bar = document.getElementById('loadingBar');
  const statusEl = document.getElementById('loadingStatus');

  if (bar) bar.style.width = `${percent}%`;
  if (statusEl) statusEl.textContent = status;

  PJA.debug.log(`Boot progress: ${percent}% - ${status}`);
}

// ============================================================================
// Boot Sequence
// ============================================================================

async function boot() {
  try {
    await bootPreInit();
    await bootCore();
    await bootSecondary();
    await bootFinalize();
  } catch (error) {
    console.error('[PJA] Boot failed:', error);

    // Show error state
    const statusEl = document.getElementById('loadingStatus');
    if (statusEl) {
      statusEl.textContent = 'Boot failed - check console';
      statusEl.style.color = '#ff4444';
    }

    // Dispatch error event
    window.dispatchEvent(new CustomEvent('pja:error', {
      detail: { error, phase: PJA?.bootloader?.phase }
    }));
  }
}

// Start boot when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
