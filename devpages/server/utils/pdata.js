import path from 'path';
import fs from 'fs'; // Using synchronous fs for simplicity during init
import { fileURLToPath } from 'url';

// Derive __dirname in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to load roles from roles.csv
function loadRoles(rolesFilePath) {
    console.log(`[PDATA] Attempting to load roles from: ${rolesFilePath}`);
    const roles = new Map(); // Map<username, role>

    if (!fs.existsSync(rolesFilePath)) {
        console.error(`[PDATA ERROR] Roles file not found: ${rolesFilePath}. Cannot proceed without roles.`);
        // Depending on requirements, could throw error or return empty map.
        // Throwing error ensures configuration is correct.
        throw new Error(`PData Roles file not found at ${rolesFilePath}`);
        // return roles; // Alternative: return empty map
    }

    try {
        const content = fs.readFileSync(rolesFilePath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const parts = trimmedLine.split(',');
                const username = parts[0]?.trim();
                const role = parts[1]?.trim();

                if (username && role) {
                    if (roles.has(username)) {
                        console.warn(`[PDATA WARN] Duplicate username found in roles file: "${username}". Using the last entry.`);
                    }
                    roles.set(username, role);
                } else {
                    console.warn(`[PDATA WARN] Skipping invalid line in roles file: "${line}"`);
                }
            }
        });
        console.log(`[PDATA] Successfully loaded roles for ${roles.size} users.`);
        return roles;
    } catch (error) {
        console.error(`[PDATA ERROR] Failed to read or parse roles file ${rolesFilePath}: ${error.message}`);
        throw error; // Rethrow error to prevent starting with bad state
    }
}


class PData {
    /**
     * Initializes PData, loading roles and setting the application data directory context.
     * @param {string} pdDir - Absolute path to PData's configuration directory (containing roles.csv).
     * @param {string} dataDir - Absolute path to the application's data directory context.
     */
    constructor(pdDir, dataDir) {
        if (!path.isAbsolute(pdDir)) {
            throw new Error(`[PDATA ERROR] pdDir must be an absolute path. Received: ${pdDir}`);
        }
        if (!path.isAbsolute(dataDir)) {
             throw new Error(`[PDATA ERROR] dataDir must be an absolute path. Received: ${dataDir}`);
        }

        this.pdDir = pdDir;
        this.dataDir = dataDir; // The application's data directory
        console.log(`[PDATA] Initialized with pdDir: ${this.pdDir}`);
        console.log(`[PDATA] Managing dataDir: ${this.dataDir}`);

        this.rolesFile = path.join(this.pdDir, 'roles.csv');

        try {
            this._roles = loadRoles(this.rolesFile); // Load roles immediately
        } catch (error) {
            // Error is logged in loadRoles, rethrow to halt server startup if roles are critical
             console.error("[PDATA FATAL] Could not initialize PData due to roles loading error.");
             throw error;
        }
    }

    /**
     * Checks if a user has permission to perform an action on a resource within the dataDir.
     * @param {string} username - The authenticated user's name.
     * @param {string} action - The action being attempted (e.g., 'read', 'write', 'list').
     * @param {string} resourcePath - The absolute path to the resource being accessed.
     * @returns {boolean} - True if allowed, false otherwise.
     */
    can(username, action, resourcePath) {
        if (!username) {
            console.warn('[PDATA.can] Called without username.');
            return false;
        }
        if (!path.isAbsolute(resourcePath)) {
             console.warn(`[PDATA.can] resourcePath must be absolute. Received: ${resourcePath}`);
             // Or throw error? For now, deny access on bad input.
             return false;
        }

        const role = this._roles.get(username);
        console.log(`[PDATA.can] Checking: user='${username}', role='${role || 'N/A'}', action='${action}', resource='${resourcePath}' within dataDir='${this.dataDir}'`);


        if (!role) {
            console.log(`[PDATA.can] Denied. User '${username}' not found in roles.`);
            return false; // User not defined in roles
        }

        // --- Admin Check ---
        if (role === 'admin') {
            // Check if the resource is within the *managed data directory* for this PData instance
            if (resourcePath.startsWith(this.dataDir)) {
                console.log(`[PDATA.can] Allowed. User '${username}' is admin and resource is within dataDir.`);
                return true;
            } else {
                console.log(`[PDATA.can] Denied. User '${username}' is admin, but resource '${resourcePath}' is outside the managed dataDir '${this.dataDir}'.`);
                return false; // Admin can only act *within* the dataDir they manage
            }
        }

        // --- User Role Check ---
        if (role === 'user') {
            const userImplicitTopDir = path.join(this.dataDir, username);
            // Check if the resource path starts with the user's implicit directory *within the data directory*
            if (resourcePath.startsWith(userImplicitTopDir)) {
                console.log(`[PDATA.can] Allowed. Resource is within user '${username}' implicit top directory '${userImplicitTopDir}'.`);
                return true;
            } else {
                console.log(`[PDATA.can] Denied. Resource '${resourcePath}' is outside user '${username}' implicit top directory '${userImplicitTopDir}'.`);
                return false;
            }
        }

        // --- Default Deny for unknown roles ---
        console.log(`[PDATA.can] Denied. Unknown role '${role}' for user '${username}'.`);
        return false;
    }

     // Optional: Add method to get user role if needed elsewhere
     getUserRole(username) {
        return this._roles.get(username) || null;
     }
}

// Export the class
export { PData };
