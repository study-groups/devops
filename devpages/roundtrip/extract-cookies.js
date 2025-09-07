#!/usr/bin/env node
/**
 * extract-cookies.js - Browser console script to extract cookies for curl
 */

console.log("🍪 Cookie Extractor for curl authentication");

function extractCookiesForCurl() {
    // Get all cookies
    const cookies = document.cookie;
    console.log("Raw cookies:", cookies);
    
    if (!cookies) {
        console.log("❌ No cookies found");
        return null;
    }
    
    // Find session cookie specifically
    const sessionMatch = cookies.match(/devpages\.sid=([^;]+)/);
    const sessionCookie = sessionMatch ? sessionMatch[0] : null;
    
    console.log("Session cookie:", sessionCookie);
    
    // Create curl-compatible format
    const curlCookies = cookies
        .split(';')
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .join('; ');
    
    // Create curl commands for testing
    const baseUrl = window.location.origin;
    
    const curlCommands = {
        listFiles: `curl -H "Cookie: ${curlCookies}" "${baseUrl}/api/files/list?pathname=users/mike"`,
        saveFile: `curl -H "Cookie: ${curlCookies}" -H "Content-Type: application/json" -X POST "${baseUrl}/api/files/save" -d '{"pathname":"users/mike/test.md","content":"# Test from curl\\nThis was saved via curl with cookies."}'`,
        getFile: `curl -H "Cookie: ${curlCookies}" "${baseUrl}/api/files/content?pathname=users/mike/001.md"`
    };
    
    console.log("\n🚀 Curl commands ready:");
    Object.entries(curlCommands).forEach(([name, cmd]) => {
        console.log(`\n${name}:`);
        console.log(cmd);
    });
    
    // Also create cookie file format
    const cookieFile = cookies
        .split(';')
        .map(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                // Netscape cookie format: domain, tailmatch, path, secure, expiration, name, value
                return `localhost\tFALSE\t/\tFALSE\t0\t${name}\t${value}`;
            }
        })
        .filter(Boolean)
        .join('\n');
    
    console.log("\n📁 Cookie file format (save as cookies.txt):");
    console.log("# Netscape HTTP Cookie File");
    console.log(cookieFile);
    
    return {
        cookies: curlCookies,
        sessionCookie,
        curlCommands,
        cookieFile: "# Netscape HTTP Cookie File\n" + cookieFile
    };
}

// Browser usage
if (typeof window !== 'undefined') {
    window.extractCookiesForCurl = extractCookiesForCurl;
    console.log("✅ Run extractCookiesForCurl() in the browser console");
} else {
    console.log("❌ This must be run in the browser console");
}

export { extractCookiesForCurl };