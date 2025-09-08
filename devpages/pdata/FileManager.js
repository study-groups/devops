import path from 'path';
import fs from 'fs-extra';
import { PathManager } from './utils/PathManager.js';

class FileManager {
    constructor(config = {}, userManager, capabilityManager, authSrv) {
        this.dataRoot = config.dataRoot;
        this.uploadsDir = config.uploadsDir;
        this.tempUploadsDir = config.tempUploadsDir;
        this.userManager = userManager;
        this.capabilityManager = capabilityManager;
        this.authSrv = authSrv;

        this.pathManager = new PathManager({
            dataRoot: this.dataRoot,
            roles: this.userManager.roles,
            systemRoots: config.systemRoots || {}
        });
    }

    _resolveVirtualPath(token, virtualPath) {
        if (!virtualPath.startsWith('~')) {
            // This is not a virtual path, return as is for legacy handling.
            return virtualPath;
        }
    
        const segments = virtualPath.split('/');
        const mountAlias = segments[0]; // e.g., '~data'
    
        if (token.mounts && token.mounts[mountAlias]) {
            const mountPoint = token.mounts[mountAlias];
            const subPath = segments.slice(1).join('/');
            const resolvedPath = path.resolve(path.join(mountPoint, subPath));
    
            // Security check: ensure the resolved path is within the mount point
            if (!resolvedPath.startsWith(mountPoint)) {
                throw new Error(`Path escape attempt detected in virtual path: ${virtualPath}`);
            }
            return resolvedPath;
        }
    
        throw new Error(`Unknown mount alias '${mountAlias}' in path '${virtualPath}'`);
    }

    async ensureUserDirectory(username) {
        const userRoles = this.userManager.getUserRoles(username);
        if (userRoles.length === 0) {
            throw new Error(`No roles found for user '${username}'`);
        }
        const userHome = await this.pathManager.resolvePathForUser(username, '.');
        if (!await fs.pathExists(userHome)) {
            await fs.ensureDir(userHome);
        }
        return userHome;
    }

