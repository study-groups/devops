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
     * Initializes PData by reading PD_DIR from environment variables, 
     * using the convention that $PD_DIR/data exists and points to application data.
     */
    constructor() {
        console.log('[PDATA] Initializing...');

        // --- Read and Validate PD_DIR ---
        const pdDir = process.env.PD_DIR;
        if (!pdDir) {
            console.error("[PDATA FATAL] PD_DIR environment variable is not set.");
            throw new Error("PD_DIR environment variable is required for PData initialization.");
        }
        if (!path.isAbsolute(pdDir)) {
            console.error(`[PDATA FATAL] PD_DIR must be an absolute path. Received: ${pdDir}`);
            throw new Error(`PD_DIR must be an absolute path. Received: ${pdDir}`);
        }
        
        // Check if PD_DIR exists
        try {
            const pdDirStats = fs.statSync(pdDir);
            if (!pdDirStats.isDirectory()) {
                console.error(`[PDATA FATAL] PD_DIR path exists but is not a directory: ${pdDir}`);
                throw new Error(`PD_DIR path exists but is not a directory: ${pdDir}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`[PDATA FATAL] PD_DIR directory does not exist: ${pdDir}`);
                throw new Error(`PD_DIR directory does not exist: ${pdDir}`);
            } else {
                console.error(`[PDATA FATAL] Error accessing PD_DIR directory ${pdDir}: ${error.message}`);
                throw error;
            }
        }
        
        this.pdDir = pdDir;
        console.log(`[PDATA] Using pdDir: ${this.pdDir}`);
        
        // --- Find and Validate Data Directory ---
        const dataPath = path.join(this.pdDir, 'data');
        console.log(`[PDATA] Looking for data directory at: ${dataPath}`);
        
        try {
            const dataStats = fs.statSync(dataPath);
            if (!dataStats.isDirectory()) {
                console.error(`[PDATA FATAL] ${dataPath} exists but is not a directory.`);
                throw new Error(`${dataPath} exists but is not a directory.`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`[PDATA FATAL] Required directory not found: ${dataPath}`);
                throw new Error(`Required directory not found: ${dataPath}. The convention requires $PD_DIR/data to exist.`);
            } else {
                console.error(`[PDATA FATAL] Error accessing data directory ${dataPath}: ${error.message}`);
                throw error;
            }
        }
        
        // Store the validated data directory path
        this.dataDir = dataPath;
        console.log(`[PDATA] Using dataDir: ${this.dataDir}`);
        
        // --- Load Roles ---
        this.rolesFile = path.join(this.pdDir, 'roles.csv');
        try {
            this._roles = loadRoles(this.rolesFile);
        } catch (error) {
            console.error("[PDATA FATAL] Could not complete PData initialization due to roles loading error.");
            throw error;
        }
        
        console.log('[PDATA] Initialization complete.');
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
            // Check if the resource is within the *managed data directory* (resolved symlink target)
            // Use path.resolve on dataDir just in case it contains '..' although it shouldn't here
            const resolvedDataDir = path.resolve(this.dataDir);
            if (resourcePath.startsWith(resolvedDataDir + path.sep) || resourcePath === resolvedDataDir) {
                console.log(`[PDATA.can] Allowed. User '${username}' is admin and resource is within dataDir.`);
                return true;
            } else {
                console.log(`[PDATA.can] Denied. User '${username}' is admin, but resource '${resourcePath}' is outside the managed dataDir '${resolvedDataDir}'.`);
                return false; // Admin can only act *within* the dataDir they manage
            }
        }

        // --- User Role Check ---
        if (role === 'user') {
            const resolvedDataDir = path.resolve(this.dataDir);
            const userImplicitTopDir = path.join(resolvedDataDir, username);
            // Check if the resource path starts with the user's implicit directory *within the data directory*
            if (resourcePath.startsWith(userImplicitTopDir + path.sep) || resourcePath === userImplicitTopDir) {
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
