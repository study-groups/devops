import crypto from 'crypto';
import { Buffer } from 'buffer';

/** Generates a random salt */
export function generateSalt(length = 16) {
	return crypto.randomBytes(length).toString('hex');
}

/** Hashes a password with a given salt */
export function hashPassword(password, saltHex) {
	if (!password || typeof password !== 'string' || !saltHex || typeof saltHex !== 'string') {
		console.error('[HASH ERROR] Invalid input provided to hashPassword.');
		return null;
	}
	const callContext = process.argv[1]?.includes('manageUsers.js') ? '[CLI]' : '[SERVER]';

	console.log(`[HASH ${callContext}] Hashing password using PBKDF2-SHA512 (keylen: 32)...`);

	let saltBuffer;
	try {
		saltBuffer = Buffer.from(saltHex.trim(), 'hex');
	} catch (e) {
		console.error(`[HASH ${callContext} ERROR] Failed to convert salt hex '${saltHex}' to Buffer:`, e.message);
		return null;
	}

	try {
		const iterations = 10000;
		const keylen = 32;
		const digest = 'sha512';

		const hash = crypto.pbkdf2Sync(password, saltBuffer, iterations, keylen, digest).toString('hex');
		console.log(`[HASH ${callContext}] PBKDF2 hash generated successfully (length: ${hash.length}).`);
		return hash;
	} catch (e) {
		console.error(`[HASH ${callContext} ERROR] pbkdf2Sync failed:`, e.message);
		return null;
	}
}

// Remove all other functions (validateUser, addUser, etc.) from this file 