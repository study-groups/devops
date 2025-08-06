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
        this.permissiveSymlinks = true;
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

    async can(username, action, resourcePath) {
        if (!username || !this.roles.has(username)) return false;
        if (!path.isAbsolute(resourcePath)) return false;

        const userRoles = this.roles.get(username) || [];
        if (userRoles.includes('admin')) return true;

        const userTopDir = path.join(this.usersDir, username);
        if (resourcePath.startsWith(userTopDir)) return true;
        
        for (const rootPath of Object.values(this.systemRoots)) {
            if (resourcePath.startsWith(rootPath)) {
                return true; // Simplified for now; could be more granular
            }
        }
        
        if (action === 'read' || action === 'list') {
            const stats = await fs.lstat(resourcePath);
            if (stats.isSymbolicLink()) {
                const linkTarget = await fs.readlink(resourcePath);
                const targetPath = path.resolve(path.dirname(resourcePath), linkTarget);
                return this.can(username, action, targetPath);
            }
            if (resourcePath.startsWith(this.contentRoot)) {
                return true;
            }
        }

        return false;
    }

    async resolvePathForUser(username, inputPath = '') {
        const userRoles = this.roles.get(username);
        if (!userRoles || userRoles.length === 0) {
            throw new Error(`User roles not found for ${username}`);
        }

        const normalizedClientPath = path.posix.normalize(inputPath || '.').replace(/\\.\\.[\\/\\\\]+/g, '');

        if (userRoles.includes('admin')) {
            const resolvedPath = path.join(this.contentRoot, normalizedClientPath);
            if (!path.resolve(resolvedPath).startsWith(path.resolve(this.contentRoot))) {
                throw new Error('Security Violation: Path escape attempt detected.');
            }
            return resolvedPath;
        }

        const userRootOnFs = path.join(this.usersDir, username);
        let finalPathOnFs;

        if ([`.`, username].includes(normalizedClientPath)) {
            finalPathOnFs = userRootOnFs;
        } else if (normalizedClientPath.startsWith(`${username}/`)) {
            finalPathOnFs = path.join(userRootOnFs, normalizedClientPath.substring(username.length + 1));
        } else if (this.systemRoots[normalizedClientPath]) {
            finalPathOnFs = this.systemRoots[normalizedClientPath];
        } else {
            const potentialPath = path.join(this.contentRoot, normalizedClientPath);
            if(!fs.existsSync(potentialPath)){
               throw new Error(`Access Denied: Path '${inputPath}' is invalid or outside your allowed directory.`);
            }
            finalPathOnFs = potentialPath;
        }

        const isSystemRootPath = Object.values(this.systemRoots).some(root => path.resolve(finalPathOnFs).startsWith(path.resolve(root)));

        if (!path.resolve(finalPathOnFs).startsWith(path.resolve(this.contentRoot)) && !isSystemRootPath) {
            throw new Error('Security Violation: Attempt to access path outside user scope.');
        }

        return finalPathOnFs;
    }

    async resolveSymlink(username, absolutePath, action) {
        try {
            const stats = await fs.lstat(absolutePath);
            if (stats.isSymbolicLink()) {
                const linkTarget = await fs.readlink(absolutePath);
                const targetPath = path.resolve(path.dirname(absolutePath), linkTarget);
                const canAccess = await this.can(username, action, targetPath);
                return { isSymlink: true, targetPath, canAccess };
            }
        } catch (error) {
            // ignore error
        }
        return { isSymlink: false, targetPath: null, canAccess: false };
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
}

export { PathManager };
