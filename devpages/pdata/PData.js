import path from 'path';
import fs from 'fs-extra';
import { generateSalt, hashPassword } from './userUtils.js';
import { PathManager } from './utils/PathManager.js';

class PData {
	constructor(config = {}) {
		this._initializeDataRoot();
		this.uploadsDir = path.join(this.dataRoot, 'uploads');
		this._ensureDirectoryExists(this.uploadsDir, 'Uploads');
		this.tempUploadsDir = path.join(this.uploadsDir, 'temp');
		this._ensureDirectoryExists(this.tempUploadsDir, 'Temp Uploads');

		this.usersFilePath = path.join(this.dataRoot, 'users.csv');
		this.rolesFilePath = path.join(this.dataRoot, 'roles.csv');

		this.allowedRoles = ['admin', 'user', 'project', 'guest', 'dev'];

		this.users = new Map();
		this.roles = new Map();
		this._loadRolesAndUsers();
		
		this.pathManager = new PathManager({
			dataRoot: this.dataRoot,
			roles: this.roles
		});
	}

	_initializeDataRoot() {
		const dataRootPath = process.env.PD_DIR;
		if (!dataRootPath) throw new Error('[PDATA Class FATAL] PD_DIR must be set.');
		if (!path.isAbsolute(dataRootPath)) throw new Error(`[PDATA Class FATAL] PD_DIR must be an absolute path: ${dataRootPath}`);
		
		this._ensureDirectoryExists(dataRootPath, 'PD_DIR (PData Root)');
		this.dataRoot = fs.realpathSync(dataRootPath);
	}

	_loadRolesAndUsers() {
		try {
			this.roles = this._loadCsvFile(this.rolesFilePath, 2, (parts, map) => {
				const username = parts[0].trim();
				if (!username) return;
				const userRoles = parts.slice(1).map(r => r.trim()).filter(r => this.allowedRoles.includes(r));
				if (userRoles.length > 0) map.set(username, userRoles);
			}, "Roles", true, false);
		} catch (error) {
			throw error;
		}

		try {
			this.users = this._loadCsvFile(this.usersFilePath, 3, (parts, map) => {
				const [username, salt, hash] = parts.map(p => p.trim());
				if (username && salt && hash) map.set(username, { salt, hash });
			}, "Users", false);

			for (const username of this.users.keys()) {
				if (!this.roles.has(username)) this.roles.set(username, ['user']);
			}
		} catch (error) {
			throw error;
		}
	}

	_ensureDirectoryExists(dirPath, label) {
		fs.ensureDirSync(dirPath);
		if (!fs.statSync(dirPath).isDirectory()) throw new Error(`${label} is not a directory.`);
	}

	_touchFileSync(filePath, label) {
		if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
		else if (!fs.statSync(filePath).isFile()) throw new Error(`${label} is not a file.`);
	}

	_loadCsvFile(filePath, expectedParts, processLine, label, isOptional = false, exactMatch = true) {
		const map = new Map();
		if (!fs.existsSync(filePath)) {
			if (isOptional) return map;
			this._touchFileSync(filePath, label);
			return map;
		}
		if (!fs.statSync(filePath).isFile()) throw new Error(`[PDATA Class FATAL] ${label} is not a file.`);
		
		const content = fs.readFileSync(filePath, 'utf8');
		content.split('\n').forEach(line => {
			const trimmed = line.trim();
			if (trimmed) {
				const parts = trimmed.split(',');
				if (exactMatch ? parts.length === expectedParts : parts.length >= expectedParts) {
					processLine(parts, map);
				}
			}
		});
		return map;
	}

	_rewriteCsvFile(filePath, map, formatLine, label) {
		const lines = Array.from(map.entries()).map(([key, value]) => formatLine(key, value));
		fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
	}

	_appendLineToFile(filePath, lineToAdd, label) {
		fs.appendFileSync(filePath, lineToAdd + '\n', 'utf8');
	}

	validateUser(username, password) {
		const user = this.users.get(username);
		return user && hashPassword(password, user.salt) === user.hash;
	}

