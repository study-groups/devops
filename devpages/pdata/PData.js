import path from 'path';
import fs from 'fs-extra';
import { UserManager } from './UserManager.js';
import { FileManager } from './FileManager.js';
import { CapabilityManager } from './CapabilityManager.js';
import { AuthSrv } from './AuthSrv.js';

class PData {
    constructor(config = {}) {
        this.systemRoots = config.systemRoots || {};
        this._validateConfig();
        this._initializePaths();
        this._initializeManagers();
        
        // Convert Map to Object for AuthSrv compatibility
        const assetSetsObj = Object.fromEntries(this.capabilityManager.assetSets);
        this.authSrv = new AuthSrv({ 
            secret: 'a_secure_secret_key',
            assetSets: assetSetsObj
        });
    }

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

    _initializePaths() {
        const dataRootPath = process.env.PD_DIR;
        this._ensureDirectoryExists(dataRootPath, 'PD_DIR (PData Root)');
        this.dataRoot = fs.realpathSync(dataRootPath);

        this.uploadsDir = path.join(this.dataRoot, 'uploads');
        this.systemRoots['uploads'] = this.uploadsDir; // Register uploads as a system root
        
        this._ensureDirectoryExists(this.uploadsDir, 'Uploads');
        this.tempUploadsDir = path.join(this.uploadsDir, 'temp');
        this._ensureDirectoryExists(this.tempUploadsDir, 'Temp Uploads');

        this.usersFilePath = path.join(this.dataRoot, 'users.csv');
        this.rolesFilePath = path.join(this.dataRoot, 'roles.csv');
    }

    _initializeManagers() {
        const allowedRoles = ['admin', 'user', 'project', 'guest', 'dev'];

        this.userManager = new UserManager({
            dataRoot: this.dataRoot,
            usersFilePath: this.usersFilePath,
            rolesFilePath: this.rolesFilePath,
            allowedRoles
        });
        
        this.capabilityManager = new CapabilityManager({ dataRoot: this.dataRoot });

        this.fileManager = new FileManager({
            dataRoot: this.dataRoot,
            uploadsDir: this.uploadsDir,
            tempUploadsDir: this.tempUploadsDir,
            capabilityManager: this.capabilityManager,
            systemRoots: this.systemRoots
        }, this.userManager, this.capabilityManager, this.authSrv);

        console.log(`[PData] Managers initialized.`);
    }

    _ensureDirectoryExists(dirPath, label) {
        fs.ensureDirSync(dirPath);
        if (!fs.statSync(dirPath).isDirectory()) {
            throw new Error(`${label} is not a directory.`);
        }
    }

    async createToken(username, password) {
        if (this.userManager.validateUser(username, password)) {
            const roles = this.userManager.getUserRoles(username);
            const caps = this.capabilityManager.expandRolesToCapabilities(roles);
            return this.authSrv.createToken({ username, roles, caps });
        }
        return null;
    }

    validateToken(token) {
        try {
            return this.authSrv.validateToken(token);
        } catch (error) {
            console.error('[PData] Token validation failed:', error.message);
            return null;
        }
    }

    // USER MANAGEMENT METHODS
    validateUser(username, password) {
        return this.userManager.validateUser(username, password);
    }

    async addUser(username, password, roles = ['user']) {
        const result = await this.userManager.addUser(username, password, roles);
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

    listUsers() {
        return this.userManager.listUsers();
    }

    listUsersWithRoles() {
        return this.userManager.listUsersWithRoles();
    }

    getUserRoles(username) {
        return this.userManager.getUserRoles(username);
    }

    // FILE MANAGEMENT METHODS
    async listDirectory(subject, relativePath = '') {
        return this.fileManager.listDirectory(subject, relativePath);
    }

    async readFile(subject, relativePath) {
        return this.fileManager.readFile(subject, relativePath);
    }

    async writeFile(subject, relativePath, content) {
        return this.fileManager.writeFile(subject, relativePath, content);
    }

    async deleteFile(subject, relativePath) {
        return this.fileManager.deleteFile(subject, relativePath);
    }

    async handleUpload(file) {
        return this.fileManager.handleUpload(file);
    }

    async createSymlink(username, relativePath, targetPath) {
        return this.fileManager.createSymlink(username, relativePath, targetPath);
    }

    // EXTENDED METHODS
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

    async ensureUserDirectory(username) {
        return this.fileManager.ensureUserDirectory(username);
    }

    getSystemStatus() {
        return {
            dataRoot: this.dataRoot,
            uploadsDir: this.uploadsDir,
            userCount: this.userManager.listUsers().length,
            rolesCount: Object.keys(this.userManager.listUsersWithRoles()).length,
            initialized: true
        };
    }
    
    // BACKWARD COMPATIBILITY PROPERTIES
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
