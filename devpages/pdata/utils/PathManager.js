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
        this.uploadsDir = path.join(this.dataRoot, 'uploads');
        this.usersDir = path.join(this.contentRoot, 'users');
        this.projectsDir = path.join(this.contentRoot, 'projects');

        this.roles = config.roles || new Map();
        this.permissiveSymlinks = true;
    }

    async can(username, action, resourcePath) {
        if (!username || !this.roles.has(username)) return false;
        if (!path.isAbsolute(resourcePath)) return false;

        const userRoles = this.roles.get(username) || [];
        if (userRoles.includes('admin')) return true;

        // Standard user permissions
        const userTopDir = path.join(this.usersDir, username);
        if (resourcePath.startsWith(userTopDir)) return true;
        
        // Allow reading/listing from uploads directory
        if ((action === 'read' || action === 'list') && resourcePath.startsWith(this.uploadsDir)) {
            return true;
        }
        
        // Allow reading from anywhere inside the content root if it's a symlink
        if (action === 'read' || action === 'list') {
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

        // Standard user path resolution
        const userRootOnFs = path.join(this.usersDir, username);
        let finalPathOnFs;

        if ([`.`, username].includes(normalizedClientPath)) {
            finalPathOnFs = userRootOnFs;
        } else if (normalizedClientPath.startsWith(`${username}/`)) {
            finalPathOnFs = path.join(userRootOnFs, normalizedClientPath.substring(username.length + 1));
        } else {
             // Special case for uploads directory
             if (normalizedClientPath === 'uploads') {
                 finalPathOnFs = this.uploadsDir;
             } else {
                 // For non-admins, if a path doesn't start with their username, check if it's a valid top-level shared dir
                 const potentialPath = path.join(this.contentRoot, normalizedClientPath);
                 if(!fs.existsSync(potentialPath)){
                    throw new Error(`Access Denied: Path '${inputPath}' is invalid or outside your allowed directory.`);
                 }
                 finalPathOnFs = potentialPath;
             }
        }

        if (!path.resolve(finalPathOnFs).startsWith(path.resolve(this.contentRoot)) && 
            !path.resolve(finalPathOnFs).startsWith(path.resolve(this.uploadsDir))) {
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
}

export { PathManager };
