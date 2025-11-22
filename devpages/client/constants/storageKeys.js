/**
 * Storage Keys - Standardized localStorage key constants
 *
 * Namespace: devpages:* for all DevPages-related storage
 * Prevents key collisions and provides clear organization
 */

export const STORAGE_KEYS = {
  // Theme System
  THEME: {
    CURRENT_MODE: 'devpages:theme:mode',           // 'light' | 'dark' | 'auto'
    ACTIVE_THEME: 'devpages:theme:active',         // Theme ID (e.g., 'devpages-light', 'user-custom')
    CUSTOM_THEMES: 'devpages:theme:custom',        // User-created themes
    THEME_REGISTRY: 'devpages:theme:registry',     // List of available themes
    AUTO_SWITCH: 'devpages:theme:autoSwitch',      // Auto light/dark switching
    SYNC_OS: 'devpages:theme:syncOS',             // Sync with OS dark mode
    LIGHT_THEME_DATA: 'devpages:theme:data:light', // Legacy: theme-light
    DARK_THEME_DATA: 'devpages:theme:data:dark',   // Legacy: theme-dark
  },

  // Settings
  SETTINGS: {
    PREVIEW: 'devpages:settings:preview',
    PUBLISH: 'devpages:settings:publish',
    EDITOR: 'devpages:settings:editor',
    GENERAL: 'devpages:settings:general',
  },

  // Panel State
  PANELS: {
    STATE: 'devpages:panels:state',
    LAYOUTS: 'devpages:panels:layouts',
    PREFERENCES: 'devpages:panels:preferences',
  },

  // Publish Configurations
  PUBLISH: {
    CONFIGS: 'devpages:publish:configs',
    ACTIVE_CONFIG: 'devpages:publish:activeConfig',
  },

  // User Preferences
  PREFERENCES: {
    SIDEBAR_CATEGORY: 'devpages:pref:sidebarCategory',
    LAYOUT: 'devpages:pref:layout',
    FONT_SIZE: 'devpages:pref:fontSize',
  },

  // Legacy Keys (for migration)
  LEGACY: {
    CUSTOM_THEMES: 'customThemes',
    THEME_LIGHT: 'theme-light',
    THEME_DARK: 'theme-dark',
    THEME_REGISTRY: 'theme-registry',
    SELECTED_THEME: 'selectedTheme',
    THEME_COLORS: 'themeColors',
  },
};

/**
 * Migrate legacy storage keys to new namespaced format
 */
export function migrateLegacyKeys() {
  const migrations = [
    // Theme migrations
    [STORAGE_KEYS.LEGACY.CUSTOM_THEMES, STORAGE_KEYS.THEME.CUSTOM_THEMES],
    [STORAGE_KEYS.LEGACY.THEME_LIGHT, STORAGE_KEYS.THEME.LIGHT_THEME_DATA],
    [STORAGE_KEYS.LEGACY.THEME_DARK, STORAGE_KEYS.THEME.DARK_THEME_DATA],
    [STORAGE_KEYS.LEGACY.THEME_REGISTRY, STORAGE_KEYS.THEME.THEME_REGISTRY],
    [STORAGE_KEYS.LEGACY.SELECTED_THEME, STORAGE_KEYS.THEME.ACTIVE_THEME],
  ];

  let migrated = 0;

  migrations.forEach(([oldKey, newKey]) => {
    const value = localStorage.getItem(oldKey);
    if (value && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, value);
      migrated++;
    }
  });

  if (migrated > 0) {
    console.log(`[StorageKeys] Migrated ${migrated} legacy keys`);
  }

  return migrated;
}

/**
 * Clear all DevPages storage (useful for debugging/reset)
 */
export function clearAllStorage() {
  const keys = Object.keys(localStorage);
  const devpagesKeys = keys.filter(key => key.startsWith('devpages:'));

  devpagesKeys.forEach(key => localStorage.removeItem(key));

  console.log(`[StorageKeys] Cleared ${devpagesKeys.length} storage keys`);
  return devpagesKeys.length;
}

/**
 * Get storage usage statistics
 */
export function getStorageStats() {
  const keys = Object.keys(localStorage);
  const devpagesKeys = keys.filter(key => key.startsWith('devpages:'));

  const stats = {
    totalKeys: keys.length,
    devpagesKeys: devpagesKeys.length,
    byCategory: {},
    totalSize: 0,
  };

  devpagesKeys.forEach(key => {
    const value = localStorage.getItem(key);
    const size = new Blob([value]).size;
    const category = key.split(':')[1] || 'other';

    if (!stats.byCategory[category]) {
      stats.byCategory[category] = { count: 0, size: 0 };
    }

    stats.byCategory[category].count++;
    stats.byCategory[category].size += size;
    stats.totalSize += size;
  });

  return stats;
}
