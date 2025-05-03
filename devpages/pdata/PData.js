import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
// Import only the pure helpers we need
import { generateSalt, hashPassword } from './userUtils.js';

// Note: We'll move the implementations of these utils later
// For now, assume they exist and PData might use them internally or expose necessary state
// import { loadUsersAndRoles, validateUser, addUser, deleteUser, updatePassword, setUserRole, listUsers } from './userUtils.js';
// import { listDirectory, readFile, writeFile, deleteFile, handleUpload, getUserTopLevelDirectories } from './fileUtils.js';

class PData {
	/**
	 * Initializes PData. Establishes separate roots for PData's database/storage and application data.
	 * - DB Root (users, roles, uploads): Determined by PD_DB env var.
	 * - Data Root (managed files): Determined by PD_DATA env var, defaults to <dbRoot>/data.
	 */
	constructor() {
		console.log('[PDATA Class] Initializing...');

		// --- Initialize PData Database Root (PD_DB) ---
		this._initializeDbRoot(); // Sets this.dbRoot from PD_DB

		// --- Determine and Resolve Application Data Root (PD_DATA) ---
		this._initializeDataRoot(); // Sets this.dataRoot from PD_DATA or default

		// --- Setup DB Paths & Uploads (relative to dbRoot) ---
		this._setupDbPaths(); // Uses this.dbRoot

		// --- Load Users & Roles (from dbRoot) ---
		// These maps will store the loaded data
		this._users = new Map();
		this._roles = new Map();
		this._loadRolesAndUsers(); // Uses paths from _setupDbPaths

		console.log('[PDATA Class] Initialization complete');
		console.log(`  • DB Root (PD_DB):        ${this.dbRoot}`);
		console.log(`  • Data Root (PD_DATA):    ${this.dataRoot}`);
	}

	/**
	 * Initializes and validates the PData database root directory from PD_DB.
	 * Stores the path in this.dbRoot.
	 * @private
	 */
	_initializeDbRoot() {
		const dbRootPath = process.env.PD_DB;
		if (!dbRootPath) {
			throw new Error('[PDATA Class FATAL] PD_DB environment variable must be set (for PData DB root).');
		}
		if (!path.isAbsolute(dbRootPath)) {
			throw new Error(`[PDATA Class FATAL] PD_DB must be an absolute path: ${dbRootPath}`);
		}
		// Ensure DB Root exists
		try {
			this._ensureDirectoryExists(dbRootPath, 'PD_DB (DB Root)');
		} catch (error) {
			console.error(`[PDATA Class FATAL] Could not access or create PD_DB directory: ${dbRootPath}`);
			throw error;
		}
		this.dbRoot = dbRootPath; // Store the validated DB root path
		console.log(`[PDATA Class] DB Root (PD_DB): ${this.dbRoot}`);
	}

	/**
	 * Determines the application data directory path from PD_DATA (or defaults to <dbRoot>/data),
	 * resolves it to its real path, ensures it exists, and stores it as this.dataRoot.
	 * @private
	 */
	_initializeDataRoot() {
		// 1. Get configured path: Use PD_DATA env var first, default to <dbRoot>/data
		const configuredDataPath = process.env.PD_DATA || path.join(this.dbRoot, 'data');
		console.log(`[PDATA Class] Using configured application data path: ${configuredDataPath}`);

		let needsCreationCheck = false; // Flag if we might need to create the default dir

		if (!fs.existsSync(configuredDataPath)) {
			if (configuredDataPath === path.join(this.dbRoot, 'data')) {
				console.warn(`[PDATA Class WARN] Default data directory '${configuredDataPath}' does not exist. Will attempt creation.`);
				needsCreationCheck = true; // Mark that we expect realpathSync to fail and we should try creating it
			} else {
				// If PD_DATA was explicitly set but doesn't exist, it's a fatal error.
				throw new Error(`[PDATA Class FATAL] Explicitly configured data path (PD_DATA) does not exist: ${configuredDataPath}`);
			}
		}

		// 2. Resolve to absolute real path (handles links automatically)
		try {
			// This will throw if the path doesn't exist, which we expect if needsCreationCheck is true
			this.dataRoot = fs.realpathSync(configuredDataPath);
			console.log(`[PDATA Class] Resolved application data root to real path: ${this.dataRoot}`);
		} catch (error) {
			// If realpath failed AND we expected it because the default didn't exist, try creating it.
			if (error.code === 'ENOENT' && needsCreationCheck) {
				console.warn(`[PDATA Class] Default data directory '${configuredDataPath}' not found, attempting creation...`);
				try {
					// Create the default directory relative to dbRoot
					this._ensureDirectoryExists(configuredDataPath, 'Default Data Directory');
					// Try resolving again now that it should exist
					this.dataRoot = fs.realpathSync(configuredDataPath);
					console.log(`[PDATA Class] Created and resolved default data root to real path: ${this.dataRoot}`);
				} catch (creationError) {
					console.error(`[PDATA Class FATAL] Failed to create or resolve default data directory '${configuredDataPath}': ${creationError.message}`);
					throw new Error(`Failed to create or resolve default data directory: ${creationError.message}`);
				}
			} else {
				// Otherwise, it's a real error (e.g., permissions, broken explicit link, or unexpected existence failure)
			console.error(`[PDATA Class FATAL] Failed to resolve real path for data directory '${configuredDataPath}': ${error.message}`);
			throw new Error(`Failed to resolve data directory: ${error.message}`);
			}
		}

		// 3. Ensure the final resolved target directory exists and is a directory
		try {
			if (!fs.existsSync(this.dataRoot)) {
				// This shouldn't happen after the logic above, but check anyway.
				throw new Error(`Resolved data root path does not exist after potential creation: ${this.dataRoot}`);
			 } else if (!fs.statSync(this.dataRoot).isDirectory()) {
				  throw new Error(`Resolved data root path exists but is not a directory: ${this.dataRoot}`);
			 }
			console.log(`[PDATA Class] Verified application data root exists and is a directory: ${this.dataRoot}`);
		} catch(error) {
			 console.error(`[PDATA Class FATAL] Error verifying resolved data root directory (${this.dataRoot}):`, error);
			 throw new Error(`Failed to verify data root directory: ${error.message}`);
		}
	}

