#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateToken() {
    // Create a secure, time-based token
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(32);
    
    const token = {
        value: crypto.createHash('sha256')
            .update(`${timestamp}:${randomBytes.toString('hex')}`)
            .digest('hex'),
        created: timestamp,
        expires: timestamp + (24 * 60 * 60 * 1000) // 24 hours
    };

    return token;
}

function saveToken(token) {
    const tokenPath = path.join(__dirname, '..', 'pdata', 'auth-token.json');
    
    // Ensure pdata directory exists
    const pdataDir = path.dirname(tokenPath);
    if (!fs.existsSync(pdataDir)) {
        fs.mkdirSync(pdataDir, { recursive: true });
    }

    fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
    console.log('🔐 Token generated and saved');
    return token;
}

// Generate and save token
const token = generateToken();
saveToken(token);

// Output token for immediate use
console.log('🔑 Generated Token:', token.value);
