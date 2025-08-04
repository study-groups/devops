import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSalt, hashPassword } from '../userUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const users = [
    { username: 'testuser', password: 'password123', roles: ['user'] },
    { username: 'testadmin', password: 'adminpassword', roles: ['admin'] },
    { username: 'anotheruser', password: 'anotherpassword', roles: ['user'] },
    { username: 'devuser', password: 'devpassword', roles: ['user', 'dev'] }
];

const pdataTestRootDir = path.resolve(__dirname, 'pdata_test_root');

if (!fs.existsSync(pdataTestRootDir)) {
    fs.mkdirSync(pdataTestRootDir, { recursive: true });
    console.log(`Created directory: ${pdataTestRootDir}`);
}

const usersCsvPath = path.join(pdataTestRootDir, 'users.csv');
const rolesCsvPath = path.join(pdataTestRootDir, 'roles.csv');
const assetsCsvPath = path.join(pdataTestRootDir, 'assets.csv');
const capabilitiesCsvPath = path.join(pdataTestRootDir, 'capabilities.csv');

let usersCsvContent = '';
let rolesCsvContent = '';

users.forEach(user => {
    const salt = generateSalt();
    const hash = hashPassword(user.password, salt);
    usersCsvContent += `${user.username},${salt},${hash}\n`;
    rolesCsvContent += `${user.username},${user.roles.join(',')}\n`;
});

fs.writeFileSync(usersCsvPath, usersCsvContent.trim());
fs.writeFileSync(rolesCsvPath, rolesCsvContent.trim());

const assetsCsvContent = `set_name,paths
public_games,/games/demo/*,/games/free/*
premium_games,/games/premium/*,/games/cheap-golf
team_docs,/users/team1/docs/*,/users/team1/resources/*
`;
fs.writeFileSync(assetsCsvPath, assetsCsvContent.trim());
console.log(`Created assets.csv in ${pdataTestRootDir}`);

const capabilitiesCsvContent = `capability,expression,description
cap:read:arcade_mods,read:/games/mods/**
cap:write:docs,write:/users/{user}/docs/**
cap:admin_users,delete:/users/*;write:/users/*
`;
fs.writeFileSync(capabilitiesCsvPath, capabilitiesCsvContent.trim());
console.log(`Created capabilities.csv in ${pdataTestRootDir}`);

const dataDir = path.join(pdataTestRootDir, 'data');
const usersDataDir = path.join(dataDir, 'users');
const uploadsDir = path.join(pdataTestRootDir, 'uploads');
if (!fs.existsSync(usersDataDir)) fs.mkdirSync(usersDataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const testUserDir = path.join(usersDataDir, 'testuser');
if (!fs.existsSync(testUserDir)) fs.mkdirSync(testUserDir, { recursive: true });

// Create test file for dev user to read
fs.writeFileSync(path.join(testUserDir, 'file1.txt'), 'This is file 1 for testuser.');

const testAdminDir = path.join(usersDataDir, 'testadmin');
const anotherUserDir = path.join(usersDataDir, 'anotheruser');

if (!fs.existsSync(testAdminDir)) fs.mkdirSync(testAdminDir, { recursive: true });
if (!fs.existsSync(anotherUserDir)) fs.mkdirSync(anotherUserDir, { recursive: true });

const sourceFilePath = path.join(anotherUserDir, 'shared-doc.md');
fs.writeFileSync(sourceFilePath, '# Shared Document\n\nThis is a shared document that will be accessed via symlink.');
console.log(`Created source file: ${sourceFilePath}`);

const testUserOthersDir = path.join(testUserDir, 'others');
if (!fs.existsSync(testUserOthersDir)) fs.mkdirSync(testUserOthersDir, { recursive: true });

const symlinkPath = path.join(testUserOthersDir, 'link.md');

if (fs.existsSync(symlinkPath)) {
    fs.unlinkSync(symlinkPath);
}

const relativeSourcePath = path.relative(testUserOthersDir, sourceFilePath);
fs.symlinkSync(relativeSourcePath, symlinkPath);
console.log(`Created symlink: ${symlinkPath} -> ${relativeSourcePath}`);

console.log(`Test users.csv and roles.csv created in ${pdataTestRootDir}`);
console.log('IMPORTANT: Do NOT commit actual passwords. This script is for local test setup.');
console.log('The generated users.csv and roles.csv can be committed for consistent testing environments.');
console.log('Test symlink created at testuser/others/link.md pointing to anotheruser/shared-doc.md');
