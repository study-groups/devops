import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
// Import AWS SDK components for S3 & Presigner
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// Import only the pure helpers we need
import { generateSalt, hashPassword } from './userUtils.js';

// Note: We'll move the implementations of these utils later
// For now, assume they exist and PData might use them internally or expose necessary state
// import { loadUsersAndRoles, validateUser, addUser, deleteUser, updatePassword, setUserRole, listUsers } from './userUtils.js';
// import { listDirectory, readFile, writeFile, deleteFile, handleUpload, getUserTopLevelDirectories } from './fileUtils.js';

class PData {
	/**
	 * Initializes PData. Establishes the root directory based on PD_DIR.
	 * - Root (PD_DIR): Contains users.csv, roles.csv (optional), data/, uploads/.
	 */
	constructor(config = {}) {
		console.log('[PDATA Class] Initializing...');

		// --- Initialize PData Root Directory (PD_DIR) ---
		this._initializeDataRoot(); // Sets this.dataRoot from PD_DIR

		// --- Initialize Uploads Directory ---
		this.uploadsDir = path.join(this.dataRoot, 'uploads');
		this._ensureDirectoryExists(this.uploadsDir, 'Uploads');
		this.tempUploadsDir = path.join(this.uploadsDir, 'temp'); // Multer needs this sub-dir
		this._ensureDirectoryExists(this.tempUploadsDir, 'Temp Uploads');

		// --- Set User/Role File Paths ---
		this.usersFilePath = path.join(this.dataRoot, 'users.csv'); // User file directly in PD_DIR
		this.rolesFilePath = path.join(this.dataRoot, 'roles.csv'); // Role file directly in PD_DIR (optional)

		// --- Load User and Role Data ---
		this.users = {}; // Initialize empty user cache
		this.roles = {}; // Initialize empty role cache
		this._loadRolesAndUsers(); // Load or create users.csv and roles.csv

		console.log('[PDATA Class] Initialized with configuration:');
		console.log(`  • PData Root (PD_DIR):    ${this.dataRoot}`);
		console.log(`  • Uploads Base Dir:     ${this.uploadsDir}`);
		console.log(`  • Users File Path:      ${this.usersFilePath}`);
		console.log(`  • Roles File Path:      ${this.rolesFilePath}`);
	}

	/**
	 * Initializes and validates the PData root directory from PD_DIR.
	 * @private
	 * @throws {Error} If PD_DIR is not set, not absolute, or inaccessible.
	 */
	_initializeDataRoot() {
		const dataRootPath = process.env.PD_DIR;

		if (!dataRootPath) {
			throw new Error('[PDATA Class FATAL] PD_DIR environment variable must be set (for PData root).');
		}
		if (!path.isAbsolute(dataRootPath)) {
			throw new Error(`[PDATA Class FATAL] PD_DIR must be an absolute path: ${dataRootPath}`);
		}

		try {
			// Use the internal helper to ensure it exists and is a directory
			this._ensureDirectoryExists(dataRootPath, 'PD_DIR (PData Root)');
			// Resolve to real path AFTER ensuring it exists to handle symlinks correctly
			this.dataRoot = fs.realpathSync(dataRootPath);
		} catch (error) {
			// Catch errors from _ensureDirectoryExists or realpathSync
			console.error(`[PDATA Class FATAL] Could not access, create, or resolve PD_DIR directory: ${dataRootPath}`);
			console.error(error); // Log the underlying error
			throw error; // Re-throw to stop initialization
		}
		console.log(`[PDATA Class] PData Root (PD_DIR): ${this.dataRoot}`);
	}

