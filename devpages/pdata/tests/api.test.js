import request from 'supertest';
import { createTestApp } from './test-server.js';
import fs from 'fs-extra'; // For cleaning up test directories
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDATA_TEST_ROOT = path.resolve(__dirname, 'pdata_test_root');
const USER_DATA_DIR = (username) => path.join(PDATA_TEST_ROOT, 'data', 'users', username);

// At the top of your test file, before importing PData
process.env.PD_DIR = PDATA_TEST_ROOT;

import { PData } from '../PData.js';

describe('PData API End-to-End Tests', () => {
    let expressApp;
    let httpServer;
    let agent; // To carry cookies across requests for a "session"
    let LocalStrategy;

    // Start the app/server before all tests
    beforeAll(async () => {
        try {
            console.log('Starting server setup in beforeAll...');
            LocalStrategy = (await import('passport-local')).Strategy;
            passport.use('local-test', new LocalStrategy(
                async (username, password, done) => {
                    // ...
                }
            ));
            expressApp = await createTestApp();
            
            // Return a Promise that resolves when the server is listening
            return new Promise((resolve, reject) => {
                httpServer = expressApp.listen(0, () => {
                    agent = request.agent(httpServer);
                    console.log(`Test server listening on port ${httpServer.address().port}`);
                    resolve(); // Resolve the promise instead of calling done
                });
                httpServer.on('error', (err) => {
                    console.error('Test server failed to start:', err);
                    reject(err); // Reject on error
                });
            });
        } catch (error) {
            console.error('Error in beforeAll while creating test app:', error);
            throw error; // Re-throw the error to fail the test
        }
    }, 30000);

    // Stop the server after all tests
    afterAll(async () => {
        console.log('Destroying server...');
        if (httpServer) {
            if (typeof httpServer.destroy === 'function') {
                await new Promise((resolve) => httpServer.destroy(resolve));
                console.log('Server destroyed with destroy()');
            } else {
                // Fallback if destroy isn't patched onto the server
                await new Promise((resolve) => httpServer.close(resolve));
                console.log('Server destroyed with close()');
            }
        } else {
            console.log('No httpServer to destroy');
        }
    });

    // Clean up test directories before each test
    beforeEach(async () => {
        // Clean up user-specific data directories before each test if needed
        // or specific files created by tests.
        // For instance, to ensure a clean slate for testuser's data:
        await fs.emptyDir(USER_DATA_DIR('testuser'));
        await fs.emptyDir(USER_DATA_DIR('testadmin'));
        // Ensure the base 'data' and 'uploads' directories still exist if emptyDir removes them
        await fs.ensureDir(path.join(PDATA_TEST_ROOT, 'data', 'users'));
        await fs.ensureDir(path.join(PDATA_TEST_ROOT, 'uploads'));
        console.log('--- Starting new test ---');
    }, 4000);

    afterEach(() => {
        console.log('--- Finished test ---');
    });

    // --- Authentication Tests ---
    describe('Authentication', () => {
        it('should fail to access protected route without login', async () => {
            const res = await agent.get('/api/pdata/list');
            expect(res.statusCode).toEqual(401);
        }, 10000); // 10s timeout for this test

        it('should login testuser successfully', async () => {
            console.log('Attempting login...');
            const res = await agent
                .post('/test-login')
                .send({ username: 'testuser', password: 'password123' });
            console.log('Login response:', res.statusCode, res.body);
            expect(res.statusCode).toEqual(200);
            expect(res.body.user.username).toEqual('testuser');
        }, 4000);

        it('should respond to health check', async () => {
            const res = await agent.get('/health');
            console.log('Health check response:', res.statusCode, res.text);
            expect(res.statusCode).toEqual(200);
            expect(res.text).toEqual('ok');
        });
    });

    // --- File Operations (assuming logged in as testuser) ---
    describe('File Operations for testuser', () => {
        beforeAll(async () => { // Login testuser once for this describe block
            const res = await agent
                .post('/test-login')
                .send({ username: 'testuser', password: 'password123' });
            if (res.statusCode !== 200) {
                throw new Error('Testuser login failed in beforeAll');
            }
        });

        it('should list an empty directory for testuser', async () => {
            const res = await agent.get('/api/pdata/list?dir=testuser');
            expect(res.statusCode).toEqual(200);
            expect(res.body.files).toEqual([]);
            expect(res.body.dirs).toEqual([]);
        });

        it('should write a file, then read it', async () => {
            const writeFileRes = await agent
                .post('/api/pdata/write')
                .send({ file: 'testuser/testfile.txt', content: 'Hello World' });
            expect(writeFileRes.statusCode).toEqual(200);
            expect(writeFileRes.body.success).toBe(true);

            const readFileRes = await agent.get('/api/pdata/read?file=testuser/testfile.txt');
            expect(readFileRes.statusCode).toEqual(200);
            expect(readFileRes.text).toEqual('Hello World');
            expect(readFileRes.headers['content-type']).toMatch(/text\/plain/);
        });

        it('should create a directory, list it, then write a file into it', async () => {
            // Directory path must use the username prefix for path resolution
            const filePath = 'testuser/mydir/nestedfile.txt';
            const writeRes = await agent
                .post('/api/pdata/write')
                .send({ file: filePath, content: 'Nested Content' });
            expect(writeRes.statusCode).toEqual(200);

            // List 'mydir' - also needs the username prefix
            const listRes = await agent.get('/api/pdata/list?dir=testuser/mydir');
            expect(listRes.statusCode).toEqual(200);
            expect(listRes.body.files).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'nestedfile.txt' })
            ]));
            expect(listRes.body.dirs).toEqual([]); // No sub-dirs within mydir/nestedfile.txt itself

            // List user root, should see 'mydir'
            const listRootRes = await agent.get('/api/pdata/list?dir=testuser');
            expect(listRootRes.statusCode).toEqual(200);
            expect(listRootRes.body.dirs).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'mydir' })
            ]));
        });

        it('should upload a file, then list it', async () => {
            const uploadRes = await agent
                .post('/api/pdata/upload')
                .attach('file', Buffer.from('upload content'), 'upload.txt');
            expect(uploadRes.statusCode).toEqual(200);
            expect(uploadRes.body.success).toBe(true);
            // Use a more flexible match since the URL uses timestamps
            expect(uploadRes.body.url).toMatch(/^\/uploads\/\d+-\w+\.txt$/);

            // Check the uploads directory listing using the path format PData expects
            const listRes = await agent.get('/api/pdata/list?dir=uploads');
            expect(listRes.statusCode).toEqual(200);
            expect(listRes.body.files.length).toBeGreaterThan(0);
            // At least one file name should end with '.txt'
            expect(listRes.body.files.some(f => f.name.endsWith('.txt'))).toBe(true);
        });

        it('should write a file, then delete it', async () => {
            await agent
                .post('/api/pdata/write')
                .send({ file: 'testuser/deleteme.txt', content: 'Delete this' });

            const deleteRes = await agent
                .delete('/api/pdata/delete')
                .send({ file: 'testuser/deleteme.txt' });
            expect(deleteRes.statusCode).toEqual(200);
            expect(deleteRes.body.success).toBe(true);

            const listRes = await agent.get('/api/pdata/list?dir=testuser');
            expect(listRes.body.files.find(f => f.name === 'deleteme.txt')).toBeUndefined();
        });

        // Add more tests:
        // - Attempting to access other users' files (should fail with 403/404 depending on PData.can logic)
        // - Invalid paths for read/write/delete
        // - Large file uploads/downloads (if relevant)
        // - Concurrent requests (if you want to test for race conditions, harder)
    });

    // You can add another describe block for testadmin operations
    describe('Admin Operations', () => {
        beforeAll(async () => {
            // Log out any previous user
            await agent.get('/test-logout');
            // Login testadmin
            const res = await agent
                .post('/test-login')
                .send({ username: 'testadmin', password: 'adminpassword' });
            if (res.statusCode !== 200) {
                throw new Error('Testadmin login failed in beforeAll');
            }
        });

        it('testadmin should be able to list its own empty directory', async () => {
            // For testadmin, first create their directory or ensure it exists
            await agent
                .post('/api/pdata/write')
                .send({ file: 'testadmin/ensure_dir_exists.txt', content: 'Test' });
            
            // List specifically the admin's own directory
            const res = await agent.get('/api/pdata/list?dir=testadmin');
            expect(res.statusCode).toEqual(200);
            // Now we should see the file we just created, but no other directories yet
            expect(res.body.files).toContainEqual(expect.objectContaining({ 
                name: 'ensure_dir_exists.txt' 
            }));
            expect(res.body.dirs).toEqual([]);
        });

        // Add admin-specific tests if their permissions differ significantly
        // For example, can admin read/write/delete testuser's files?
        // This depends on your PData.can(username, action, resourcePath) implementation.
        // Example:
        // it('testadmin should be able to read a file from testuser (if permitted)', async () => {
        //     // First, testuser needs to create a file (could be done in a setup step or separate test)
        //     // For simplicity, let's assume 'testuser/somefile.txt' was created
        //     // You'd need to manage this file's existence across test sessions or ensure it's there.
        //     const readFileRes = await agent.get('/api/pdata/read?file=../testuser/testfile.txt'); // Path needs to be relative to admin's root
        //     // The exact path resolution and permission checking by PData.can for cross-user access by admin is key here.
        //     // If admin has blanket access to PD_DIR/data/ then the path might be simpler,
        //     // but PData.resolvePathForUser is user-specific.
        //     // This test highlights a potentially complex area of your permission model.
        // });
    });
});
