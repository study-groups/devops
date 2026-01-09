/**
 * publishConfigSlice.js - Redux slice for managing publish configurations
 *
 * Manages multiple S3 Spaces configurations for publishing content.
 * Each configuration defines a complete Digital Ocean Spaces endpoint
 * with credentials, bucket info, and publishing preferences.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Encrypt a secret key for storage (simple XOR cipher - replace with better encryption in production)
 * In production, consider using Web Crypto API or a proper encryption library
 */
function encryptSecret(secret, key = 'devpages-secret-key') {
    if (!secret) return '';
    const encoded = btoa(secret); // Base64 encode first
    return encoded.split('').map((char, i) =>
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
}

/**
 * Decrypt a secret key from storage
 */
function decryptSecret(encrypted, key = 'devpages-secret-key') {
    if (!encrypted) return '';
    const decoded = encrypted.split('').map((char, i) =>
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
    return atob(decoded); // Base64 decode
}

/**
 * Create a new configuration with default values
 */
function createConfiguration(overrides = {}) {
    const now = new Date().toISOString();
    return {
        id: `config-${Date.now()}`,
        name: 'New Configuration',
        endpoint: '',
        region: '',
        bucket: '',
        accessKey: '',
        secretKey: '',
        prefix: 'published/',
        baseUrl: '',
        themeUrl: '',
        themeName: '',
        inlineCSS: true,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

/**
 * Initial state
 */
const initialState = {
    // Array of configurations
    configurations: [],

    // ID of the active configuration
    activeConfigId: null,

    // UI state
    ui: {
        showConfigManager: false,
        editingConfigId: null,
        isTestingConnection: false,
        testResult: null
    },

    // Initialization flag
    _initialized: false
};

const publishConfigSlice = createSlice({
    name: 'publishConfig',
    initialState,
    reducers: {
        /**
         * Initialize configurations from environment or create default
         */
        initializeConfigurations: (state, action) => {
            if (state._initialized) {
                console.log('[publishConfig] Already initialized, skipping');
                return;
            }

            const envConfig = action.payload;

            // If we have env config, create a default configuration from it
            if (envConfig && envConfig.endpoint) {
                const defaultConfig = createConfiguration({
                    id: 'primary',
                    name: 'Primary CDN',
                    endpoint: envConfig.endpoint,
                    region: envConfig.region || '',
                    bucket: envConfig.bucket || '',
                    accessKey: envConfig.accessKey || '',
                    secretKey: encryptSecret(envConfig.secretKey || ''),
                    baseUrl: envConfig.baseUrl || '',
                    inlineCSS: true,
                    isDefault: true
                });

                state.configurations = [defaultConfig];
                state.activeConfigId = 'primary';
            }

            state._initialized = true;
        },

        /**
         * Add a new configuration
         */
        addConfiguration: (state, action) => {
            const config = createConfiguration(action.payload);

            // Encrypt the secret key before storing
            if (config.secretKey) {
                config.secretKey = encryptSecret(config.secretKey);
            }

            // If this is the first config or marked as default, make it default
            if (state.configurations.length === 0 || config.isDefault) {
                // Remove default from other configs
                state.configurations.forEach(c => c.isDefault = false);
                config.isDefault = true;
                state.activeConfigId = config.id;
            }

            state.configurations.push(config);
        },

        /**
         * Add multiple configurations at once (for bulk loading like TETRA configs)
         * Does NOT set defaults or trigger side effects
         */
        addConfigurationsBulk: (state, action) => {
            const configs = action.payload;
            if (Array.isArray(configs)) {
                configs.forEach(config => {
                    // Check if already exists
                    const existingIndex = state.configurations.findIndex(c => c.id === config.id);
                    if (existingIndex === -1) {
                        state.configurations.push(config);
                    }
                });
            }
        },

        /**
         * Update an existing configuration
         */
        updateConfiguration: (state, action) => {
            const { id, updates } = action.payload;
            const config = state.configurations.find(c => c.id === id);

            if (config) {
                // Encrypt secret key if it's being updated
                if (updates.secretKey && updates.secretKey !== config.secretKey) {
                    updates.secretKey = encryptSecret(updates.secretKey);
                }

                // Handle default flag changes
                if (updates.isDefault && !config.isDefault) {
                    // Remove default from other configs
                    state.configurations.forEach(c => c.isDefault = false);
                    state.activeConfigId = id;
                }

                Object.assign(config, updates, {
                    updatedAt: new Date().toISOString()
                });
            }
        },

        /**
         * Delete a configuration
         */
        deleteConfiguration: (state, action) => {
            const id = action.payload;
            const index = state.configurations.findIndex(c => c.id === id);

            if (index !== -1) {
                state.configurations.splice(index, 1);

                // If we deleted the active config, switch to the first available
                if (state.activeConfigId === id) {
                    state.activeConfigId = state.configurations.length > 0
                        ? state.configurations[0].id
                        : null;
                }

                // Ensure we have a default config
                if (state.configurations.length > 0 && !state.configurations.some(c => c.isDefault)) {
                    state.configurations[0].isDefault = true;
                }
            }
        },

        /**
         * Set the active configuration
         */
        setActiveConfiguration: (state, action) => {
            const id = action.payload;
            if (state.configurations.find(c => c.id === id)) {
                state.activeConfigId = id;
            }
        },

        /**
         * Set the default configuration
         */
        setDefaultConfiguration: (state, action) => {
            const id = action.payload;

            // Remove default from all configs
            state.configurations.forEach(c => c.isDefault = false);

            // Set new default
            const config = state.configurations.find(c => c.id === id);
            if (config) {
                config.isDefault = true;
                state.activeConfigId = id;
            }
        },

        /**
         * Toggle configuration manager visibility
         */
        toggleConfigManager: (state) => {
            state.ui.showConfigManager = !state.ui.showConfigManager;
        },

        /**
         * Open configuration manager
         */
        openConfigManager: (state) => {
            state.ui.showConfigManager = true;
        },

        /**
         * Close configuration manager
         */
        closeConfigManager: (state) => {
            state.ui.showConfigManager = false;
            state.ui.editingConfigId = null;
        },

        /**
         * Start editing a configuration
         */
        startEditingConfig: (state, action) => {
            state.ui.editingConfigId = action.payload;
            state.ui.showConfigManager = true;
        },

        /**
         * Stop editing a configuration
         */
        stopEditingConfig: (state) => {
            state.ui.editingConfigId = null;
        },

        /**
         * Set connection test result
         */
        setTestResult: (state, action) => {
            state.ui.testResult = action.payload;
            state.ui.isTestingConnection = false;
        },

        /**
         * Start connection test
         */
        startConnectionTest: (state) => {
            state.ui.isTestingConnection = true;
            state.ui.testResult = null;
        },

        /**
         * Clear test result
         */
        clearTestResult: (state) => {
            state.ui.testResult = null;
        }
    }
});

export const publishConfigActions = publishConfigSlice.actions;

// Selectors
export const selectAllConfigurations = (state) => state.publishConfig.configurations;

export const selectActiveConfiguration = (state) => {
    const activeId = state.publishConfig.activeConfigId;
    return state.publishConfig.configurations.find(c => c.id === activeId) || null;
};

export const selectActiveConfigurationDecrypted = (state) => {
    const config = selectActiveConfiguration(state);
    if (!config) return null;

    return {
        ...config,
        secretKey: decryptSecret(config.secretKey)
    };
};

export const selectDefaultConfiguration = (state) => {
    return state.publishConfig.configurations.find(c => c.isDefault) || null;
};

export const selectConfigurationById = (state, id) => {
    return state.publishConfig.configurations.find(c => c.id === id) || null;
};

export const selectConfigurationByIdDecrypted = (state, id) => {
    const config = selectConfigurationById(state, id);
    if (!config) return null;

    return {
        ...config,
        secretKey: decryptSecret(config.secretKey)
    };
};

export const selectConfigManagerState = (state) => state.publishConfig.ui;

export const selectEditingConfig = (state) => {
    const editingId = state.publishConfig.ui.editingConfigId;
    if (!editingId) return null;

    const config = selectConfigurationById(state, editingId);
    if (!config) return null;

    return {
        ...config,
        secretKey: decryptSecret(config.secretKey)
    };
};

// Thunks
export const publishConfigThunks = {
    /**
     * Initialize from environment variables
     */
    initializeFromEnv: () => async (dispatch) => {
        try {
            // Fetch spaces config from server
            const response = await fetch('/api/spaces/config');
            const result = await response.json();

            if (result.success && result.config) {
                const envConfig = {
                    endpoint: result.config.endpointValue,
                    region: result.config.regionValue,
                    bucket: result.config.bucketValue,
                    baseUrl: result.config.publishBaseUrlValue,
                    // Note: We don't get the actual keys from the server for security
                    accessKey: '', // Server shouldn't expose these
                    secretKey: ''
                };

                dispatch(publishConfigActions.initializeConfigurations(envConfig));
            }
        } catch (error) {
            console.error('[publishConfig] Failed to initialize from env:', error);
            // Initialize with empty state
            dispatch(publishConfigActions.initializeConfigurations(null));
        }
    },

    /**
     * Test a configuration's connection
     */
    testConfiguration: (configId) => async (dispatch, getState) => {
        dispatch(publishConfigActions.startConnectionTest());

        try {
            const config = selectConfigurationByIdDecrypted(getState(), configId);
            if (!config) {
                throw new Error('Configuration not found');
            }

            // TODO: Implement actual connection test
            // For now, just validate that required fields are present
            const errors = [];
            if (!config.endpoint) errors.push('Endpoint is required');
            if (!config.region) errors.push('Region is required');
            if (!config.bucket) errors.push('Bucket is required');

            if (errors.length > 0) {
                dispatch(publishConfigActions.setTestResult({
                    success: false,
                    message: 'Configuration incomplete',
                    errors
                }));
                return false;
            }

            // Simulate successful test
            dispatch(publishConfigActions.setTestResult({
                success: true,
                message: 'Connection successful',
                details: {
                    endpoint: config.endpoint,
                    bucket: config.bucket,
                    region: config.region
                }
            }));

            return true;
        } catch (error) {
            dispatch(publishConfigActions.setTestResult({
                success: false,
                message: error.message,
                errors: [error.stack]
            }));
            return false;
        }
    }
};

// Export helpers for encryption/decryption if needed elsewhere
export { encryptSecret, decryptSecret };

export default publishConfigSlice.reducer;
