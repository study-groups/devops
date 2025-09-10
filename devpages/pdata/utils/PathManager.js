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
        this.symlinkLoggingEnabled = true; // Enable detailed symlink logging
        this.permissiveSymlinks = true; // Allow more flexible symlink handling
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
        // ULTRA PERMISSIVE MODE: Always return true
        console.log(`[ULTRA PERMISSIVE] Allowing access: User: ${username}, Action: ${action}, Path: ${resourcePath}`);
        return true;
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
                const resolvedPath = path.resolve(this.contentRoot, subPath);
                console.log(`[PathManager] Virtual path resolved: User: ${username}, Input: ${inputPath}, Resolved: ${resolvedPath}`);
                return resolvedPath;
            }
        }
        
        // Handle regular relative paths - resolve within user's data directory
        if (!inputPath || inputPath === '.' || inputPath === username) {
            const userPath = path.join(this.contentRoot, 'users', username);
            console.log(`[PathManager] User home resolved: User: ${username}, Input: ${inputPath}, Resolved: ${userPath}`);
            return userPath;
        }
        
        // For other paths, check if it looks like a user path
        const pathSegments = inputPath.split('/').filter(s => s); // Remove empty segments
        const firstSegment = pathSegments[0];
        
        // If the path already starts with 'users/', resolve directly to contentRoot
        if (firstSegment === 'users') {
            const regularDataPath = path.resolve(this.contentRoot, inputPath);
            console.log(`[PathManager] User path resolved: User: ${username}, Input: ${inputPath}, Resolved: ${regularDataPath}`);
            return regularDataPath;
        }
        
        // If the first segment looks like a username (and exists in users dir), resolve to users directory
        const potentialUserPath = path.join(this.contentRoot, 'users', inputPath);
        const regularDataPath = path.resolve(this.contentRoot, inputPath);
        
        // Check if this could be a user path by seeing if users/firstSegment exists
        const userDirPath = path.join(this.contentRoot, 'users', firstSegment);
        if (fs.existsSync(userDirPath)) {
            console.log(`[PathManager] User path resolved: User: ${username}, Input: ${inputPath}, Resolved: ${potentialUserPath}`);
            return potentialUserPath;
        }
        
        // Otherwise, resolve relative to data root
        console.log(`[PathManager] Data path resolved: User: ${username}, Input: ${inputPath}, Resolved: ${regularDataPath}`);
        return regularDataPath;
    }

    async resolveSymlink(username, absolutePath, action) {
        try {
            const stats = await fs.lstat(absolutePath);
            
            if (stats.isSymbolicLink()) {
                const linkTarget = await fs.readlink(absolutePath);
                const targetPath = path.resolve(path.dirname(absolutePath), linkTarget);
                
                console.log(`[ULTRA PERMISSIVE] Symlink resolution: 
                    User: ${username}
                    Symlink: ${absolutePath}
                    Target: ${targetPath}
                    Action: ${action}`);

                return { 
                    isSymlink: true, 
                    targetPath, 
                    canAccess: true,
                    symlinkPath: absolutePath,
                    linkTarget: linkTarget
                };
            }
        } catch (error) {
            console.warn(`[ULTRA PERMISSIVE] Symlink resolution warning: ${error.message}`);
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
        // Always return a default path
        const defaultPath = path.join(this.dataRoot, 'data', 'users', username);
        console.log(`[ULTRA PERMISSIVE] Finding user top dir: User: ${username}, Path: ${defaultPath}`);
        
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
