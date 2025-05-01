import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Generate a random salt
export function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// Hash password with salt
export function hashPassword(password, saltHex) {
    const callContext = process.argv[1]?.includes('manageUsers.js') ? '[CLI]' : '[SERVER]'; // Rudimentary context detection
    console.log(`[HASH ${callContext}] Hashing password...`);
    console.log(`[HASH ${callContext}] Input Password Type: ${typeof password}`);
    console.log(`[HASH ${callContext}] Input Password Value: ${password}`); // Be careful logging passwords in prod
    console.log(`[HASH ${callContext}] Input Salt Hex Type: ${typeof saltHex}`);
    console.log(`[HASH ${callContext}] Input Salt Hex Value: ${saltHex}`);
    console.log(`[HASH ${callContext}] Iterations: 10000`);
    console.log(`[HASH ${callContext}] Key Length (bytes): 32`);
    console.log(`[HASH ${callContext}] Digest: sha512`);
    
    // Convert hex salt string to a Buffer
    let saltBuffer;
    try {
        saltBuffer = Buffer.from(saltHex.trim(), 'hex');
        console.log(`[HASH ${callContext}] Converted Salt Buffer (hex): ${saltBuffer.toString('hex')}`);
    } catch (e) {
        console.error(`[HASH ${callContext} ERROR] Failed to convert salt hex '${saltHex}' to Buffer:`, e);
        return null;
    }
    
    try {
        const hash = crypto.pbkdf2Sync(password, saltBuffer, 10000, 32, 'sha512').toString('hex');
        console.log(`[HASH ${callContext}] Produced hash: ${hash}`); // Log the full hash now
        return hash;
    } catch (e) {
        console.error(`[HASH ${callContext} ERROR] pbkdf2Sync failed:`, e);
        return null;
    }
}

// Modify the loadUsers function to include roles
export function loadUsers(usersFilePath) {
    const users = new Map();
    if (!usersFilePath) {
        console.error("[loadUsers] usersFilePath parameter is required.");
        return users; // Return empty map
    }
    if (!fs.existsSync(usersFilePath)) {
        console.error(`[loadUsers] Users file not found at provided path: ${usersFilePath}`);
        // Consider throwing an error or returning empty based on how critical this is
        return users; // Return empty map
    }
    try {
        const data = fs.readFileSync(usersFilePath, 'utf8');
        const lines = data.split('\n');
        console.log(`[loadUsers] Reading users from: ${usersFilePath}`); // Log the path being used

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const [username, salt, hash] = trimmedLine.split(',');
                if (username && salt && hash) {
                    if (users.has(username)) {
                        console.warn(`[loadUsers] Duplicate username found: "${username}". Using the last entry.`);
                    }
                    users.set(username.trim(), { salt: salt.trim(), hash: hash.trim() });
                } else {
                    console.warn(`[loadUsers] Skipping invalid line (missing parts): "${line}"`);
                }
            }
        });
        console.log(`[loadUsers] Loaded ${users.size} users.`);
    } catch (error) {
        console.error(`[loadUsers] Error reading or parsing users file ${usersFilePath}:`, error);
        // Depending on requirements, might re-throw or return empty map
    }
    return users;
}

export function validateUser(username, password, usersFilePath) {
    if (!username || !password) {
        return false;
    }
    const users = loadUsers(usersFilePath); // Load users using the provided path
    const userData = users.get(username);

    if (!userData) {
        console.log(`[VALIDATE] User '${username}' not found in loaded data.`);
        return false; // User not found
    }

    console.log(`[VALIDATE] Validating '${username}'. Salt: ${userData.salt}, Stored Hash: ${userData.hash}`);
    const passwordHash = hashPassword(password, userData.salt);
    const isMatch = passwordHash === userData.hash;
    console.log(`[VALIDATE] Result for '${username}': ${isMatch ? 'MATCH' : 'MISMATCH'}`);
    return isMatch;
}

export function getUserSalt(username, usersFilePath) {
    if (!username) return null;
    const users = loadUsers(usersFilePath); // Load users using the provided path
    const userData = users.get(username);
    if (!userData) {
        console.log(`[GETSALT] User '${username}' not found in loaded data.`);
        return null;
    }
    console.log(`[GETSALT] Found salt for '${username}': ${userData.salt}`);
    return userData ? userData.salt : null;
}

export default {
    loadUsers,
    getUserSalt,
    validateUser,
    hashPassword,
    generateSalt
}; 