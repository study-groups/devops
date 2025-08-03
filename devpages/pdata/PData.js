import path from 'path';
import fs from 'fs-extra';
import { UserManager } from './UserManager.js';
import { FileManager } from './FileManager.js';

/**
 * PData - Orchestration layer that coordinates UserManager and FileManager
 * Provides configuration validation and maintains backward compatibility
 */
class PData {
    constructor(config = {}) {
        this._validateConfig();
        this._initializePaths();
        this._initializeManagers();
    }

    /**
     * Validate configuration and environment variables
     */
    _validateConfig() {
        const pdDir = process.env.PD_DIR;
        if (!pdDir) {
            throw new Error('[PDATA FATAL] PD_DIR environment variable is required.');
        }
        if (!path.isAbsolute(pdDir)) {
            throw new Error(`[PDATA FATAL] PD_DIR must be an absolute path: ${pdDir}`);
        }
        
        console.log(`[PData] Validating configuration with PD_DIR: ${pdDir}`);
    }

    /**
     * Initialize directory structure and paths
     */
    _initializePaths() {
        const dataRootPath = process.env.PD_DIR;
        
        this._ensureDirectoryExists(dataRootPath, 'PD_DIR (PData Root)');
        this.dataRoot = fs.realpathSync(dataRootPath);

        // Initialize uploads directory
        this.uploadsDir = path.join(this.dataRoot, 'uploads');
        this._ensureDirectoryExists(this.uploadsDir, 'Uploads');
        this.tempUploadsDir = path.join(this.uploadsDir, 'temp');
        this._ensureDirectoryExists(this.tempUploadsDir, 'Temp Uploads');

        // Initialize user/role file paths
        this.usersFilePath = path.join(this.dataRoot, 'users.csv');
        this.rolesFilePath = path.join(this.dataRoot, 'roles.csv');

        // Initialize dbRoot
        const dbRootEnv = process.env.DB_ROOT;
        if (dbRootEnv) {
            if (!path.isAbsolute(dbRootEnv)) {
                throw new Error(`[PDATA FATAL] DB_ROOT, if set, must be an absolute path: ${dbRootEnv}`);
            }
            this.dbRoot = fs.realpathSync(dbRootEnv);
            console.log(`[PData] Initialized with DB_ROOT from environment: ${this.dbRoot}`);
        } else {
            this.dbRoot = path.join(this.dataRoot, 'db');
            console.log(`[PData] DB_ROOT not set, defaulting to: ${this.dbRoot}`);
        }
        this._ensureDirectoryExists(this.dbRoot, 'PData DB Root');

        console.log(`[PData] Paths initialized:
  - Data Root: ${this.dataRoot}
  - Uploads: ${this.uploadsDir}
  - DB Root: ${this.dbRoot}`);
    }

    /**
     * Initialize UserManager and FileManager
     */
    _initializeManagers() {
        const allowedRoles = ['admin', 'user', 'project', 'guest', 'dev'];

        // Initialize UserManager
        this.userManager = new UserManager({
            dataRoot: this.dataRoot,
            usersFilePath: this.usersFilePath,
            rolesFilePath: this.rolesFilePath,
            allowedRoles
        });

        // Initialize FileManager with UserManager reference
        this.fileManager = new FileManager({
            dataRoot: this.dataRoot,
            uploadsDir: this.uploadsDir,
            tempUploadsDir: this.tempUploadsDir
        }, this.userManager);

        console.log(`[PData] Managers initialized:
  - Users: ${this.userManager.listUsers().length} found
  - Roles: ${Object.keys(this.userManager.listUsersWithRoles()).length} assignments`);
    }

    /**
     * Utility method for ensuring directories exist
     */
    _ensureDirectoryExists(dirPath, label) {
        fs.ensureDirSync(dirPath);
        if (!fs.statSync(dirPath).isDirectory()) {
            throw new Error(`${label} is not a directory.`);
        }
    }

    // =============================================================================
    // USER MANAGEMENT METHODS (delegate to UserManager)
    // =============================================================================

    validateUser(username, password) {
        return this.userManager.validateUser(username, password);
    }

    async addUser(username, password, roles = ['user']) {
        const result = await this.userManager.addUser(username, password, roles);
        
        // Create user's home directory after successful user creation
        try {
            await this.fileManager.ensureUserDirectory(username);
        } catch (error) {
            console.warn(`[PData] Could not create home directory for ${username}: ${error.message}`);
        }
        
        return result;
    }

    async deleteUser(username) {
        return this.userManager.deleteUser(username);
    }

    async updatePassword(username, newPassword) {
        return this.userManager.updatePassword(username, newPassword);
    }

    async setUserRoles(username, newRoles) {
        return this.userManager.setUserRoles(username, newRoles);
    }

    async addUserRole(username, roleToAdd) {
        return this.userManager.addUserRole(username, roleToAdd);
    }

    async removeUserRole(username, roleToRemove) {
        return this.userManager.removeUserRole(username, roleToRemove);
    }

    listUsers() {
        return this.userManager.listUsers();
    }

    listUsersWithRoles() {
        return this.userManager.listUsersWithRoles();
    }

    getUserRoles(username) {
        return this.userManager.getUserRoles(username);
    }

    getUserRole(username) {
        return this.userManager.getUserRole(username);
    }

    // =============================================================================
    // FILE MANAGEMENT METHODS (delegate to FileManager)
    // =============================================================================

    async listDirectory(username, relativePath = '') {
        return this.fileManager.listDirectory(username, relativePath);
    }

    async readFile(username, relativePath) {
        return this.fileManager.readFile(username, relativePath);
    }

    async writeFile(username, relativePath, content) {
        return this.fileManager.writeFile(username, relativePath, content);
    }

    async deleteFile(username, relativePath) {
        return this.fileManager.deleteFile(username, relativePath);
    }

    async handleUpload(file) {
        return this.fileManager.handleUpload(file);
    }

    async createSymlink(username, relativePath, targetPath) {
        return this.fileManager.createSymlink(username, relativePath, targetPath);
    }

    // =============================================================================
    // EXTENDED METHODS (orchestration and convenience)
    // =============================================================================

    /**
     * Get comprehensive user information including home directory
     */
    async getUserInfo(username) {
        if (!this.userManager.users.has(username)) {
            throw new Error(`User '${username}' not found.`);
        }

        const homeInfo = await this.fileManager.getUserHomeInfo(username);
        
        return {
            username,
            roles: this.userManager.getUserRoles(username),
            primaryRole: this.userManager.getUserRole(username),
            exists: this.userManager.users.has(username),
            homeDirectory: homeInfo
        };
    }

    /**
     * Ensure user directory exists (convenience method)
     */
    async ensureUserDirectory(username) {
        return this.fileManager.ensureUserDirectory(username);
    }

    /**
     * Get system status
     */
    getSystemStatus() {
        return {
            dataRoot: this.dataRoot,
            uploadsDir: this.uploadsDir,
            dbRoot: this.dbRoot,
            userCount: this.userManager.listUsers().length,
            rolesCount: Object.keys(this.userManager.listUsersWithRoles()).length,
            initialized: true
        };
    }

    // =============================================================================
    // BACKWARD COMPATIBILITY PROPERTIES
    // =============================================================================

    get pathManager() {
        return this.fileManager.pathManager;
    }

    get users() {
        return this.userManager.users;
    }

    get roles() {
        return this.userManager.roles;
    }

    get allowedRoles() {
        return this.userManager.allowedRoles;
    }
}

export { PData };