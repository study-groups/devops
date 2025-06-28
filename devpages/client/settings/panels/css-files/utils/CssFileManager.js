/**
 * client/settings/panels/css-files/utils/CssFileManager.js
 * CSS file management utilities for toggling, viewing, and content operations
 */

export class CssFileManager {
    constructor() {
        this.cssFiles = new Map();
        this.cache = new Map();
    }

    /**
     * Set the current CSS files map
     * @param {Map} cssFiles - CSS files map
     */
    setCssFiles(cssFiles) {
        this.cssFiles = cssFiles;
    }

    /**
     * Toggle a CSS file's enabled/disabled state
     * @param {string} href - File href
     * @param {boolean} enabled - Whether to enable the file
     * @returns {boolean} Success status
     */
    toggleCssFile(href, enabled) {
        try {
            const cssFile = this.cssFiles.get(href);
            if (!cssFile) {
                console.warn('[CssFileManager] CSS file not found:', href);
                return false;
            }

            if (cssFile.type === 'external') {
                const link = document.querySelector(`link[href="${href}"]`);
                if (link) {
                    link.disabled = !enabled;
                    cssFile.disabled = !enabled;
                    console.log(`[CssFileManager] ${enabled ? 'Enabled' : 'Disabled'} CSS file:`, href);
                    return true;
                }
            } else if (cssFile.type === 'inline') {
                const style = cssFile.element;
                if (style) {
        const file = this.cssFiles.get(href);
        if (file && file.element) {
            file.element.disabled = !enabled;
            file.enabled = enabled;
            console.log(`[CssFileManager] Toggled ${href} to ${enabled ? 'enabled' : 'disabled'}`);
            return true;
        }
        console.warn(`[CssFileManager] File not found for toggle: ${href}`);
        return false;
    }

    /**
     * Fetch and return a CSS file's content
     * @param {string} href - File href
     * @returns {Promise<Object>} Object with content, title, and success status
     */
    async fetchCssFileContent(href) {
        const file = this.cssFiles.get(href);
        let content = '';
        let title = href;
        let success = true;

        if (!file) {
            return {
                content: 'Error: File not found in tracked stylesheets.',
                title: 'Error',
                success: false
            };
        }

        if (file.type === 'inline') {
            content = file.element.textContent;
            title = `Inline Style: ${file.id}`;
        } else {
            try {
                const response = await fetch(href);
                if (response.ok) {
                    content = await response.text();
                } else {
                    content = `Error: Could not fetch stylesheet. Status: ${response.status}`;
                    success = false;
                }
            } catch (error) {
                content = `Error: Could not fetch stylesheet. ${error.message}`;
                success = false;
            }
        }

        return { content, title, success };
    }

    /**
     * Get file information by href
     * @param {string} href - File href
     * @returns {Object|null} File information or null if not found
     */
    getFileInfo(href) {
        return this.cssFiles.get(href) || null;
    }

    /**
     * Check if a file exists in the collection
     * @param {string} href - File href
     * @returns {boolean} True if file exists
     */
    hasFile(href) {
        return this.cssFiles.has(href);
    }

    /**
     * Get all files as an array
     * @returns {Array} Array of [href, file] pairs
     */
    getAllFiles() {
        return Array.from(this.cssFiles.entries());
    }

    /**
     * Get files by type
     * @param {string} type - File type ('theme', 'system', 'other')
     * @returns {Array} Array of [href, file] pairs
     */
    getFilesByType(type) {
        return this.getAllFiles().filter(([href, file]) => {
            switch (type) {
                case 'theme':
                    return file.isTheme;
                case 'system':
                    return file.isSystem;
                case 'other':
                    return !file.isTheme && !file.isSystem;
                default:
                    return false;
            }
        });
    }

    /**
     * Get enabled/disabled files
     * @param {boolean} enabled - Whether to get enabled or disabled files
     * @returns {Array} Array of [href, file] pairs
     */
    getFilesByStatus(enabled) {
        return this.getAllFiles().filter(([href, file]) => file.enabled === enabled);
    }

    /**
     * Search files by path/name
     * @param {string} query - Search query
     * @returns {Array} Array of matching [href, file] pairs
     */
    searchFiles(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllFiles().filter(([href, file]) => {
            const path = file.type === 'link' ? new URL(file.href).pathname : file.href;
            return path.toLowerCase().includes(lowerQuery);
        });
    }

    /**
     * Get total size of all CSS files (where known)
     * @returns {Object} Size information
     */
    getTotalSize() {
        const files = Array.from(this.cssFiles.values());
        const knownSizes = files.filter(f => typeof f.size === 'number');
        const totalBytes = knownSizes.reduce((sum, f) => sum + f.size, 0);
        
        return {
            totalFiles: files.length,
            filesWithKnownSize: knownSizes.length,
            totalBytes: totalBytes,
            totalKB: Math.round(totalBytes / 1024 * 100) / 100,
            averageKB: knownSizes.length > 0 ? Math.round(totalBytes / knownSizes.length / 1024 * 100) / 100 : 0
        };
    }

    /**
     * Validate and clean up CSS files collection
     * Removes files whose elements are no longer in the DOM
     * @returns {number} Number of files removed
     */
    cleanupInvalidFiles() {
        let removedCount = 0;
        const toRemove = [];

        this.cssFiles.forEach((file, href) => {
            if (file.element && !document.contains(file.element)) {
                toRemove.push(href);
            }
        });

        toRemove.forEach(href => {
            this.cssFiles.delete(href);
            removedCount++;
        });

        if (removedCount > 0) {
            console.log(`[CssFileManager] Cleaned up ${removedCount} invalid file references`);
        }

        return removedCount;
    }

    /**
     * Get file statistics by category
     * @returns {Object} Statistics object
     */
    getFileStatistics() {
        const files = Array.from(this.cssFiles.values());
        
        return {
            total: files.length,
            byType: {
                theme: files.filter(f => f.isTheme).length,
                system: files.filter(f => f.isSystem).length,
                other: files.filter(f => !f.isTheme && !f.isSystem).length
            },
            byFormat: {
                linked: files.filter(f => f.type === 'link').length,
                inline: files.filter(f => f.type === 'inline').length
            },
            byStatus: {
                enabled: files.filter(f => f.enabled).length,
                disabled: files.filter(f => !f.enabled).length
            },
            sizes: this.getTotalSize()
        };
    }

    /**
     * Export CSS files information to JSON
     * @param {boolean} includeContent - Whether to include file content
     * @returns {Object} Exportable data
     */
    async exportToJson(includeContent = false) {
        const files = [];
        
        for (const [href, file] of this.cssFiles.entries()) {
            const fileData = {
                href: file.href,
                id: file.id,
                type: file.type,
                enabled: file.enabled,
                isSystem: file.isSystem,
                isTheme: file.isTheme,
                size: file.size,
                loadTime: file.loadTime
            };

            if (includeContent) {
                try {
                    const { content } = await this.fetchCssFileContent(href);
                    fileData.content = content;
                } catch (error) {
                    fileData.content = `Error loading content: ${error.message}`;
                }
            }

            files.push(fileData);
        }

        return {
            exportDate: new Date().toISOString(),
            totalFiles: files.length,
            statistics: this.getFileStatistics(),
            files: files
        };
    }

    /**
     * Create a backup of current CSS states
     * @returns {Object} Backup data
     */
    createBackup() {
        const backup = {
            timestamp: Date.now(),
            files: []
        };

        this.cssFiles.forEach((file, href) => {
            backup.files.push({
                href: file.href,
                enabled: file.enabled,
                type: file.type,
                isSystem: file.isSystem,
                isTheme: file.isTheme
            });
        });

        return backup;
    }

    /**
     * Restore CSS states from backup
     * @param {Object} backup - Backup data
     * @returns {Object} Restoration results
     */
    restoreBackup(backup) {
        const results = {
            totalAttempted: 0,
            successful: 0,
            failed: 0,
            notFound: []
        };

        if (!backup || !backup.files) {
            throw new Error('Invalid backup data');
        }

        backup.files.forEach(backupFile => {
            results.totalAttempted++;
            
            if (this.hasFile(backupFile.href)) {
                const success = this.toggleCssFile(backupFile.href, backupFile.enabled);
                if (success) {
                    results.successful++;
                } else {
                    results.failed++;
                }
            } else {
                results.notFound.push(backupFile.href);
                results.failed++;
            }
        });

        console.log(`[CssFileManager] Backup restoration completed:`, results);
        return results;
    }
} 