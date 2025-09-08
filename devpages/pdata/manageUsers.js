#!/usr/bin/env node
import path from 'path';
import readline from 'readline';
import { PData } from './PData.js'; // Import the PData class

// --- PData Initialization ---
// Determine PD_DIR for PData initialization
const pdDir = process.env.PD_DIR;
if (!pdDir) {
    console.error('[USERS ERROR] PD_DIR environment variable is not set. This script requires PD_DIR.');
    process.exit(1); // Exit if PD_DIR is crucial and not set
}

let pdataInstance;
try {
    // Instantiate PData - this will also load users and roles
    console.log(`[USERS] Initializing PData with PD_DIR: ${pdDir}`);
    pdataInstance = new PData(pdDir);
    console.log(`[USERS] PData initialized. Using Users file: ${pdataInstance.usersFile}, Roles file: ${pdataInstance.rolesFile}`);
} catch (error) {
     console.error(`[USERS FATAL] Failed to initialize PData: ${error.message}. Script cannot continue.`);
     process.exit(1); // Exit if PData fails to initialize
}
// --- End PData Initialization ---


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

async function handleAddUser() {
    console.log('\n[USERS] Add New User');
    const username = await question('Enter username: ');
    if (!username) {
        console.log('[USERS] Username cannot be empty.');
        return;
    }
    const password = await question('Enter password: ');
    if (!password) {
        console.log('[USERS] Password cannot be empty.');
        return;
    }
    let role = await question('Enter role (user/admin) [default: user]: ');
    role = role.trim().toLowerCase() || 'user'; // Default to 'user'
    if (role !== 'user' && role !== 'admin') {
        console.log(`[USERS] Invalid role '${role}'. Setting to 'user'.`);
        role = 'user';
    }

    const success = await pdataInstance.addUser(username, password, role);
    if (!success) {
        console.log(`[USERS] Failed to add user '${username}'. User might already exist or an error occurred.`);
    }
}

async function handleListUsers() {
    console.log('\n[USERS] Listing all users');
    try {
        const users = pdataInstance.listUsers(); // Use PData method
        if (users.length === 0) {
            console.log('[USERS] No users found.');
            return;
        }
        console.log('[USERS] Current users and roles:');
        users.forEach(user => {
            const role = pdataInstance.getUserRole(user) || 'N/A';
            console.log(`- ${user} (Role: ${role})`);
        });
    } catch (error) {
        console.error(`[USERS ERROR] Failed to list users: ${error.message}`);
    }
}

async function handleDeleteUser() {
    console.log('\n[USERS] Delete User');
    const userToDelete = await question('Enter username to delete: ');
    if (!userToDelete) {
        console.log('[USERS] Username cannot be empty.');
        return;
    }
    const success = await pdataInstance.deleteUser(userToDelete); // Use PData method
    if (!success) {
        console.log(`[USERS] Failed to delete user '${userToDelete}'. User might not exist or an error occurred.`);
    }
}

async function handleUpdatePassword() {
     console.log('\n[USERS] Update User Password');
     const username = await question('Enter username to update: ');
     if (!username) {
         console.log('[USERS] Username cannot be empty.');
         return;
     }
     const newPassword = await question('Enter new password: ');
     if (!newPassword) {
         console.log('[USERS] New password cannot be empty.');
         return;
     }
     const success = await pdataInstance.updatePassword(username, newPassword); // Use PData method
     if (!success) {
         console.log(`[USERS] Failed to update password for '${username}'. User might not exist or an error occurred.`);
     }
}

async function handleSetRole() {
    console.log('\n[USERS] Set User Role');
    const username = await question('Enter username to modify role: ');
    if (!username) {
        console.log('[USERS] Username cannot be empty.');
        return;
    }
    let newRole = await question('Enter new role (user/admin): ');
    newRole = newRole.trim().toLowerCase();
    if (newRole !== 'user' && newRole !== 'admin') {
        console.log(`[USERS ERROR] Invalid role '${newRole}'. Role not changed.`);
        return;
    }

    const success = await pdataInstance.setUserRole(username, newRole); // Use PData method
    if (!success) {
        console.log(`[USERS] Failed to set role for '${username}'. User might not exist or an error occurred.`);
    }
}


async function main() {
    console.log('\n[USERS] User Management Utility');
    console.log(`[USERS] Using PData configured with PD_DIR: ${pdataInstance.pdDir}`);

    while (true) {
        console.log('\n--- Options ---');
        console.log('1. Add user');
        console.log('2. List users');
        console.log('3. Delete user');
        console.log('4. Update user password');
        console.log('5. Set user role');
        console.log('6. Exit');

        const choice = await question('\nSelect an option (1-6): ');

        switch (choice) {
            case '1':
                await handleAddUser();
                break;
            case '2':
                await handleListUsers();
                break;
            case '3':
                await handleDeleteUser();
                break;
            case '4':
                 await handleUpdatePassword();
                 break;
             case '5':
                 await handleSetRole();
                 break;
            case '6':
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
            const [username, password, role] = args;
            if (!username || !password) {
                console.error('[USERS ERROR] Usage: node manageUsers.js add <username> <password> [role=user]');
                return;
            }
            await pdataInstance.addUser(username, password, [role || 'user']);
            break;
        case 'update': // Changed command name to 'updatePassword' for clarity? Or keep 'update'? Keep 'update' for now.
            const [updateUser, newPassword] = args;
            if (!updateUser || !newPassword) {
                console.error('[USERS ERROR] Usage: node manageUsers.js update <username> <newPassword>');
                return;
            }
            await pdataInstance.updatePassword(updateUser, newPassword);
            break;
        case 'list':
            await handleListUsers(); // Use the async handler which prints nicely
            break;
        case 'delete':
            const [userToDelete] = args;
            if (!userToDelete) {
                console.error('[USERS ERROR] Usage: node manageUsers.js delete <username>');
                return;
            }
            await pdataInstance.deleteUser(userToDelete);
            break;
         case 'setrole':
             const [roleUser, newRole] = args;
             if (!roleUser || !newRole) {
                 console.error('[USERS ERROR] Usage: node manageUsers.js setrole <username> <user|admin>');
                 return;
             }
             await pdataInstance.setUserRole(roleUser, newRole.toLowerCase());
             break;
        default:
            console.error(`[USERS ERROR] Unknown command: ${command}`);
            console.error('Available commands: add, list, delete, update, setrole');
    }
}

// Check if running as a script with command-line arguments
// process.argv contains [node executable, script path, arg1, arg2, ...]
if (process.argv.length > 2) {
    const [,, command, ...args] = process.argv;
    runCommand(command, ...args)
        .catch(err => {
             console.error(`[USERS SCRIPT ERROR] Command '${command}' failed:`, err);
             process.exitCode = 1; // Indicate error exit
        })
        .finally(() => rl.close()); // Ensure readline interface is closed
} else {
    // Run interactive menu
    main()
       .catch(err => {
            console.error("[USERS MENU ERROR]", err);
            process.exitCode = 1; // Indicate error exit
       })
       .finally(() => rl.close()); // Ensure readline is closed even on menu error
} 