	/** Sets up paths for DB files (users, roles) and uploads directory relative to dbRoot */
	_setupDbPaths() {
		// Uploads dir is relative to dbRoot (PD_DB)
		// Still allow PD_UPLOADS override for flexibility
		const uploadsDir = process.env.PD_UPLOADS || path.join(this.dbRoot, 'uploads');
		this._ensureDirectoryExists(uploadsDir, 'Uploads (relative to DB Root)');
		this.uploadsDir = uploadsDir; // Store the absolute path

		// DB config files are relative to dbRoot (PD_DB)
		this.rolesFile = path.join(this.dbRoot, 'roles.csv');
		this.usersFile = path.join(this.dbRoot, 'users.csv');

		console.log(`[PDATA Class] DB/Upload Path Setup:`);
		console.log(`  • Uploads Dir: ${this.uploadsDir}`);
		console.log(`  • Roles File:  ${this.rolesFile}`);
		console.log(`  • Users File:  ${this.usersFile}`);

		// Touch config files if they don't exist
		this._touchFileSync(this.rolesFile, 'Roles');
		this._touchFileSync(this.usersFile, 'Users');
	}

	/** Loads roles and user credentials from CSV files into instance maps. */
	_loadRolesAndUsers() {
		// Uses this.rolesFile and this.usersFile derived from dbRoot
		// --- Load user roles ---
		try {
			this._roles = this._loadCsvFile(this.rolesFile, 2, (parts, map) => {
				const username = parts[0].trim();
				const role = parts[1].trim();
				if (map.has(username)) {
					console.warn(`[PDATA Class WARN] Duplicate username found in roles file: "${username}". Using the last entry.`);
				}
				map.set(username, role);
			}, "Roles");
			console.log(`[PDATA Class] Loaded roles for ${this._roles.size} users from ${this.rolesFile}`);
		} catch (error) {
			console.error('[PDATA Class FATAL] Failed to load roles:', error);
			throw error; // Rethrow fatal error
		}

		 // --- Load user credentials ---
		 try {
			this._users = this._loadCsvFile(this.usersFile, 3, (parts, map) => {
				const username = parts[0].trim();
				const salt = parts[1].trim();
				const hash = parts[2].trim();
				if (!salt || !hash) {
					console.warn(`[PDATA Class WARN] Skipping user '${username}' due to empty salt or hash in users file.`);
					return;
				}
				if (map.has(username)) {
					console.warn(`[PDATA Class WARN] Duplicate username found in users file: "${username}". Using the last entry.`);
				}
				map.set(username, { salt, hash });
			}, "Users");
			console.log(`[PDATA Class] Loaded credentials for ${this._users.size} users from ${this.usersFile}`);
		} catch (error) {
			console.error('[PDATA Class FATAL] Failed to load user credentials:', error);
			throw error; // Rethrow fatal error
		}
	}

	/** Ensure directory exists (private helper) */
	_ensureDirectoryExists(dirPath, label) {
		try {
			if (!fs.existsSync(dirPath)) {
				console.log(`[PDATA Class] Creating ${label.toLowerCase()} directory: ${dirPath}`);
				fs.mkdirSync(dirPath, { recursive: true });
			} else if (!fs.statSync(dirPath).isDirectory()) {
				throw new Error(`${label} path exists but is not a directory: ${dirPath}`);
			}
		} catch (error) {
			 console.error(`[PDATA Class FATAL] Error accessing/creating ${label} directory (${dirPath}):`, error);
			 throw new Error(`Failed to setup ${label.toLowerCase()} directory: ${error.message}`);
		}
	}

