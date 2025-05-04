import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use absolute path relative to server directory (using derived __dirname)
export const USERS_FILE = process.env.PJA_USERS_CSV || path.join(__dirname, '../../users.csv');
console.log(`[USERS] Using users file: ${path.resolve(USERS_FILE)}`);

// Generate a random salt
export function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// Hash password with salt
export function hashPassword(password, saltHex) {
    console.log(`[AUTH DEBUG] Server hashing password with:`)
    console.log(`[AUTH DEBUG] Password: ${password}`);
    console.log(`[AUTH DEBUG] Salt (hex): ${saltHex}`);
    
    // Convert hex salt string to a Buffer
    let saltBuffer;
    try {
        saltBuffer = Buffer.from(saltHex, 'hex');
        console.log(`[AUTH DEBUG] Salt (Buffer): ${saltBuffer.toString('hex')}`); // Log buffer as hex again to verify
    } catch (e) {
        console.error(`[AUTH DEBUG ERROR] Failed to convert salt hex '${saltHex}' to Buffer:`, e);
        return null; // Or throw error
    }
    
    try {
        // Use the saltBuffer with pbkdf2Sync
        const hash = crypto.pbkdf2Sync(password, saltBuffer, 10000, 64, 'sha512').toString('hex');
        console.log(`[AUTH DEBUG] Produced hash: ${hash.slice(0, 20)}...`);
        return hash;
    } catch (e) {
        console.error(`[AUTH DEBUG ERROR] pbkdf2Sync failed:`, e);
        return null; // Or throw error
    }
}

// Modify the loadUsers function to include roles
export function loadUsers() {
    console.log(`[USERS] Attempting to load users from: ${path.resolve(USERS_FILE)}`);
    
    if (!fs.existsSync(USERS_FILE)) {
        console.log('[USERS] File not found, creating new users file');
        const salt = generateSalt();
        const hashedPassword = hashPassword('gridranger', salt);
        fs.writeFileSync(USERS_FILE, `gridranger,${salt},${hashedPassword}\n`);
        console.log(`[USERS] Created default user file at: ${path.resolve(USERS_FILE)}`);
    }
    
    try {
        console.log('[USERS] Reading users file...');
        const content = fs.readFileSync(USERS_FILE, 'utf8');
        const users = new Map();
        
        content.split('\n').forEach(line => {
            if (line.trim()) {
                const [username] = line.split(',');
                console.log(`[USERS] Found user in file: ${username}`);
                users.set(username, { 
                    salt: line.split(',')[1], 
                    hash: line.split(',')[2] 
                });
            }
        });
        
        console.log(`[USERS] Successfully loaded ${users.size} users`);
        return users;
    } catch (error) {
        console.error(`[USERS ERROR] Failed to read ${path.resolve(USERS_FILE)}: ${error.message}`);
        throw error;
    }
}

export function validateUser(username, hashedPassword) {
    console.log(`[AUTH] Validating user: ${username}`);
    const users = loadUsers();
    const user = users.get(username);
    
    if (!user) {
        console.log(`[AUTH] User not found: ${username}`);
        return false;
    }
    
    if (!hashedPassword) {
        console.error(`[AUTH VALIDATE ERROR] Hashed password not received from client for user ${username}`);
        return false;
    }

    console.log(`[AUTH] Comparing received client hash with stored hash:`);
    console.log(`[AUTH] Received hash: ${hashedPassword ? hashedPassword.slice(0, 20) + '...' : '(Missing)'}`);
    console.log(`[AUTH] Stored hash:   ${user.hash ? user.hash.slice(0, 20) + '...' : '(Missing stored)'}`);
    
    const isValid = hashedPassword === user.hash;
    console.log(`[AUTH] Validation ${isValid ? 'successful' : 'failed'} for user: ${username}`);
    return isValid;
}

export function getUserSalt(username) {
    console.log(`[AUTH] Getting salt for user: ${username} from ${path.resolve(USERS_FILE)}`);
    try {
        const users = loadUsers();
        const salt = users.get(username)?.salt;
        if (!salt) {
            console.log(`[AUTH] No salt found for user: ${username}`);
        } else {
            console.log(`[AUTH] Found salt for ${username}: ${salt.slice(0, 20)}...`);
        }
        return salt || null;
    } catch (error) {
        console.error(`[AUTH ERROR] Failed to get salt: ${error.message}`);
        return null;
    }
} 