/**
 * Event Delegation
 * Centralized event handling using data attributes
 *
 * Usage in HTML:
 *   <button data-action="theme:next">Next Theme</button>
 *   <a data-action="navigate" data-to="/games">Games</a>
 */

const handlers = new Map();

/**
 * Initialize event delegation
 */
function init() {
  // Click delegation
  document.addEventListener('click', handleClick);

  // Register built-in actions
  registerBuiltInActions();

  console.log('[EventDelegation] Initialized');
}

/**
 * Handle click events via delegation
 */
function handleClick(event) {
  // Find closest element with data-action
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  if (!action) return;

  // Prevent default for links with data-action
  if (target.tagName === 'A') {
    event.preventDefault();
  }

  // Parse action (supports namespace:action format)
  const [namespace, method] = action.includes(':')
    ? action.split(':')
    : ['global', action];

  // Find handler
  const key = `${namespace}:${method}`;
  const handler = handlers.get(key) || handlers.get(`global:${action}`);

  if (handler) {
    handler(event, target, target.dataset);
  } else {
    console.warn('[EventDelegation] No handler for action:', action);
  }
}

/**
 * Register an action handler
 * @param {string} action - Action name (e.g., 'theme:next' or 'navigate')
 * @param {Function} handler - Handler function(event, element, dataset)
 */
function register(action, handler) {
  const key = action.includes(':') ? action : `global:${action}`;
  handlers.set(key, handler);
}

/**
 * Unregister an action handler
 */
function unregister(action) {
  const key = action.includes(':') ? action : `global:${action}`;
  handlers.delete(key);
}

/**
 * Register built-in actions
 */
function registerBuiltInActions() {
  // Navigation
  register('navigate', (event, el, data) => {
    const path = data.to || el.getAttribute('href');
    if (path && window.PJA?.services?.router) {
      window.PJA.services.router.navigate(path);
    }
  });

  // Theme switching
  register('theme:next', () => {
    if (window.PJA?.services?.theme) {
      window.PJA.services.theme.next();
    }
  });

  register('theme:set', (event, el, data) => {
    const theme = data.theme;
    if (theme && window.PJA?.services?.theme) {
      window.PJA.services.theme.set(theme);
    }
  });

  // Debug toggle
  register('debug:toggle', () => {
    if (window.PJA?.debug) {
      window.PJA.debug.enabled = !window.PJA.debug.enabled;
      localStorage.setItem('pja-debug', window.PJA.debug.enabled);
      console.log('[Debug]', window.PJA.debug.enabled ? 'Enabled' : 'Disabled');
    }
  });
}

export const EventDelegation = {
  init,
  register,
  unregister
};
