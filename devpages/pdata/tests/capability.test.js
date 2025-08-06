import path from 'path';
import { fileURLToPath } from 'url';
import { PData } from '../PData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDATA_TEST_ROOT = path.resolve(__dirname, 'pdata_test_root');

describe('PData Capability and Token Tests', () => {
    let pdata;
    let testUserToken;

    beforeAll(async () => {
        process.env.PD_DIR = PDATA_TEST_ROOT;
        pdata = new PData();
        testUserToken = await pdata.createToken('testuser', 'password123');
    });

    test('should create a valid token for an existing user', async () => {
        const token = await pdata.createToken('testuser', 'password123');
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        const decoded = pdata.validateToken(token);
        expect(decoded).toBeDefined();
        expect(decoded.username).toBe('testuser');
        expect(decoded.roles).toEqual(['user']);
    });

    test('should not create a token for a user with an incorrect password', async () => {
        const token = await pdata.createToken('testuser', 'wrongpassword');
        expect(token).toBeNull();
    });

    test('should validate a legitimate token', async () => {
        const token = await pdata.createToken('testadmin', 'adminpassword');
        const decoded = pdata.validateToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded.username).toBe('testadmin');
    });

    test('should reject an expired or tampered token', async () => {
        const token = await pdata.authSrv.createToken({ username: 'testuser', roles: ['user'], caps: [], ttl: 0.1 });
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait for token to expire
        expect(pdata.validateToken(token)).toBeNull();

        const tamperedToken = token.slice(0, -1) + 'a'; // Tamper with the signature
        expect(pdata.validateToken(tamperedToken)).toBeNull();
    });

    test('should allow an action if token has a matching direct capability', () => {
        const decodedToken = pdata.validateToken(testUserToken);
        decodedToken.caps = ['read:users/testuser/file1.txt'];
        expect(pdata.authSrv.tokenHasCap(decodedToken, 'read', 'users/testuser/file1.txt')).toBe(true);
    });
    
    test('should deny an action if token does not have a matching capability', () => {
        const decodedToken = pdata.validateToken(testUserToken);
        decodedToken.caps = ['read:users/testuser/file1.txt'];
        expect(pdata.authSrv.tokenHasCap(decodedToken, 'write', 'users/testuser/file1.txt')).toBe(false);
    });

    test('should correctly expand asset sets from assets.csv for capability checks', () => {
        const token = pdata.validateToken(testUserToken);
        token.caps = ['read:@assets:public_games'];

        expect(pdata.authSrv.tokenHasCap(token, 'read', '/games/demo/game1.rom')).toBe(true);
        expect(pdata.authSrv.tokenHasCap(token, 'read', '/games/free/game2.rom')).toBe(true);
        expect(pdata.authSrv.tokenHasCap(token, 'read', '/games/premium/game3.rom')).toBe(false);
    });

    // THREE-TIER MOUNTING TESTS
    test('should create three-tier mounts for regular users', async () => {
        const token = await pdata.createToken('testuser', 'password123');
        const decoded = pdata.validateToken(token);
        
        expect(decoded.mounts).toBeDefined();
        expect(decoded.mounts['~data']).toBeDefined();
        expect(decoded.mounts['~data']).toContain('data');
        expect(decoded.mounts['~/data/users/testuser']).toBeDefined();
        expect(decoded.mounts['~/data/users/testuser']).toContain('users/testuser');
    });

    test('should create system-wide mounts for admin users', async () => {
        const token = await pdata.createToken('testadmin', 'adminpassword');
        const decoded = pdata.validateToken(token);
        
        expect(decoded.mounts).toBeDefined();
        expect(decoded.mounts['~data']).toBeDefined();
        expect(decoded.mounts['~log']).toBeDefined();
        expect(decoded.mounts['~cache']).toBeDefined();
        expect(decoded.mounts['~system']).toBeDefined();
        expect(decoded.mounts['~system']).toBe(PDATA_TEST_ROOT);
    });

    test('should support different user home directories', async () => {
        const token = await pdata.createToken('gridranger', 'gridpass');
        const decoded = pdata.validateToken(token);
        
        expect(decoded.mounts).toBeDefined();
        expect(decoded.mounts['~data']).toBeDefined();
        expect(decoded.mounts['~/data/projects/gridranger']).toBeDefined();
        expect(decoded.mounts['~/data/projects/gridranger']).toContain('projects/gridranger');
    });

    test('should resolve paths correctly using three-tier mounts', async () => {
        const token = await pdata.createToken('testuser', 'password123');
        const decoded = pdata.validateToken(token);
        
        // Test userspace data access
        const dataPath = pdata.authSrv.resolvePath(decoded, '~data');
        expect(dataPath).toBe(decoded.mounts['~data']);
        
        // Test user-specific home access
        const homePath = pdata.authSrv.resolvePath(decoded, '~/data/users/testuser');
        expect(homePath).toBe(decoded.mounts['~/data/users/testuser']);
        
        // Test relative path resolution within user space
        const filePath = pdata.authSrv.resolvePath(decoded, '~/data/users/testuser/documents/test.md');
        expect(filePath).toContain('users/testuser/documents/test.md');
    });

    test('should use three-tier mounting in file operations', async () => {
        const token = await pdata.createToken('testuser', 'password123');
        const decoded = pdata.validateToken(token);
        
        // Test that listDirectory works with token-based mounting
        const result = await pdata.listDirectory(decoded, '');
        expect(result).toBeDefined();
        expect(result.exists).toBe(true);
        
        // Test that file operations work with three-tier mounts
        await pdata.writeFile(decoded, 'unified-test.txt', 'Hello three-tier mounting!');
        const content = await pdata.readFile(decoded, 'unified-test.txt');
        expect(content).toBe('Hello three-tier mounting!');
        
        // Cleanup
        await pdata.deleteFile(decoded, 'unified-test.txt');
    });

    test('should provide three-tier mounts for users via MountManager', async () => {
        // Test regular user gets ~data + their specific home mount
        const userMounts = await pdata.getAvailableTopDirs('testuser');
        expect(userMounts).toContain('~data');
        expect(userMounts).toContain('~/data/users/testuser');
        
        // Test admin gets system-wide access
        const adminMounts = await pdata.getAvailableTopDirs('testadmin');
        expect(adminMounts).toContain('~data');
        expect(adminMounts).toContain('~log');
        expect(adminMounts).toContain('~cache');
        expect(adminMounts).toContain('~system');
        
        // Test project user gets appropriate access
        const projectMounts = await pdata.getAvailableTopDirs('gridranger');
        expect(projectMounts).toContain('~data');
        expect(projectMounts).toContain('~/data/projects/gridranger');
    });
});
