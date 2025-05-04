import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { USERS_FILE, generateSalt, hashPassword } from './userUtils.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

export async function addUser(username, password) {
    console.log('\n[USERS] Adding new user');
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);
    
    const userLine = `${username},${salt},${hashedPassword}\n`;
    
    try {
        if (!fs.existsSync(USERS_FILE)) {
            fs.writeFileSync(USERS_FILE, userLine);
            console.log(`[USERS] Created new users file with user: ${username}`);
        } else {
            let content = fs.readFileSync(USERS_FILE, 'utf8');
            if (!content.endsWith('\n')) {
                content += '\n';
                fs.writeFileSync(USERS_FILE, content);
            }
            fs.appendFileSync(USERS_FILE, userLine);
            console.log(`[USERS] Added user: ${username}`);
        }
    } catch (error) {
        console.error(`[USERS ERROR] Failed to add user: ${error.message}`);
    }
}

export function listUsers() {
    console.log('\n[USERS] Listing all users');
    try {
        if (!fs.existsSync(USERS_FILE)) {
            console.log('[USERS] No users file exists yet');
            return;
        }
        
        const content = fs.readFileSync(USERS_FILE, 'utf8');
        const users = content.split('\n')
            .filter(line => line.trim())
            .map(line => line.split(',')[0]);
        
        console.log('[USERS] Current users:');
        users.forEach(user => console.log(`- ${user}`));
    } catch (error) {
        console.error(`[USERS ERROR] Failed to list users: ${error.message}`);
    }
}

export function deleteUser(username) {
    // TODO: Implement user deletion
    console.log('[USERS] Delete user functionality coming soon');
}

async function main() {
    console.log('\n[USERS] User Management Utility');
    console.log('[USERS] Using users file:', USERS_FILE);
    
    while (true) {
        console.log('\n1. Add user');
        console.log('2. List users');
        console.log('3. Delete user (coming soon)');
        console.log('4. Exit');
        
        const choice = await question('\nSelect an option (1-4): ');
        
        switch (choice) {
            case '1':
                const username = await question('[USERS] Enter username: ');
                const password = await question('[USERS] Enter password: ');
                await addUser(username, password);
                break;
            case '2':
                listUsers();
                break;
            case '3':
                const userToDelete = await question('[USERS] Enter username to delete: ');
                await deleteUser(userToDelete);
                break;
            case '4':
                console.log('[USERS] Exiting...');
                rl.close();
                return;
            default:
                console.log('[USERS] Invalid option');
        }
    }
}

async function runCommand(command, ...args) {
    switch (command) {
        case 'add':
            const [username, password] = args;
            if (!username || !password) {
                console.error('[USERS ERROR] Username and password required');
                return;
            }
            await addUser(username, password);
            break;
        case 'list':
            listUsers();
            break;
        case 'delete':
            const [userToDelete] = args;
            if (!userToDelete) {
                console.error('[USERS ERROR] Username required');
                return;
            }
            await deleteUser(userToDelete);
            break;
        default:
            console.error(`[USERS ERROR] Unknown command: ${command}`);
    }
}

// Add a test function
async function testHash() {
    const password = "test123";
    const salt = "abcdef1234567890";
    console.log("\n[TEST] Testing hash generation:");
    const hash = hashPassword(password, salt);
    console.log(`[TEST] Test password: ${password}`);
    console.log(`[TEST] Test salt: ${salt}`);
    console.log(`[TEST] Produced hash: ${hash}`);
}

// Updated check for direct execution in ESM context
// A common pattern is checking if the script path matches process.argv[1]
// For simplicity, we'll keep the logic based on command-line args presence.
// Note: `require.main === module` is a CJS pattern.
const isDirectExecution = process.argv[1] && process.argv[1].endsWith('manageUsers.js');

if (process.argv.length > 2) { // Check if command line arguments beyond node and script name exist
    const [,, command, ...args] = process.argv;
    if (command) {
        runCommand(command, ...args)
            .catch(console.error)
            .finally(() => rl.close()); // Ensure readline interface is closed
    } else {
        main()
            .catch(console.error)
            .finally(() => rl.close()); // Ensure readline interface is closed
    }
} else if (isDirectExecution) {
    // Fallback to interactive main if run directly without specific commands
    main()
        .catch(console.error)
        .finally(() => rl.close()); // Ensure readline interface is closed
} 