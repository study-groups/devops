import path from 'path';
import fs from 'fs-extra';
import { UserManager } from './UserManager.js';
import { FileManager } from './FileManager.js';
import { CapabilityManager } from './CapabilityManager.js';
import { AuthSrv } from './AuthSrv.js';
import { MountManager } from './utils/MountManager.js';
import { AuditLogger } from './AuditLogger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PData {
    constructor(config = {}) {
        this.systemRoots = config.systemRoots || {};
        this._validateConfig();
        this._initializePaths();
        this._initializeAudit(config.audit);
        this._initializeManagers();
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

    _initializeAudit(auditConfig = {}) {
        const defaultConfig = {
            enabled: process.env.PDATA_AUDIT !== 'false',
            logLevel: process.env.PDATA_AUDIT_LEVEL || 'info',
            console: process.env.PDATA_AUDIT_CONSOLE !== 'false',
            persistPath: process.env.PDATA_AUDIT_LOG || path.join(this.dataRoot, 'logs', 'audit.log')
        };

        this.audit = new AuditLogger({ ...defaultConfig, ...auditConfig });
        console.log(`[PData] Audit logging initialized. Path: ${defaultConfig.persistPath}`);
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

        // Initialize AuthSrv before FileManager so it can be passed to constructor
        const assetSetsObj = Object.fromEntries(this.capabilityManager.assetSets);
        const secret = process.env.PDATA_SECRET || process.env.SESSION_SECRET;
        if (!secret) {
            throw new Error('[PDATA FATAL] PDATA_SECRET or SESSION_SECRET environment variable is required.');
        }
        this.authSrv = new AuthSrv({
            secret,
            assetSets: assetSetsObj
        });

        this.fileManager = new FileManager({
            dataRoot: this.dataRoot,
            uploadsDir: this.uploadsDir,
            tempUploadsDir: this.tempUploadsDir,
            capabilityManager: this.capabilityManager,
            systemRoots: this.systemRoots,
            audit: this.audit
        }, this.userManager, this.capabilityManager, this.authSrv);

        this.mountManager = new MountManager({
            dataRoot: this.dataRoot,
            roles: this.userManager.roles
        });

        console.log(`[PData] Managers initialized.`);
    }

    _ensureDirectoryExists(dirPath, label) {
        fs.ensureDirSync(dirPath);
        if (!fs.statSync(dirPath).isDirectory()) {
            throw new Error(`${label} is not a directory.`);
        }
    }

    async createToken(username, password) {
        const isValid = this.userManager.validateUser(username, password);

        if (isValid) {
            const roles = this.userManager.getUserRoles(username);
            const caps = this.capabilityManager.expandRolesToCapabilities(roles);

            // UNIFIED MOUNTING: Single mount based on user role
            const mounts = await this._createUnifiedMounts(username, roles);

            const token = this.authSrv.createToken({ username, roles, caps, mounts });

            await this.audit.auth('login', username, true, { roles, mountCount: Object.keys(mounts).length });

            return token;
        }

        await this.audit.auth('login', username, false, { reason: 'invalid_credentials' });
        return null;
    }

    /**
     * Create a token for an already authenticated user (bypasses password validation)
     * Used when user is authenticated via session
     */
    async createTokenForAuthenticatedUser(username) {
        const roles = this.userManager.getUserRoles(username);
        const caps = this.capabilityManager.expandRolesToCapabilities(roles);

        // UNIFIED MOUNTING: Single mount based on user role
        const mounts = await this._createUnifiedMounts(username, roles);

        const token = this.authSrv.createToken({ username, roles, caps, mounts });

        await this.audit.log('auth.token.created', {
            username,
            action: 'token_created',
            metadata: { roles, mountCount: Object.keys(mounts).length, source: 'session' }
        });

        return token;
    }

    /**
     * Create unified mount namespace for a user based on their role
     * Three-tier system: ~data (userspace), ~log/~cache (system), ~/data/* (user-specific)
     */
    async _createUnifiedMounts(username, roles) {
        const mounts = {};
        
        if (roles.includes('admin')) {
            // Admin gets system-wide access
            mounts['~data'] = path.join(this.dataRoot, 'data');
            mounts['~log'] = path.join(this.dataRoot, 'logs'); 
            mounts['~cache'] = path.join(this.dataRoot, 'cache');
            mounts['~uploads'] = path.join(this.dataRoot, 'uploads');
            // Full system access for admin debugging
            mounts['~system'] = this.dataRoot;
        } else {
            // Regular users get ONLY their specific home directory (Plan 9 isolation)
            // NO access to general ~data (that would expose all users/projects)
            
            // User-specific home directory under ~/data/
            const userHome = await this._getUserHomeDirectory(username);
            const relativePath = path.relative(path.join(this.dataRoot, 'data'), userHome);
            mounts[`~/data/${relativePath}`] = userHome;
        }
        
        return mounts;
    }

    /**
     * Get the home directory path for a user
     * Checks users.csv for home_dir field, otherwise uses legacy logic
     */
    async _getUserHomeDirectory(username) {
        // Check if user has a specific home_dir defined in users.csv
        const userData = this.userManager.users.get(username);
        if (userData && userData.home_dir) {
            // home_dir is relative to $PD_DIR/data
            const homePath = path.join(this.dataRoot, 'data', userData.home_dir);
            await fs.ensureDir(homePath);
            return homePath;
        }
        
        // Legacy logic: check projects first, then users
        const projectPath = path.join(this.dataRoot, 'data', 'projects', username);
        if (await fs.pathExists(projectPath)) {
            return projectPath;
        }
        
        // Default to users directory
        const userPath = path.join(this.dataRoot, 'data', 'users', username);
        await fs.ensureDir(userPath);
        return userPath;
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
        try {
            const result = await this.userManager.addUser(username, password, roles);
            await this.audit.user('created', username, true, { roles });

            try {
                await this.fileManager.ensureUserDirectory(username);
            } catch (error) {
                console.warn(`[PData] Could not create home directory for ${username}: ${error.message}`);
            }

            return result;
        } catch (error) {
            await this.audit.user('created', username, false, { error: error.message });
            throw error;
        }
    }

    async deleteUser(username) {
        const result = await this.userManager.deleteUser(username);
        await this.audit.user('deleted', username, true);
        return result;
    }

    async updatePassword(username, newPassword) {
        const result = await this.userManager.updatePassword(username, newPassword);
        await this.audit.user('password_changed', username, true);
        return result;
    }

    async setUserRoles(username, newRoles) {
        const oldRoles = this.userManager.getUserRoles(username);
        const result = await this.userManager.setUserRoles(username, newRoles);
        await this.audit.user('roles_changed', username, true, { oldRoles, newRoles });
        return result;
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
    
    /**
     * Get available top-level directories for a user using the mounting system
     * This is the Plan 9-inspired approach where directories are mount points
     */
    async getAvailableTopDirs(username) {
        return this.mountManager.getAvailableMounts(username);
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