	async addUser(username, password, roles = ['user']) {
		if (!username || !password) throw new Error('Username and password are required.');
		if (this.users.has(username)) throw new Error(`User '${username}' already exists.`);
		
		const salt = generateSalt();
		const hash = hashPassword(password, salt);
		await this._appendLineToFile(this.usersFilePath, `${username},${salt},${hash}`, 'Users');
		
		const validRoles = roles.filter(role => this.allowedRoles.includes(role));
		if (validRoles.length > 0) {
			await this._appendLineToFile(this.rolesFilePath, `${username},${validRoles.join(',')}`, 'Roles');
		}

		this.users.set(username, { salt, hash });
		this.roles.set(username, validRoles.length > 0 ? validRoles : ['user']);
		return true;
	}

	async deleteUser(username) {
		if (!username) throw new Error('Username is required.');
		if (!this.users.has(username)) throw new Error(`User '${username}' not found.`);
		
		this.users.delete(username);
		this.roles.delete(username);
		await this._rewriteCsvFile(this.usersFilePath, this.users, (u, c) => `${u},${c.salt},${c.hash}`, 'Users');
		await this._rewriteCsvFile(this.rolesFilePath, this.roles, (u, r) => `${u},${r.join(',')}`, 'Roles');
		return true;
	}

	async updatePassword(username, newPassword) {
		if (!username || !newPassword) throw new Error('Username and new password are required.');
		if (!this.users.has(username)) throw new Error(`User '${username}' not found.`);
		
		const salt = generateSalt();
		const hash = hashPassword(newPassword, salt);
		this.users.set(username, { salt, hash });
		await this._rewriteCsvFile(this.usersFilePath, this.users, (u, c) => `${u},${c.salt},${c.hash}`, 'Users');
		return true;
	}

	async setUserRoles(username, newRoles) {
		if (!username || !newRoles) throw new Error('Username and roles are required.');
		if (!this.users.has(username)) throw new Error(`User '${username}' not found.`);
		
		const validRoles = newRoles.filter(r => this.allowedRoles.includes(r));
		this.roles.set(username, validRoles);
		await this._rewriteCsvFile(this.rolesFilePath, this.roles, (u, r) => `${u},${r.join(',')}`, 'Roles');
		return true;
	}

	async addUserRole(username, roleToAdd) {
		if (!username || !roleToAdd) throw new Error("Username and role are required.");
		if (!this.users.has(username)) throw new Error(`User '${username}' not found.`);
		if (!this.allowedRoles.includes(roleToAdd)) throw new Error(`Invalid role: '${roleToAdd}'.`);
		
		const userRoles = this.getUserRoles(username);
		if (!userRoles.includes(roleToAdd)) {
			this.roles.set(username, [...userRoles, roleToAdd]);
			await this._rewriteCsvFile(this.rolesFilePath, this.roles, (u, r) => `${u},${r.join(',')}`, 'Roles');
		}
		return true;
	}

	async removeUserRole(username, roleToRemove) {
		if (!username || !roleToRemove) throw new Error("Username and role are required.");
		if (!this.users.has(username)) throw new Error(`User '${username}' not found.`);
		
		let userRoles = this.getUserRoles(username);
		if (userRoles.includes(roleToRemove)) {
			this.roles.set(username, userRoles.filter(r => r !== roleToRemove));
			await this._rewriteCsvFile(this.rolesFilePath, this.roles, (u, r) => `${u},${r.join(',')}`, 'Roles');
		}
		return true;
	}

	listUsers() {
		return Array.from(this.users.keys());
	}
	
	listUsersWithRoles() {
		const result = {};
		this.users.forEach((_, username) => {
			result[username] = this.getUserRoles(username);
		});
		return result;
	}

	getUserRoles(username) {
		return this.roles.get(username) || [];
	}

	async listDirectory(username, relativePath = '') {
        const absolutePathToList = await this.pathManager.resolvePathForUser(username, relativePath);

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
		return { dirs: dirs.sort(), files: files.sort() };
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
}

export { PData };
