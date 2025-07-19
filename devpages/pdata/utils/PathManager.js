// pdata/utils/PathManager.js
import path from 'path';
import fs from 'fs-extra';

/**
 * PathManager - Handles path resolution, validation, and permission checks
 * for PData access with improved support for symlinks and flexible top directories.
 */
class PathManager {
    /**
     * Create a new PathManager
     * @param {Object} config - Configuration object
     * @param {string} config.dataRoot - Root directory for PData (PD_DIR)
     * @param {Map} config.roles - Map of username to role ('admin' or 'user')
     */
    constructor(config = {}) {
        this.dataRoot = config.dataRoot;
        if (!this.dataRoot) {
            throw new Error('PathManager requires dataRoot (PD_DIR) to be specified');
        }

        // Content root is dataRoot/data (effectively MD_DIR)
        this.contentRoot = path.join(this.dataRoot, 'data');
        this.uploadsDir = path.join(this.dataRoot, 'uploads');

        // Pre-compute common paths
        this.usersDir = path.join(this.contentRoot, 'users');
        this.projectsDir = path.join(this.contentRoot, 'projects');

        // Store user roles map
        this.roles = config.roles || new Map();

        // ADD THIS: Permissive symlinks flag - set to true to allow any symlink target
        this.permissiveSymlinks = true; // <-- SET THIS TO true TO ENABLE
        
        // Cache for user top directories
        this.userTopDirsCache = new Map();
    }

    /**
     * Reset the user top directory cache for a specific user or all users
     * @param {string} [username] - Username to reset, or all users if not specified
     */
    resetTopDirCache(username = null) {
        if (username) {
            this.userTopDirsCache.delete(username);
        } else {
            this.userTopDirsCache.clear();
        }
    }

    /**
     * Determine the top directory for a user
     * @param {string} username - User to find top directory for
     * @returns {Promise<{topDir: string, rootPath: string}>} The top directory name and full path
     */
    async findUserTopDir(username) {
        // Check cache first
        if (this.userTopDirsCache.has(username)) {
            return this.userTopDirsCache.get(username);
        }

        // Check both possible locations
        const userDir = path.join(this.usersDir, username);
        const projectDir = path.join(this.projectsDir, username);

        let topDir = null;
        let rootPath = null;

        // Prefer projects over users if both exist
        if (await this._dirExists(projectDir)) {
            topDir = `projects/${username}`;
            rootPath = projectDir;
        } else if (await this._dirExists(userDir)) {
            topDir = `users/${username}`;
            rootPath = userDir;
        } else {
            // Default to users directory if neither exists
            // This allows for creating a new user directory when needed
            topDir = `users/${username}`;
            rootPath = userDir;
        }

        const result = { topDir, rootPath };
        // Cache the result
        this.userTopDirsCache.set(username, result);
        return result;
    }

