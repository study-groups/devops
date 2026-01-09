/**
 * API Module - Plain fetch functions for server communication
 *
 * Replaces RTK Query with simple, predictable fetch calls.
 * Each function returns a Promise that resolves to data or rejects with error.
 */

const BASE_URL = '/api';
const DEFAULT_TIMEOUT = 10000;

/**
 * Base fetch wrapper with timeout and error handling
 */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  }
}

// ===== AUTHENTICATION API =====

export const authApi = {
  /**
   * Login with username/password
   */
  async login(credentials) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Generate a PData API token
   */
  async generateToken({ expiryHours = 24, description = 'API Access Token' } = {}) {
    return apiFetch('/auth/token/generate', {
      method: 'POST',
      body: JSON.stringify({ expiryHours, description }),
    });
  },

  /**
   * Get current user authentication status
   */
  async getCurrentUser() {
    return apiFetch('/auth/user');
  },

  /**
   * Logout and invalidate session
   */
  async logout() {
    return apiFetch('/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Get system status
   */
  async getSystemStatus() {
    return apiFetch('/auth/system');
  },
};

// ===== FILE SYSTEM API =====

export const filesApi = {
  /**
   * Get top-level directories for the authenticated user
   */
  async getTopLevelDirectories() {
    return apiFetch('/files/dirs');
  },

  /**
   * Get directory listing
   */
  async getDirectoryListing(pathname = '/') {
    const params = new URLSearchParams({ pathname });
    return apiFetch(`/files/list?${params}`);
  },

  /**
   * Get file content
   */
  async getFileContent(pathname) {
    const params = new URLSearchParams({ pathname });
    return apiFetch(`/files/content?${params}`);
  },

  /**
   * Save file content
   */
  async saveFile(pathname, content) {
    return apiFetch('/files/save', {
      method: 'POST',
      body: JSON.stringify({ pathname, content }),
    });
  },

  /**
   * Delete file
   */
  async deleteFile(pathname) {
    const params = new URLSearchParams({ pathname });
    return apiFetch(`/files/delete?${params}`, {
      method: 'DELETE',
    });
  },
};

// ===== CONFIGURATION API =====

export const configApi = {
  /**
   * Get directory configuration
   */
  async getDirectoryConfig(directory) {
    const params = new URLSearchParams({ directory });
    return apiFetch(`/config?${params}`);
  },
};

// ===== USER API =====

export const userApi = {
  /**
   * Get user information
   */
  async getUserInfo(username) {
    return apiFetch(`/users/${username}`);
  },
};

// Combined API object for convenience
export const api = {
  auth: authApi,
  files: filesApi,
  config: configApi,
  user: userApi,
};

export default api;

console.log('[API] Plain fetch API module initialized');
