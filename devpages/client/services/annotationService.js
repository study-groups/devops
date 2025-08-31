/**
 * annotationService.js - A centralized service for managing annotations on Redux state.
 *
 * This service provides a simple key-value store for annotations, persisting them
 * to localStorage. This allows developers to add notes or comments to specific
 * parts of the Redux state for debugging purposes.
 */

class AnnotationService {
    constructor(storageKey = 'devpages_redux_annotations') {
        this.storageKey = storageKey;
        this.annotations = this.loadAnnotations();
    }

    /**
     * Load annotations from localStorage.
     * @returns {object} The parsed annotations object.
     */
    loadAnnotations() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('[AnnotationService] Failed to load annotations:', error);
            return {};
        }
    }

    /**
     * Save the current annotations to localStorage.
     */
    saveAnnotations() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.annotations));
        } catch (error) {
            console.error('[AnnotationService] Failed to save annotations:', error);
        }
    }

    /**
     * Get all annotations.
     * @returns {object} The current annotations.
     */
    getAnnotations() {
        return this.annotations;
    }

    /**
     * Get a specific annotation by its key.
     * @param {string} key - The key for the annotation (e.g., 'sliceName.key').
     * @returns {string|undefined} The annotation text.
     */
    getAnnotation(key) {
        return this.annotations[key];
    }

    /**
     * Set or update an annotation.
     * @param {string} key - The key for the annotation.
     * @param {string} value - The annotation text.
     */
    setAnnotation(key, value) {
        if (value) {
            this.annotations[key] = value;
        } else {
            delete this.annotations[key];
        }
        this.saveAnnotations();
    }

    /**
     * Remove an annotation.
     * @param {string} key - The key of the annotation to remove.
     */
    removeAnnotation(key) {
        delete this.annotations[key];
        this.saveAnnotations();
    }
}

// Export a singleton instance of the service
export const annotationService = new AnnotationService();
