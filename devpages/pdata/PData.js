import path from 'path';
import fs from 'fs-extra';
import { generateSalt, hashPassword } from './userUtils.js';
import { PathManager } from './utils/PathManager.js';

class PData {
	constructor(config = {}) {
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

		// --- Define allowed roles ---
		this.allowedRoles = ['admin', 'user', 'project'];

		// --- Load User and Role Data ---
		this.users = new Map(); // Initialize empty user cache
		this.roles = new Map(); // Initialize empty role cache
		this._loadRolesAndUsers(); // Load or create users.csv and roles.csv
		
		// --- Initialize PathManager ---
		this.pathManager = new PathManager({
			dataRoot: this.dataRoot,
			roles: this.roles
		});
	}

	_initializeDataRoot() {
		const dataRootPath = process.env.PD_DIR;

		if (!dataRootPath) {
			throw new Error('[PDATA Class FATAL] PD_DIR environment variable must be set (for PData root).');
		}
		if (!path.isAbsolute(dataRootPath)) {
			throw new Error(`[PDATA Class FATAL] PD_DIR must be an absolute path: ${dataRootPath}`);
		}

		try {
			this._ensureDirectoryExists(dataRootPath, 'PD_DIR (PData Root)');
			this.dataRoot = fs.realpathSync(dataRootPath);
		} catch (error) {
			throw error;
		}
	}

	_loadRolesAndUsers() {
		// --- Load user roles (Optional File) ---
		try {
			this.roles = this._loadCsvFile(this.rolesFilePath, 2, (parts, map) => {
				const username = parts[0].trim();
				const role = parts[1].trim();
				if (!username || !role) {
					return;
				}
				// Updated to allow admin, user, and project roles
				if (!this.allowedRoles.includes(role)) {
					console.warn(`[PDATA Class] Skipping unknown role '${role}' for user '${username}'. Allowed roles: ${this.allowedRoles.join(', ')}`);
					return;
				}
				map.set(username, role);
			}, "Roles", true);
		} catch (error) {
			throw error;
		}

		// --- Load user credentials (Required File) ---
		try {
			this.users = this._loadCsvFile(this.usersFilePath, 3, (parts, map) => {
				const username = parts[0].trim();
				const salt = parts[1].trim();
				const hash = parts[2].trim();
				if (!username) {
					return;
				}
				if (!salt || !hash) {
					return;
				}
				map.set(username, { salt, hash });
			}, "Users", false);

			// Ensure roles map has entries for all users found in users.csv, defaulting to 'user'
			for (const username of this.users.keys()) {
				if (!this.roles.has(username)) {
					this.roles.set(username, 'user');
				}
			}
		} catch (error) {
			throw error;
		}
	}

	_ensureDirectoryExists(dirPath, label) {
		try {
			// Use fs-extra's ensureDir function which is more robust than mkdirSync
			fs.ensureDirSync(dirPath);
			if (!fs.statSync(dirPath).isDirectory()) {
				throw new Error(`${label} path exists but is not a directory: ${dirPath}`);
			}
		} catch (error) {
			throw new Error(`Failed to setup ${label.toLowerCase()} directory: ${error.message}`);
		}
	}

	_touchFileSync(filePath, label) {
		try {
			if (!fs.existsSync(filePath)) {
				fs.writeFileSync(filePath, ''); // Create empty file
			} else if (!fs.statSync(filePath).isFile()) {
				throw new Error(`${label} path exists but is not a file: ${filePath}`);
			}
		} catch(error) {
			throw new Error(`Failed to ensure ${label.toLowerCase()} file: ${error.message}`);
		}
	}

