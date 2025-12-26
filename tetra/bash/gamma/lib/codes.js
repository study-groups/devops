/**
 * GAMMA Code Generation
 *
 * Generates short, memorable join codes for matches.
 */

'use strict';

// Base32 alphabet without ambiguous characters (no I, O, 0, 1)
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Wordlist approach: adjective + noun = 65536 combinations
const ADJECTIVES = [
    'RED', 'BLUE', 'GOLD', 'DARK', 'WILD', 'FAST', 'COOL', 'HOT',
    'ICY', 'NEW', 'OLD', 'BIG', 'SLY', 'SHY', 'DRY', 'WET',
    'RAW', 'ODD', 'FIT', 'MAD', 'SAD', 'BAD', 'RAD', 'FAT',
    'TAN', 'ZEN', 'ACE', 'TOP', 'LOW', 'HIP', 'MOD', 'POP'
];

const NOUNS = [
    'FOX', 'CAT', 'DOG', 'OWL', 'BAT', 'BEE', 'ANT', 'APE',
    'ELK', 'EEL', 'COD', 'COW', 'PIG', 'RAM', 'RAT', 'YAK',
    'JAM', 'JAR', 'JET', 'GEM', 'ORB', 'AXE', 'BOW', 'KEY',
    'SUN', 'SKY', 'SEA', 'BAY', 'ICE', 'FOG', 'DEW', 'OAK'
];

class Codes {
    constructor(options = {}) {
        this.mode = options.mode || 'base32';  // 'base32' or 'word'
        this.length = options.length || 4;
    }

    /**
     * Generate a unique code
     * @param {Function} existsCheck - Function to check if code exists
     * @param {number} maxAttempts - Max attempts before lengthening
     */
    generate(existsCheck = () => false, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
            const code = this.mode === 'word'
                ? this.generateWord()
                : this.generateBase32(this.length);

            if (!existsCheck(code)) {
                return code;
            }
        }

        // Fall back to longer code
        return this.generateBase32(this.length + 1);
    }

    /**
     * Generate base32 code
     */
    generateBase32(length) {
        let code = '';
        for (let i = 0; i < length; i++) {
            code += BASE32[Math.floor(Math.random() * BASE32.length)];
        }
        return code;
    }

    /**
     * Generate word-based code (ADJNOUN format)
     */
    generateWord() {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        return adj + noun;
    }

    /**
     * Validate code format
     */
    isValid(code) {
        if (!code || typeof code !== 'string') return false;

        // Base32: 4-6 uppercase alphanumeric
        if (/^[A-Z0-9]{4,6}$/.test(code)) return true;

        // Word: 6-8 uppercase letters
        if (/^[A-Z]{6,8}$/.test(code)) return true;

        return false;
    }

    /**
     * Normalize code (uppercase, trim)
     */
    normalize(code) {
        if (!code) return null;
        return code.toString().toUpperCase().trim();
    }
}

module.exports = Codes;
