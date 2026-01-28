// Caddy Panel - Scanner & Attack Detection

const SCANNER_PATTERNS = [
    /^\/wp-/i, /\/xmlrpc\.php/i, /\/wp-login/i, /\/wp-admin/i,
    /\/wp-content/i, /\/wp-includes/i,
    /\/\.env/i, /\/\.git/i, /\/\.aws/i, /\/\.ssh/i, /\/\.htaccess/i,
    /\/config\.(php|json|yml|yaml)/i,
    /\/phpinfo\.php/i, /\/phpmyadmin/i, /\/pma\//i, /\/myadmin/i, /\/adminer/i,
    /\.(bak|backup|old|orig|save|swp|tmp)$/i,
    /\/backup/i, /\/bak\//i, /\/old\//i, /\/test\//i,
    /\/shell/i, /\/cmd/i, /\/eval/i, /\/cgi-bin/i, /\/\.well-known\/security/i
];

const ATTACK_PATTERNS = [
    /\.\.\//,                    // Path traversal
    /\.\.%2f/i,                  // URL-encoded path traversal
    /\.\.%5c/i,                  // URL-encoded backslash traversal
    /%2e%2e/i,                   // Double-encoded dots
    /%c0%ae/i,                   // Overlong UTF-8 encoding
    /%252e/i,                    // Double URL encoding
    /etc\/passwd/i,              // passwd file access
    /etc\/shadow/i,              // shadow file access
    /\.ssh\/id_rsa/i,            // SSH key access
    /\.bash_history/i,           // bash history
    /win\.ini/i,                 // Windows ini
    /system32\/config/i,         // Windows SAM
    /proc\/self/i,               // Linux proc
];

function isScannerRequest(uri) {
    if (!uri) return false;
    return SCANNER_PATTERNS.some(pattern => pattern.test(uri));
}

function isAttackRequest(uri) {
    if (!uri) return false;
    return ATTACK_PATTERNS.some(pattern => pattern.test(uri));
}

function groupScannerBursts(logs, windowSecs = 60, minBurst = 5) {
    if (!logs || logs.length === 0) return [];

    const result = [];
    const ipBuckets = new Map();

    function flushBucket(ip) {
        const bucket = ipBuckets.get(ip);
        if (!bucket || bucket.length === 0) return;

        if (bucket.length >= minBurst) {
            const paths = [...new Set(bucket.map(l => {
                const uri = l.uri || l.request?.uri || '';
                return uri.split('?')[0];
            }))].slice(0, 3);

            result.push({
                type: 'scanner-group',
                ip: ip,
                count: bucket.length,
                paths: paths,
                tsStart: bucket[0].ts,
                tsEnd: bucket[bucket.length - 1].ts,
                statuses: [...new Set(bucket.map(l => l.status))].sort()
            });
        } else {
            result.push(...bucket);
        }
        ipBuckets.set(ip, []);
    }

    for (const log of logs) {
        const entry = parseLogEntry(log);
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip || '';
        const isScanner = entry.type === 'request' && isScannerRequest(entry.uri);

        if (isScanner && ip) {
            const bucket = ipBuckets.get(ip) || [];
            if (bucket.length > 0) {
                const lastTs = bucket[bucket.length - 1].ts || 0;
                const currentTs = log.ts || 0;
                if (currentTs - lastTs > windowSecs) {
                    flushBucket(ip);
                }
            }
            const newBucket = ipBuckets.get(ip) || [];
            newBucket.push(log);
            ipBuckets.set(ip, newBucket);
        } else {
            if (ip && ipBuckets.has(ip)) {
                flushBucket(ip);
            }
            result.push(log);
        }
    }

    for (const ip of ipBuckets.keys()) {
        flushBucket(ip);
    }

    return result;
}
