import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { PData } from '../PData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDATA_TEST_ROOT = path.resolve(__dirname, 'pdata_test_root');

describe('Enhanced Symlink Handling', () => {
    let pdata;

    // Helper function to clean up symlinks
    const cleanupSymlinks = async (username) => {
        const userDir = path.join(PDATA_TEST_ROOT, 'data', 'users', username);
        const mylinksDir = path.join(userDir, 'mylinks');
        
        if (await fs.pathExists(mylinksDir)) {
            const entries = await fs.readdir(mylinksDir);
            for (const entry of entries) {
                const entryPath = path.join(mylinksDir, entry);
                try {
                    await fs.unlink(entryPath);
                } catch (error) {
                    console.warn(`Could not remove symlink ${entryPath}: ${error.message}`);
                }
            }
        }
    };

    beforeAll(async () => {
        process.env.PD_DIR = PDATA_TEST_ROOT;
        
        // Ensure test users and directories are set up
        const setup = await import('child_process').then(cp => cp.execSync('npm run setup-test-users'));
        console.log(setup.toString());

        pdata = new PData();
    });

    beforeEach(async () => {
        // Clean up symlinks before each test
        await cleanupSymlinks('testuser');
        await cleanupSymlinks('testadmin');
    });

    describe('Symlink Creation', () => {
        test('should allow creating symlink within user\'s own directory', async () => {
            const username = 'testuser';
            const symlinkPath = 'testuser/mylinks/test_link.txt';
            const targetPath = 'testuser/file1.txt';

            // Ensure the target file exists
            await pdata.writeFile(username, targetPath, 'Original content');

            // Create symlink
            const result = await pdata.createSymlink(username, symlinkPath, targetPath);
            expect(result).toBe(true);

            // Verify symlink exists and is readable
            const linkContent = await pdata.readFile(username, symlinkPath);
            expect(linkContent).toBe('Original content');
        });

        test('should allow creating symlink to another user\'s file', async () => {
            const sourceUser = 'testuser';
            const targetUser = 'anotheruser';
            const symlinkPath = 'testuser/mylinks/cross_user_link.txt';
            const targetPath = 'anotheruser/shared-doc.md';

            // Attempt to create cross-user symlink
            const result = await pdata.createSymlink(sourceUser, symlinkPath, targetPath);
            expect(result).toBe(true);

            // Verify symlink can be read
            const linkContent = await pdata.readFile(sourceUser, symlinkPath);
            expect(linkContent).toContain('Shared Document');
        });

        test('should prevent symlink with path traversal', async () => {
            const username = 'testuser';
            const symlinkPath = 'testuser/mylinks/traversal_link.txt';
            const targetPath = '../anotheruser/shared-doc.md';

            await expect(pdata.createSymlink(username, symlinkPath, targetPath))
                .rejects.toThrow(/Path traversal is not allowed/);
        });
    });

    describe('Symlink Access Permissions', () => {
        test('should allow reading symlink within user\'s directory', async () => {
            const username = 'testuser';
            const symlinkPath = 'testuser/mylinks/read_link.txt';
            const targetPath = 'testuser/file1.txt';

            // Create symlink
            await pdata.writeFile(username, targetPath, 'Readable content');
            await pdata.createSymlink(username, symlinkPath, targetPath);

            // Read symlink content
            const content = await pdata.readFile(username, symlinkPath);
            expect(content).toBe('Readable content');
        });

        test('should allow writing through symlink to another user\'s file', async () => {
            const sourceUser = 'testuser';
            const targetUser = 'anotheruser';
            const symlinkPath = 'testuser/mylinks/write_link.txt';
            const targetPath = 'anotheruser/shared-doc.md';

            // Create symlink to another user's file
            await pdata.createSymlink(sourceUser, symlinkPath, targetPath);

            // Attempt to write through symlink
            await pdata.writeFile(sourceUser, symlinkPath, 'Modified content');
            
            // Verify content was written
            const updatedContent = await pdata.readFile(sourceUser, symlinkPath);
            expect(updatedContent).toBe('Modified content');
        });

        test('admin should be able to create and access symlinks across users', async () => {
            const adminUser = 'testadmin';
            const sourceUser = 'testuser';
            const symlinkPath = 'testadmin/cross_user_link.txt';
            const targetPath = 'testuser/file1.txt';

            // Create symlink as admin
            await pdata.writeFile(sourceUser, targetPath, 'Admin-accessible content');
            await pdata.createSymlink(adminUser, symlinkPath, targetPath);

            // Read symlink content as admin
            const content = await pdata.readFile(adminUser, symlinkPath);
            expect(content).toBe('Admin-accessible content');
        });
    });

    describe('Symlink Edge Cases', () => {
        test('should handle symlinks to non-existent files gracefully', async () => {
            const username = 'testuser';
            const symlinkPath = 'testuser/mylinks/nonexistent_link.txt';
            const targetPath = 'testuser/nonexistent_file.txt';

            // Create symlink to non-existent file
            await pdata.createSymlink(username, symlinkPath, targetPath);

            // Attempt to read should fail
            await expect(pdata.readFile(username, symlinkPath))
                .rejects.toThrow(/no such file/i);
        });

        test('should allow creating multiple symlinks to the same target', async () => {
            const username = 'testuser';
            const targetPath = 'testuser/file1.txt';
            
            // Create first symlink
            const firstSymlinkPath = 'testuser/mylinks/first_link.txt';
            await pdata.writeFile(username, targetPath, 'Original content');
            await pdata.createSymlink(username, firstSymlinkPath, targetPath);

            // Create second symlink to same target
            const secondSymlinkPath = 'testuser/mylinks/second_link.txt';
            await pdata.createSymlink(username, secondSymlinkPath, targetPath);

            // Both symlinks should be readable
            const firstContent = await pdata.readFile(username, firstSymlinkPath);
            const secondContent = await pdata.readFile(username, secondSymlinkPath);
            
            expect(firstContent).toBe('Original content');
            expect(secondContent).toBe('Original content');
        });
    });
});
