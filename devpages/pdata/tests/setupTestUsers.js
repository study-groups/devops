import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Adjust path as necessary to import from your actual userUtils.js
import { generateSalt, hashPassword } from '../userUtils.js';

// --- ES Module equivalent for __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---

const users = [
    { username: 'testuser', password: 'password123', role: 'user' },
    { username: 'testadmin', password: 'adminpassword', role: 'admin' },
    { username: 'anotheruser', password: 'anotherpassword', role: 'user' }
];

const pdataTestRootDir = path.resolve(__dirname, 'pdata_test_root');

// --- Ensure the main pdata_test_root directory exists FIRST ---
if (!fs.existsSync(pdataTestRootDir)) {
    fs.mkdirSync(pdataTestRootDir, { recursive: true });
    console.log(`Created directory: ${pdataTestRootDir}`);
}
// ---

const usersCsvPath = path.join(pdataTestRootDir, 'users.csv');
const rolesCsvPath = path.join(pdataTestRootDir, 'roles.csv');

let usersCsvContent = '';
let rolesCsvContent = '';

users.forEach(user => {
    const salt = generateSalt();
    const hash = hashPassword(user.password, salt);
    usersCsvContent += `${user.username},${salt},${hash}\n`;
    rolesCsvContent += `${user.username},${user.role}\n`;
});

fs.writeFileSync(usersCsvPath, usersCsvContent.trim());
fs.writeFileSync(rolesCsvPath, rolesCsvContent.trim());

// Ensure data and uploads directories exist
const dataDir = path.join(pdataTestRootDir, 'data');
const usersDataDir = path.join(dataDir, 'users');
const uploadsDir = path.join(pdataTestRootDir, 'uploads');
if (!fs.existsSync(usersDataDir)) fs.mkdirSync(usersDataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Create user-specific directories
const testUserDir = path.join(usersDataDir, 'testuser');
const testAdminDir = path.join(usersDataDir, 'testadmin');
const anotherUserDir = path.join(usersDataDir, 'anotheruser');

// Ensure user directories exist
if (!fs.existsSync(testUserDir)) fs.mkdirSync(testUserDir, { recursive: true });
if (!fs.existsSync(testAdminDir)) fs.mkdirSync(testAdminDir, { recursive: true });
if (!fs.existsSync(anotherUserDir)) fs.mkdirSync(anotherUserDir, { recursive: true });

// Create a file in anotheruser directory
const sourceFilePath = path.join(anotherUserDir, 'shared-doc.md');
fs.writeFileSync(sourceFilePath, '# Shared Document\n\nThis is a shared document that will be accessed via symlink.');
console.log(`Created source file: ${sourceFilePath}`);

// Create 'others' directory in testuser
const testUserOthersDir = path.join(testUserDir, 'others');
if (!fs.existsSync(testUserOthersDir)) fs.mkdirSync(testUserOthersDir, { recursive: true });

// Create symlink from testuser/others/link.md to anotheruser/shared-doc.md
const symlinkPath = path.join(testUserOthersDir, 'link.md');

// Remove symlink if it already exists
if (fs.existsSync(symlinkPath)) {
    fs.unlinkSync(symlinkPath);
}

// Create the symlink - use relative path for better portability
const relativeSourcePath = path.relative(testUserOthersDir, sourceFilePath);
fs.symlinkSync(relativeSourcePath, symlinkPath);
console.log(`Created symlink: ${symlinkPath} -> ${relativeSourcePath}`);

console.log(`Test users.csv and roles.csv created in ${pdataTestRootDir}`);
console.log('IMPORTANT: Do NOT commit actual passwords. This script is for local test setup.');
console.log('The generated users.csv and roles.csv can be committed for consistent testing environments.');
console.log('Test symlink created at testuser/others/link.md pointing to anotheruser/shared-doc.md');
