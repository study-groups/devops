// pdata/utils/PathManager.js
import path from 'path';
import fs from 'fs-extra';

class PathManager {
    constructor(config = {}) {
        this.dataRoot = config.dataRoot;
        if (!this.dataRoot) {
            throw new Error('PathManager requires dataRoot to be specified');
        }

        this.contentRoot = path.join(this.dataRoot, 'data');
        fs.ensureDirSync(this.contentRoot);
        this.usersDir = path.join(this.contentRoot, 'users');
        this.projectsDir = path.join(this.contentRoot, 'projects');

        this.roles = config.roles || new Map();
        this.systemRoots = config.systemRoots || {};
    }

    getUserHomeDirectory(username) {
        const projectDir = path.join(this.projectsDir, username);
        const userDir = path.join(this.usersDir, username);
        
        const projectExists = fs.existsSync(projectDir);
        const userExists = fs.existsSync(userDir);
        
        if (projectExists) {
            return { type: 'project', path: projectDir, exists: true };
        }
        if (userExists) {
            return { type: 'user', path: userDir, exists: true };
        }
        
        return { type: 'user', path: userDir, exists: false };
    }

    async can(username, action, resourcePath, isSymlinkTarget = false) {
        // Basic permission check - validate path is within allowed roots
        const normalizedPath = path.resolve(resourcePath);

        // Check if path is within contentRoot (main data directory)
        if (normalizedPath.startsWith(this.contentRoot)) {
            return true;
        }

        // Check if path is within any system root
        for (const [rootName, rootPath] of Object.entries(this.systemRoots)) {
            if (normalizedPath.startsWith(rootPath)) {
                return true;
            }
        }

        // Path is outside allowed boundaries
        return false;
    }

    async resolvePathForUser(username, inputPath = '') {
        // Handle virtual paths starting with ~
        if (inputPath && inputPath.startsWith('~')) {
            // This is a virtual path that should be handled by token-based resolution
            // For legacy username-based calls, we'll map to the data directory
            const virtualSegments = inputPath.split('/');
            const mountAlias = virtualSegments[0]; // e.g., '~data'
            const subPath = virtualSegments.slice(1).join('/');
            
            if (mountAlias === '~data') {
                return path.resolve(this.contentRoot, subPath);
            }
        }
        
        // Handle regular relative paths - resolve within user's data directory
        if (!inputPath || inputPath === '.' || inputPath === username) {
            return path.join(this.contentRoot, 'users', username);
        }
        
        // For other paths, check if it looks like a user path
        const pathSegments = inputPath.split('/').filter(s => s); // Remove empty segments
        const firstSegment = pathSegments[0];
        
        // If the path already starts with 'users/', resolve directly to contentRoot
        if (firstSegment === 'users') {
            return path.resolve(this.contentRoot, inputPath);
        }

        // If the first segment looks like a username (and exists in users dir), resolve to users directory
        const potentialUserPath = path.join(this.contentRoot, 'users', inputPath);
        const regularDataPath = path.resolve(this.contentRoot, inputPath);

        // Check if this could be a user path by seeing if users/firstSegment exists
        const userDirPath = path.join(this.contentRoot, 'users', firstSegment);
        if (fs.existsSync(userDirPath)) {
            return potentialUserPath;
        }

        // Otherwise, resolve relative to data root
        return regularDataPath;
    }

    async resolveSymlink(username, absolutePath, action) {
        try {
            const stats = await fs.lstat(absolutePath);

            if (stats.isSymbolicLink()) {
                const linkTarget = await fs.readlink(absolutePath);
                const targetPath = path.resolve(path.dirname(absolutePath), linkTarget);

                return {
                    isSymlink: true,
                    targetPath,
                    canAccess: true,
                    symlinkPath: absolutePath,
                    linkTarget: linkTarget
                };
            }
        } catch (error) {
            // Silently handle symlink resolution errors
        }

        return { isSymlink: false, targetPath: null, canAccess: true };
    }

    /**
     * UNIFIED MOUNTING: Check if a path is within a user's unified mount
     * This is used by token-based operations for consistency checking
     */
    isPathWithinMount(absolutePath, mountPath) {
        const normalizedPath = path.resolve(absolutePath);
        const normalizedMount = path.resolve(mountPath);
        return normalizedPath.startsWith(normalizedMount);
    }

    /**
     * UNIFIED MOUNTING: Validate that a token-resolved path is secure
     * Ensures path doesn't escape the mount boundaries
     */
    validateTokenPath(absolutePath, token) {
        // Get the mount root from the token
        const mountEntries = Object.entries(token.mounts);
        if (mountEntries.length === 0) {
            throw new Error('Token has no valid mounts');
        }

        // Check if path is within any of the token's mounts
        for (const [alias, mountPath] of mountEntries) {
            if (this.isPathWithinMount(absolutePath, mountPath)) {
                return true;
            }
        }

        throw new Error(`Path ${absolutePath} is outside allowed mount boundaries`);
    }

    async findUserTopDir(username) {
        const defaultPath = path.join(this.dataRoot, 'data', 'users', username);

        return {
            topDir: `users/${username}`,
            rootPath: defaultPath
        };
    }

    // Helper method to check directory existence
    async _dirExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }
}

export { PathManager };