    /**
     * Check if a user has permission to perform an action on a resource
     * @param {string} username - Username to check
     * @param {string} action - Action type ('read', 'write', 'list', 'delete')
     * @param {string} resourcePath - Absolute path to resource
     * @param {boolean} [isSymlinkTarget=false] - Whether this path is a symlink target
     * @returns {Promise<boolean>} True if allowed, false otherwise
     */
    async can(username, action, resourcePath, isSymlinkTarget = false) {
        // Validate inputs
        if (!username || !this.roles.has(username)) {
            return false;
        }
        if (!path.isAbsolute(resourcePath)) {
            return false;
        }

        const role = this.roles.get(username);

        // Special case for uploads directory - allow access for all users
        if (resourcePath === this.uploadsDir || resourcePath.startsWith(this.uploadsDir + path.sep)) {
            return true;
        }

        // ADD THIS: Permissive symlinks check
        if (isSymlinkTarget && this.permissiveSymlinks) {
            // Allow read/list operations to any symlink target when permissive mode is enabled
            if (action === 'read' || action === 'list') {
                return true;
            }
            // For write operations, still require admin role for safety
            if ((action === 'write' || action === 'delete') && role === 'admin') {
                return true;
            }
        }
        
        // Admin role check
        if (role === 'admin') {
            // Admins can do anything within the application data root
            if (resourcePath.startsWith(this.dataRoot + path.sep) || resourcePath === this.dataRoot) {
                return true;
            }
            return false;
        }

        // Regular user role check
        if (role === 'user') {
            // Get the user's top directory
            const { rootPath: userTopDir } = await this.findUserTopDir(username);

            // Direct access to user's own directory
            if (resourcePath === userTopDir || resourcePath.startsWith(userTopDir + path.sep)) {
                return true;
            }

            // Symlink target permission check - looser for read, stricter for write
            if (isSymlinkTarget) {
                if (action === 'read' || action === 'list') {
                    // For reading through symlinks, allow if the target is within content root
                    if (resourcePath.startsWith(this.contentRoot + path.sep) || resourcePath === this.contentRoot) {
                        return true;
                    }
                } else if (action === 'write' || action === 'delete') {
                    // For writing through symlinks, only allow if target is in user's dir or uploads
                    if (resourcePath.startsWith(userTopDir + path.sep) || 
                        resourcePath === userTopDir ||
                        resourcePath.startsWith(this.uploadsDir + path.sep) ||
                        resourcePath === this.uploadsDir) {
                        return true;
                    }
                }
                return false;
            }

            // Check if the resource is within the content root (for non-symlink targets)
            if (resourcePath.startsWith(this.contentRoot + path.sep) || resourcePath === this.contentRoot) {
                // For read/list actions, allow access to top-level directories
                if (action === 'read' || action === 'list') {
                    const parentDir = path.dirname(resourcePath);
                    if (parentDir === this.contentRoot || 
                        parentDir === this.usersDir || 
                        parentDir === this.projectsDir) {
                        return true;
                    }
                }
            }
        }

        // Default deny
        return false;
    }

    /**
     * Resolve a relative path to an absolute path for a user
     * @param {string} username - Username
     * @param {string} inputPath - Relative path from client
     * @returns {Promise<string>} Absolute path
     * @throws {Error} If path is invalid or outside allowed scope
     */
    async resolvePathForUser(username, inputPath = '') {
        const userRole = this.roles.get(username);
        if (!userRole) {
            throw new Error(`User role not found for ${username}`);
        }

        // Normalize and sanitize the input path
        const normalizedClientPath = path.posix.normalize(inputPath || '.').replace(/^(\\.\\.[\\/\\\\])+/, '');

        // Special case for uploads directory
        if (normalizedClientPath === 'uploads' || normalizedClientPath.startsWith('uploads/')) {
            const uploadsPath = path.join(this.dataRoot, normalizedClientPath);
            return uploadsPath;
        }

        // Admin path resolution
        if (userRole === 'admin') {
            // Admin paths are relative to contentRoot (MD_DIR)
            const resolvedAdminPath = path.join(this.contentRoot, normalizedClientPath);

            // Security check to prevent path traversal
            const resolvedContentRoot = path.resolve(this.contentRoot);
            if (!path.resolve(resolvedAdminPath).startsWith(resolvedContentRoot + path.sep) && 
                path.resolve(resolvedAdminPath) !== resolvedContentRoot) {
                throw new Error('Security Violation: Path escape attempt detected.');
            }

            return resolvedAdminPath;
        }

        // Regular user path resolution
        const { topDir, rootPath: userRootOnFs } = await this.findUserTopDir(username);

        // Determine if this is a path to the user's root or within it
        let finalPathOnFs;

        // Handle paths like '.' or 'users/username' or 'projects/username'
        if (normalizedClientPath === '.' || normalizedClientPath === topDir) {
            finalPathOnFs = userRootOnFs;
        }
        // Handle paths that include the user's directory like 'users/username/notes' or 'projects/username/notes'
        else if (normalizedClientPath.startsWith(topDir + path.posix.sep)) {
            // Extract the part after topDir (e.g., 'notes' from 'users/username/notes')
            const relativePart = normalizedClientPath.substring(topDir.length + 1);
            finalPathOnFs = path.join(userRootOnFs, relativePart);
        }
        // Handle paths like 'username/notes' (legacy format)
        else if (normalizedClientPath.startsWith(username + path.posix.sep)) {
            // Extract the part after username (e.g., 'notes' from 'username/notes')
            const relativePart = normalizedClientPath.substring(username.length + 1);
            finalPathOnFs = path.join(userRootOnFs, relativePart);
        }
        // Handle paths like 'username' (legacy format)
        else if (normalizedClientPath === username) {
            finalPathOnFs = userRootOnFs;
        }
        else {
            throw new Error(`Access Denied: Path '${inputPath}' is invalid or outside your allowed directory.`);
        }

        // Final security check
        const resolvedFinalPath = path.resolve(finalPathOnFs);
        const resolvedUserRoot = path.resolve(userRootOnFs);
        if (!resolvedFinalPath.startsWith(resolvedUserRoot + path.sep) && resolvedFinalPath !== resolvedUserRoot) {
            throw new Error('Security Violation: Attempt to access path outside user scope.');
        }

        return finalPathOnFs;
    }

