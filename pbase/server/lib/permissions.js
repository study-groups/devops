/**
 * Role permissions - reads from permissions.csv as source of truth
 */

import fs from 'fs';
import path from 'path';

const PERMISSION_KEYS = ['can_view', 'can_upload', 'can_delete', 'can_admin'];
const DEFAULT_PERMISSIONS = { can_view: true, can_upload: false, can_delete: false, can_admin: false };
const REQUIRED_ROLES = ['admin', 'user', 'guest'];

let permissionsMap = null;
let healthStatus = { ok: false, message: '', path: '', roles: [] };

/**
 * Load permissions from CSV file
 * Format: role,can_view,can_upload,can_delete,can_admin
 */
function loadPermissions() {
    const pdDir = process.env.PD_DIR || path.join(process.cwd(), '..', 'data');
    const csvPath = path.join(pdDir, 'permissions.csv');
    healthStatus.path = csvPath;

    const map = new Map();
    const warnings = [];

    try {
        if (!fs.existsSync(csvPath)) {
            throw new Error('File not found');
        }

        const content = fs.readFileSync(csvPath, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.trim());

        if (lines.length === 0) {
            throw new Error('File is empty');
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map(p => p.trim());

            if (parts.length < 5) {
                warnings.push(`Line ${i + 1}: Expected 5 columns, got ${parts.length}`);
                continue;
            }

            const [role, ...flags] = parts;
            if (!role) {
                warnings.push(`Line ${i + 1}: Empty role name`);
                continue;
            }

            const perms = {
                can_view: flags[0] === 'true',
                can_upload: flags[1] === 'true',
                can_delete: flags[2] === 'true',
                can_admin: flags[3] === 'true',
            };

            // Validate: admin should have can_admin
            if (role === 'admin' && !perms.can_admin) {
                warnings.push(`Role 'admin' missing can_admin permission`);
            }

            map.set(role, perms);
        }

        // Check for required roles
        const missingRoles = REQUIRED_ROLES.filter(r => !map.has(r));
        if (missingRoles.length > 0) {
            warnings.push(`Missing required roles: ${missingRoles.join(', ')}`);
        }

        healthStatus.roles = Array.from(map.keys());
        healthStatus.ok = warnings.length === 0;
        healthStatus.message = warnings.length === 0
            ? `Loaded ${map.size} roles`
            : `Loaded ${map.size} roles with warnings: ${warnings.join('; ')}`;

        console.log(`[Permissions] ${healthStatus.message}`);
        if (warnings.length > 0) {
            warnings.forEach(w => console.warn(`[Permissions] WARNING: ${w}`));
        }

    } catch (err) {
        healthStatus.ok = false;
        healthStatus.message = `Failed to load: ${err.message}. Using defaults.`;
        console.warn(`[Permissions] ${healthStatus.message}`);

        // Fallback defaults
        map.set('admin', { can_view: true, can_upload: true, can_delete: true, can_admin: true });
        map.set('user', { can_view: true, can_upload: true, can_delete: false, can_admin: false });
        map.set('project', { can_view: true, can_upload: false, can_delete: false, can_admin: false });
        map.set('guest', { can_view: true, can_upload: false, can_delete: false, can_admin: false });
        healthStatus.roles = Array.from(map.keys());
    }

    return map;
}

/**
 * Get permissions for a role
 * @param {string} role
 * @returns {object} Permission flags
 */
export function getPermissions(role) {
    if (!permissionsMap) {
        permissionsMap = loadPermissions();
    }
    return permissionsMap.get(role) || permissionsMap.get('guest') || DEFAULT_PERMISSIONS;
}

/**
 * Get all defined permissions (for admin display)
 * @returns {object} Map of role -> permissions
 */
export function getAllPermissions() {
    if (!permissionsMap) {
        permissionsMap = loadPermissions();
    }
    return Object.fromEntries(permissionsMap);
}

/**
 * Get health status of permissions system
 * @returns {object} { ok, message, path, roles }
 */
export function getHealth() {
    if (!permissionsMap) {
        permissionsMap = loadPermissions();
    }
    return { ...healthStatus };
}

/**
 * Force reload permissions from CSV
 */
export function reload() {
    permissionsMap = null;
    return loadPermissions();
}
