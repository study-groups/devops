import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { generateSalt, hashPassword } from './userUtils.js';

// Helper function to get the path to users.csv based on PD_DIR
function getUsersFilePath() {
    const pdDir = process.env.PD_DIR;
    if (!pdDir) {
        console.error('[USERS ERROR] PD_DIR environment variable is not set.');
        process.exit(1); // Exit if PD_DIR is crucial and not set
    }
    if (!fs.existsSync(pdDir)) {
        console.error(`[USERS ERROR] PD_DIR directory does not exist: ${pdDir}`);
        process.exit(1); // Exit if PD_DIR doesn't exist
    }
    return path.join(pdDir, 'users.csv');
}

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
        // Use the helper function to get the correct path
        const usersFilePath = getUsersFilePath();
        if (!fs.existsSync(usersFilePath)) {
            fs.writeFileSync(usersFilePath, userLine);
            console.log(`[USERS] Created new users file (${usersFilePath}) with user: ${username}`);
        } else {
            let content = fs.readFileSync(usersFilePath, 'utf8');
            if (!content.endsWith('\n')) {
                content += '\n';
                fs.writeFileSync(usersFilePath, content);
            }
            fs.appendFileSync(usersFilePath, userLine);
            console.log(`[USERS] Added user: ${username} to ${usersFilePath}`);
        }
    } catch (error) {
        console.error(`[USERS ERROR] Failed to add user: ${error.message}`);
    }
}

export function listUsers() {
    console.log('\n[USERS] Listing all users');
    try {
        // Use the helper function to get the correct path
        const usersFilePath = getUsersFilePath();
        if (!fs.existsSync(usersFilePath)) {
            console.log(`[USERS] No users file exists yet at ${usersFilePath}`);
            return;
        }
        
        const content = fs.readFileSync(usersFilePath, 'utf8');
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
    console.log('\n[USERS] Deleting user:', username);
    try {
        // Use the helper function to get the correct path
        const usersFilePath = getUsersFilePath();
        if (!fs.existsSync(usersFilePath)) {
            console.error(`[USERS ERROR] Users file not found at ${usersFilePath}. Cannot delete user.`);
            return;
        }

        let content = fs.readFileSync(usersFilePath, 'utf8');
        let lines = content.split('\n');
        
        const initialLength = lines.filter(line => line.trim()).length; // Count non-empty lines
        
        // Filter out the user to be deleted
        const updatedLines = lines.filter(line => {
            if (!line.trim()) return false; // Skip empty lines
            const parts = line.split(',');
            return parts[0] !== username; // Keep lines where username doesn't match
        });

        const finalLength = updatedLines.length;

        if (finalLength < initialLength) {
            // Join the remaining lines, ensuring a trailing newline if there are any users left
            const updatedContent = updatedLines.join('\n') + (updatedLines.length > 0 ? '\n' : '');
            fs.writeFileSync(usersFilePath, updatedContent);
            console.log(`[USERS] Deleted user: ${username} from ${usersFilePath}`);
        } else {
            console.log(`[USERS] User not found: ${username}`);
        }

    } catch (error) {
        console.error(`[USERS ERROR] Failed to delete user: ${error.message}`);
    }
}

async function main() {
    console.log('\n[USERS] User Management Utility');
    // Use the helper function to get the correct path for logging
    console.log('[USERS] Using users file:', getUsersFilePath());
    
    while (true) {
        console.log('\n1. Add user');
        console.log('2. List users');
        console.log('3. Delete user');
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

export function updateUser(username, newPassword) {
    console.log(`\n[USERS] Updating password for user: ${username}`);
    try {
        const usersFilePath = getUsersFilePath();
        if (!fs.existsSync(usersFilePath)) {
            console.error(`[USERS ERROR] Users file not found at ${usersFilePath}. Cannot update user.`);
            return;
        }

        let content = fs.readFileSync(usersFilePath, 'utf8');
        let lines = content.split('\n').filter(line => line.trim()); // Read non-empty lines
        let userFound = false;

        const updatedLines = lines.map(line => {
            const parts = line.split(',');
            if (parts[0] === username) {
                userFound = true;
                const newSalt = generateSalt();
                const newHashedPassword = hashPassword(newPassword, newSalt);
                console.log(`[USERS] Generating new salt and hash for ${username}`);
                return `${username},${newSalt},${newHashedPassword}`; // Return updated line
            }
            return line; // Keep other lines as is
        });

        if (userFound) {
            // Join the lines, ensuring a trailing newline
            const updatedContent = updatedLines.join('\n') + '\n';
            fs.writeFileSync(usersFilePath, updatedContent);
            console.log(`[USERS] Updated password for user: ${username} in ${usersFilePath}`);
        } else {
            console.log(`[USERS] User not found: ${username}. Cannot update password.`);
        }

    } catch (error) {
        console.error(`[USERS ERROR] Failed to update user password: ${error.message}`);
    }
}

async function runCommand(command, ...args) {
    switch (command) {
        case 'add':
            const [username, password] = args;
            if (!username || !password) {
                console.error('[USERS ERROR] Username and password required for add');
                return;
            }
            await addUser(username, password);
            break;
        case 'update':
            const [updateUser, newPassword] = args;
            if (!updateUser || !newPassword) {
                console.error('[USERS ERROR] Username and new password required for update');
                return;
            }
            await updateUser(updateUser, newPassword);
            break;
        case 'list':
            listUsers();
            break;
        case 'delete':
            const [userToDelete] = args;
            if (!userToDelete) {
                console.error('[USERS ERROR] Username required for delete');
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