// pdata/utils/MountManager.js
import path from 'path';
import fs from 'fs-extra';

/**
 * MountManager - Plan 9 inspired mounting system
 * Manages namespace mount points for different user roles
 */
class MountManager {
    constructor(config = {}) {
        this.dataRoot = config.dataRoot;
        this.roles = config.roles || new Map();
        
        // Define system mount points - directories that can be mounted in the namespace
        this.systemMounts = {
            // System directories that admins can see
            'data': path.join(this.dataRoot, 'data'),
            'images': path.join(this.dataRoot, 'images'),
            'uploads': path.join(this.dataRoot, 'uploads'),
            'logs': path.join(this.dataRoot, 'logs'),
            'config': path.join(this.dataRoot, 'config'),
            
            // Additional system mounts
            'tmp': path.join(this.dataRoot, 'tmp'),
            'cache': path.join(this.dataRoot, 'cache')
        };
        
        // Define mount policies - what each role can see
        this.mountPolicies = {
            admin: [
                'data', 'images', 'uploads', 
                'logs', 'config', 'tmp', 'cache'
            ],
            user: [], // Users get dynamic mounts based on their directories
            guest: [] // Guests get no mounts
        };
        
        console.log('[MountManager] Initialized with system mounts:', Object.keys(this.systemMounts));
    }
    
    /**
     * Get all available mount points for a user based on their role
     * THREE-TIER MOUNTING: ~data (userspace), ~log/~cache (system), ~/data/* (user-specific)
     */
    async getAvailableMounts(username) {
        const role = this.getUserRole(username);
        console.log(`[MountManager] Getting three-tier mounts for user '${username}' with role '${role}'`);
        
        const mounts = [];
        
        if (role === 'admin') {
            // Admin gets full system access
            mounts.push('~data', '~log', '~cache', '~uploads', '~system');
            console.log(`[MountManager] Available mounts for '${username}':`, mounts);
            return mounts;
        } else if (['user', 'project', 'dev'].includes(role)) {
            // Regular users get ONLY their specific home directory (Plan 9 isolation)
            // NO access to general ~data (that would expose all users/projects)
            
            // Add user-specific home mount based on their directory
            // This would be something like ~/data/users/mike or ~/data/projects/gridranger
            const userHomeMount = await this._getUserHomeMount(username);
            if (userHomeMount) mounts.push(userHomeMount);
            
            // Optionally add shared resources (if we want them)
            // mounts.push('~shared'); // Only if we create a specific shared area
            
            console.log(`[MountManager] Available mounts for '${username}':`, mounts);
            return mounts;
        } else {
            // Guests or unknown roles get no mounts
            console.log(`[MountManager] Role '${role}' has no mount access`);
            return [];
        }
    }
    
    /**
     * Get user's home mount alias (e.g., ~/data/users/mike)
     */
    async _getUserHomeMount(username) {
        try {
            // This would ideally check the user's home_dir from users.csv
            // For now, use the legacy logic to determine the path
            const projectPath = path.join(this.dataRoot, 'data', 'projects', username);
            const userPath = path.join(this.dataRoot, 'data', 'users', username);
            
            if (fs.existsSync(projectPath)) {
                return `~/data/projects/${username}`;
            } else if (fs.existsSync(userPath)) {
                return `~/data/users/${username}`;
            }
            
            // Default to users path even if it doesn't exist yet
            return `~/data/users/${username}`;
        } catch (error) {
            console.warn(`[MountManager] Could not determine home mount for '${username}':`, error.message);
            return null;
        }
    }

