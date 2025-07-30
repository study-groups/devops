import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { PData } from '../PData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDATA_TEST_ROOT = path.resolve(__dirname, 'pdata_test_root');

describe('PData Symlink and Roles Tests', () => {
    let pdata;

    beforeAll(async () => {
        process.env.PD_DIR = PDATA_TEST_ROOT;
        
        const setup = await import('child_process').then(cp => cp.execSync('npm run setup-test-users'));
        console.log(setup.toString());

        pdata = new PData();
        // Add a user with both user and admin roles
        await pdata.addUser('superadmin', 'superpassword', ['user', 'admin']);
    });

    afterAll(async () => {
        await pdata.deleteUser('superadmin');
        const symlinkPath = path.join(PDATA_TEST_ROOT, 'data', 'users', 'testuser', 'others', 'link.md');
        if (fs.existsSync(symlinkPath)) {
            fs.unlinkSync(symlinkPath);
        }
    });

    test('should list symlinks in directory listing for a regular user', async () => {
        const { files } = await pdata.listDirectory('testuser', 'testuser/others');
        expect(files).toContain('link.md');
    });

    test('should read content through a symlink for a regular user', async () => {
        const content = await pdata.readFile('testuser', 'testuser/others/link.md');
        expect(content).toContain('# Shared Document');
    });

    test('should not allow a regular user to write through a symlink to another user\'s file', async () => {
        await expect(pdata.writeFile('testuser', 'users/testuser/others/link.md', 'Modified content')).rejects.toThrow(/Permission denied/);
    });

    test('should allow an admin to read through a user symlink', async () => {
        const content = await pdata.readFile('testadmin', 'users/testuser/others/link.md');
        expect(content).toContain('# Shared Document');
    });

    test('should allow a user with admin role to read any file', async () => {
        const content = await pdata.readFile('superadmin', 'users/testuser/file1.txt');
        expect(content).toBe('This is file 1 for testuser.');
    });

    test('should allow a user with admin role to write to any file', async () => {
        const newContent = 'Admin was here.';
        await pdata.writeFile('superadmin', 'users/anotheruser/shared-doc.md', newContent);
        const updatedContent = await pdata.readFile('superadmin', 'users/anotheruser/shared-doc.md');
        expect(updatedContent).toBe(newContent);
    });
});
