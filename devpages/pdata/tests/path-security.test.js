/**
 * Critical Path Security Tests for PData
 * 
 * These tests prevent catastrophic bugs where virtual paths (starting with ~)
 * get incorrectly transformed into literal filesystem paths containing ~ characters,
 * leading to unintended directory creation and potential data corruption.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { PData } from '../PData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDATA_TEST_ROOT = path.resolve(__dirname, 'pdata_test_root');
const USER_DATA_DIR = (username) => path.join(PDATA_TEST_ROOT, 'data', 'users', username);

// Set test environment
process.env.PD_DIR = PDATA_TEST_ROOT;

describe('Path Security Tests - Critical Bug Prevention', () => {
    let pdata;
    let testToken;

    beforeAll(async () => {
        // Clean up any existing test data
        if (await fs.pathExists(PDATA_TEST_ROOT)) {
            await fs.remove(PDATA_TEST_ROOT);
        }

        // Create test directory structure
        await fs.ensureDir(USER_DATA_DIR('testuser'));
        await fs.ensureDir(path.join(PDATA_TEST_ROOT, 'data', 'projects'));
        
        // Initialize PData
        pdata = new PData(PDATA_TEST_ROOT);
        
        // Create a test token with proper mounts
        testToken = {
            username: 'testuser',
            roles: ['user'],
            caps: [
                'read:~data/**',
                'write:~data/**',
                'list:~data/**'
            ],
            mounts: {
                '~data': path.join(PDATA_TEST_ROOT, 'data')
            }
        };
    });

    afterAll(async () => {
        // Clean up test data
        if (await fs.pathExists(PDATA_TEST_ROOT)) {
            await fs.remove(PDATA_TEST_ROOT);
        }
    });

    describe('Virtual Path Handling - Prevent Literal ~ Directory Creation', () => {
        
        test('CRITICAL: Should NOT create literal ~data directory when writing to virtual path', async () => {
            const virtualPath = '~data/users/testuser/test-file.md';
            const testContent = 'This is test content';
            
            // Write to virtual path using token
            await pdata.writeFile(testToken, virtualPath, testContent);
            
            // Verify the file was written to the correct resolved location
            const expectedPath = path.join(PDATA_TEST_ROOT, 'data', 'users', 'testuser', 'test-file.md');
            const exists = await fs.pathExists(expectedPath);
            expect(exists).toBe(true);
            
            const content = await fs.readFile(expectedPath, 'utf8');
            expect(content).toBe(testContent);
            
            // CRITICAL SECURITY CHECK: Ensure no literal ~data directory was created
            const literalTildeDir = path.join(PDATA_TEST_ROOT, '~data');
            const literalExists = await fs.pathExists(literalTildeDir);
            expect(literalExists).toBe(false);
            
            // Also check for literal tilde directories in various possible locations
            const possibleLiteralPaths = [
                path.join(PDATA_TEST_ROOT, '~data'),
                path.join(PDATA_TEST_ROOT, 'testuser', '~data'),
                path.join(USER_DATA_DIR('testuser'), '~data'),
                path.join(process.cwd(), '~data'),
            ];
            
            for (const literalPath of possibleLiteralPaths) {
                const exists = await fs.pathExists(literalPath);
                expect(exists).toBe(false);
            }
        });

        test('CRITICAL: Should reject paths with literal ~ characters in non-virtual positions', async () => {
            const malformedPaths = [
                'users/mike/~data/test.md',  // ~ in middle
                'testuser/~data/projects/file.md',  // ~ after username
                'data/~users/test.md',  // ~ in wrong position
                'mike/~data/users/mike/misc/test.md'  // The exact bug pattern
            ];
            
            for (const malformedPath of malformedPaths) {
                await expect(async () => {
                    await pdata.writeFile(testToken, malformedPath, 'test content');
                }).rejects.toThrow();
                
                // Verify no literal tilde directories were created
                const pathParts = malformedPath.split('/');
                for (let i = 0; i < pathParts.length; i++) {
                    if (pathParts[i].includes('~')) {
                        const partialPath = path.join(PDATA_TEST_ROOT, ...pathParts.slice(0, i + 1));
                        const exists = await fs.pathExists(partialPath);
                        expect(exists).toBe(false);
                    }
                }
            }
        });

        test('Should properly handle valid virtual paths starting with ~', async () => {
            const validVirtualPaths = [
                '~data/users/testuser/valid-file.md',
                '~data/projects/test-project/file.md',
                '~data/shared/document.md'
            ];
            
            for (const virtualPath of validVirtualPaths) {
                const testContent = `Content for ${virtualPath}`;
                
                // Should not throw
                await pdata.writeFile(testToken, virtualPath, testContent);
                
                // Verify content was written correctly
                const content = await pdata.readFile(testToken, virtualPath);
                expect(content).toBe(testContent);
            }
        });

        test('Should handle relative paths correctly without creating literal ~ directories', async () => {
            const relativePaths = [
                'users/testuser/relative-file.md',
                'projects/test-project/file.md',
                'shared/document.md'
            ];
            
            for (const relativePath of relativePaths) {
                const testContent = `Content for ${relativePath}`;
                
                // Write using token (which should prepend ~data/ for relative paths)
                await pdata.writeFile(testToken, relativePath, testContent);
                
                // Verify no literal tilde directories were created anywhere
                const checkPaths = [
                    path.join(PDATA_TEST_ROOT, '~data'),
                    path.join(PDATA_TEST_ROOT, 'testuser', '~data'),
                    path.join(USER_DATA_DIR('testuser'), '~data')
                ];
                
                for (const checkPath of checkPaths) {
                    const exists = await fs.pathExists(checkPath);
                    expect(exists).toBe(false);
                }
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        
        test('Should reject empty or invalid paths', async () => {
            const invalidPaths = [
                '',
                null,
                undefined,
                '.',
                '..',
                '../../../etc/passwd',
                'path/with/../../../traversal'
            ];
            
            for (const invalidPath of invalidPaths) {
                await expect(async () => {
                    await pdata.writeFile(testToken, invalidPath, 'test content');
                }).rejects.toThrow();
            }
        });

        test('Should handle paths with multiple consecutive slashes correctly', async () => {
            const pathsWithSlashes = [
                '~data//users//testuser//file.md',
                '~data/users///testuser/file.md',
                'users//testuser//file.md'
            ];
            
            for (const pathWithSlashes of pathsWithSlashes) {
                // Should normalize and handle correctly without creating literal ~ dirs
                await pdata.writeFile(testToken, pathWithSlashes, 'test content');
                
                // Verify no literal tilde directories
                const literalTildeDir = path.join(PDATA_TEST_ROOT, '~data');
                const exists = await fs.pathExists(literalTildeDir);
                expect(exists).toBe(false);
            }
        });
    });

    describe('Filesystem State Verification', () => {
        
        test('Should never create any directories starting with literal ~ character', async () => {
            // After all tests, scan the entire test directory for any literal ~ directories
            const scanForLiteralTildeDirs = async (dirPath) => {
                const items = await fs.readdir(dirPath);
                for (const item of items) {
                    if (item.startsWith('~')) {
                        throw new Error(`CRITICAL BUG: Found literal tilde directory: ${path.join(dirPath, item)}`);
                    }
                    
                    const itemPath = path.join(dirPath, item);
                    const stat = await fs.stat(itemPath);
                    if (stat.isDirectory()) {
                        await scanForLiteralTildeDirs(itemPath);
                    }
                }
            };
            
            // This should pass without finding any literal ~ directories
            await scanForLiteralTildeDirs(PDATA_TEST_ROOT);
        });
    });
});