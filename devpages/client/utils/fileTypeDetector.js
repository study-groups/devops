/**
 * fileTypeDetector.js - Detects file types and provides metadata
 */

/**
 * Detect file type from pathname
 * @param {string} pathname - File path
 * @returns {Object} File type info
 */
export function detectFileType(pathname) {
    if (!pathname) {
        return {
            type: 'unknown',
            extension: '',
            icon: '📄',
            label: 'Unknown',
            supportsPreview: false
        };
    }

    const ext = pathname.split('.').pop().toLowerCase();

    const typeMap = {
        'md': {
            type: 'markdown',
            extension: 'md',
            icon: '📝',
            label: 'Markdown',
            supportsPreview: true,
            editorMode: 'markdown'
        },
        'html': {
            type: 'html',
            extension: 'html',
            icon: '🌐',
            label: 'HTML',
            supportsPreview: true,
            editorMode: 'html',
            supportsSections: true
        },
        'htm': {
            type: 'html',
            extension: 'html',
            icon: '🌐',
            label: 'HTML',
            supportsPreview: true,
            editorMode: 'html',
            supportsSections: true
        },
        'css': {
            type: 'css',
            extension: 'css',
            icon: '🎨',
            label: 'CSS',
            supportsPreview: false,
            editorMode: 'css'
        },
        'js': {
            type: 'javascript',
            extension: 'js',
            icon: '⚡',
            label: 'JavaScript',
            supportsPreview: true,
            supportsAstPreview: true,
            editorMode: 'javascript'
        },
        'mjs': {
            type: 'javascript',
            extension: 'mjs',
            icon: '⚡',
            label: 'JavaScript (ES Module)',
            supportsPreview: true,
            supportsAstPreview: true,
            editorMode: 'javascript'
        },
        'json': {
            type: 'json',
            extension: 'json',
            icon: '📋',
            label: 'JSON',
            supportsPreview: false,
            editorMode: 'json'
        },
        'txt': {
            type: 'text',
            extension: 'txt',
            icon: '📄',
            label: 'Text',
            supportsPreview: false,
            editorMode: 'text'
        }
    };

    return typeMap[ext] || {
        type: 'unknown',
        extension: ext,
        icon: '📄',
        label: ext.toUpperCase(),
        supportsPreview: false,
        editorMode: 'text'
    };
}

/**
 * Check if file type supports preview
 * @param {string} pathname - File path
 * @returns {boolean}
 */
export function supportsPreview(pathname) {
    const fileType = detectFileType(pathname);
    return fileType.supportsPreview;
}

/**
 * Check if file type supports sections mode
 * @param {string} pathname - File path
 * @returns {boolean}
 */
export function supportsSectionsMode(pathname) {
    const fileType = detectFileType(pathname);
    return fileType.supportsSections === true;
}

/**
 * Check if file type supports AST preview
 * @param {string} pathname - File path
 * @returns {boolean}
 */
export function supportsAstPreview(pathname) {
    const fileType = detectFileType(pathname);
    return fileType.supportsAstPreview === true;
}
