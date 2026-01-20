/**
 * CLI Storage - Persist noise settings to localStorage
 *
 * Keys:
 *   noisecard:{elementId} - Settings for specific element
 *   noisecard:_last - Most recent settings (for quick restore)
 */

const STORAGE_PREFIX = 'noisecard:';

/**
 * Save noise config for an element
 */
export function saveConfig(elementId, config) {
  try {
    const key = STORAGE_PREFIX + (elementId || '_default');
    const data = {
      ...config,
      _saved: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));

    // Also save as last used
    localStorage.setItem(STORAGE_PREFIX + '_last', JSON.stringify(data));

    return true;
  } catch (e) {
    console.warn('[NoiseStorage] Failed to save:', e);
    return false;
  }
}

/**
 * Load noise config for an element
 */
export function loadConfig(elementId) {
  try {
    const key = STORAGE_PREFIX + (elementId || '_default');
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      delete parsed._saved; // Remove metadata
      return parsed;
    }
  } catch (e) {
    console.warn('[NoiseStorage] Failed to load:', e);
  }
  return null;
}

/**
 * Load last used config
 */
export function loadLastConfig() {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + '_last');
    if (data) {
      const parsed = JSON.parse(data);
      delete parsed._saved;
      return parsed;
    }
  } catch (e) {
    console.warn('[NoiseStorage] Failed to load last:', e);
  }
  return null;
}

/**
 * Clear saved config
 */
export function clearConfig(elementId) {
  try {
    const key = STORAGE_PREFIX + (elementId || '_default');
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * List all saved configs
 */
export function listConfigs() {
  const configs = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_PREFIX) && key !== STORAGE_PREFIX + '_last') {
        const id = key.replace(STORAGE_PREFIX, '');
        const data = JSON.parse(localStorage.getItem(key));
        configs.push({
          id,
          saved: data._saved ? new Date(data._saved).toLocaleString() : 'unknown',
          type: data.type || 'unknown'
        });
      }
    }
  } catch (e) {
    console.warn('[NoiseStorage] Failed to list:', e);
  }
  return configs;
}

export default {
  saveConfig,
  loadConfig,
  loadLastConfig,
  clearConfig,
  listConfigs
};
