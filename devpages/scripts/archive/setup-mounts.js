#!/usr/bin/env node
// scripts/setup-mounts.js
// Set up Plan 9-style mount point directories

import path from 'path';
import fs from 'fs-extra';

const PD_DIR = process.env.PD_DIR || '/root/pj/pd';

// Define the mount point directories that should exist
const mountDirectories = [
    'data',
    'data/users', 
    'data/projects',
    'images',
    'uploads',
    'logs',
    'config',
    'tmp',
    'cache',
    'sessions'
];

async function setupMountDirectories() {
    console.log(`[MOUNT_SETUP] Setting up mount directories in: ${PD_DIR}`);
    
    if (!await fs.pathExists(PD_DIR)) {
        console.log(`[MOUNT_SETUP] Creating PD_DIR: ${PD_DIR}`);
        await fs.ensureDir(PD_DIR);
    }
    
    for (const mountDir of mountDirectories) {
        const fullPath = path.join(PD_DIR, mountDir);
        
        try {
            await fs.ensureDir(fullPath);
            console.log(`[MOUNT_SETUP] ✓ Created/verified: ${mountDir}`);
        } catch (error) {
            console.error(`[MOUNT_SETUP] ✗ Failed to create ${mountDir}:`, error.message);
        }
    }
    
    // Create some example user/project directories if they don't exist
    const exampleDirs = [
        'data/users/admin',
        'data/projects/example'
    ];
    
    // Also ensure the roles file exists and has an admin user
    const rolesPath = path.join(PD_DIR, 'config/roles.csv');
    if (!await fs.pathExists(rolesPath)) {
        console.log(`[MOUNT_SETUP] Creating default roles file: ${rolesPath}`);
        const rolesCsvContent = `username,roles\nmike,admin\nadmin,admin\n`;
        await fs.writeFile(rolesCsvContent, rolesCsvContent);
    }
    
    for (const exampleDir of exampleDirs) {
        const fullPath = path.join(PD_DIR, exampleDir);
        
        try {
            if (!await fs.pathExists(fullPath)) {
                await fs.ensureDir(fullPath);
                
                // Create a simple README in each example directory
                const readmePath = path.join(fullPath, 'README.md');
                const readmeContent = `# ${path.basename(exampleDir)}\n\nThis is an example directory created by the mounting system.\n`;
                await fs.writeFile(readmePath, readmeContent);
                
                console.log(`[MOUNT_SETUP] ✓ Created example: ${exampleDir}`);
            }
        } catch (error) {
            console.error(`[MOUNT_SETUP] ✗ Failed to create example ${exampleDir}:`, error.message);
        }
    }
    
    console.log(`[MOUNT_SETUP] Mount setup complete!`);
    
    // List what we created
    console.log(`\n[MOUNT_SETUP] Available mount points:`);
    for (const mountDir of mountDirectories) {
        const fullPath = path.join(PD_DIR, mountDir);
        const exists = await fs.pathExists(fullPath);
        console.log(`  ${mountDir}: ${exists ? '✓' : '✗'}`);
    }
}

// Run the setup
setupMountDirectories().catch(error => {
    console.error('[MOUNT_SETUP] Setup failed:', error);
    process.exit(1);
});