    async listDirectory(subject, relativePath = '') {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;

        let absolutePathToList;

        if (isToken) {
            // UNIFIED MOUNTING: Use token-based namespace resolution
            try {
                absolutePathToList = this._resolveVirtualPath(subject, relativePath);
            } catch (error) {
                throw new Error(`Invalid path '${relativePath}': ${error.message}`);
            }

            // For capability checking, convert empty path to appropriate mount alias
            let capabilityPath = relativePath;
            if (!relativePath || relativePath === '.' || relativePath === '/') {
                // User is accessing their mount root - default to their home mount
                const userHomeMounts = Object.keys(subject.mounts).filter(m => m.startsWith('~/data/'));
                if (userHomeMounts.length > 0) {
                    capabilityPath = userHomeMounts[0] + '/'; // Use user-specific mount
                } else {
                    // Fallback to ~data for userspace access
                    capabilityPath = '~data/';
                }
            } else if (!relativePath.startsWith('~')) {
                // For relative paths, check if it should map to user's home or general data
                const userHomeMounts = Object.keys(subject.mounts).filter(m => m.startsWith('~/data/'));
                if (userHomeMounts.length > 0) {
                    // Map to user's specific home directory
                    capabilityPath = userHomeMounts[0] + '/' + relativePath;
                } else {
                    // Map to general data access
                    capabilityPath = '~data/' + relativePath;
                }
            }

            if (!this.authSrv.tokenHasCap(subject, 'list', capabilityPath)) {
                throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
            }
        } else {
            // Legacy username-based resolution (fallback)
            if (!relativePath || relativePath === '.' || relativePath === username) {
                await this.ensureUserDirectory(username);
            }

            absolutePathToList = await this.pathManager.resolvePathForUser(username, relativePath);
            
            if (!await this.pathManager.can(username, 'list', absolutePathToList)) {
                throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
            }
        }
        
        if (!await fs.pathExists(absolutePathToList)) {
            return { dirs: [], files: [], message: `Directory '${relativePath || '/'}' does not exist.`, exists: false };
        }

        const entries = await fs.readdir(absolutePathToList, { withFileTypes: true });
        const dirs = [], files = [];

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const entryAbsolutePath = path.join(absolutePathToList, entry.name);
            
            // Treat symlinks as normal files/directories based on what they point to
            let isDirectory = entry.isDirectory();
            let isFile = entry.isFile();
            
            if (entry.isSymbolicLink()) {
                try {
                    // Follow the symlink to determine its type
                    const stats = await fs.stat(entryAbsolutePath);
                    isDirectory = stats.isDirectory();
                    isFile = stats.isFile();
                } catch (error) {
                    // If symlink is broken, treat as file for listing purposes
                    isFile = true;
                }
            }
            
            const checkAction = isDirectory ? 'list' : 'read';

            if (isToken) {
                const entryRelativePath = path.join(relativePath, entry.name);
                console.log(`[FileManager] Checking capability: user='${subject.username}', action='${checkAction}', path='${entryRelativePath}', entry='${entry.name}'`);
                console.log(`[FileManager] User capabilities:`, subject.caps);
                const hasCapability = this.authSrv.tokenHasCap(subject, checkAction, entryRelativePath);
                console.log(`[FileManager] Capability check result: ${hasCapability}`);
                if (hasCapability) {
                    if (isDirectory) dirs.push(entry.name);
                    else if (isFile) files.push(entry.name);
                }
            } else {
                if (await this.pathManager.can(username, checkAction, entryAbsolutePath)) {
                    if (isDirectory) dirs.push(entry.name);
                    else if (isFile) files.push(entry.name);
                }
            }
        }
        return { dirs: dirs.sort(), files: files.sort(), exists: true };
    }

    async readFile(subject, relativePath) {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;
        if (!relativePath) throw new Error("File path is required.");

        // Resolve path using PathManager
        const absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);
        
        try {
            // fs.readFile automatically follows symlinks, so we don't need special handling
            const content = await fs.readFile(absolutePath, 'utf8');
            
            console.log(`[FileManager] File read: User: ${username}, Path: ${absolutePath}`);
            return content;
        } catch (error) {
            console.warn(`[FileManager] File read error: ${error.message}`);
            throw error;
        }
    }

    async writeFile(subject, relativePath, content) {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;
        if (!relativePath) throw new Error("File path is required.");
        if (content === undefined) throw new Error("Content is required for writeFile.");

        // Resolve path using PathManager
        const absoluteFilePath = await this.pathManager.resolvePathForUser(username, relativePath);
        
        try {
            // Ensure directory exists
            await fs.ensureDir(path.dirname(absoluteFilePath));
            
            // fs.writeFile automatically follows symlinks, so we don't need special handling
            await fs.writeFile(absoluteFilePath, content, 'utf8');
            
            console.log(`[FileManager] File written: User: ${username}, Path: ${absoluteFilePath}`);
            return true;
        } catch (error) {
            console.warn(`[FileManager] File write error: ${error.message}`);
            throw error;
        }
    }

    async deleteFile(subject, relativePath) {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;
        if (!relativePath) throw new Error("File path is required.");

        let absolutePath;

        if (isToken) {
            // UNIFIED MOUNTING: Use token-based namespace resolution
            try {
                absolutePath = this._resolveVirtualPath(subject, relativePath);
            } catch (error) {
                throw new Error(`Invalid path '${relativePath}': ${error.message}`);
            }

            // For capability checking, ensure proper path format for three-tier system
            let capabilityPath = relativePath;
            if (!relativePath || relativePath === '.' || relativePath === '/') {
                // Convert to mount alias with trailing slash if accessing root
                const userHomeMounts = Object.keys(subject.mounts).filter(m => m.startsWith('~/data/'));
                if (userHomeMounts.length > 0) {
                    capabilityPath = userHomeMounts[0] + '/';
                } else {
                    capabilityPath = '~data/';
                }
            } else if (!relativePath.startsWith('~')) {
                // For relative paths, prepend the appropriate mount alias
                const userHomeMounts = Object.keys(subject.mounts).filter(m => m.startsWith('~/data/'));
                if (userHomeMounts.length > 0) {
                    capabilityPath = userHomeMounts[0] + '/' + relativePath;
                } else {
                    capabilityPath = '~data/' + relativePath;
                }
            }

            if (!this.authSrv.tokenHasCap(subject, 'delete', capabilityPath)) {
                throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
            }
        } else {
            // Legacy username-based resolution (fallback)
            absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);

            if (!await this.pathManager.can(username, 'delete', absolutePath)) {
                throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
            }
        }
        
        await fs.remove(absolutePath);
        return true;
    }

    async handleUpload(file) {
        if (!file) throw new Error('File object is required.');
        const destinationPath = path.join(this.uploadsDir, `${Date.now()}-${file.originalname}`);
        await fs.move(file.path, destinationPath);
        return `/uploads/${path.basename(destinationPath)}`;
    }

    async createSymlink(username, relativePath, targetPath) {
        if (!relativePath || !targetPath) throw new Error("Source and target paths are required.");
        
        // Validate input paths
        if (relativePath.includes('..') || targetPath.includes('..')) {
            throw new Error("Path traversal is not allowed.");
        }

        // Resolve absolute paths
        const absoluteSymlinkPath = await this.pathManager.resolvePathForUser(username, relativePath);
        const absoluteTargetPath = await this.pathManager.resolvePathForUser(username, targetPath);
        
        // Create relative symlink for better portability
        const symlinkDir = path.dirname(absoluteSymlinkPath);
        const relativeTargetPath = path.relative(symlinkDir, absoluteTargetPath);
        
        try {
            // Ensure the symlink directory exists
            await fs.ensureDir(symlinkDir);

            // Remove existing symlink if it exists
            try {
                await fs.unlink(absoluteSymlinkPath);
            } catch (unlinkError) {
                // Ignore if file doesn't exist
                if (unlinkError.code !== 'ENOENT') {
                    console.warn(`[FileManager] Symlink unlink warning: ${unlinkError.message}`);
                }
            }

            // Create new symlink
            await fs.symlink(relativeTargetPath, absoluteSymlinkPath, 'file');
            
            console.log(`[FileManager] Symlink created: User: ${username}, Symlink: ${absoluteSymlinkPath}, Target: ${absoluteTargetPath}`);
            return true;
        } catch (error) {
            console.warn(`[FileManager] Symlink creation error: ${error.message}`);
            throw error;
        }
    }

    async getUserHomeInfo(username) {
        const userRoles = this.userManager.getUserRoles(username);
        if (userRoles.length === 0) {
            throw new Error(`No roles found for user '${username}'`);
        }
        const homePath = await this.pathManager.resolvePathForUser(username, '.');
        const exists = await fs.pathExists(homePath);
        return {
            username,
            roles: userRoles,
            homePath,
            exists,
            relativePath: userRoles.includes('admin') ? '.' : `users/${username}`
        };
    }
}

export { FileManager };
