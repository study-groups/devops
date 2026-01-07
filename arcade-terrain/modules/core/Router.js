/**
 * Hash-based Router
 * Simple client-side routing using URL hash
 */

const routes = new Map();
let currentRoute = null;
let appContainer = null;
const subscribers = new Set();

/**
 * Initialize router
 */
function init() {
  appContainer = document.getElementById('pja-app');

  // Register default routes
  registerDefaultRoutes();

  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);

  // Handle initial route
  handleHashChange();

  console.log('[Router] Initialized');
}

/**
 * Register default routes
 */
function registerDefaultRoutes() {
  // Home page
  register('/', async () => {
    const { HomePage } = await import('@pages/Home.js');
    return HomePage;
  });

  // Games listing
  register('/games', async () => {
    const { GamesPage } = await import('@pages/Games.js');
    return GamesPage;
  });

  // Play game (with param)
  register('/play/:gameId', async () => {
    const { PlayPage } = await import('@pages/Play.js');
    return PlayPage;
  });

  // 404 fallback
  register('*', async () => {
    return {
      render: () => `
        <div class="page page-404">
          <h1>404</h1>
          <p>Page not found</p>
          <a href="#/">Back to Home</a>
        </div>
      `
    };
  });
}

/**
 * Register a route
 * @param {string} path - Route path (supports :params)
 * @param {Function} loader - Async function that returns page module
 */
function register(path, loader) {
  routes.set(path, {
    path,
    loader,
    pattern: pathToPattern(path)
  });
}

/**
 * Convert path to regex pattern
 */
function pathToPattern(path) {
  if (path === '*') return { regex: /.*/, params: [] };

  const params = [];
  const regexStr = path
    .replace(/:([^/]+)/g, (_, name) => {
      params.push(name);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');

  return {
    regex: new RegExp(`^${regexStr}$`),
    params
  };
}

/**
 * Parse current hash into path
 */
function getPath() {
  const hash = window.location.hash.slice(1) || '/';
  return hash.startsWith('/') ? hash : '/' + hash;
}

/**
 * Handle hash change
 */
async function handleHashChange() {
  const path = getPath();
  console.log('[Router] Navigating to:', path);

  // Find matching route
  let matchedRoute = null;
  let params = {};

  for (const [routePath, route] of routes) {
    if (routePath === '*') continue;

    const match = path.match(route.pattern.regex);
    if (match) {
      matchedRoute = route;
      route.pattern.params.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      break;
    }
  }

  // Fall back to 404
  if (!matchedRoute) {
    matchedRoute = routes.get('*');
  }

  if (!matchedRoute) {
    console.error('[Router] No route found for:', path);
    return;
  }

  try {
    // Load page module
    const page = await matchedRoute.loader();

    // Render page
    if (appContainer && page.render) {
      appContainer.innerHTML = page.render(params);

      // Call mount lifecycle if defined
      if (page.mount) {
        page.mount(appContainer, params);
      }
    }

    // Update current route
    const oldRoute = currentRoute;
    currentRoute = { path, params, page };

    // Notify subscribers
    notify(currentRoute, oldRoute);

  } catch (error) {
    console.error('[Router] Failed to load page:', error);
    if (appContainer) {
      appContainer.innerHTML = `
        <div class="page page-error">
          <h1>Error</h1>
          <p>Failed to load page</p>
          <pre>${error.message}</pre>
        </div>
      `;
    }
  }
}

/**
 * Navigate to path programmatically
 */
function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : '/' + path;
}

/**
 * Go back in history
 */
function back() {
  window.history.back();
}

/**
 * Get current route info
 */
function current() {
  return currentRoute ? { ...currentRoute } : null;
}

/**
 * Subscribe to route changes
 */
function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Notify subscribers
 */
function notify(newRoute, oldRoute) {
  subscribers.forEach(fn => fn(newRoute, oldRoute));

  window.dispatchEvent(new CustomEvent('pja:route-change', {
    detail: { route: newRoute, previous: oldRoute }
  }));
}

export const Router = {
  init,
  register,
  navigate,
  back,
  current,
  subscribe,
  getPath
};