	/** Create file if it doesn't exist (private helper) */
	_touchFileSync(filePath, label) {
		try {
			if (!fs.existsSync(filePath)) {
				console.log(`[PDATA Class] Creating empty ${label.toLowerCase()} file: ${filePath}`);
				fs.writeFileSync(filePath, ''); // Create empty file
			} else if (!fs.statSync(filePath).isFile()) {
				 throw new Error(`${label} path exists but is not a file: ${filePath}`);
			}
		} catch(error) {
			console.error(`[PDATA Class FATAL] Error accessing/creating ${label.toLowerCase()} file (${filePath}):`, error);
			throw new Error(`Failed to ensure ${label.toLowerCase()} file: ${error.message}`);
		}
	}

	/** Load CSV file (private helper) */
	_loadCsvFile(filePath, expectedParts, processLine, label) {
		const map = new Map();
		if (!fs.existsSync(filePath)) {
			console.warn(`[PDATA Class WARN] ${label} file not found at ${filePath}. Starting with empty ${label.toLowerCase()}.`);
			return map;
		}
		 if (!fs.statSync(filePath).isFile()) {
			 throw new Error(`[PDATA Class FATAL] ${label} path exists but is not a file: ${filePath}`);
		 }
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			content.split('\n').forEach(line => {
				const trimmedLine = line.trim();
				if (trimmedLine) {
					const parts = trimmedLine.split(',');
					if (parts.length === expectedParts) {
						processLine(parts, map);
					} else {
						console.warn(`[PDATA Class WARN] Skipping invalid line in ${label.toLowerCase()} file (expected ${expectedParts} parts, got ${parts.length}): "${line}"`);
					}
				}
			});
			return map;
		} catch (error) {
			console.error(`[PDATA Class ERROR] Failed to read or parse ${label.toLowerCase()} file ${filePath}: ${error.message}`);
			throw error;
		}
	}

	// --- CSV File Helpers (Private) ---
	/** Rewrite CSV file (private helper) */
	_rewriteCsvFile(filePath, map, formatLine, label) {
		console.log(`[PDATA Class] Rewriting ${label.toLowerCase()} file: ${filePath}`);
		try {
			const lines = [];
			for (const [key, value] of map.entries()) {
				lines.push(formatLine(key, value));
			}
			const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
			fs.writeFileSync(filePath, content, 'utf8');
			console.log(`[PDATA Class] Successfully rewrote ${label.toLowerCase()} file with ${map.size} entries.`);
		} catch (error) {
			console.error(`[PDATA Class ERROR] Failed to rewrite ${label.toLowerCase()} file ${filePath}: ${error.message}`);
			throw new Error(`Failed to save ${label.toLowerCase()}: ${error.message}`);
		}
	}
	/** Append line to file (private helper) */
	_appendLineToFile(filePath, lineToAdd, label) {
		console.log(`[PDATA Class] Appending to ${label.toLowerCase()} file: ${filePath}`);
		try {
			let contentToAppend = '';
			if (fs.existsSync(filePath)) {
				const currentContent = fs.readFileSync(filePath, 'utf8');
				if (currentContent.length > 0 && !currentContent.endsWith('\n')) {
					contentToAppend += '\n';
				}
			}
			contentToAppend += lineToAdd + '\n';
			fs.appendFileSync(filePath, contentToAppend, 'utf8');
			console.log(`[PDATA Class] Successfully appended to ${label.toLowerCase()} file.`);
		} catch (error) {
			console.error(`[PDATA Class ERROR] Failed to append to ${label.toLowerCase()} file ${filePath}: ${error.message}`);
			throw new Error(`Failed to update ${label.toLowerCase()}: ${error.message}`);
		}
	}

	// --- Public User Management Methods ---
	// These now use 'this' to access instance state (_users, _roles, usersFile, rolesFile)

	/** Validates user credentials */
	validateUser(username, password) {
		const userData = this._users.get(username);
		if (!userData) {
			console.log(`[PDATA Class.validate] User '${username}' not found.`);
			return false;
		}
		console.log(`[PDATA Class.validate] Validating '${username}'...`);
		console.log(`[PDATA Class.validate] Stored Salt: ${userData.salt}`); // DEBUG
		console.log(`[PDATA Class.validate] Stored Hash: ${userData.hash}`); // DEBUG

		const calculatedHash = hashPassword(password, userData.salt);
		console.log(`[PDATA Class.validate] Password Received: ${password}`); // DEBUG
		console.log(`[PDATA Class.validate] Calculated Hash: ${calculatedHash}`); // DEBUG

		if (!calculatedHash) {
			console.error(`[PDATA Class.validate] Hash calculation failed for user '${username}'.`);
			return false;
		}
		const isMatch = calculatedHash === userData.hash;
		console.log(`[PDATA Class.validate] Result for '${username}': ${isMatch ? 'MATCH' : 'MISMATCH'}`);
		return isMatch;
	}

	/** Adds a new user */
	async addUser(username, password, role = 'user') {
		console.log(`[PDATA Class.addUser] Attempting to add user '${username}' with role '${role}'`);
		if (this._users.has(username) || this._roles.has(username)) { // Use this._users, this._roles
			console.warn(`[PDATA Class.addUser WARN] User '${username}' already exists.`);
			return false;
		}
		if (role !== 'user' && role !== 'admin') {
			console.error(`[PDATA Class.addUser ERROR] Invalid role specified: '${role}'. Must be 'user' or 'admin'.`);
			return false;
		}
		// Use imported helpers
		const salt = generateSalt();
		const hashedPassword = hashPassword(password, salt);
		if (!hashedPassword) {
			console.error(`[PDATA Class.addUser ERROR] Failed to hash password for new user '${username}'.`);
			return false;
		}

		const newUser = { salt, hash: hashedPassword };
		const userLine = `${username},${salt},${hashedPassword}`;
		const roleLine = `${username},${role}`;

		try {
			// Use private helper methods and instance paths (this.usersFile, this.rolesFile)
			this._appendLineToFile(this.usersFile, userLine, 'Users');
			this._appendLineToFile(this.rolesFile, roleLine, 'Roles');

			// Update in-memory maps
			this._users.set(username, newUser);
			this._roles.set(username, role);

			console.log(`[PDATA Class.addUser] Successfully added user '${username}' with role '${role}'.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.addUser ERROR] Failed to add user '${username}': ${error.message}`);
			console.error(`[PDATA Class.addUser CRITICAL] Inconsistency possible: File operations failed for addUser '${username}'.`);
			return false;
		}
	}

	/** Deletes a user */
	async deleteUser(username) {
		console.log(`[PDATA Class.deleteUser] Attempting to delete user '${username}'`);
		if (!this._users.has(username) && !this._roles.has(username)) { // Use this._users, this._roles
			console.warn(`[PDATA Class.deleteUser WARN] User '${username}' not found. Cannot delete.`);
			return false;
		}

		const originalUser = this._users.get(username);
		const originalRole = this._roles.get(username);

		this._users.delete(username);
		this._roles.delete(username);
		console.log(`[PDATA Class.deleteUser] Removed '${username}' from in-memory maps.`);

		try {
			// Use private helper and instance paths/maps
			this._rewriteCsvFile(this.usersFile, this._users, (uname, udata) => `${uname},${udata.salt},${udata.hash}`, 'Users');
			this._rewriteCsvFile(this.rolesFile, this._roles, (uname, urole) => `${uname},${urole}`, 'Roles');
			console.log(`[PDATA Class.deleteUser] Successfully deleted user '${username}' and updated files.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.deleteUser ERROR] Failed to rewrite files after deleting user '${username}': ${error.message}`);
			// Rollback in-memory state
			if (originalUser) this._users.set(username, originalUser);
			if (originalRole) this._roles.set(username, originalRole);
			console.error(`[PDATA Class.deleteUser CRITICAL] Rolled back in-memory state for '${username}' due to file write failure.`);
			return false;
		}
	}

	/** Updates a user's password */
	async updatePassword(username, newPassword) {
		console.log(`[PDATA Class.updatePassword] Attempting to update password for '${username}'`);
		if (!this._users.has(username)) { // Use this._users
			console.warn(`[PDATA Class.updatePassword WARN] User '${username}' not found. Cannot update password.`);
			return false;
		}

		const newSalt = generateSalt();
		const newHashedPassword = hashPassword(newPassword, newSalt);
		if (!newHashedPassword) {
			console.error(`[PDATA Class.updatePassword ERROR] Failed to hash new password for '${username}'.`);
			return false;
		}

		const originalUserData = { ...this._users.get(username) }; // Clone original
		const updatedUserData = { salt: newSalt, hash: newHashedPassword };

		this._users.set(username, updatedUserData); // Update in-memory
		console.log(`[PDATA Class.updatePassword] Updated in-memory password hash for '${username}'.`);

		try {
			// Use private helper and instance paths/maps
			this._rewriteCsvFile(this.usersFile, this._users, (uname, udata) => `${uname},${udata.salt},${udata.hash}`, 'Users');
			console.log(`[PDATA Class.updatePassword] Successfully updated password for '${username}' in file.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.updatePassword ERROR] Failed to rewrite users file after updating password for '${username}': ${error.message}`);
			// Rollback in-memory state
			this._users.set(username, originalUserData);
			console.error(`[PDATA Class.updatePassword CRITICAL] Rolled back in-memory password change for '${username}' due to file write failure.`);
			return false;
		}
	}

	/** Sets a user's role */
	async setUserRole(username, newRole) {
		console.log(`[PDATA Class.setUserRole] Attempting to set role for '${username}' to '${newRole}'`);
		if (!this._users.has(username)) { // Use this._users
			console.warn(`[PDATA Class.setUserRole WARN] User '${username}' not found. Cannot set role.`);
			return false;
		}
		if (newRole !== 'user' && newRole !== 'admin') {
			console.error(`[PDATA Class.setUserRole ERROR] Invalid role specified: '${newRole}'. Must be 'user' or 'admin'.`);
			return false;
		}

		const originalRole = this._roles.get(username); // Use this._roles

		this._roles.set(username, newRole); // Update in-memory
		console.log(`[PDATA Class.setUserRole] Updated in-memory role for '${username}' to '${newRole}'.`);

		try {
			// Use private helper and instance paths/maps
			this._rewriteCsvFile(this.rolesFile, this._roles, (uname, urole) => `${uname},${urole}`, 'Roles');
			console.log(`[PDATA Class.setUserRole] Successfully updated role for '${username}' in file.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.setUserRole ERROR] Failed to rewrite roles file after setting role for '${username}': ${error.message}`);
			// Rollback in-memory state
			if (originalRole === undefined) {
				this._roles.delete(username);
			} else {
				this._roles.set(username, originalRole);
			}
			console.error(`[PDATA Class.setUserRole CRITICAL] Rolled back in-memory role change for '${username}' due to file write failure.`);
			return false;
		}
	}

	/** Lists all registered usernames */
	listUsers() {
		return Array.from(this._users.keys()); // Use this._users
	}

	// --- Authorization & Path Methods ---

	/**
	 * Checks if a user has permission to perform an action on a resource.
	 * Core authorization logic.
	 * @param {string} username - The username performing the action.
	 * @param {string} action - The action being performed (e.g., 'read', 'write', 'list', 'delete').
	 * @param {string} resourcePath - The absolute path to the resource being accessed.
	 * @returns {boolean} - True if allowed, false otherwise.
	 */
	can(username, action, resourcePath) {
		// Ensure user exists in the system before checking roles/permissions
		if (!username || !this._users.has(username)) {
			console.log(`[PDATA Class.can] Denied. User '${username || 'N/A'}' not found in loaded users.`);
			return false;
		}
		// Ensure resourcePath is absolute for reliable comparison
		if (!path.isAbsolute(resourcePath)) {
			console.warn(`[PDATA Class.can] Programming Error: resourcePath must be absolute. Received: ${resourcePath}. Denying access.`);
			 return false;
		}

		const role = this._roles.get(username);
		// Use the resolved application data root for all checks
		const currentDataRoot = this.dataRoot;

		console.log(`[PDATA Class.can] Checking: user='${username}', role='${role || 'N/A'}', action='${action}', resource='${resourcePath}' within dataRoot='${currentDataRoot}'`);

		// Deny if user exists but has no assigned role
		if (!role) {
			console.log(`[PDATA Class.can] Denied. User '${username}' found but has no role defined in roles file.`);
			return false;
		}

		// --- Admin Check ---
		// Admins can do anything *within* the application data root.
		if (role === 'admin') {
			if (resourcePath.startsWith(currentDataRoot + path.sep) || resourcePath === currentDataRoot) {
				console.log(`[PDATA Class.can] Allowed. User '${username}' is admin and resource is within resolved dataRoot.`);
				return true;
			} else {
				console.log(`[PDATA Class.can] Denied. User '${username}' is admin, but resource '${resourcePath}' is outside the resolved dataRoot '${currentDataRoot}'.`);
				return false;
			}
		}

		// --- User Role Check ---
		if (role === 'user') {
			// Users primarily operate within their implicit top-level directory
			const userImplicitTopDir = path.join(currentDataRoot, username);

			// Check if the resource is the user's directory itself or within it
			if (resourcePath === userImplicitTopDir || resourcePath.startsWith(userImplicitTopDir + path.sep)) {
				console.log(`[PDATA Class.can] Allowed. Resource is within user '${username}' implicit top directory '${userImplicitTopDir}'.`);
				return true; // Access within own directory allowed for all actions
			} else {
				// Check if the resource is within the *overall* data root (but outside the user's dir)
				if (resourcePath.startsWith(currentDataRoot + path.sep)) {
					// Allow read/list access to shared top-level directories/files
					if (action === 'read' || action === 'list') {
						console.log(`[PDATA Class.can] Allowed (Shared Read/List). Resource '${resourcePath}' is outside user dir but within dataRoot.`);
						return true;
					} else {
						// Deny write/delete actions outside the user's own directory
						console.log(`[PDATA Class.can] Denied. Action '${action}' not permitted for user '${username}' outside their own directory '${userImplicitTopDir}'.`);
						return false;
					}
                } else {
					// Deny access if the resource is outside the data root entirely
					console.log(`[PDATA Class.can] Denied. Resource '${resourcePath}' is outside the resolved dataRoot '${currentDataRoot}'.`);
				    return false;
                }
			}
		}

		// --- Default Deny for unknown roles ---
		console.log(`[PDATA Class.can] Denied. Unknown role '${role}' for user '${username}'.`);
		return false;
	}

	 /**
	  * Gets the role of a user.
	 * @param {string} username - The username to query.
	 * @returns {string | null} - The user's role ('admin', 'user') or null if not found or no role assigned.
	  */
	 getUserRole(username) {
		return this._roles.get(username) || null;
	 }

	/**
	 * Resolves a relative path against the application data root, ensuring it stays within bounds.
	 * @param {string} [relativePath=''] - The path relative to the data root.
	 * @returns {string} - The absolute, resolved path.
	 * @throws {Error} - If the path attempts to escape the data root.
	 */
	resolvePath(relativePath = '') {
		const currentDataRoot = this.dataRoot;
		// Resolve the path fully first
		const intendedPath = path.resolve(currentDataRoot, relativePath);

		// Security Check: Ensure the fully resolved path is still within the data root
		if (!intendedPath.startsWith(currentDataRoot + path.sep) && intendedPath !== currentDataRoot) {
			console.error(`[PDATA Class SECURITY] Path traversal attempt detected: relativePath='${relativePath}', resolved='${intendedPath}', base='${currentDataRoot}'`);
			// Throw a generic permission error, don't leak path details
			 throw new Error('Permission denied: Invalid path');
		}
		return intendedPath;
	}

	// --- File Operation Methods ---
	// These now use 'this' to access instance state (dataRoot, uploadsDir) and methods (resolvePath, can)

	/** List directory contents (files and dirs), handling symlinks */
	async listDirectory(username, relativePath = '') {
		const logPrefix = '[PDATA Class.listDirectory]';
		let absolutePath;
		try {
			absolutePath = this.resolvePath(relativePath); // Use this.resolvePath
		} catch (resolveError) {
			console.error(`${logPrefix} Error resolving path '${relativePath}': ${resolveError.message}`);
			throw resolveError;
		}

		if (!this.can(username, 'list', absolutePath)) { // Use this.can
			console.log(`${logPrefix} Permission denied for user '${username}' on '${absolutePath}'.`);
			throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
		}

		try {
			const entries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
			const dirs = [];
			const files = [];
			const currentDataRoot = this.dataRoot; // Use this.dataRoot

			for (const entry of entries) {
				if (entry.name.startsWith('.')) continue;
				const entryAbsolutePath = path.join(absolutePath, entry.name);
				const entryRelativePath = path.join(relativePath, entry.name);
				try {
					this.resolvePath(entryRelativePath); // Check entry bounds

					if (entry.isDirectory()) {
						dirs.push(entry.name);
					} else if (entry.isFile()) {
						files.push(entry.name);
					} else if (entry.isSymbolicLink()) {
						console.log(`${logPrefix} Found symlink: '${entry.name}' in '${absolutePath}'`);
						let targetAbsolutePath;
						try {
							const linkTarget = await fsPromises.readlink(entryAbsolutePath);
							targetAbsolutePath = path.resolve(path.dirname(entryAbsolutePath), linkTarget);
							const targetRelativePath = path.relative(currentDataRoot, targetAbsolutePath);
							const finalResolvedTargetPath = this.resolvePath(targetRelativePath); // Use this.resolvePath
							const stats = await fsPromises.lstat(finalResolvedTargetPath);

							if (stats.isDirectory()) {
								console.log(`${logPrefix} Symlink '${entry.name}' points to DIRECTORY within bounds: ${finalResolvedTargetPath}. Adding to dirs.`);
								dirs.push(entry.name);
							} else if (stats.isFile()) {
								console.log(`${logPrefix} Symlink '${entry.name}' points to FILE within bounds: ${finalResolvedTargetPath}. Adding to files.`);
								files.push(entry.name);
							} else {
								console.warn(`${logPrefix} Symlink '${entry.name}' points to something neither file nor directory (at ${finalResolvedTargetPath}). Skipping.`);
							}
						} catch (targetError) {
							if (targetError.message.includes('Permission denied: Invalid path')) {
								console.warn(`${logPrefix} Symlink '${entry.name}' target resolves outside allowed dataRoot. Skipping. (Target: ${targetAbsolutePath})`);
							} else if (targetError.code === 'ENOENT') {
								console.warn(`${logPrefix} Symlink '${entry.name}' is broken (Target not found: '${targetAbsolutePath || 'unknown'}'). Skipping.`);
							} else {
								console.warn(`${logPrefix} Error accessing symlink target for '${entry.name}' (Target: ${targetAbsolutePath || 'unknown'}): ${targetError.code || targetError.message}. Skipping link.`);
							}
						}
					}
				} catch (entryError) {
					console.warn(`${logPrefix} Error processing entry '${entry.name}' in '${absolutePath}': ${entryError.message}. Skipping entry.`);
				}
			}
			console.log(`${logPrefix} Listing for '${relativePath || '/'}': Dirs=[${dirs.join(',')}], Files=[${files.join(',')}]`);
			dirs.sort();
			files.sort();
			return { dirs, files };
		} catch (error) {
			console.error(`${logPrefix} Error reading directory '${absolutePath}':`, error);
			if (error.code === 'ENOENT') throw new Error(`Directory not found: '${relativePath || '/'}'.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied reading directory: '${relativePath || '/'}'.`);
			else if (error.message.startsWith('Permission denied')) throw error;
			else throw new Error(`Failed to list directory '${relativePath || '/'}': ${error.message}`);
		}
	}

	/** Read file content */
	async readFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		let absolutePath;
		try {
			absolutePath = this.resolvePath(relativePath); // Use this.resolvePath
		} catch (resolveError) {
			console.error(`[PDATA Class.readFile] Error resolving path '${relativePath}': ${resolveError.message}`);
			throw resolveError;
		}

		if (!this.can(username, 'read', absolutePath)) { // Use this.can
			console.log(`[PDATA Class.readFile] Permission denied for user '${username}' on '${absolutePath}'.`);
			throw new Error(`Permission denied to read file '${relativePath}'.`);
		}

		try {
			const stats = await fsPromises.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`'${relativePath}' (resolved: ${absolutePath}) is not a readable file or symlink.`);
			}
			const content = await fsPromises.readFile(absolutePath, 'utf8');
			console.log(`[PDATA Class.readFile] Successfully read file '${absolutePath}' for user '${username}'.`);
			return content;
		} catch (error) {
			console.error(`[PDATA Class.readFile] Error reading file '${absolutePath}':`, error);
			if (error.code === 'ENOENT') throw new Error(`File not found: '${relativePath}'.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied reading file: '${relativePath}'.`);
			else if (error.message.includes('not a readable file or symlink')) throw error;
			else throw new Error(`Failed to read file '${relativePath}': ${error.message}`);
		}
	}

	/** Write content to a file */
	async writeFile(username, relativePath, content) {
		if (!relativePath) throw new Error("File path is required.");
		if (content === undefined) throw new Error("Content is required for writeFile.");

		let absolutePath;
		let dirPath;
		try {
			absolutePath = this.resolvePath(relativePath); // Use this.resolvePath
			dirPath = path.dirname(absolutePath);
			this.resolvePath(path.relative(this.dataRoot, dirPath)); // Use this.resolvePath, this.dataRoot
		} catch (resolveError) {
			console.error(`[PDATA Class.writeFile] Error resolving path '${relativePath}': ${resolveError.message}`);
			throw resolveError;
		}

		if (!this.can(username, 'write', dirPath)) { // Use this.can
			const relativeDirPath = path.dirname(relativePath);
			console.log(`[PDATA Class.writeFile] Permission denied for user '${username}' to write in directory '${relativeDirPath}' (resolved: ${dirPath}).`);
			throw new Error(`Permission denied to write in directory '${relativeDirPath}'.`);
		}

		try {
			const stats = await fsPromises.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`Cannot overwrite: '${relativePath}' exists and is not a file or symlink.`);
			}
			if (!this.can(username, 'write', absolutePath)) { // Use this.can
				console.log(`[PDATA Class.writeFile] Permission denied for user '${username}' to overwrite existing file/link '${absolutePath}'.`);
				throw new Error(`Permission denied to overwrite file '${relativePath}'.`);
			}
		} catch (statError) {
			if (statError.code === 'ENOENT') { /* File doesn't exist, OK */ }
			else if (statError.message.startsWith('Cannot overwrite:')) throw statError;
			else {
				console.error(`[PDATA Class.writeFile] Error stating existing file '${absolutePath}':`, statError);
				throw new Error(`Failed to check existing file status for '${relativePath}': ${statError.message}`);
			}
		}

		try {
			await fsPromises.mkdir(dirPath, { recursive: true });
			await fsPromises.writeFile(absolutePath, content, 'utf8');
			console.log(`[PDATA Class.writeFile] Successfully wrote file '${absolutePath}' for user '${username}'.`);
		} catch (error) {
			console.error(`[PDATA Class.writeFile] Error writing file '${absolutePath}':`, error);
			if (error.code === 'EACCES') throw new Error(`Permission denied writing file: '${relativePath}'.`);
			else if (error.code === 'EISDIR') throw new Error(`Cannot write file: '${relativePath}' is a directory.`);
			else throw new Error(`Failed to write file '${relativePath}': ${error.message}`);
		}
	}

	/** Delete a file or a symbolic link */
	async deleteFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		let absolutePath;
		try {
			absolutePath = this.resolvePath(relativePath); // Use this.resolvePath
		} catch (resolveError) {
			console.error(`[PDATA Class.deleteFile] Error resolving path '${relativePath}': ${resolveError.message}`);
			throw resolveError;
		}

		if (!this.can(username, 'delete', absolutePath)) { // Use this.can
			console.log(`[PDATA Class.deleteFile] Permission denied for user '${username}' on '${absolutePath}'.`);
			throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
		}

		try {
			const stats = await fsPromises.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
			}
			await fsPromises.unlink(absolutePath);
			console.log(`[PDATA Class.deleteFile] Successfully deleted file/link '${absolutePath}' for user '${username}'.`);
		} catch (error) {
			console.error(`[PDATA Class.deleteFile] Error deleting file/link '${absolutePath}':`, error);
			if (error.code === 'ENOENT') throw new Error(`File or link not found: '${relativePath}'. Cannot delete.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied deleting file/link: '${relativePath}'.`);
			else if (error.code === 'EPERM' || error.code === 'EISDIR' || error.message.includes('not a file or symbolic link')) {
                 throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
            }
			else throw new Error(`Failed to delete file/link '${relativePath}': ${error.message}`);
		}
	}

	/** Get user's top-level directories (within their implicit folder) */
	async getUserTopLevelDirectories(username) {
		const logPrefix = '[PDATA Class.getUserTopLevelDirs]';
		let userDirPath;
		try {
			userDirPath = this.resolvePath(username); // Use this.resolvePath
		} catch (resolveError) {
			console.error(`${logPrefix} Error resolving user directory path for '${username}': ${resolveError.message}`);
			throw new Error(`Cannot access directory for user '${username}'.`);
		}

		if (!this.can(username, 'list', userDirPath)) { // Use this.can
			console.log(`${logPrefix} Permission denied for user '${username}' to list their own directory '${userDirPath}'.`);
			throw new Error(`Permission denied to access directory for '${username}'.`);
		}

		try {
			const entries = await fsPromises.readdir(userDirPath, { withFileTypes: true });
			const dirs = [];
			for (const entry of entries) {
				if (entry.name.startsWith('.')) continue;
				if (entry.isDirectory()) {
					dirs.push(entry.name);
				}
			}
			dirs.sort();
			console.log(`${logPrefix} Found top-level dirs for '${username}': [${dirs.join(',')}]`);
			return dirs;
		} catch (error) {
			if (error.code === 'ENOENT') {
				console.log(`${logPrefix} User directory not found for '${username}' at '${userDirPath}'. Returning empty list.`);
				return [];
			}
			console.error(`${logPrefix} Error reading user directory '${userDirPath}' for '${username}':`, error);
			throw new Error(`Failed to list directories for user '${username}': ${error.message}`);
		}
	}

	/** Handles moving an uploaded file from temp location to final uploads dir */
	async handleUpload(file) {
		const logPrefix = '[PDATA Class.handleUpload]';
		if (!file || !file.path || !file.originalname) {
			console.error(`${logPrefix} Invalid file object provided:`, file);
			throw new Error('Invalid file object provided for upload.');
		}

		const tempPath = file.path;
		const finalUploadsDir = this.uploadsDir; // Use this.uploadsDir

		const timestamp = Date.now();
		const randomPart = Math.random().toString(36).substring(2, 8);
		const ext = path.extname(file.originalname);
		const uniqueFilename = `${timestamp}-${randomPart}${ext}`;
		const destinationPath = path.join(finalUploadsDir, uniqueFilename);
		const relativeUrlPath = `/uploads/${uniqueFilename}`;

		try {
			console.log(`${logPrefix} Moving upload from ${tempPath} to ${destinationPath}`);
			// Use internal helper, though it might be redundant if called at init
			this._ensureDirectoryExists(finalUploadsDir, 'Uploads Target');
			await fsPromises.rename(tempPath, destinationPath);
			console.log(`${logPrefix} Upload successful: ${relativeUrlPath}`);
			return relativeUrlPath;
		} catch (error) {
			console.error(`${logPrefix} Failed to move uploaded file ${tempPath} to ${destinationPath}: ${error.message}`);
			try { await fsPromises.unlink(tempPath); console.log(`${logPrefix} Cleaned up temporary file ${tempPath}`); }
			catch (cleanupError) { console.error(`${logPrefix} Failed to cleanup temp upload file ${tempPath}: ${cleanupError.message}`); }
			throw new Error(`Failed to save uploaded file: ${error.message}`);
		}
	}

} // End PData Class

// Export the PData class
export { PData };
