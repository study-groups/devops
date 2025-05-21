import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { PData } from '../PData.js';

// --- ES Module equivalent for __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---

const PDATA_TEST_ROOT = path.resolve(__dirname, 'pdata_test_root');

describe('PData Symlink Tests', () => {
    let pdata;

    beforeAll(() => {
        // Set environment variable for test
        process.env.PD_DIR = PDATA_TEST_ROOT;
        
        // Initialize PData with the test environment
        pdata = new PData();
    });

    beforeEach(() => {
        // Make sure the setup script has been run
        const symlinkPath = path.join(PDATA_TEST_ROOT, 'data', 'testuser', 'others', 'link.md');
        if (!fs.existsSync(symlinkPath)) {
            throw new Error('Test symlink not found. Please run the setup script first.');
        }
    });

    test('should list symlinks in directory listing', async () => {
        // List the contents of testuser/others directory
        const { dirs, files } = await pdata.listDirectory('testuser', 'testuser/others');
        
        // Check if the symlink is included in the files list
        expect(files).toContain('link.md');
    });

    test('should read content through a symlink', async () => {
        // Read the content of the symlink
        const content = await pdata.readFile('testuser', 'testuser/others/link.md');
        
        // Verify the content matches the source file
        expect(content).toContain('# Shared Document');
        expect(content).toContain('This is a shared document that will be accessed via symlink.');
    });

    test('should not allow writing through a symlink to a file owned by another user', async () => {
        // Attempt to write to the symlink, which points to another user's file
        // This should fail with a permission error
        await expect(
            pdata.writeFile('testuser', 'testuser/others/link.md', 'Modified content')
        ).rejects.toThrow(/Permission denied/);
    });

    test('should allow admin to read through user symlinks', async () => {
        // Admin should be able to read through the symlink
        const content = await pdata.readFile('testadmin', 'testuser/others/link.md');
        
        // Verify the content
        expect(content).toContain('# Shared Document');
    });
});
