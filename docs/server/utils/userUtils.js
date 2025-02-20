const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use absolute path relative to server directory
const USERS_FILE = process.env.PJA_USERS_CSV || path.join(__dirname, '../../users.csv');
console.log(`[USERS] Using users file: ${path.resolve(USERS_FILE)}`);

// Generate a random salt
function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// Hash password with salt
function hashPassword(password, salt) {
    console.log(`[AUTH DEBUG] Server hashing password with:`)
    console.log(`[AUTH DEBUG] Password: ${password}`);
    console.log(`[AUTH DEBUG] Salt: ${salt}`);
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    console.log(`[AUTH DEBUG] Produced hash: ${hash.slice(0, 20)}...`);
    return hash;
}

// Format: username,salt,hashedPassword
function loadUsers() {
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
                users.set(username, { salt: line.split(',')[1], hash: line.split(',')[2] });
            }
        });
        
        console.log(`[USERS] Successfully loaded ${users.size} users`);
        return users;
    } catch (error) {
        console.error(`[USERS ERROR] Failed to read ${path.resolve(USERS_FILE)}: ${error.message}`);
        throw error;
    }
}

function validateUser(username, hashedPassword) {
    console.log(`[AUTH] Validating user: ${username}`);
    const users = loadUsers();
    const user = users.get(username);
    
    if (!user) {
        console.log(`[AUTH] User not found: ${username}`);
        return false;
    }
    
    console.log(`[AUTH] Comparing hashes for ${username}:`);
    console.log(`[AUTH] Received hash: ${hashedPassword.slice(0, 20)}...`);
    console.log(`[AUTH] Stored hash:   ${user.hash.slice(0, 20)}...`);
    console.log(`[AUTH] Using salt:    ${user.salt.slice(0, 20)}...`);
    
    const isValid = hashedPassword === user.hash;
    console.log(`[AUTH] Validation ${isValid ? 'successful' : 'failed'} for user: ${username}`);
    return isValid;
}

function getUserSalt(username) {
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

module.exports = {
    validateUser,
    getUserSalt,
    loadUsers,
    generateSalt,
    hashPassword,
    USERS_FILE
}; 