import fs from 'fs-extra';
import { generateSalt, hashPassword } from './userUtils.js';

/**
 * UserManager - Handles user authentication, roles, and user data persistence
 */
class UserManager {
    constructor(config = {}) {
        this.dataRoot = config.dataRoot;
        this.usersFilePath = config.usersFilePath;
        this.rolesFilePath = config.rolesFilePath;
        this.allowedRoles = config.allowedRoles || ['admin', 'user', 'project', 'guest', 'dev'];

        this.users = new Map();
        this.roles = new Map();
        this._loadRolesAndUsers();
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
                const [username, salt, hash, home_dir] = parts.map(p => p.trim());
                if (username && salt && hash) {
                    const userData = { salt, hash };
                    if (home_dir) userData.home_dir = home_dir;
                    map.set(username, userData);
                }
            }, "Users", false, false); // Allow 3 or 4 parts

            for (const username of this.users.keys()) {
                if (!this.roles.has(username)) this.roles.set(username, ['user']);
            }
        } catch (error) {
            throw error;
        }
    }

    _loadCsvFile(filePath, expectedParts, processLine, label, isOptional = false, exactMatch = true) {
        const map = new Map();
        if (!fs.existsSync(filePath)) {
            if (isOptional) return map;
            this._touchFileSync(filePath, label);
            return map;
        }
        if (!fs.statSync(filePath).isFile()) throw new Error(`[UserManager FATAL] ${label} is not a file.`);
        
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

    _touchFileSync(filePath, label) {
        if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
        else if (!fs.statSync(filePath).isFile()) throw new Error(`${label} is not a file.`);
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

    getUserRole(username) {
        const roles = this.getUserRoles(username);
        return roles.length > 0 ? roles[0] : null;
    }
}

export { UserManager };