import path from 'path';
import fs from 'fs-extra';
import { PathManager } from './utils/PathManager.js';

/**
 * FileManager - Handles file operations, directory management, and permissions
 */
class FileManager {
    constructor(config = {}, userManager) {
        this.dataRoot = config.dataRoot;
        this.uploadsDir = config.uploadsDir;
        this.tempUploadsDir = config.tempUploadsDir;
        this.userManager = userManager;
        
        this.pathManager = new PathManager({
            dataRoot: this.dataRoot,
            roles: this.userManager.roles
        });
    }

    /**
     * Ensure user's home directory exists if they have valid roles
     */
    async ensureUserDirectory(username) {
        const userRoles = this.userManager.getUserRoles(username);
        if (userRoles.length === 0) {
            throw new Error(`No roles found for user '${username}'`);
        }

        const userHome = await this.pathManager.resolvePathForUser(username, '.');
        
        if (!await fs.pathExists(userHome)) {
            await fs.ensureDir(userHome);
            console.log(`[FileManager] Created user directory: ${userHome}`);
        }
        
        return userHome;
    }

    async listDirectory(username, relativePath = '') {
        // Ensure user's home directory exists if they're listing their root
        if (!relativePath || relativePath === '.' || relativePath === username) {
            await this.ensureUserDirectory(username);
        }

        const absolutePathToList = await this.pathManager.resolvePathForUser(username, relativePath);

        // Check if directory exists before trying to read it
        if (!await fs.pathExists(absolutePathToList)) {
            return { 
                dirs: [], 
                files: [], 
                message: `Directory '${relativePath || '/'}' does not exist.`,
                exists: false 
            };
        }

        if (!absolutePathToList.startsWith(this.uploadsDir) && !await this.pathManager.can(username, 'list', absolutePathToList)) {
            throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
        }

        const entries = await fs.readdir(absolutePathToList, { withFileTypes: true });
        const dirs = [], files = [];

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const entryAbsolutePath = path.join(absolutePathToList, entry.name);
            const checkAction = entry.isDirectory() || entry.isSymbolicLink() ? 'list' : 'read';

            if (await this.pathManager.can(username, checkAction, entryAbsolutePath)) {
                if (entry.isDirectory()) dirs.push(entry.name);
                else if (entry.isFile()) files.push(entry.name);
                else if (entry.isSymbolicLink()) {
                    const { canAccess } = await this.pathManager.resolveSymlink(username, entryAbsolutePath, checkAction);
                    if (canAccess) files.push(entry.name);
                }
            }
        }
        return { dirs: dirs.sort(), files: files.sort(), exists: true };
    }

    async readFile(username, relativePath) {
        if (!relativePath) throw new Error("File path is required.");
        const absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);

        if (!await this.pathManager.can(username, 'read', absolutePath)) {
            throw new Error(`Permission denied to read file '${relativePath}'.`);
        }
        
        const { isSymlink, targetPath, canAccess } = await this.pathManager.resolveSymlink(username, absolutePath, 'read');
        if (isSymlink) {
            if (!canAccess) throw new Error(`Permission denied to read symlink target for '${relativePath}'.`);
            return fs.readFile(targetPath, 'utf8');
        }
        if (!(await fs.lstat(absolutePath)).isFile()) throw new Error(`'${relativePath}' is not a readable file.`);
        return fs.readFile(absolutePath, 'utf8');
    }

    async writeFile(username, relativePath, content) {
        if (!relativePath) throw new Error("File path is required.");
        if (content === undefined) throw new Error("Content is required for writeFile.");

        const absoluteFilePath = await this.pathManager.resolvePathForUser(username, relativePath);
        
        const { isSymlink, targetPath, canAccess } = await this.pathManager.resolveSymlink(username, absoluteFilePath, 'write');
        
        if (isSymlink) {
            if (!canAccess) throw new Error(`Permission denied to write to symlink target for '${relativePath}'.`);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content, 'utf8');
            return true;
        }
        
        if (!await this.pathManager.can(username, 'write', absoluteFilePath)) {
            throw new Error(`Permission denied to write in directory '${path.dirname(relativePath)}'.`);
        }

        await fs.ensureDir(path.dirname(absoluteFilePath));
        await fs.writeFile(absoluteFilePath, content, 'utf8');
        return true;
    }

    async deleteFile(username, relativePath) {
        if (!relativePath) throw new Error("File path is required.");
        const absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);
        if (!await this.pathManager.can(username, 'delete', absolutePath)) {
            throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
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
        const absoluteSymlinkPath = await this.pathManager.resolvePathForUser(username, relativePath);
        if (!await this.pathManager.can(username, 'write', path.dirname(absoluteSymlinkPath))) {
            throw new Error(`Permission denied to create symlink in directory.`);
        }
        const absoluteTargetPath = await this.pathManager.resolvePathForUser(username, targetPath);
        const relativeTargetPath = path.relative(path.dirname(absoluteSymlinkPath), absoluteTargetPath);
        await fs.ensureDir(path.dirname(absoluteSymlinkPath));
        await fs.symlink(relativeTargetPath, absoluteSymlinkPath, 'file');
        return true;
    }

    /**
     * Get user's home directory information
     */
    async getUserHomeInfo(username) {
        const userRoles = this.userManager.getUserRoles(username);
        if (userRoles.length === 0) {
            throw new Error(`No roles found for user '${username}'`);
        }

        try {
            const homePath = await this.pathManager.resolvePathForUser(username, '.');
            const exists = await fs.pathExists(homePath);
            
            return {
                username,
                roles: userRoles,
                homePath,
                exists,
                relativePath: userRoles.includes('admin') ? '.' : `users/${username}`
            };
        } catch (error) {
            throw new Error(`Failed to get home directory for '${username}': ${error.message}`);
        }
    }
}

export { FileManager };