import path from 'path';
import fs from 'fs-extra';
import { generateSalt, hashPassword } from './userUtils.js';

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

		// --- Load User and Role Data ---
		this.users = new Map(); // Initialize empty user cache
		this.roles = new Map(); // Initialize empty role cache
		this._loadRolesAndUsers(); // Load or create users.csv and roles.csv
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
				if (role !== 'admin' && role !== 'user') {
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
		
		if (newRole !== 'admin' && newRole !== 'user') {
			throw new Error(`Invalid role: '${newRole}'. Valid roles are 'admin' and 'user'.`);
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

	can(username, action, resourcePath) {
		// Ensure user exists in the system before checking roles/permissions
		if (!username || !this.users.has(username)) {
			return false;
		}
		// Ensure resourcePath is absolute for reliable comparison
		if (!path.isAbsolute(resourcePath)) {
			return false;
		}

		const role = this.roles.get(username);
		// Use the resolved application data root for all checks
		const currentDataRoot = this.dataRoot;
		const userDataDirRoot = path.join(this.dataRoot, 'data');
		const uploadsDir = path.join(this.dataRoot, 'uploads');

		// Deny if user exists but has no assigned role
		if (!role) {
			return false;
		}

		// Special case for uploads directory - allow access for all users
		if (resourcePath === uploadsDir || resourcePath.startsWith(uploadsDir + path.sep)) {
			return true;
		}

		// --- Admin Check ---
		// Admins can do anything *within* the application data root.
		if (role === 'admin') {
			if (resourcePath.startsWith(currentDataRoot + path.sep) || resourcePath === currentDataRoot) {
				return true;
			} else {
				return false;
			}
		}

		// --- User Role Check ---
		if (role === 'user') {
			// Users primarily operate within their implicit top-level directory
			const userImplicitTopDir = path.join(userDataDirRoot, username);

			// Check if the resource is the user's directory itself or within it
			if (resourcePath === userImplicitTopDir || resourcePath.startsWith(userImplicitTopDir + path.sep)) {
				return true;
			} else {
				// Check if the resource is within the *overall* data root (but outside the user's specific dir)
				if (resourcePath.startsWith(currentDataRoot + path.sep)) {
					// Allow read/list access to shared areas
					if (action === 'read' || action === 'list') {
						const parentDir = path.dirname(resourcePath);
						// *** Check against derived userDataDirRoot ***
						if (parentDir === currentDataRoot || parentDir === userDataDirRoot) {
							return true;
						} else {
							return false;
						}
					} else {
						return false;
					}
				} else {
					return false;
				}
			}
		}

		// --- Default Deny for unknown roles ---
		return false;
	}

	getUserRole(username) {
		if (this.roles instanceof Map) {
			return this.roles.get(username) || null;
		} else if (typeof this.roles === 'object' && this.roles !== null) {
			return this.roles[username] || null;
		}
		return null;
	}

	resolvePathForUser(username, inputPath = '') {
		const userRole = this.getUserRole(username);
		if (!userRole) {
			throw new Error(`User role not found for ${username}`);
		}

		// This is the actual root for user content, effectively MD_DIR
		// this.dataRoot is PD_DIR. PD_DIR/data is symlinked to MD_DIR.
		const contentRootActual = path.join(this.dataRoot, 'data'); 

		const normalizedClientPath = path.posix.normalize(inputPath || '.').replace(/^(\\.\\.[\\/\\\\])+/, '');

		// Special case for 'uploads' directory - accessible to all users
		if (normalizedClientPath === 'uploads' || normalizedClientPath.startsWith('uploads/')) {
			const uploadsPath = path.join(this.dataRoot, normalizedClientPath);
			return uploadsPath;
		}

		if (userRole === 'admin') {
			// Admin paths are relative to contentRootActual (MD_DIR)
			const resolvedAdminPath = path.join(contentRootActual, normalizedClientPath);
			
			const resolvedContentRoot = path.resolve(contentRootActual);
			if (!path.resolve(resolvedAdminPath).startsWith(resolvedContentRoot + path.sep) && path.resolve(resolvedAdminPath) !== resolvedContentRoot) {
				throw new Error('Security Violation: Path escape attempt detected.');
			}
			return resolvedAdminPath;
		} else { // Non-admin user
			const userOwnDirectoryName = username; // e.g., 'rich'
			// User's root directory is within contentRootActual
			const userRootOnFs = path.join(contentRootActual, userOwnDirectoryName); // e.g., /root/pj/pd/data/rich (which is /root/pj/md/rich)

			let finalPathOnFs;

			if (normalizedClientPath === '.' || normalizedClientPath === userOwnDirectoryName) {
				finalPathOnFs = userRootOnFs;
			}
			else if (normalizedClientPath.startsWith(userOwnDirectoryName + path.posix.sep)) {
				// Client path 'rich/notes' is relative to contentRootActual ('MD_DIR')
				finalPathOnFs = path.join(contentRootActual, normalizedClientPath);
			}
			else {
				throw new Error(`Access Denied: Path '${inputPath}' is invalid or outside your allowed directory.`);
			}

			const resolvedFinalPath = path.resolve(finalPathOnFs);
			const resolvedUserRoot = path.resolve(userRootOnFs);
			if (!resolvedFinalPath.startsWith(resolvedUserRoot + path.sep) && resolvedFinalPath !== resolvedUserRoot) {
				throw new Error('Security Violation: Attempt to access path outside user scope.');
			}

			return finalPathOnFs;
		}
	}

	async listDirectory(username, relativePath = '') {
		const role = this.getUserRole(username);

		let absolutePathToList;
		try {
			absolutePathToList = this.resolvePathForUser(username, relativePath); // Path of the directory we are listing
		} catch (resolveError) {
			throw resolveError;
		}

		if (!this.can(username, 'list', absolutePathToList)) {
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

				// Construct the full relative path for this entry, from the perspective of the content root (MD_DIR)
				// This is what resolvePathForUser expects.
				const entryRelativePathFromContentRoot = path.posix.join(relativePath, entry.name);

				try {
					// Check 1: Resolve the entry's full relative path to ensure bounds and get its absolute path
					const entryAbsolutePath = this.resolvePathForUser(username, entryRelativePathFromContentRoot);

					// Check 2: Permission check on the specific item
					const checkAction = entry.isDirectory() || entry.isSymbolicLink() ? 'list' : 'read';
					if (!this.can(username, checkAction, entryAbsolutePath)) {
						continue;
					}

					// --- Add to lists based on type ---
					if (entry.isDirectory()) {
						dirs.push(entry.name);
					} else if (entry.isFile()) {
						files.push(entry.name);
					} else if (entry.isSymbolicLink()) {
						// *** MODIFIED SYMLINK LOGIC ***
						let targetType = 'unknown'; // Default if we can't determine target type
						try {
							const linkTarget = await fs.readlink(entryAbsolutePath);
							const targetAbsolutePath = path.resolve(path.dirname(entryAbsolutePath), linkTarget);
							// Use lstat to check target type without following further links
							const targetStats = await fs.lstat(targetAbsolutePath);
							if (targetStats.isDirectory()) {
								targetType = 'directory';
							} else if (targetStats.isFile()) {
								targetType = 'file';
							}
						} catch (targetError) {
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
					// Skip any entries with errors
					continue;
				}
			} // End for loop

			dirs.sort();
			files.sort();
			return { dirs, files };

		} catch (error) { // Outer catch for readdir failure
			if (error.code === 'ENOENT') {
				throw new Error(`Directory not found: '${relativePath || '/'}'.`);
			}
			if (error.code === 'EACCES') {
				throw new Error(`Permission denied reading contents of '${relativePath || '/'}'.`);
			}
			// Rethrow other unexpected errors
			throw new Error(`Failed to list contents for '${relativePath || '/'}': ${error.message}`);
		}
	}

	async readFile(username, relativePath) {
		if (!relativePath) throw new Error("File path is required.");
		let absolutePath;
		try {
			absolutePath = this.resolvePathForUser(username, relativePath);
		} catch (resolveError) {
			throw resolveError;
		}

		// Only check permission on the symlink itself, not its target
		if (!this.can(username, 'read', absolutePath)) {
			throw new Error(`Permission denied to read file '${relativePath}'.`);
		}

		try {
			// Check if the path is a symlink
			const stats = await fs.lstat(absolutePath);
			
			if (stats.isSymbolicLink()) {
				// It's a symlink, resolve the target path
				const linkTarget = await fs.readlink(absolutePath);
				const targetAbsolutePath = path.resolve(path.dirname(absolutePath), linkTarget);
				
				// Check if the target is a file
				const targetStats = await fs.lstat(targetAbsolutePath);
				if (!targetStats.isFile()) {
					throw new Error(`Symlink target '${relativePath}' is not a readable file.`);
				}
				
				// For symlinks, we allow reading regardless of target ownership
				// This is intentional to allow users to access shared resources via symlinks
				try {
					const content = await fs.readFile(targetAbsolutePath, 'utf8');
					return content;
				} catch (readError) {
					throw new Error(`Failed to read symlink target: ${readError.message}`);
				}
			} else if (stats.isFile()) {
				// For regular files, just read directly
				const content = await fs.readFile(absolutePath, 'utf8');
				return content;
			} else {
				throw new Error(`'${relativePath}' is not a readable file or symlink.`);
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
			absoluteFilePath = this.resolvePathForUser(username, relativePath);
			
			// Check if the file is a symlink before attempting to write
			if (await fs.pathExists(absoluteFilePath)) {
				const stats = await fs.lstat(absoluteFilePath);
				if (stats.isSymbolicLink()) {
					// Get the target path of the symlink
					const linkTarget = await fs.readlink(absoluteFilePath);
					const targetAbsolutePath = path.resolve(path.dirname(absoluteFilePath), linkTarget);
					
					// Need to check if we have permission to write to the target
					const userRole = this.getUserRole(username);
					
					// Admin can write to any target they have permission for
					if (userRole === 'admin') {
						if (!this.can(username, 'write', targetAbsolutePath)) {
							throw new Error(`Permission denied to write to symlink target for '${relativePath}'.`);
						}
					} else {
						// For regular users:
						// 1. The symlink must be in the user's directory (already checked by resolvePathForUser)
						// 2. The target must also be in the user's directory or shared writable location
						const userDir = path.join(this.dataRoot, 'data', username);
						
						// Check if target is in user's directory or in uploads (which is writable by all)
						const uploadsDir = path.join(this.dataRoot, 'uploads');
						const isTargetInUserDir = targetAbsolutePath.startsWith(userDir);
						const isTargetInUploads = targetAbsolutePath.startsWith(uploadsDir);
						
						if (!isTargetInUserDir && !isTargetInUploads) {
							throw new Error(`Permission denied: Cannot write through symlink to target outside your directory.`);
						}
						
						// Double-check explicit permission
						if (!this.can(username, 'write', targetAbsolutePath)) {
							throw new Error(`Permission denied to write to symlink target for '${relativePath}'.`);
						}
					}
					
					// Write to the symlink target directly
					const parentDirOfTarget = path.dirname(targetAbsolutePath);
					
					// Ensure the target's parent directory exists
					await fs.ensureDir(parentDirOfTarget);
					await fs.writeFile(targetAbsolutePath, content, 'utf8');
					return true;
				}
			}
			
			const parentDirAbsolute = path.dirname(absoluteFilePath);

			// Check permission to write in the directory
			if (!this.can(username, 'write', parentDirAbsolute)) {
				throw new Error(`Permission denied to write in directory '${path.dirname(relativePath)}'.`);
			}

			// Ensure directory exists before writing file (using fs-extra's ensureDir)
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
			absolutePath = this.resolvePathForUser(username, relativePath); // Use user-specific resolver
		} catch (resolveError) {
			throw resolveError;
		}

		if (!this.can(username, 'delete', absolutePath)) {
			throw new Error(`Permission denied to delete file or link '${relativePath}'.`);
		}

		try {
			const stats = await fs.lstat(absolutePath);
			if (!stats.isFile() && !stats.isSymbolicLink()) {
				throw new Error(`Cannot delete: '${relativePath}' is not a file or symbolic link.`);
			}
			// Use fs-extra's remove which is more robust than unlink
			await fs.remove(absolutePath);
		} catch (error) {
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
		
		// Resolve the symlink path (where the link will be created)
		let absoluteSymlinkPath;
		try {
			absoluteSymlinkPath = this.resolvePathForUser(username, relativePath);
		} catch (resolveError) {
			throw resolveError;
		}
		
		// Ensure user has write permission to the directory where the symlink will be created
		const parentDirAbsolute = path.dirname(absoluteSymlinkPath);
		if (!this.can(username, 'write', parentDirAbsolute)) {
			throw new Error(`Permission denied to create symlink in directory '${path.dirname(relativePath)}'.`);
		}
		
		// Resolve the target path
		let absoluteTargetPath;
		try {
			// First try to resolve as if it's a relative path within the user's context
			absoluteTargetPath = this.resolvePathForUser(username, targetPath);
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
		
		// Check if target exists (optional, symlinks to non-existent targets are allowed)
		try {
			await fs.access(absoluteTargetPath);
		} catch (accessError) {
			// Just a warning, we'll still create the symlink
			console.warn(`Creating symlink to non-existent target: ${absoluteTargetPath}`);
		}
		
		try {
			// Create the symlink with relative path for better portability
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
			
			// Ensure parent directory exists using fs-extra's ensureDir
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
}

export { PData };
