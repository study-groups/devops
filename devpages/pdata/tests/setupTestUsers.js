import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSalt, hashPassword } from '../userUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const users = [
    { username: 'testuser', password: 'password123', roles: ['user'], home_dir: 'users/testuser' },
    { username: 'testadmin', password: 'adminpassword', roles: ['admin'] },
    { username: 'anotheruser', password: 'anotherpassword', roles: ['user'], home_dir: 'users/anotheruser' },
    { username: 'devuser', password: 'devpassword', roles: ['user', 'dev'], home_dir: 'projects/devuser' },
    { username: 'gridranger', password: 'gridpass', roles: ['project'], home_dir: 'projects/gridranger' },
    { username: 'gamer', password: 'gamepass', roles: ['user'], home_dir: 'games/gamer' }
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
    const homeDirField = user.home_dir ? `,${user.home_dir}` : '';
    usersCsvContent += `${user.username},${salt},${hash}${homeDirField}\n`;
    rolesCsvContent += `${user.username},${user.roles.join(',')}\n`;
});

// Add role -> capability mappings to roles.csv (semicolon-separated capabilities)
rolesCsvContent += 'user,cap:data:userspace;cap:home:basic\n';
rolesCsvContent += 'admin,cap:system:admin\n';
rolesCsvContent += 'dev,cap:data:userspace;cap:home:basic;cap:projects:access\n';
rolesCsvContent += 'project,cap:data:userspace;cap:home:basic;cap:projects:access\n';

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
cap:read:arcade_mods,read:~/data/games/mods/**
cap:write:docs,write:~/data/{user}/docs/**
cap:admin_users,delete:~/data/users/*;write:~/data/users/*
cap:data:userspace,list:~data/**;read:~data/**;write:~data/**;delete:~data/**
cap:home:basic,list:~/data/{user}/**;read:~/data/{user}/**;write:~/data/{user}/**;delete:~/data/{user}/**
cap:system:admin,list:~system/**;read:~system/**;write:~system/**;delete:~system/**;list:~log/**;read:~log/**;write:~log/**;list:~cache/**;read:~cache/**;write:~cache/**
cap:projects:access,list:~/data/projects/**;read:~/data/projects/**;write:~/data/projects/**;delete:~/data/projects/**
cap:games:access,list:~/data/games/**;read:~/data/games/**;write:~/data/games/**;delete:~/data/games/**
`;
fs.writeFileSync(capabilitiesCsvPath, capabilitiesCsvContent.trim());
console.log(`Created capabilities.csv in ${pdataTestRootDir}`);

const dataDir = path.join(pdataTestRootDir, 'data');
const usersDataDir = path.join(dataDir, 'users');
const projectsDataDir = path.join(dataDir, 'projects');
const gamesDataDir = path.join(dataDir, 'games');
const uploadsDir = path.join(pdataTestRootDir, 'uploads');

// Create directory structure for three-tier system
if (!fs.existsSync(usersDataDir)) fs.mkdirSync(usersDataDir, { recursive: true });
if (!fs.existsSync(projectsDataDir)) fs.mkdirSync(projectsDataDir, { recursive: true });
if (!fs.existsSync(gamesDataDir)) fs.mkdirSync(gamesDataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Create user directories based on their home_dir
const testUserDir = path.join(usersDataDir, 'testuser');
const anotherUserDir = path.join(usersDataDir, 'anotheruser');
const devUserDir = path.join(projectsDataDir, 'devuser');
const gridrangerDir = path.join(projectsDataDir, 'gridranger');
const gamerDir = path.join(gamesDataDir, 'gamer');

if (!fs.existsSync(testUserDir)) fs.mkdirSync(testUserDir, { recursive: true });
if (!fs.existsSync(anotherUserDir)) fs.mkdirSync(anotherUserDir, { recursive: true });
if (!fs.existsSync(devUserDir)) fs.mkdirSync(devUserDir, { recursive: true });
if (!fs.existsSync(gridrangerDir)) fs.mkdirSync(gridrangerDir, { recursive: true });
if (!fs.existsSync(gamerDir)) fs.mkdirSync(gamerDir, { recursive: true });

// Create test file for testuser
fs.writeFileSync(path.join(testUserDir, 'file1.txt'), 'This is file 1 for testuser.');

const testAdminDir = path.join(usersDataDir, 'testadmin');
if (!fs.existsSync(testAdminDir)) fs.mkdirSync(testAdminDir, { recursive: true });

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