    /**
     * Resolve a mount point name to an actual filesystem path
     * THREE-TIER MOUNTING: Handles ~data, ~log, ~cache, ~system, and ~/data/* aliases
     */
    resolveMountPath(mountName, username = null) {
        // System mounts
        if (mountName === '~system') {
            return this.dataRoot;
        } else if (mountName === '~data') {
            return path.join(this.dataRoot, 'data');
        } else if (mountName === '~log') {
            return path.join(this.dataRoot, 'logs');
        } else if (mountName === '~cache') {
            return path.join(this.dataRoot, 'cache');
        } else if (mountName === '~uploads') {
            return path.join(this.dataRoot, 'uploads');
        }
        
        // User-specific mounts (~/data/*)
        if (mountName.startsWith('~/data/')) {
            const subPath = mountName.slice(7); // Remove '~/data/'
            return path.join(this.dataRoot, 'data', subPath);
        }
        
        // Legacy home mount support
        if (mountName === '~home') {
            if (!username) {
                throw new Error('Username required to resolve ~home mount');
            }
            
            const projectPath = path.join(this.dataRoot, 'data', 'projects', username);
            const userPath = path.join(this.dataRoot, 'data', 'users', username);
            
            if (fs.existsSync(projectPath)) {
                return projectPath;
            }
            return userPath;
        }
        
        // Legacy support for old mount names
        if (mountName.includes('/')) {
            const [baseMount, subPath] = mountName.split('/', 2);
            if (this.systemMounts[baseMount]) {
                return path.join(this.systemMounts[baseMount], subPath);
            }
        }
        
        if (this.systemMounts[mountName]) {
            return this.systemMounts[mountName];
        }
        
        throw new Error(`Unknown mount point: ${mountName}`);
    }
    
    /**
     * Check if a user can access a specific mount point
     */
    async canAccessMount(username, mountName) {
        const availableMounts = await this.getAvailableMounts(username);
        return availableMounts.includes(mountName);
    }
    
    /**
     * Get mount information for debugging
     */
    getMountInfo() {
        return {
            systemMounts: this.systemMounts,
            mountPolicies: this.mountPolicies,
            unifiedMounts: {
                '~system': 'Complete system access (admin only)',
                '~home': 'User home directory access'
            },
            totalMounts: Object.keys(this.systemMounts).length
        };
    }
    
    /**
     * Add a new system mount point (for dynamic mounting)
     */
    addMount(mountName, mountPath) {
        this.systemMounts[mountName] = mountPath;
        console.log(`[MountManager] Added mount '${mountName}' -> '${mountPath}'`);
    }
    
    /**
     * Remove a mount point
     */
    removeMount(mountName) {
        if (this.systemMounts[mountName]) {
            delete this.systemMounts[mountName];
            console.log(`[MountManager] Removed mount '${mountName}'`);
        }
    }
    
    // Private helper methods
    
    getUserRole(username) {
        if (this.roles.has(username)) {
            const userRoles = this.roles.get(username);
            if (Array.isArray(userRoles)) {
                return userRoles.includes('admin') ? 'admin' : 'user';
            }
            return userRoles === 'admin' ? 'admin' : 'user';
        }
        return 'guest';
    }
    
    async _mountExists(mountPath) {
        try {
            const stats = await fs.stat(mountPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }
    
    async _getUserDirectories() {
        try {
            const usersPath = this.systemMounts.users;
            if (!await this._mountExists(usersPath)) return [];
            
            const entries = await fs.readdir(usersPath);
            const dirs = [];
            
            for (const entry of entries) {
                const fullPath = path.join(usersPath, entry);
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory() && !entry.startsWith('.')) {
                    dirs.push(entry);
                }
            }
            
            return dirs;
        } catch (error) {
            console.error('[MountManager] Error reading user directories:', error.message);
            return [];
        }
    }
    
    async _getProjectDirectories() {
        try {
            const projectsPath = this.systemMounts.projects;
            if (!await this._mountExists(projectsPath)) return [];
            
            const entries = await fs.readdir(projectsPath);
            const dirs = [];
            
            for (const entry of entries) {
                const fullPath = path.join(projectsPath, entry);
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory() && !entry.startsWith('.')) {
                    dirs.push(entry);
                }
            }
            
            return dirs;
        } catch (error) {
            console.error('[MountManager] Error reading project directories:', error.message);
            return [];
        }
    }
    
    async _findUserDirectory(username) {
        // Check projects first (preferred)
        const projectPath = path.join(this.systemMounts.projects, username);
        if (await this._mountExists(projectPath)) {
            return {
                mountName: `projects/${username}`,
                type: 'project',
                path: projectPath
            };
        }
        
        // Check users directory
        const userPath = path.join(this.systemMounts.users, username);
        if (await this._mountExists(userPath)) {
            return {
                mountName: `users/${username}`,
                type: 'user', 
                path: userPath
            };
        }
        
        return null;
    }
}

export { MountManager };