    /**
     * Handle symlink resolution and permission checking
     * @param {string} username - Username
     * @param {string} absolutePath - Absolute path of the symlink
     * @param {string} action - Action ('read', 'write', 'list', 'delete')
     * @returns {Promise<{isSymlink: boolean, targetPath: string|null, canAccess: boolean}>}
     */
    async resolveSymlink(username, absolutePath, action) {
        // Check if the path exists and is a symlink
        let isSymlink = false;
        let targetPath = null;
        let canAccess = false;

        try {
            const stats = await fs.lstat(absolutePath);

            if (stats.isSymbolicLink()) {
                isSymlink = true;

                // Get the target path
                const linkTarget = await fs.readlink(absolutePath);
                targetPath = path.resolve(path.dirname(absolutePath), linkTarget);

                // Check permissions on the target
                canAccess = await this.can(username, action, targetPath, true);
            }
        } catch (error) {
            // Path doesn't exist or can't be accessed
            isSymlink = false;
            targetPath = null;
            canAccess = false;
        }

        return { isSymlink, targetPath, canAccess };
    }

    /**
     * Get available top-level directories in the data root (e.g., ['projects', 'users'])
     * @returns {Promise<string[]>} Array of top-level directory names
     */
    async getAvailableTopDirs(username) {
        try {
            const entries = await fs.readdir(this.dataRoot, { withFileTypes: true });
            
            // Filter for directories AND symlinks that point to directories
            const validDirs = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    validDirs.push(entry.name);
                } else if (entry.isSymbolicLink()) {
                    // Check if symlink points to a directory
                    try {
                        const symlinkPath = path.join(this.dataRoot, entry.name);
                        const stats = await fs.stat(symlinkPath); // follows symlinks
                        if (stats.isDirectory()) {
                            validDirs.push(entry.name);
                        }
                    } catch (error) {
                        // Broken symlink, skip it
                        console.warn(`[PathManager] Skipping broken symlink: ${entry.name}`, error.message);
                    }
                }
            }
            
            console.log(`[PathManager] getAvailableTopDirs for ${username}: ${validDirs.join(', ')}`);
            return validDirs;
        } catch (error) {
            console.error('[PathManager] Error reading data root for top dirs:', error);
            return [];
        }
    }

    /**
     * Check if a directory exists
     * @param {string} dirPath - Directory path to check
     * @returns {Promise<boolean>} True if directory exists
     * @private
     */
    async _dirExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Read directory entries if it exists, otherwise return empty array
     * @param {string} dirPath - Directory to read
     * @returns {Promise<string[]>} Directory entries (excluding dot files)
     * @private
     */
    async _readDirIfExists(dirPath) {
        try {
            const entries = await fs.readdir(dirPath);
            return entries.filter(entry => !entry.startsWith('.'));
        } catch (error) {
            return [];
        }
    }
}

export { PathManager };