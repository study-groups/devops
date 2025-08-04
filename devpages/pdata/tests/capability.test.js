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
});