	_loadCsvFile(filePath, expectedParts, processLine, label, isOptional = false) {
		const map = new Map();
		if (!fs.existsSync(filePath)) {
			if (isOptional) {
				return map;
			} else {
				this._touchFileSync(filePath, label);
				return map;
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
					}
				}
			});
			return map;
		} catch (error) {
			throw new Error(`Failed to parse ${label.toLowerCase()} file: ${error.message}`);
		}
	}

	_rewriteCsvFile(filePath, map, formatLine, label) {
		try {
			const lines = [];
			map.forEach((value, key) => {
				const line = formatLine(key, value);
				if (line) lines.push(line);
			});
			fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
		} catch (error) {
			throw new Error(`Failed to rewrite ${label.toLowerCase()} file: ${error.message}`);
		}
	}

	_appendLineToFile(filePath, lineToAdd, label) {
		try {
			fs.appendFileSync(filePath, lineToAdd + '\n', 'utf8');
		} catch (error) {
			throw new Error(`Failed to append to ${label.toLowerCase()} file: ${error.message}`);
		}
	}

	validateUser(username, password) {
		if (!username || !password) return false;

		const user = this.users.get(username);
		if (!user || !user.salt || !user.hash) return false;

		try {
			const { salt, hash: storedHash } = user;
			const calculatedHash = hashPassword(password, salt);
			return calculatedHash === storedHash;
		} catch (error) {
			return false;
		}
	}

	async addUser(username, password, role = 'user') {
		if (!username || !password) {
			throw new Error('Username and password are required.');
		}
		
		if (this.users.has(username)) {
			throw new Error(`User '${username}' already exists.`);
		}

		// Create user entry with hashed credentials
		const salt = generateSalt();
		const hash = hashPassword(password, salt);
		
		// Add to users.csv
		const userLine = `${username},${salt},${hash}`;
		await this._appendLineToFile(this.usersFilePath, userLine, 'Users');
		
		// Add to roles.csv if not already there
		if (!this.roles.has(username)) {
			const roleLine = `${username},${role}`;
			await this._appendLineToFile(this.rolesFilePath, roleLine, 'Roles');
		}
		
		// Update in-memory maps
		this.users.set(username, { salt, hash });
		this.roles.set(username, role);
		
		return true;
	}

	async deleteUser(username) {
		if (!username) {
			throw new Error('Username is required.');
		}
		
		if (!this.users.has(username)) {
			throw new Error(`User '${username}' not found.`);
		}
		
		// Remove from in-memory maps
		this.users.delete(username);
		this.roles.delete(username);
		
		// Rewrite users.csv without the deleted user
		await this._rewriteCsvFile(
			this.usersFilePath,
			this.users,
			(u, creds) => `${u},${creds.salt},${creds.hash}`,
			'Users'
		);
		
		// Rewrite roles.csv without the deleted user
		await this._rewriteCsvFile(
			this.rolesFilePath,
			this.roles,
			(u, r) => `${u},${r}`,
			'Roles'
		);
		
		return true;
	}

	async updatePassword(username, newPassword) {
		if (!username || !newPassword) {
			throw new Error('Username and new password are required.');
		}
		
		if (!this.users.has(username)) {
			throw new Error(`User '${username}' not found.`);
		}
		
		// Update credentials
		const salt = generateSalt();
		const hash = hashPassword(newPassword, salt);
		
		// Update in-memory map
		this.users.set(username, { salt, hash });
		
		// Rewrite users.csv with updated credentials
		await this._rewriteCsvFile(
			this.usersFilePath,
			this.users,
			(u, creds) => `${u},${creds.salt},${creds.hash}`,
			'Users'
		);
		
		return true;
	}

	async setUserRole(username, newRole) {
		if (!username || !newRole) {
			throw new Error('Username and new role are required.');
		}
		
		if (!this.users.has(username)) {
			throw new Error(`User '${username}' not found.`);
		}
		
		// Updated to allow admin, user, and project roles
		if (!this.allowedRoles.includes(newRole)) {
			throw new Error(`Invalid role: '${newRole}'. Valid roles are: ${this.allowedRoles.join(', ')}.`);
		}
		
		// Update in-memory map
		this.roles.set(username, newRole);
		
		// Rewrite roles.csv with updated role
		await this._rewriteCsvFile(
			this.rolesFilePath,
			this.roles,
			(u, r) => `${u},${r}`,
			'Roles'
		);
		
		return true;
	}

	listUsers() {
		return Array.from(this.users.keys());
	}
	
	listUsersWithRoles() {
		const result = {};
		this.users.forEach((_, username) => {
			result[username] = this.roles.get(username) || 'user';
		});
		return result;
	}

	async can(username, action, resourcePath) {
		return this.pathManager.can(username, action, resourcePath);
	}

	getUserRole(username) {
		if (this.roles instanceof Map) {
			return this.roles.get(username) || null;
		} else if (typeof this.roles === 'object' && this.roles !== null) {
			return this.roles[username] || null;
		}
		return null;
	}

	async resolvePathForUser(username, inputPath = '') {
		return this.pathManager.resolvePathForUser(username, inputPath);
	}

	async listDirectory(username, relativePath = '') {
		const role = this.getUserRole(username);

		let absolutePathToList;
		try {
			absolutePathToList = await this.pathManager.resolvePathForUser(username, relativePath);
		} catch (resolveError) {
			throw resolveError;
		}

		if (!await this.pathManager.can(username, 'list', absolutePathToList)) {
			throw new Error(`Permission denied to list directory '${relativePath || '/'}'.`);
		}

		try {
			const entries = await fs.readdir(absolutePathToList, { withFileTypes: true });
			const dirs = [];
			const files = [];

			for (const entry of entries) {
				if (entry.name.startsWith('.')) {
					continue;
				}

				// Construct the full relative path for this entry
				const entryRelativePathFromContentRoot = path.posix.join(relativePath, entry.name);

				try {
					// Check 1: Resolve the entry's full relative path to ensure bounds
					const entryAbsolutePath = await this.pathManager.resolvePathForUser(username, entryRelativePathFromContentRoot);

					// Check 2: Permission check on the specific item
					const checkAction = entry.isDirectory() || entry.isSymbolicLink() ? 'list' : 'read';
					if (!await this.pathManager.can(username, checkAction, entryAbsolutePath)) {
						continue;
					}

					// --- Add to lists based on type ---
					if (entry.isDirectory()) {
						dirs.push(entry.name);
					} else if (entry.isFile()) {
						files.push(entry.name);
					} else if (entry.isSymbolicLink()) {
						// Handle symlinks with improved handling
						const { isSymlink, targetPath, canAccess } = 
							await this.pathManager.resolveSymlink(username, entryAbsolutePath, checkAction);
							
						if (isSymlink && targetPath && canAccess) {
							try {
								const targetStats = await fs.lstat(targetPath);
								if (targetStats.isDirectory()) {
									dirs.push(entry.name);
								} else {
									files.push(entry.name);
								}
							} catch (targetError) {
								// Broken symlink, still add to files
								files.push(entry.name);
							}
						}
					}
				} catch (entryError) {
					// Skip entries with errors
					continue;
				}
			}

			dirs.sort();
			files.sort();
			return { dirs, files };

		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error(`Directory not found: '${relativePath || '/'}'.`);
			}
			if (error.code === 'EACCES') {
				throw new Error(`Permission denied reading contents of '${relativePath || '/'}'.`);
			}
			throw new Error(`Failed to list contents for '${relativePath || '/'}': ${error.message}`);
		}
	}

	async readFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		
		let absolutePath;
		try {
			absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);
		} catch (resolveError) {
			throw resolveError;
		}

		// Check permission on the file (symlink itself, not its target yet)
		if (!await this.pathManager.can(username, 'read', absolutePath)) {
			throw new Error(`Permission denied to read file '${relativePath}'.`);
		}

		try {
			// Check if path exists and is a symlink
			const { isSymlink, targetPath, canAccess } = 
				await this.pathManager.resolveSymlink(username, absolutePath, 'read');
			
			if (isSymlink) {
				// It's a symlink
				if (!targetPath) {
					throw new Error(`Symlink target for '${relativePath}' could not be resolved.`);
				}
				
				if (!canAccess) {
					throw new Error(`Permission denied to read symlink target for '${relativePath}'.`);
				}
				
				// Check if target is a readable file
				const targetStats = await fs.lstat(targetPath);
				if (!targetStats.isFile()) {
					throw new Error(`Symlink target '${relativePath}' is not a readable file.`);
				}
				
				try {
					const content = await fs.readFile(targetPath, 'utf8');
					return content;
				} catch (readError) {
					throw new Error(`Failed to read symlink target: ${readError.message}`);
				}
			} else {
				// Regular file
				const stats = await fs.lstat(absolutePath);
				if (stats.isFile()) {
					const content = await fs.readFile(absolutePath, 'utf8');
					return content;
				} else {
					throw new Error(`'${relativePath}' is not a readable file or symlink.`);
				}
			}
		} catch (error) {
			if (error.code === 'ENOENT') throw new Error(`File not found: '${relativePath}'.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied reading file: '${relativePath}'.`);
			else if (error.message.includes('not a readable file or symlink')) throw error;
			else if (error.code === 'EISDIR') throw new Error(`Cannot read file: '${relativePath}' is a directory.`);
			else throw new Error(`Failed to read file '${relativePath}': ${error.message}`);
		}
	}

	async writeFile(username, relativePath, content) {
		if (!relativePath) throw new Error("File path is required.");
		if (content === undefined) throw new Error("Content is required for writeFile.");

		let absoluteFilePath;
		try {
			absoluteFilePath = await this.pathManager.resolvePathForUser(username, relativePath);
			
			// Check if file is a symlink using the improved PathManager
			const { isSymlink, targetPath, canAccess } = 
				await this.pathManager.resolveSymlink(username, absoluteFilePath, 'write');
			
			if (isSymlink) {
				if (!targetPath) {
					throw new Error(`Symlink target for '${relativePath}' could not be resolved.`);
				}
				
				if (!canAccess) {
					throw new Error(`Permission denied to write to symlink target for '${relativePath}'.`);
				}
				
				// Write to the symlink target
				const parentDirOfTarget = path.dirname(targetPath);
				await fs.ensureDir(parentDirOfTarget);
				await fs.writeFile(targetPath, content, 'utf8');
				return true;
			}
			
			// Regular file write
			const parentDirAbsolute = path.dirname(absoluteFilePath);

			// Check permission to write in the directory
			if (!await this.pathManager.can(username, 'write', parentDirAbsolute)) {
				throw new Error(`Permission denied to write in directory '${path.dirname(relativePath)}'.`);
			}

			// Ensure directory exists before writing file
			await fs.ensureDir(parentDirAbsolute);
			await fs.writeFile(absoluteFilePath, content, 'utf8');

			return true;
		} catch (error) {
			if (error.code === 'EACCES') 
				throw new Error(`Permission denied writing file: '${relativePath}'.`);
			else if (error.code === 'EISDIR') 
				throw new Error(`Cannot write file: '${relativePath}' is a directory.`);
			else 
				throw new Error(`Failed to write file '${relativePath}': ${error.message}`);
		}
	}

	async deleteFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		
		let absolutePath;
		try {
			absolutePath = await this.pathManager.resolvePathForUser(username, relativePath);
		} catch (resolveError) {
			throw resolveError;
		}

		if (!await this.pathManager.can(username, 'delete', absolutePath)) {
			throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
		}

		try {
			const stats = await fs.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
			}
			
			await fs.remove(absolutePath);
		} catch (error) {
			if (error.code === 'ENOENT') throw new Error(`File or link not found: '${relativePath}'. Cannot delete.`);
			else if (error.code === 'EACCES') throw new Error(`Permission denied deleting file/link: '${relativePath}'.`);
			else if (error.code === 'EPERM' || error.code === 'EISDIR') {
				throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
			}
			else if (error.message.includes('not a file or symbolic link')) throw error;
			else throw new Error(`Failed to delete file/link '${relativePath}': ${error.message}`);
		}
	}

	async handleUpload(file) {
		if (!file || !file.path || !file.originalname) {
			throw new Error('Invalid file object provided for upload.');
		}

		const tempPath = file.path;
		const finalUploadsDir = this.uploadsDir;

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
			// Use fs-extra's ensureDir which is more reliable than _ensureDirectoryExists
			await fs.ensureDir(finalUploadsDir);
			
			// Use fs-extra's move instead of rename (more robust across devices)
			await fs.move(tempPath, destinationPath, { overwrite: true });
			return relativeUrlPath; // Return the web-accessible path
		} catch (error) {
			// Attempt to clean up the temporary file if move fails
			try { 
				if (await fs.pathExists(tempPath)) {
					await fs.remove(tempPath);
				}
			} catch (cleanupError) { }
			throw new Error(`Failed to save uploaded file: ${error.message}`);
		}
	}

	async createSymlink(username, relativePath, targetPath) {
		if (!relativePath || !targetPath) {
			throw new Error("Source and target paths are required.");
		}
		
		// Resolve the symlink path
		let absoluteSymlinkPath;
		try {
			absoluteSymlinkPath = await this.pathManager.resolvePathForUser(username, relativePath);
		} catch (resolveError) {
			throw resolveError;
		}
		
		// Ensure user has permission to create symlink in the directory
		const parentDirAbsolute = path.dirname(absoluteSymlinkPath);
		if (!await this.pathManager.can(username, 'write', parentDirAbsolute)) {
			throw new Error(`Permission denied to create symlink in directory '${path.dirname(relativePath)}'.`);
		}
		
		// Resolve the target path
		let absoluteTargetPath;
		try {
			// First try to resolve as if it's a relative path within user's context
			absoluteTargetPath = await this.pathManager.resolvePathForUser(username, targetPath);
		} catch (resolveError) {
			// If that fails, check if it's an absolute path
			if (path.isAbsolute(targetPath)) {
				// For security, only allow absolute paths for admin users
				const role = this.getUserRole(username);
				if (role === 'admin') {
					absoluteTargetPath = targetPath;
				} else {
					throw new Error(`Permission denied: Regular users cannot specify absolute target paths.`);
				}
			} else {
				throw resolveError;
			}
		}
		
		// Check if target exists (warning only)
		try {
			await fs.access(absoluteTargetPath);
		} catch (accessError) {
			console.warn(`Creating symlink to non-existent target: ${absoluteTargetPath}`);
		}
		
		try {
			// Create relative symlink for better portability
			const relativeTargetPath = path.relative(path.dirname(absoluteSymlinkPath), absoluteTargetPath);
			
			// Remove existing file/symlink if it exists
			if (await fs.pathExists(absoluteSymlinkPath)) {
				const stats = await fs.lstat(absoluteSymlinkPath);
				if (stats.isFile() || stats.isSymbolicLink()) {
					await fs.unlink(absoluteSymlinkPath);
				} else {
					throw new Error(`Cannot create symlink: '${relativePath}' exists and is not a file or symlink.`);
				}
			}
			
			// Ensure parent directory exists
			await fs.ensureDir(parentDirAbsolute);
			
			// Create the symlink
			await fs.symlink(relativeTargetPath, absoluteSymlinkPath);
			return true;
		} catch (error) {
			if (error.code === 'EACCES') 
				throw new Error(`Permission denied creating symlink: '${relativePath}'.`);
			else 
				throw new Error(`Failed to create symlink '${relativePath}': ${error.message}`);
		}
	}

	async getAvailableTopDirs(username) {
		return this.pathManager.getAvailableTopDirs(username);
	}

	// Helper method to get allowed roles
	getAllowedRoles() {
		return [...this.allowedRoles];
	}
}

export { PData };
