// pdata/utils/pathSecurity.js
// Path security and sanitization utilities

import path from 'path';

/**
 * Sanitize a user-provided path to prevent traversal attacks
 * @param {string} inputPath - The path to sanitize
 * @returns {string} - Sanitized path
 * @throws {Error} - If path contains dangerous patterns
 */
export function sanitizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
        throw new Error('Invalid path: must be a non-empty string');
    }

    // Prevent null bytes (path poisoning)
    if (inputPath.includes('\0')) {
        throw new Error('Invalid path: null bytes not allowed');
    }

    // Prevent path traversal sequences
    if (inputPath.includes('..')) {
        throw new Error('Path traversal is not allowed');
    }

    // Prevent absolute paths (unless it's a virtual path starting with ~)
    if (inputPath.startsWith('/') && !inputPath.startsWith('~')) {
        throw new Error('Invalid path: absolute paths not allowed');
    }

    // Prevent Windows absolute paths
    if (inputPath.match(/^[a-zA-Z]:/)) {
        throw new Error('Invalid path: Windows absolute paths not allowed');
    }

    // Prevent UNC paths
    if (inputPath.startsWith('\\\\') || inputPath.startsWith('//')){
        throw new Error('Invalid path: UNC paths not allowed');
    }

    // Normalize the path to prevent encoded traversal
    const normalized = path.normalize(inputPath);
    if (normalized.includes('..')) {
        throw new Error('Invalid path: normalized path contains parent references');
    }

    return normalized;
}

/**
 * Validate that a resolved absolute path is within an allowed root
 * @param {string} absolutePath - The absolute path to check
 * @param {string} allowedRoot - The root directory that must contain the path
 * @returns {boolean} - True if path is within root
 */
export function isWithinRoot(absolutePath, allowedRoot) {
    const normalized = path.resolve(absolutePath);
    const normalizedRoot = path.resolve(allowedRoot);

    return normalized.startsWith(normalizedRoot + path.sep) ||
           normalized === normalizedRoot;
}

/**
 * Safely join paths with validation
 * @param {string} root - The root directory
 * @param {string} userPath - The user-provided path
 * @returns {string} - Safely joined path
 * @throws {Error} - If result escapes root
 */
export function safeJoin(root, userPath) {
    const sanitized = sanitizePath(userPath);
    const joined = path.join(root, sanitized);
    const resolved = path.resolve(joined);

    if (!isWithinRoot(resolved, root)) {
        throw new Error('Path escape attempt detected');
    }

    return resolved;
}
