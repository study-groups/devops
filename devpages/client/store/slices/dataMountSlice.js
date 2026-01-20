/**
 * dataMountSlice.js - Redux slice for managing local data mount points
 *
 * Manages multiple data mount points where each mount point is a directory
 * that can contain a pdata.json file with metadata including publishing info.
 *
 * Default mount point is PD_DATA = $PD_DIR/data
 * Users can add arbitrary directories as LOCAL DATA MOUNT POINTS.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Create a new mount point configuration with default values
 */
function createMountPoint(overrides = {}) {
    const now = new Date().toISOString();
    return {
        id: `mount-${Date.now()}`,
        name: 'New Mount Point',
        path: '',                    // Absolute path to the mount directory (e.g., PD_DIR)
        defaultSubdir: null,         // Default subdirectory to show (e.g., 'data')
        isDefault: false,
        isActive: false,
        metadata: null,              // Loaded from pdata.json if present
        publishConfigs: [],          // Publishing configurations from pdata.json
        lastAccessed: null,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

/**
 * Initial state
 */
const initialState = {
    // Array of mount points
    mountPoints: [],

    // ID of the active mount point
    activeMountId: null,

    // Default PD_DATA path (set from server)
    defaultDataPath: null,

    // UI state
    ui: {
        showMountSelector: false,
        isLoading: false,
        error: null
    },

    // Initialization flag
    _initialized: false
};

const dataMountSlice = createSlice({
    name: 'dataMount',
    initialState,
    reducers: {
        /**
         * Initialize with default PD_DIR mount point
         * Mount path = PD_DIR, defaultSubdir = 'data'
         */
        initializeMounts: (state, action) => {
            if (state._initialized) {
                console.log('[dataMount] Already initialized, skipping');
                return;
            }

            const { defaultMountPath, defaultSubdir, pdDir } = action.payload || {};

            // Create default mount point from PD_DIR
            if (defaultMountPath || pdDir) {
                const mountPath = defaultMountPath || pdDir;
                const defaultMount = createMountPoint({
                    id: 'default',
                    name: 'Default Data',
                    path: mountPath,
                    defaultSubdir: defaultSubdir || 'data',
                    isDefault: true,
                    isActive: true
                });

                state.mountPoints = [defaultMount];
                state.activeMountId = 'default';
                state.defaultDataPath = mountPath;
            }

            state._initialized = true;
        },

        /**
         * Add a new mount point
         */
        addMountPoint: (state, action) => {
            const mount = createMountPoint(action.payload);

            // If this is the first mount or marked as active, make it active
            if (state.mountPoints.length === 0 || mount.isActive) {
                state.mountPoints.forEach(m => m.isActive = false);
                mount.isActive = true;
                state.activeMountId = mount.id;
            }

            state.mountPoints.push(mount);
        },

        /**
         * Update an existing mount point
         */
        updateMountPoint: (state, action) => {
            const { id, updates } = action.payload;
            const mount = state.mountPoints.find(m => m.id === id);

            if (mount) {
                // Handle active flag changes
                if (updates.isActive && !mount.isActive) {
                    state.mountPoints.forEach(m => m.isActive = false);
                    state.activeMountId = id;
                }

                Object.assign(mount, updates, {
                    updatedAt: new Date().toISOString()
                });
            }
        },

        /**
         * Remove a mount point (cannot remove default)
         */
        removeMountPoint: (state, action) => {
            const id = action.payload;

            // Don't allow removing the default mount
            const mount = state.mountPoints.find(m => m.id === id);
            if (mount?.isDefault) {
                console.warn('[dataMount] Cannot remove default mount point');
                return;
            }

            const index = state.mountPoints.findIndex(m => m.id === id);
            if (index !== -1) {
                state.mountPoints.splice(index, 1);

                // If we removed the active mount, switch to default
                if (state.activeMountId === id) {
                    const defaultMount = state.mountPoints.find(m => m.isDefault);
                    if (defaultMount) {
                        defaultMount.isActive = true;
                        state.activeMountId = defaultMount.id;
                    } else if (state.mountPoints.length > 0) {
                        state.mountPoints[0].isActive = true;
                        state.activeMountId = state.mountPoints[0].id;
                    } else {
                        state.activeMountId = null;
                    }
                }
            }
        },

        /**
         * Set the active mount point
         */
        setActiveMountPoint: (state, action) => {
            const id = action.payload;
            const mount = state.mountPoints.find(m => m.id === id);

            if (mount) {
                state.mountPoints.forEach(m => m.isActive = false);
                mount.isActive = true;
                mount.lastAccessed = new Date().toISOString();
                state.activeMountId = id;
            }
        },

        /**
         * Update mount point metadata (from pdata.json)
         */
        setMountMetadata: (state, action) => {
            const { id, metadata, publishConfigs } = action.payload;
            const mount = state.mountPoints.find(m => m.id === id);

            if (mount) {
                mount.metadata = metadata;
                if (publishConfigs) {
                    mount.publishConfigs = publishConfigs;
                }
                mount.updatedAt = new Date().toISOString();
            }
        },

        /**
         * Toggle mount selector visibility
         */
        toggleMountSelector: (state) => {
            state.ui.showMountSelector = !state.ui.showMountSelector;
        },

        /**
         * Open mount selector
         */
        openMountSelector: (state) => {
            state.ui.showMountSelector = true;
        },

        /**
         * Close mount selector
         */
        closeMountSelector: (state) => {
            state.ui.showMountSelector = false;
        },

        /**
         * Set loading state
         */
        setLoading: (state, action) => {
            state.ui.isLoading = action.payload;
        },

        /**
         * Set error state
         */
        setError: (state, action) => {
            state.ui.error = action.payload;
            state.ui.isLoading = false;
        },

        /**
         * Clear error state
         */
        clearError: (state) => {
            state.ui.error = null;
        }
    }
});

export const dataMountActions = dataMountSlice.actions;

// Selectors
export const selectAllMountPoints = (state) => state.dataMount.mountPoints;

export const selectActiveMountPoint = (state) => {
    const activeId = state.dataMount.activeMountId;
    return state.dataMount.mountPoints.find(m => m.id === activeId) || null;
};

export const selectActiveMountPath = (state) => {
    const active = selectActiveMountPoint(state);
    return active?.path || state.dataMount.defaultDataPath || null;
};

/**
 * Get the default subdirectory for the active mount (e.g., 'data')
 */
export const selectActiveMountDefaultSubdir = (state) => {
    const active = selectActiveMountPoint(state);
    return active?.defaultSubdir || 'data';
};

/**
 * Get the full path to the default subdirectory (mount path + defaultSubdir)
 * This is where the file tree should initially load from
 */
export const selectActiveDefaultSubdirPath = (state) => {
    const mountPath = selectActiveMountPath(state);
    const subdir = selectActiveMountDefaultSubdir(state);
    if (!mountPath) return null;
    return subdir ? `${mountPath}/${subdir}` : mountPath;
};

export const selectDefaultMountPoint = (state) => {
    return state.dataMount.mountPoints.find(m => m.isDefault) || null;
};

export const selectMountPointById = (state, id) => {
    return state.dataMount.mountPoints.find(m => m.id === id) || null;
};

export const selectMountSelectorState = (state) => state.dataMount.ui;

export const selectMountPublishConfigs = (state) => {
    const active = selectActiveMountPoint(state);
    return active?.publishConfigs || [];
};

// Thunks
export const dataMountThunks = {
    /**
     * Initialize mount points from server
     */
    initializeFromServer: () => async (dispatch) => {
        dispatch(dataMountActions.setLoading(true));

        try {
            const response = await fetch('/api/mount/info', {
                credentials: 'include'
            });

            // Handle non-OK responses gracefully
            if (!response.ok) {
                // 401/403 is expected when not logged in - just use defaults
                if (response.status === 401 || response.status === 403) {
                    console.log('[dataMount] Not authenticated, using defaults');
                    return;
                }
                throw new Error(`Server returned ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                dispatch(dataMountActions.initializeMounts({
                    // Mount path is PD_DIR
                    defaultMountPath: result.defaultMountPath || result.pdDir,
                    // Default subdirectory within mount (e.g., 'data')
                    defaultSubdir: result.defaultSubdir || 'data',
                    pdDir: result.pdDir
                }));
            }
        } catch (error) {
            // Silently handle - mount points can be configured later
            console.log('[dataMount] Could not load from server:', error.message);
        } finally {
            dispatch(dataMountActions.setLoading(false));
        }
    },

    /**
     * Add a mount point and load its metadata
     */
    addAndLoadMountPoint: (path, name) => async (dispatch) => {
        dispatch(dataMountActions.setLoading(true));

        try {
            // Validate and get metadata from server
            const response = await fetch('/api/mount/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Invalid mount point');
            }

            // Add the mount point
            const mountId = `mount-${Date.now()}`;
            dispatch(dataMountActions.addMountPoint({
                id: mountId,
                name: name || result.suggestedName || path.split('/').pop(),
                path: result.resolvedPath || path,
                metadata: result.metadata,
                publishConfigs: result.publishConfigs || []
            }));

            return { success: true, mountId };
        } catch (error) {
            console.error('[dataMount] Failed to add mount point:', error);
            dispatch(dataMountActions.setError(error.message));
            return { success: false, error: error.message };
        } finally {
            dispatch(dataMountActions.setLoading(false));
        }
    },

    /**
     * Refresh metadata for a mount point
     */
    refreshMountMetadata: (mountId) => async (dispatch, getState) => {
        const mount = selectMountPointById(getState(), mountId);
        if (!mount) return;

        dispatch(dataMountActions.setLoading(true));

        try {
            const response = await fetch('/api/mount/metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: mount.path })
            });

            const result = await response.json();

            if (result.success) {
                dispatch(dataMountActions.setMountMetadata({
                    id: mountId,
                    metadata: result.metadata,
                    publishConfigs: result.publishConfigs
                }));
            }
        } catch (error) {
            console.error('[dataMount] Failed to refresh metadata:', error);
            dispatch(dataMountActions.setError(error.message));
        } finally {
            dispatch(dataMountActions.setLoading(false));
        }
    },

    /**
     * Switch to a mount point and optionally navigate to its root
     */
    switchToMountPoint: (mountId) => async (dispatch, getState) => {
        const mount = selectMountPointById(getState(), mountId);
        if (!mount) return;

        dispatch(dataMountActions.setActiveMountPoint(mountId));

        // Optionally dispatch navigation to the mount's root
        // This would require importing pathThunks
        console.log(`[dataMount] Switched to mount point: ${mount.name} at ${mount.path}`);
    }
};

export default dataMountSlice.reducer;
