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

        if (!relativePath || relativePath === '.' || relativePath === username) {
            await this.ensureUserDirectory(username);
        }

        const absolutePathToList = await this.pathManager.resolvePathForUser(username, relativePath);
        
        if (!await fs.pathExists(absolutePathToList)) {
            return { dirs: [], files: [], message: `Directory '${relativePath || '/'}' does not exist.`, exists: false };
        }

        if (isToken) {
            if (!this.authSrv.tokenHasCap(subject, 'list', relativePath)) {
                throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
            }
        } else {
            if (!await this.pathManager.can(username, 'list', absolutePathToList)) {
                throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
            }
        }

        const entries = await fs.readdir(absolutePathToList, { withFileTypes: true });
        const dirs = [], files = [];

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const entryAbsolutePath = path.join(absolutePathToList, entry.name);
            const checkAction = entry.isDirectory() || entry.isSymbolicLink() ? 'list' : 'read';

            if (isToken) {
                const entryRelativePath = path.join(relativePath, entry.name);
                if (this.authSrv.tokenHasCap(subject, checkAction, entryRelativePath)) {
                    if (entry.isDirectory()) dirs.push(entry.name);
                    else if (entry.isFile() || entry.isSymbolicLink()) files.push(entry.name);
                }
            } else {
                if (await this.pathManager.can(username, checkAction, entryAbsolutePath)) {
                    if (entry.isDirectory()) dirs.push(entry.name);
                    else if (entry.isFile()) files.push(entry.name);
                    else if (entry.isSymbolicLink()) {
                        const { canAccess } = await this.pathManager.resolveSymlink(username, entryAbsolutePath, checkAction);
                        if (canAccess) files.push(entry.name);
                    }
                }
            }
        }
        return { dirs: dirs.sort(), files: files.sort(), exists: true };
    }

    async readFile(subject, relativePath) {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;
        if (!relativePath) throw new Error("File path is required.");

        const absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);

        if (isToken) {
            if (!this.authSrv.tokenHasCap(subject, 'read', relativePath)) {
                throw new Error(`Permission denied to read file '${relativePath}'.`);
            }
        } else {
            if (!await this.pathManager.can(username, 'read', absolutePath)) {
                throw new Error(`Permission denied to read file '${relativePath}'.`);
            }
        }
        
        const { isSymlink, targetPath, canAccess } = await this.pathManager.resolveSymlink(username, absolutePath, 'read');
        if (isSymlink) {
            if (!canAccess && !isToken) throw new Error(`Permission denied to read symlink target for '${relativePath}'.`);
            return fs.readFile(targetPath, 'utf8');
        }

        if (!(await fs.lstat(absolutePath)).isFile()) throw new Error(`'${relativePath}' is not a readable file.`);
        return fs.readFile(absolutePath, 'utf8');
    }

    async writeFile(subject, relativePath, content) {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;
        if (!relativePath) throw new Error("File path is required.");
        if (content === undefined) throw new Error("Content is required for writeFile.");

        const absoluteFilePath = await this.pathManager.resolvePathForUser(username, relativePath);

        if (isToken) {
            if (!this.authSrv.tokenHasCap(subject, 'write', relativePath)) {
                throw new Error(`Permission denied to write to file '${relativePath}'.`);
            }
        }
        
        const { isSymlink, targetPath, canAccess } = await this.pathManager.resolveSymlink(username, absoluteFilePath, 'write');
        
        if (isSymlink) {
            if (!isToken && !canAccess) {
                throw new Error(`Permission denied to write to symlink target for '${relativePath}'.`);
            }
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content, 'utf8');
            return true;
        }
        
        if (!isToken && !await this.pathManager.can(username, 'write', absoluteFilePath)) {
            throw new Error(`Permission denied to write in directory '${path.dirname(relativePath)}'.`);
        }

        await fs.ensureDir(path.dirname(absoluteFilePath));
        await fs.writeFile(absoluteFilePath, content, 'utf8');
        return true;
    }

    async deleteFile(subject, relativePath) {
        const isToken = typeof subject === 'object' && subject.username;
        const username = isToken ? subject.username : subject;
        if (!relativePath) throw new Error("File path is required.");

        const absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);

        if (isToken) {
             if (!this.authSrv.tokenHasCap(subject, 'delete', relativePath)) {
                throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
            }
        } else {
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
