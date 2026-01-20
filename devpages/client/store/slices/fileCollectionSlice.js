/**
 * fileCollectionSlice.js - Redux slice for managing file selections and collections
 *
 * Manages file selections (checkboxes in file tree) and saved collections
 * (bookmarks) that can be loaded/saved for bulk operations.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Collection structure:
 * {
 *   name: string,
 *   mountId: string,              // Which mount point this collection belongs to
 *   files: string[],              // Relative paths within mount
 *   defaultPublishConfigId: string | null,  // Optional default publish target
 *   createdAt: string,
 *   updatedAt: string
 * }
 */

/**
 * Create a new collection with default values
 */
function createCollection(name, files = [], mountId = 'default') {
    const now = new Date().toISOString();
    return {
        name,
        mountId,
        files,
        defaultPublishConfigId: null,
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Initial state
 */
export const fileCollectionInitialState = {
    // Currently selected file paths (Set stored as array for serialization)
    selectedFiles: [],

    // Saved collections: { name: CollectionObject, ... }
    // Note: Migrated from old format { name: [files] } to new format with metadata
    collections: {},

    // UI state
    ui: {
        isLoading: false,
        error: null
    }
};

const fileCollectionSlice = createSlice({
    name: 'fileCollection',
    initialState: fileCollectionInitialState,
    reducers: {
        /**
         * Toggle a single file's selection state
         */
        toggleFile: (state, action) => {
            const filePath = action.payload;
            const index = state.selectedFiles.indexOf(filePath);

            if (index === -1) {
                state.selectedFiles.push(filePath);
            } else {
                state.selectedFiles.splice(index, 1);
            }
        },

        /**
         * Select multiple files at once
         */
        selectFiles: (state, action) => {
            const filePaths = action.payload;
            const currentSet = new Set(state.selectedFiles);

            filePaths.forEach(path => currentSet.add(path));
            state.selectedFiles = Array.from(currentSet);
        },

        /**
         * Deselect multiple files at once
         */
        deselectFiles: (state, action) => {
            const filePaths = action.payload;
            const toRemove = new Set(filePaths);

            state.selectedFiles = state.selectedFiles.filter(path => !toRemove.has(path));
        },

        /**
         * Clear all selections
         */
        clearSelection: (state) => {
            state.selectedFiles = [];
        },

        /**
         * Set selection to a specific list of files (replace current selection)
         */
        setSelection: (state, action) => {
            state.selectedFiles = Array.isArray(action.payload) ? [...action.payload] : [];
        },

        /**
         * Save current selection as a named collection
         */
        saveCollection: (state, action) => {
            const { name, files, mountId = 'default' } = action.payload;
            // Use provided files or current selection
            const fileList = files || [...state.selectedFiles];

            // Check if updating existing collection
            const existing = state.collections[name];
            if (existing) {
                existing.files = fileList;
                existing.updatedAt = new Date().toISOString();
            } else {
                state.collections[name] = createCollection(name, fileList, mountId);
            }
        },

        /**
         * Load a collection into the current selection
         */
        loadCollection: (state, action) => {
            const name = action.payload;
            const collection = state.collections[name];
            if (collection) {
                // Support both old format (array) and new format (object with files)
                const files = Array.isArray(collection) ? collection : collection.files;
                state.selectedFiles = [...files];
            }
        },

        /**
         * Delete a saved collection
         */
        deleteCollection: (state, action) => {
            const name = action.payload;
            delete state.collections[name];
        },

        /**
         * Rename a collection
         */
        renameCollection: (state, action) => {
            const { oldName, newName } = action.payload;
            if (state.collections[oldName] && oldName !== newName) {
                const collection = state.collections[oldName];
                // Handle both old and new format
                if (typeof collection === 'object' && !Array.isArray(collection)) {
                    collection.name = newName;
                    collection.updatedAt = new Date().toISOString();
                }
                state.collections[newName] = collection;
                delete state.collections[oldName];
            }
        },

        /**
         * Set the default publish target for a collection
         */
        setCollectionPublishTarget: (state, action) => {
            const { name, configId } = action.payload;
            const collection = state.collections[name];
            if (collection && typeof collection === 'object' && !Array.isArray(collection)) {
                collection.defaultPublishConfigId = configId;
                collection.updatedAt = new Date().toISOString();
            }
        },

        /**
         * Update the mount point for a collection
         */
        updateCollectionMount: (state, action) => {
            const { name, mountId } = action.payload;
            const collection = state.collections[name];
            if (collection && typeof collection === 'object' && !Array.isArray(collection)) {
                collection.mountId = mountId;
                collection.updatedAt = new Date().toISOString();
            }
        },

        /**
         * Load collections from localStorage (for initialization)
         * Handles migration from old format (array) to new format (object with metadata)
         */
        loadCollectionsFromStorage: (state) => {
            try {
                const stored = localStorage.getItem('devpages-file-collections');
                if (stored) {
                    const parsed = JSON.parse(stored);

                    // Migrate old format collections to new format
                    const migrated = {};
                    for (const [name, value] of Object.entries(parsed)) {
                        if (Array.isArray(value)) {
                            // Old format: { name: [files] } -> migrate to new format
                            migrated[name] = createCollection(name, value, 'default');
                        } else if (typeof value === 'object' && value.files) {
                            // New format: already correct
                            migrated[name] = value;
                        }
                    }

                    state.collections = migrated;
                }
            } catch (error) {
                console.error('[fileCollection] Failed to load collections from storage:', error);
            }
        },

        /**
         * Set UI loading state
         */
        setLoading: (state, action) => {
            state.ui.isLoading = action.payload;
        },

        /**
         * Set UI error state
         */
        setError: (state, action) => {
            state.ui.error = action.payload;
        },

        /**
         * Clear UI error
         */
        clearError: (state) => {
            state.ui.error = null;
        }
    }
});

export const fileCollectionActions = fileCollectionSlice.actions;

// Selectors
export const selectSelectedFiles = (state) => state.fileCollection.selectedFiles;

export const selectSelectedFilesSet = (state) => new Set(state.fileCollection.selectedFiles);

export const selectSelectedCount = (state) => state.fileCollection.selectedFiles.length;

export const selectIsFileSelected = (state, filePath) =>
    state.fileCollection.selectedFiles.includes(filePath);

export const selectCollections = (state) => state.fileCollection.collections;

export const selectCollectionNames = (state) => Object.keys(state.fileCollection.collections);

export const selectCollection = (state, name) => state.fileCollection.collections[name] || null;

/**
 * Get files from a collection (handles both old array format and new object format)
 */
export const selectCollectionFiles = (state, name) => {
    const collection = state.fileCollection.collections[name];
    if (!collection) return [];
    return Array.isArray(collection) ? collection : (collection.files || []);
};

/**
 * Get collection metadata (mountId, publishConfigId, etc.)
 */
export const selectCollectionMetadata = (state, name) => {
    const collection = state.fileCollection.collections[name];
    if (!collection || Array.isArray(collection)) {
        return { mountId: 'default', defaultPublishConfigId: null };
    }
    return {
        mountId: collection.mountId || 'default',
        defaultPublishConfigId: collection.defaultPublishConfigId || null,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt
    };
};

/**
 * Get collections filtered by mount point
 */
export const selectCollectionsByMount = (state, mountId) => {
    const collections = state.fileCollection.collections;
    return Object.entries(collections)
        .filter(([_, coll]) => {
            const collMountId = Array.isArray(coll) ? 'default' : (coll.mountId || 'default');
            return collMountId === mountId;
        })
        .map(([name]) => name);
};

export const selectFileCollectionUI = (state) => state.fileCollection.ui;

// Thunks
export const fileCollectionThunks = {
    /**
     * Initialize collections from localStorage
     */
    initialize: () => (dispatch) => {
        dispatch(fileCollectionActions.loadCollectionsFromStorage());
    },

    /**
     * Save a collection and persist to localStorage
     */
    saveCollectionAndPersist: (name, files = null, mountId = 'default') => (dispatch, getState) => {
        dispatch(fileCollectionActions.saveCollection({ name, files, mountId }));

        // Persist to localStorage
        const collections = getState().fileCollection.collections;
        try {
            localStorage.setItem('devpages-file-collections', JSON.stringify(collections));
        } catch (error) {
            console.error('[fileCollection] Failed to persist collections:', error);
        }
    },

    /**
     * Set publish target for a collection and persist
     */
    setCollectionPublishTargetAndPersist: (name, configId) => (dispatch, getState) => {
        dispatch(fileCollectionActions.setCollectionPublishTarget({ name, configId }));

        // Persist to localStorage
        const collections = getState().fileCollection.collections;
        try {
            localStorage.setItem('devpages-file-collections', JSON.stringify(collections));
        } catch (error) {
            console.error('[fileCollection] Failed to persist collections:', error);
        }
    },

    /**
     * Update mount for a collection and persist
     */
    updateCollectionMountAndPersist: (name, mountId) => (dispatch, getState) => {
        dispatch(fileCollectionActions.updateCollectionMount({ name, mountId }));

        // Persist to localStorage
        const collections = getState().fileCollection.collections;
        try {
            localStorage.setItem('devpages-file-collections', JSON.stringify(collections));
        } catch (error) {
            console.error('[fileCollection] Failed to persist collections:', error);
        }
    },

    /**
     * Delete a collection and persist to localStorage
     */
    deleteCollectionAndPersist: (name) => (dispatch, getState) => {
        dispatch(fileCollectionActions.deleteCollection(name));

        // Persist to localStorage
        const collections = getState().fileCollection.collections;
        try {
            localStorage.setItem('devpages-file-collections', JSON.stringify(collections));
        } catch (error) {
            console.error('[fileCollection] Failed to persist collections:', error);
        }
    },

    /**
     * Rename file in server
     */
    renameFile: (dir, oldName, newName) => async (dispatch) => {
        dispatch(fileCollectionActions.setLoading(true));
        dispatch(fileCollectionActions.clearError());

        try {
            const response = await fetch('/api/files/rename', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ dir, oldName, newName })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to rename file: ${response.status}`);
            }

            const result = await response.json();
            dispatch(fileCollectionActions.setLoading(false));
            return result;
        } catch (error) {
            dispatch(fileCollectionActions.setError(error.message));
            dispatch(fileCollectionActions.setLoading(false));
            throw error;
        }
    },

    /**
     * Delete file from server
     */
    deleteFile: (dir, file) => async (dispatch) => {
        dispatch(fileCollectionActions.setLoading(true));
        dispatch(fileCollectionActions.clearError());

        try {
            const params = new URLSearchParams({ dir, file });
            const response = await fetch(`/api/files/delete?${params}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to delete file: ${response.status}`);
            }

            const result = await response.json();
            dispatch(fileCollectionActions.setLoading(false));
            return result;
        } catch (error) {
            dispatch(fileCollectionActions.setError(error.message));
            dispatch(fileCollectionActions.setLoading(false));
            throw error;
        }
    }
};

export default fileCollectionSlice.reducer;
