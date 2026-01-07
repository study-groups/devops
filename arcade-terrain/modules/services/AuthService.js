/**
 * Auth Service
 * Handles authentication state and token management
 */

const STORAGE_KEY = 'pja-auth-token';

let isAuthenticated = false;
let user = null;
const subscribers = new Set();

/**
 * Initialize auth service
 * Validates stored token if present
 */
async function init() {
  const token = getToken();
  if (token) {
    try {
      await validateToken(token);
    } catch (e) {
      console.warn('[AuthService] Token validation failed:', e);
      clearToken();
    }
  }
  console.log('[AuthService] Initialized, authenticated:', isAuthenticated);
}

/**
 * Get stored token
 */
function getToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Store token
 */
function setToken(token) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch (e) {
    console.warn('[AuthService] Could not store token:', e);
  }
}

/**
 * Clear token
 */
function clearToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Ignore
  }
  isAuthenticated = false;
  user = null;
}

/**
 * Validate token with server
 * TODO: Implement actual validation
 */
async function validateToken(token) {
  // Stub: In production, this would call the auth API
  // For now, just check if token exists
  if (token && token.length > 0) {
    isAuthenticated = true;
    user = { id: 'stub', name: 'User' };
    return true;
  }
  throw new Error('Invalid token');
}

/**
 * Login with credentials
 * TODO: Implement actual login
 */
async function login(credentials) {
  // Stub implementation
  console.log('[AuthService] Login called with:', credentials);

  // In production: POST to /api/auth/login
  const token = 'stub-token-' + Date.now();
  setToken(token);
  isAuthenticated = true;
  user = { id: 'stub', name: credentials.username || 'User' };

  notify();
  return { success: true, user };
}

/**
 * Logout
 */
function logout() {
  clearToken();
  notify();
  return { success: true };
}

/**
 * Check if authenticated
 */
function check() {
  return isAuthenticated;
}

/**
 * Get current user
 */
function getUser() {
  return user ? { ...user } : null;
}

/**
 * Subscribe to auth changes
 */
function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Notify subscribers
 */
function notify() {
  const state = { isAuthenticated, user };
  subscribers.forEach(fn => fn(state));

  window.dispatchEvent(new CustomEvent('pja:auth-change', {
    detail: state
  }));
}

export const AuthService = {
  init,
  login,
  logout,
  check,
  getUser,
  getToken,
  subscribe
};