	/** Loads roles and user credentials from CSV files into instance maps. */
	_loadRolesAndUsers() {
		// --- Load user roles (Optional File) ---
		try {
			// Use rolesFilePath set in constructor
			this.roles = this._loadCsvFile(this.rolesFilePath, 2, (parts, map) => {
				const username = parts[0].trim();
				const role = parts[1].trim();
				if (!username || !role) {
					console.warn(`[PDATA Class WARN] Skipping role entry due to empty username or role.`);
					return;
				}
				if (map.has(username)) {
					console.warn(`[PDATA Class WARN] Duplicate username found in roles file: "${username}". Using the last entry.`);
				}
				// Basic role validation
				if (role !== 'admin' && role !== 'user') {
					console.warn(`[PDATA Class WARN] Invalid role '${role}' for user '${username}' in roles file. Skipping.`);
					return;
				}
				map.set(username, role);
			}, "Roles", true); // Mark as optional file
			console.log(`[PDATA Class] Loaded roles for ${this.roles.size} users from ${this.rolesFilePath}`);
		} catch (error) {
			console.error('[PDATA Class FATAL] Failed to load roles:', error);
			throw error; // Rethrow fatal error
		}

		// --- Load user credentials (Required File) ---
		try {
			// Use usersFilePath set in constructor
			this.users = this._loadCsvFile(this.usersFilePath, 3, (parts, map) => {
				const username = parts[0].trim();
				const salt = parts[1].trim();
				const hash = parts[2].trim();
				if (!username) {
					console.warn(`[PDATA Class WARN] Skipping user entry due to empty username in users file.`);
					return;
				}
				if (!salt || !hash) {
					console.warn(`[PDATA Class WARN] Skipping user '${username}' due to empty salt or hash in users file.`);
					return;
				}
				if (map.has(username)) {
					console.warn(`[PDATA Class WARN] Duplicate username found in users file: "${username}". Using the last entry.`);
				}
				map.set(username, { salt, hash });
			}, "Users", false); // Mark as required file
			console.log(`[PDATA Class] Loaded credentials for ${this.users.size} users from ${this.usersFilePath}`);

			// Ensure roles map has entries for all users found in users.csv, defaulting to 'user'
			for (const username of this.users.keys()) {
				if (!this.roles.has(username)) {
					console.log(`[PDATA Class] User '${username}' found in users.csv but not in roles.csv. Defaulting role to 'user'.`);
					this.roles.set(username, 'user');
					// Optionally, append the default role to roles.csv for consistency?
					// this._appendLineToFile(this.rolesFilePath, `${username},user`, 'Roles'); // Be careful about race conditions/performance
				}
			}

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
	_loadCsvFile(filePath, expectedParts, processLine, label, isOptional = false) {
		const map = new Map();
		if (!fs.existsSync(filePath)) {
			if (isOptional) {
				console.warn(`[PDATA Class WARN] Optional ${label} file not found at ${filePath}. Starting with empty ${label.toLowerCase()}.`);
				// Optionally create it here if desired: this._touchFileSync(filePath, label);
				return map;
			} else {
				// If required file doesn't exist, create it? Or throw error? Let's create it.
				console.warn(`[PDATA Class WARN] Required ${label} file not found at ${filePath}. Creating empty file.`);
				this._touchFileSync(filePath, label);
				return map; // Return empty map after creating
				// Alternatively: throw new Error(`[PDATA Class FATAL] Required ${label} file not found: ${filePath}`);
			}
		}
		 if (!fs.statSync(filePath).isFile()) {
			 throw new Error(`[PDATA Class FATAL] ${label} path exists but is not a file: ${filePath}`);
		 }
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			content.split('\n').forEach((line, index) => {
				const trimmedLine = line.trim();
				if (trimmedLine) { // Skip empty lines
					// Basic CSV parsing, assumes commas are not within fields
					const parts = trimmedLine.split(',');
					if (parts.length === expectedParts) {
						processLine(parts, map);
					} else {
						console.warn(`[PDATA Class WARN] Skipping invalid line #${index + 1} in ${label.toLowerCase()} file (expected ${expectedParts} parts, got ${parts.length}): "${line}"`);
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
			// Ensure trailing newline only if there's content
			const content = lines.length > 0 ? lines.join('\n') + '\n' : '';
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
			// Ensure file exists before appending (could happen if roles file was optional and never created)
			this._touchFileSync(filePath, label);
			// Check current content for trailing newline
			const currentContent = fs.readFileSync(filePath, 'utf8');
			if (currentContent.length > 0 && !currentContent.endsWith('\n')) {
				contentToAppend += '\n'; // Add newline if missing
			}
			contentToAppend += lineToAdd + '\n'; // Add the new line and ensure newline
			fs.appendFileSync(filePath, contentToAppend, 'utf8');
			console.log(`[PDATA Class] Successfully appended to ${label.toLowerCase()} file.`);
		} catch (error) {
			console.error(`[PDATA Class ERROR] Failed to append to ${label.toLowerCase()} file ${filePath}: ${error.message}`);
			throw new Error(`Failed to update ${label.toLowerCase()}: ${error.message}`);
		}
	}

	// --- Public User Management Methods ---
	// These now use 'this' to access instance state (users, roles, usersFilePath, rolesFilePath)

	/** Validates user credentials */
	validateUser(username, password) {
		const userData = this.users.get(username); // Use this.users
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
		if (this.users.has(username)) { // Use this.users
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
			// Use private helper methods and instance paths (this.usersFilePath, this.rolesFilePath)
			this._appendLineToFile(this.usersFilePath, userLine, 'Users');
			this._appendLineToFile(this.rolesFilePath, roleLine, 'Roles');

			// Update in-memory maps
			this.users.set(username, newUser); // Use this.users
			this.roles.set(username, role); // Use this.roles

			console.log(`[PDATA Class.addUser] Successfully added user '${username}' with role '${role}'.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.addUser ERROR] Failed to add user '${username}': ${error.message}`);
			console.error(`[PDATA Class.addUser CRITICAL] Inconsistency possible: File operations failed for addUser '${username}'.`);
			// Attempt to rollback in-memory state? Maybe not necessary if error is fatal.
			return false;
		}
	}

	/** Deletes a user */
	async deleteUser(username) {
		console.log(`[PDATA Class.deleteUser] Attempting to delete user '${username}'`);
		if (!this.users.has(username) && !this.roles.has(username)) { // Use this.users, this.roles
			console.warn(`[PDATA Class.deleteUser WARN] User '${username}' not found. Cannot delete.`);
			return false;
		}

		// Store original state for potential rollback
		const originalUser = this.users.get(username);
		const originalRole = this.roles.get(username);

		// Remove from in-memory maps first
		this.users.delete(username);
		this.roles.delete(username);
		console.log(`[PDATA Class.deleteUser] Removed '${username}' from in-memory maps.`);

		try {
			// Use private helper and instance paths/maps
			this._rewriteCsvFile(this.usersFilePath, this.users, (uname, udata) => `${uname},${udata.salt},${udata.hash}`, 'Users');
			this._rewriteCsvFile(this.rolesFilePath, this.roles, (uname, urole) => `${uname},${urole}`, 'Roles');
			console.log(`[PDATA Class.deleteUser] Successfully deleted user '${username}' and updated files.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.deleteUser ERROR] Failed to rewrite files after deleting user '${username}': ${error.message}`);
			// Rollback in-memory state
			if (originalUser) this.users.set(username, originalUser);
			if (originalRole) this.roles.set(username, originalRole);
			console.error(`[PDATA Class.deleteUser CRITICAL] Rolled back in-memory state for '${username}' due to file write failure.`);
			return false;
		}
	}

	/** Updates a user's password */
	async updatePassword(username, newPassword) {
		console.log(`[PDATA Class.updatePassword] Attempting to update password for '${username}'`);
		if (!this.users.has(username)) { // Use this.users
			console.warn(`[PDATA Class.updatePassword WARN] User '${username}' not found. Cannot update password.`);
			return false;
		}

		const newSalt = generateSalt();
		const newHashedPassword = hashPassword(newPassword, newSalt);
		if (!newHashedPassword) {
			console.error(`[PDATA Class.updatePassword ERROR] Failed to hash new password for '${username}'.`);
			return false;
		}

		const originalUserData = { ...this.users.get(username) }; // Clone original
		const updatedUserData = { salt: newSalt, hash: newHashedPassword };

		this.users.set(username, updatedUserData); // Update in-memory
		console.log(`[PDATA Class.updatePassword] Updated in-memory password hash for '${username}'.`);

		try {
			// Use private helper and instance paths/maps
			this._rewriteCsvFile(this.usersFilePath, this.users, (uname, udata) => `${uname},${udata.salt},${udata.hash}`, 'Users');
			console.log(`[PDATA Class.updatePassword] Successfully updated password for '${username}' in file.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.updatePassword ERROR] Failed to rewrite users file after updating password for '${username}': ${error.message}`);
			// Rollback in-memory state
			this.users.set(username, originalUserData);
			console.error(`[PDATA Class.updatePassword CRITICAL] Rolled back in-memory password change for '${username}' due to file write failure.`);
			return false;
		}
	}

	/** Sets a user's role */
	async setUserRole(username, newRole) {
		console.log(`[PDATA Class.setUserRole] Attempting to set role for '${username}' to '${newRole}'`);
		if (!this.users.has(username)) { // User must exist in users.csv to have a role set
			console.warn(`[PDATA Class.setUserRole WARN] User '${username}' not found in credential store. Cannot set role.`);
			return false;
		}
		if (newRole !== 'user' && newRole !== 'admin') {
			console.error(`[PDATA Class.setUserRole ERROR] Invalid role specified: '${newRole}'. Must be 'user' or 'admin'.`);
			return false;
		}

		const originalRole = this.roles.get(username); // Use this.roles

		this.roles.set(username, newRole); // Update in-memory
		console.log(`[PDATA Class.setUserRole] Updated in-memory role for '${username}' to '${newRole}'.`);

		try {
			// Use private helper and instance paths/maps
			this._rewriteCsvFile(this.rolesFilePath, this.roles, (uname, urole) => `${uname},${urole}`, 'Roles');
			console.log(`[PDATA Class.setUserRole] Successfully updated role for '${username}' in file.`);
			return true;
		} catch (error) {
			console.error(`[PDATA Class.setUserRole ERROR] Failed to rewrite roles file after setting role for '${username}': ${error.message}`);
			// Rollback in-memory state
			if (originalRole === undefined) {
				this.roles.delete(username); // If user didn't have a role before, remove it again
			} else {
				this.roles.set(username, originalRole); // Otherwise, restore the previous role
			}
			console.error(`[PDATA Class.setUserRole CRITICAL] Rolled back in-memory role change for '${username}' due to file write failure.`);
			return false;
		}
	}

	/** Lists all registered usernames */
	listUsers() {
		return Array.from(this.users.keys()); // Use this.users
	}

	/** Lists all registered usernames with their roles */
	listUsersWithRoles() {
		const userList = [];
		for (const username of this.users.keys()) {
			const role = this.roles.get(username) || 'user'; // Default to user if missing?
			userList.push({ username, role });
		}
		// Sort by username for consistent output
		userList.sort((a, b) => a.username.localeCompare(b.username));
		return userList;
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
		if (!username || !this.users.has(username)) { // Use this.users
			console.log(`[PDATA Class.can] Denied. User '${username || 'N/A'}' not found in loaded users.`);
			return false;
		}
		// Ensure resourcePath is absolute for reliable comparison
		if (!path.isAbsolute(resourcePath)) {
			console.warn(`[PDATA Class.can] Programming Error: resourcePath must be absolute. Received: ${resourcePath}. Denying access.`);
			 return false;
		}

		const role = this.roles.get(username); // Use this.roles
		// Use the resolved application data root for all checks
		const currentDataRoot = this.dataRoot;
		const userDataDirRoot = path.join(this.dataRoot, 'data'); // Define user data root path

		console.log(`[PDATA Class.can] Checking: user='${username}', role='${role || 'N/A'}', action='${action}', resource='${resourcePath}' within dataRoot='${currentDataRoot}'`);

		// Deny if user exists but has no assigned role
		if (!role) {
			console.log(`[PDATA Class.can] Denied. User '${username}' found but has no role defined.`);
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
			const userImplicitTopDir = path.join(userDataDirRoot, username);

			// Check if the resource is the user's directory itself or within it
			if (resourcePath === userImplicitTopDir || resourcePath.startsWith(userImplicitTopDir + path.sep)) {
				console.log(`[PDATA Class.can] Allowed. Resource is within user '${username}' directory '${userImplicitTopDir}'.`);
				return true;
			} else {
				// Check if the resource is within the *overall* data root (but outside the user's specific dir)
				if (resourcePath.startsWith(currentDataRoot + path.sep)) {
					// Allow read/list access to shared areas
					if (action === 'read' || action === 'list') {
						const parentDir = path.dirname(resourcePath);
						// *** Check against derived userDataDirRoot ***
						if (parentDir === currentDataRoot || parentDir === userDataDirRoot) {
							console.log(`[PDATA Class.can] Allowed (Shared Read/List). Resource '${resourcePath}' is at top level or user base level.`);
							return true;
						} else {
							console.log(`[PDATA Class.can] Denied (Shared Read/List). Resource '${resourcePath}' is too deep outside user dir.`);
							return false;
						}
					} else {
						console.log(`[PDATA Class.can] Denied. Action '${action}' not permitted for user '${username}' outside their own directory '${userImplicitTopDir}'.`);
						return false;
					}
				} else {
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
		return this.roles.get(username) || null; // Use this.roles
	 }

	/**
	 * Resolves a client-provided relative path (assumed to be relative to MD_DIR)
	 * to an absolute filesystem path based on the user's role and context.
	 * Handles security checks to prevent path traversal.
	 *
	 * @param {string} username The user making the request.
	 * @param {string} inputPath The relative path from the client (e.g., '', 'mike', 'mike/notes'). Defaults to ''.
	 * @returns {string} The resolved absolute filesystem path.
	 * @throws {Error} If access is denied or the path is invalid.
	 */
	resolvePathForUser(username, inputPath = '') {
		const userRole = this.getUserRole(username);
		if (!userRole) {
			console.error(`[resolvePathForUser FATAL] Cannot resolve path. Role not found for user: ${username}`);
			throw new Error(`User role not found for ${username}`);
		}

		console.log(`[resolvePathForUser] START: User='${username}', Role='${userRole}', InputPath='${inputPath}'`);

		// This is the actual root for user content, effectively MD_DIR
		// this.dataRoot is PD_DIR. PD_DIR/data is symlinked to MD_DIR.
		const contentRootActual = path.join(this.dataRoot, 'data'); 

		const normalizedClientPath = path.posix.normalize(inputPath || '.').replace(/^(\\.\\.[\\/\\\\])+/, '');

		if (userRole === 'admin') {
			// Admin paths are relative to contentRootActual (MD_DIR)
			const resolvedAdminPath = path.join(contentRootActual, normalizedClientPath);
			console.log(`[resolvePathForUser] Admin '${username}' mapping client path '${inputPath}' (normalized: '${normalizedClientPath}') to FS path '${resolvedAdminPath}' (contentRootActual: ${contentRootActual})`);
			
			const resolvedContentRoot = path.resolve(contentRootActual);
			if (!path.resolve(resolvedAdminPath).startsWith(resolvedContentRoot + path.sep) && path.resolve(resolvedAdminPath) !== resolvedContentRoot) {
				console.error(`[resolvePathForUser SECURITY] Critical: Admin '${username}' with input '${inputPath}' resolved to '${resolvedAdminPath}' which is OUTSIDE contentRootActual '${contentRootActual}'. Denying.`);
        		throw new Error('Security Violation: Path escape attempt detected.');
			}
			console.log(`[resolvePathForUser] END: Returning resolved path: ${resolvedAdminPath}`);
			return resolvedAdminPath;
		} else { // Non-admin user
			const userOwnDirectoryName = username; // e.g., 'rich'
			// User's root directory is within contentRootActual
			const userRootOnFs = path.join(contentRootActual, userOwnDirectoryName); // e.g., /root/pj/pd/data/rich (which is /root/pj/md/rich)
			console.log(`[resolvePathForUser] User '${username}'. Calculated userRootOnFs: ${userRootOnFs}`);

			let finalPathOnFs;

			if (normalizedClientPath === '.' || normalizedClientPath === userOwnDirectoryName) {
				finalPathOnFs = userRootOnFs;
				console.log(`[resolvePathForUser] User '${username}' requesting own root via '${inputPath}'. Mapped to: ${finalPathOnFs}`);
			}
			else if (normalizedClientPath.startsWith(userOwnDirectoryName + path.posix.sep)) {
				// Client path 'rich/notes' is relative to contentRootActual ('MD_DIR')
				finalPathOnFs = path.join(contentRootActual, normalizedClientPath);
				console.log(`[resolvePathForUser] User '${username}' requesting subpath '${inputPath}'. Mapped relative to contentRootActual: ${finalPathOnFs}`);
			}
			else {
				console.warn(`[resolvePathForUser] Denying access for user '${username}': client path '${inputPath}' (normalized: '${normalizedClientPath}') is not within their allowed scope ('${userOwnDirectoryName}/...' or '${userOwnDirectoryName}' or '').`);
				throw new Error(`Access Denied: Path '${inputPath}' is invalid or outside your allowed directory.`);
			}

			const resolvedFinalPath = path.resolve(finalPathOnFs);
			const resolvedUserRoot = path.resolve(userRootOnFs);
			if (!resolvedFinalPath.startsWith(resolvedUserRoot + path.sep) && resolvedFinalPath !== resolvedUserRoot) {
				console.error(`[resolvePathForUser SECURITY] Critical: User '${username}' with input '${inputPath}' resolved to '${resolvedFinalPath}' which is OUTSIDE their resolved root '${resolvedUserRoot}'. Denying.`);
				throw new Error('Security Violation: Attempt to access path outside user scope.');
			}

			console.log(`[resolvePathForUser] END: Returning resolved path: ${finalPathOnFs}`);
			return finalPathOnFs;
		}
	}

	// --- File Operation Methods ---
	// These now use 'this' to access instance state (dataRoot, uploadsDir) and methods (resolvePathForUser, can)

	/** List directory contents (files and dirs), handling symlinks */
	async listDirectory(username, relativePath = '') {
		const logPrefix = '[PDATA Class.listDirectory]';
		const role = this.getUserRole(username);
        console.log(`${logPrefix} START: User='${username}', Role='${role}', Requested RelativePath='${relativePath}'`);

		let absolutePathToList;
		try {
			absolutePathToList = this.resolvePathForUser(username, relativePath); // Path of the directory we are listing
            console.log(`${logPrefix} Resolved absolute path to list: ${absolutePathToList}`);
		} catch (resolveError) {
			console.error(`${logPrefix} Error resolving path '${relativePath}' for user '${username}': ${resolveError.message}`);
			throw resolveError;
		}

        console.log(`${logPrefix} Checking 'list' permission for user '${username}' on path '${absolutePathToList}'...`);
		if (!this.can(username, 'list', absolutePathToList)) {
			console.log(`${logPrefix} Permission DENIED for user '${username}' on '${absolutePathToList}'.`);
			throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
		}
        console.log(`${logPrefix} Permission GRANTED for user '${username}' on path '${absolutePathToList}'.`);

        // Base directory for calculating relative paths for display/client (not used for resolvePathForUser on entries)
        // const baseDirForDisplayRelativePath = role === 'admin' ? path.join(this.dataRoot, 'data') : path.join(this.dataRoot, 'data', username);
        // console.log(`${logPrefix} Base directory for calculating display relative paths: ${baseDirForDisplayRelativePath}`);

		try {
            console.log(`${logPrefix} Attempting to read directory contents from: ${absolutePathToList}`);
			const entries = await fsPromises.readdir(absolutePathToList, { withFileTypes: true });
            console.log(`${logPrefix} Found ${entries.length} raw entries.`);
			const dirs = [];
			const files = [];

			for (const entry of entries) {
                console.log(`${logPrefix} Processing entry: Name='${entry.name}', Type=${entry.isDirectory() ? 'Dir' : entry.isFile() ? 'File' : entry.isSymbolicLink() ? 'Link' : 'Other'}`);
				if (entry.name.startsWith('.')) {
                    console.log(`${logPrefix} Skipping hidden entry '${entry.name}'.`);
                    continue;
                }

                // Construct the full relative path for this entry, from the perspective of the content root (MD_DIR)
                // This is what resolvePathForUser expects.
                const entryRelativePathFromContentRoot = path.posix.join(relativePath, entry.name);
                console.log(`${logPrefix} Constructed entryRelativePathFromContentRoot for '${entry.name}': '${entryRelativePathFromContentRoot}' (based on dirRelativePath: '${relativePath}')`);

				// --- Process Entry ---
				try {
                    // Check 1: Resolve the entry's full relative path to ensure bounds and get its absolute path
					const entryAbsolutePath = this.resolvePathForUser(username, entryRelativePathFromContentRoot);
                    console.log(`${logPrefix} Resolved absolute path for entry '${entry.name}': '${entryAbsolutePath}'`);

                    // Check 2: Permission check on the specific item
                    const checkAction = entry.isDirectory() || entry.isSymbolicLink() ? 'list' : 'read';
                    if (!this.can(username, checkAction, entryAbsolutePath)) {
                         console.warn(`${logPrefix} Skipping entry '${entry.name}' because 'can(${checkAction})' check failed on '${entryAbsolutePath}'.`);
                         continue;
                    }
                    console.log(`${logPrefix} Permission GRANTED for '${checkAction}' on entry '${entry.name}' at '${entryAbsolutePath}'`);

					// --- Add to lists based on type ---
                    if (entry.isDirectory()) {
                         console.log(`${logPrefix} Including directory '${entry.name}'.`);
						dirs.push(entry.name);
					} else if (entry.isFile()) {
                        console.log(`${logPrefix} Including file '${entry.name}'.`);
						files.push(entry.name);
					} else if (entry.isSymbolicLink()) {
						// *** MODIFIED SYMLINK LOGIC ***
						console.log(`${logPrefix} Found symlink: '${entry.name}'. Including in list. Checking target type (best effort)...`);
						let targetType = 'unknown'; // Default if we can't determine target type
						try {
							const linkTarget = await fsPromises.readlink(entryAbsolutePath);
							const targetAbsolutePath = path.resolve(path.dirname(entryAbsolutePath), linkTarget);
							// Use lstat to check target type without following further links
							const targetStats = await fsPromises.lstat(targetAbsolutePath);
							if (targetStats.isDirectory()) {
								targetType = 'directory';
							} else if (targetStats.isFile()) {
								targetType = 'file';
							}
                            console.log(`${logPrefix} Symlink '${entry.name}' target '${linkTarget}' appears to be a ${targetType}.`);
						} catch (targetError) {
							// Log error determining target type, but still list the link
							console.warn(`${logPrefix} Could not determine target type for symlink '${entry.name}': ${targetError.message}. Listing as link.`);
                            targetType = 'link'; // Explicitly mark as link if target is inaccessible/broken
						}

                        // Add to appropriate list based on determined target type
                        if (targetType === 'directory') {
                             dirs.push(entry.name);
                        } else {
                            // Add to files list if target is file, link, or unknown type
                            files.push(entry.name);
                        }
                        // *** END MODIFIED SYMLINK LOGIC ***
					}
				} catch (entryError) {
					// ... (Inner error handling for processing a single entry) ...
                    console.warn(`${logPrefix} Error processing entry '${entry.name}' in '${absolutePathToList}': ${entryError.message}. Skipping entry.`);
                    if (!entryError.message.includes('Permission denied') && !entryError.message.includes('outside allowed base')) {
                         console.error(entryError);
                    }
				}
			} // End for loop

			dirs.sort();
			files.sort();
			console.log(`${logPrefix} Finished. Returning dirs: [${dirs.join(',')}], files: [${files.join(',')}]`);
			// *** Ensure the API endpoint using this sends back the RELATIVE path in 'pathname' ***
			// The API handler needs modification if it's not already doing this.
			// Example: return { pathname: relativePath, dirs, files };
			return { dirs, files }; // Return just dirs/files for now, API needs to add pathname

		} catch (error) { // Outer catch for readdir failure
            console.error(`${logPrefix} Error reading directory '${absolutePathToList}':`, error);
            if (error.code === 'ENOENT') {
                // This case should ideally not happen if resolvePathForUser worked, but handle defensively.
                console.error(`${logPrefix} Directory not found: ${absolutePathToList}`);
                throw new Error(`Directory not found: '${relativePath || '/'}'.`);
            }
            if (error.code === 'EACCES') {
                 console.error(`${logPrefix} Permission denied reading directory: ${absolutePathToList}`);
                 throw new Error(`Permission denied reading contents of '${relativePath || '/'}'.`);
            }
            // Rethrow other unexpected errors
			throw new Error(`Failed to list contents for '${relativePath || '/'}': ${error.message}`);
		}
	} // End listDirectory

	/** Read file content */
	async readFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		let absolutePath;
		try {
			absolutePath = this.resolvePathForUser(username, relativePath); // Use user-specific resolver
		} catch (resolveError) {
			console.error(`[PDATA Class.readFile] Error resolving path '${relativePath}' for user '${username}': ${resolveError.message}`);
			throw resolveError;
		}

		if (!this.can(username, 'read', absolutePath)) {
			console.log(`[PDATA Class.readFile] Permission denied for user '${username}' on '${absolutePath}'.`);
			throw new Error(`Permission denied to read file '${relativePath}'.`);
		}

		try {
			// Use lstat to check type without following symlinks initially
			const stats = await fsPromises.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`'${relativePath}' is not a readable file or symlink.`);
			}
			// If it's a symlink, lstat already verified we have 'read' access *to the link itself*.
			// readFile will follow the link; Node's underlying fs operations handle target permissions.
			const content = await fsPromises.readFile(absolutePath, 'utf8');
			console.log(`[PDATA Class.readFile] Successfully read file '${absolutePath}' for user '${username}'.`);
			return content;
		} catch (error) {
			console.error(`[PDATA Class.readFile] Error reading file '${absolutePath}':`, error);
			if (error.code === 'ENOENT') throw new Error(`File not found: '${relativePath}'.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied reading file: '${relativePath}'.`);
			else if (error.message.includes('not a readable file or symlink')) throw error;
			else if (error.code === 'EISDIR') throw new Error(`Cannot read file: '${relativePath}' is a directory.`);
			else throw new Error(`Failed to read file '${relativePath}': ${error.message}`);
		}
	}

	/** Write content to a file */
	async writeFile(username, relativePath, content) {
		if (!relativePath) throw new Error("File path is required.");
		if (content === undefined) throw new Error("Content is required for writeFile.");

		let absolutePath;
		let dirAbsolutePath;
		try {
			absolutePath = this.resolvePathForUser(username, relativePath); // Use user-specific resolver
			dirAbsolutePath = path.dirname(absolutePath);
			// Verify the target directory is also resolvable/within bounds for the user
			const dirRelativePath = path.relative(
				this.getUserRole(username) === 'admin' ? this.dataRoot : path.join(this.dataRoot, 'data', username),
				dirAbsolutePath
			);
			this.resolvePathForUser(username, dirRelativePath);

		} catch (resolveError) {
			console.error(`[PDATA Class.writeFile] Error resolving path '${relativePath}' for user '${username}': ${resolveError.message}`);
			throw resolveError;
		}

		// Check permission to write in the *directory* first
		if (!this.can(username, 'write', dirAbsolutePath)) {
			console.log(`[PDATA Class.writeFile] Permission denied for user '${username}' to write in directory '${dirAbsolutePath}'.`);
			throw new Error(`Permission denied to write in directory '${path.dirname(relativePath)}'.`);
		}

		// Check if file exists and if user can overwrite *it*
		try {
			const stats = await fsPromises.lstat(absolutePath);
			// Allow overwriting files and symlinks, but not directories
			if (stats.isDirectory()) {
				throw new Error(`Cannot overwrite: '${relativePath}' exists and is a directory.`);
			}
			// If it exists (file/symlink), check 'write' permission on the item itself
			if (!this.can(username, 'write', absolutePath)) {
				console.log(`[PDATA Class.writeFile] Permission denied for user '${username}' to overwrite existing file/link '${absolutePath}'.`);
				throw new Error(`Permission denied to overwrite file '${relativePath}'.`);
			}
		} catch (statError) {
			if (statError.code === 'ENOENT') {
				/* File doesn't exist, this is okay, proceed to write */
				// Check write permission on the parent directory again (redundant but safe)
				if (!this.can(username, 'write', dirAbsolutePath)) {
					throw new Error(`Permission denied to create file in directory '${path.dirname(relativePath)}'.`);
				}
			}
			else if (statError.message.startsWith('Cannot overwrite:')) throw statError;
			else {
				console.error(`[PDATA Class.writeFile] Error stating existing path '${absolutePath}':`, statError);
				throw new Error(`Failed to check existing path status for '${relativePath}': ${statError.message}`);
			}
		}

		// Proceed with writing
		try {
			// Ensure directory exists before writing file
			await fsPromises.mkdir(dirAbsolutePath, { recursive: true });
			await fsPromises.writeFile(absolutePath, content, 'utf8');
			console.log(`[PDATA Class.writeFile] Successfully wrote file '${absolutePath}' for user '${username}'.`);
		} catch (error) {
			console.error(`[PDATA Class.writeFile] Error writing file '${absolutePath}':`, error);
			if (error.code === 'EACCES') throw new Error(`Permission denied writing file: '${relativePath}'.`);
			else if (error.code === 'EISDIR') throw new Error(`Cannot write file: '${relativePath}' is a directory.`); // Should be caught earlier
			else throw new Error(`Failed to write file '${relativePath}': ${error.message}`);
		}
	}

	/** Delete a file or a symbolic link */
	async deleteFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		let absolutePath;
		try {
			absolutePath = this.resolvePathForUser(username, relativePath); // Use user-specific resolver
		} catch (resolveError) {
			console.error(`[PDATA Class.deleteFile] Error resolving path '${relativePath}' for user '${username}': ${resolveError.message}`);
			throw resolveError;
		}

		if (!this.can(username, 'delete', absolutePath)) {
			console.log(`[PDATA Class.deleteFile] Permission denied for user '${username}' on '${absolutePath}'.`);
			throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
		}

		try {
			const stats = await fsPromises.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
			}
			await fsPromises.unlink(absolutePath); // unlink works for files and symlinks
			console.log(`[PDATA Class.deleteFile] Successfully deleted file/link '${absolutePath}' for user '${username}'.`);
		} catch (error) {
			console.error(`[PDATA Class.deleteFile] Error deleting file/link '${absolutePath}':`, error);
			if (error.code === 'ENOENT') throw new Error(`File or link not found: '${relativePath}'. Cannot delete.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied deleting file/link: '${relativePath}'.`);
			else if (error.code === 'EPERM' || error.code === 'EISDIR') {
				// EPERM on Windows, EISDIR on Unix when trying to unlink a directory
				throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
			}
			else if (error.message.includes('not a file or symbolic link')) throw error;
			else throw new Error(`Failed to delete file/link '${relativePath}': ${error.message}`);
		}
	}

	/** Get user's top-level directories (within their specific base directory) */
	async getUserTopLevelDirectories(username) {
		const logPrefix = '[PDATA Class.getUserTopLevelDirs]';
		const role = this.getUserRole(username);
		if (!role) {
            console.error(`${logPrefix} Failed: User '${username}' not found or has no role.`);
			throw new Error(`Cannot list directories: User '${username}' not found or has no role.`);
		}
        console.log(`${logPrefix} User='${username}', Role='${role}'`);

        // *** Calculate base directory using dataRoot ***
		const userBaseDir = role === 'admin' ? this.dataRoot : path.join(this.dataRoot, 'data', username);
        console.log(`${logPrefix} Determined base directory: ${userBaseDir}`);

        // *** Ensure the base directory itself exists BEFORE checking permissions or reading ***
		try {
			this._ensureDirectoryExists(userBaseDir, `Base dir for ${username}`);
            console.log(`${logPrefix} Ensured base directory exists.`);
		} catch (ensureError) {
			console.error(`${logPrefix} Failed to ensure base directory '${userBaseDir}' exists: ${ensureError.message}`);
			throw new Error(`Failed to access base directory for '${username}': ${ensureError.message}`);
		}

        // *** Check permission to list the base directory ***
		if (!this.can(username, 'list', userBaseDir)) {
			console.error(`${logPrefix} Permission denied check failed for user '${username}' to list their base directory '${userBaseDir}'.`);
			throw new Error(`Permission denied to access base directory for '${username}'.`);
		}
        console.log(`${logPrefix} Permission check 'list' on base directory '${userBaseDir}' passed.`);

		try {
            // *** Read the directory entries ***
			console.log(`${logPrefix} Reading directory entries from '${userBaseDir}'...`);
			const entries = await fsPromises.readdir(userBaseDir, { withFileTypes: true });
            console.log(`${logPrefix} Found ${entries.length} raw entries.`);
			const dirs = [];
			for (const entry of entries) {
                console.log(`${logPrefix} Processing entry: Name='${entry.name}', Type=${entry.isDirectory() ? 'Dir' : entry.isFile() ? 'File' : entry.isSymbolicLink() ? 'Link' : 'Other'}`);
				if (entry.name.startsWith('.')) {
                    console.log(`${logPrefix} Skipping hidden entry '${entry.name}'.`);
                    continue; // Skip hidden
                }
				const entryAbsolutePath = path.join(userBaseDir, entry.name);
				try {
					const stats = await fsPromises.lstat(entryAbsolutePath); // Use lstat to check type
					if (stats.isDirectory()) {
						// Verify the directory is still within bounds (paranoid check)
                        try {
						    this.resolvePathForUser(username, entry.name);
                            console.log(`${logPrefix} Including directory '${entry.name}'.`);
						    dirs.push(entry.name);
                        } catch (resolveCheckError) {
                             console.warn(`${logPrefix} Skipping directory '${entry.name}' because it failed bounds check: ${resolveCheckError.message}`);
                        }
					} else if (stats.isSymbolicLink()){
						// Optionally list symlinks that point to directories within bounds
						try {
                            // Resolve the target using resolvePathForUser to check bounds
							const finalResolvedTargetPath = this.resolvePathForUser(username, entry.name);
							const targetStats = await fsPromises.stat(finalResolvedTargetPath); // Use stat to follow link
							if(targetStats.isDirectory()){
								console.log(`${logPrefix} Including directory symlink '${entry.name}' pointing to '${finalResolvedTargetPath}'.`);
								dirs.push(entry.name);
							} else {
                                 console.log(`${logPrefix} Skipping symlink '${entry.name}' because target is not a directory.`);
                            }
						} catch(linkError){
							console.warn(`${logPrefix} Skipping symlink '${entry.name}' due to error resolving/checking target: ${linkError.message}`);
						}
					} else {
                        console.log(`${logPrefix} Skipping entry '${entry.name}' because it's not a directory or directory symlink.`);
                    }
				} catch (entryError) {
					console.warn(`${logPrefix} Error processing entry '${entry.name}' for user '${username}': ${entryError.message}. Skipping.`);
				}
			}
			dirs.sort();
			console.log(`${logPrefix} Finished. Found top-level dirs for '${username}': [${dirs.join(',')}]`);
			return dirs;
		} catch (error) {
			// Handle if the base directory doesn't exist (should be caught by ensureDir now)
			if (error.code === 'ENOENT') {
				console.error(`${logPrefix} CRITICAL: Base directory '${userBaseDir}' reported as non-existent during readdir, despite earlier check.`);
                return []; // Return empty list, though this indicates a problem
			}
            if (error.code === 'EACCES') {
                console.error(`${logPrefix} CRITICAL: Permission denied reading base directory '${userBaseDir}' during readdir, despite passing 'can' check.`);
                throw new Error(`Permission denied listing directory contents for '${username}'.`);
            }
			console.error(`${logPrefix} Unexpected error reading user base directory '${userBaseDir}' for '${username}':`, error);
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

		// Security: Basic filename sanitization
		const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_.-]/g, '_');
		const timestamp = Date.now();
		const randomPart = Math.random().toString(36).substring(2, 8);
		const ext = path.extname(safeOriginalName);
		// Construct a unique filename, avoiding potential collisions or exploits
		const uniqueFilename = `${timestamp}-${randomPart}${ext || '.upload'}`; // Add default ext if missing
		const destinationPath = path.join(finalUploadsDir, uniqueFilename);
		const relativeUrlPath = `/uploads/${uniqueFilename}`; // Path used for accessing via web server

		try {
			console.log(`${logPrefix} Moving upload from ${tempPath} to ${destinationPath}`);
			// Ensure the final uploads directory exists (might be redundant if checked at init)
			this._ensureDirectoryExists(finalUploadsDir, 'Uploads Target');
			// Move the file
			await fsPromises.rename(tempPath, destinationPath);
			console.log(`${logPrefix} Upload successful: ${relativeUrlPath}`);
			return relativeUrlPath; // Return the web-accessible path
		} catch (error) {
			console.error(`${logPrefix} Failed to move uploaded file ${tempPath} to ${destinationPath}: ${error.message}`);
			// Attempt to clean up the temporary file if move fails
			try { await fsPromises.unlink(tempPath); console.log(`${logPrefix} Cleaned up temporary file ${tempPath}`); }
			catch (cleanupError) { console.error(`${logPrefix} Failed to cleanup temp upload file ${tempPath}: ${cleanupError.message}`); }
			throw new Error(`Failed to save uploaded file: ${error.message}`);
		}
	}

} // End PData Class

// Export the PData class
export { PData };
