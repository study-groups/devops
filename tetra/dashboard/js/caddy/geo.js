// Caddy Panel - IP Geolocation Module
// Shared geo lookup with caching

const ipGeoCache = new Map();

const geoState = {
    loading: false,
    loadedCount: 0,
    totalCount: 0
};

/**
 * Lookup IP geolocation via ip-api.com
 * @param {string} ip
 * @returns {Promise<object|null>}
 */
async function lookupIP(ip) {
    if (!ip || ip === '-') return null;

    // Check cache
    if (ipGeoCache.has(ip)) {
        return ipGeoCache.get(ip);
    }

    // Skip private IPs
    if (isPrivateIP(ip)) {
        const local = { ip, city: 'Local', country: 'Private', org: '-', isp: '-', as: '-' };
        ipGeoCache.set(ip, local);
        return local;
    }

    try {
        // ip-api.com: free, no key, 45 req/min limit
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,as`);
        const data = await res.json();

        if (data.status === 'success') {
            const result = {
                ip,
                city: data.city || '-',
                region: data.regionName || '-',
                country: data.country || '-',
                isp: data.isp || '-',
                org: data.org || '-',
                as: data.as || '-'
            };
            ipGeoCache.set(ip, result);
            return result;
        }
    } catch (e) {
        console.warn('[Geo] Lookup failed for', ip, e.message);
    }

    return null;
}

/**
 * Check if IP is private/local
 */
function isPrivateIP(ip) {
    return ip.startsWith('10.') ||
           ip.startsWith('192.168.') ||
           ip.startsWith('127.') ||
           ip.startsWith('172.16.') ||
           ip.startsWith('172.17.') ||
           ip.startsWith('172.18.') ||
           ip.startsWith('172.19.') ||
           ip.startsWith('172.2') ||
           ip.startsWith('172.30.') ||
           ip.startsWith('172.31.') ||
           ip === 'localhost';
}

/**
 * Get cached geo for IP (sync)
 */
function getGeo(ip) {
    return ipGeoCache.get(ip) || null;
}

/**
 * Format geo for display (short)
 */
function formatGeoShort(ip, maxLen = 14) {
    const geo = getGeo(ip);
    if (!geo) return '-';
    const text = `${geo.city}, ${geo.country}`;
    return text.length > maxLen ? text.substring(0, maxLen - 1) + '…' : text;
}

/**
 * Batch lookup IPs with rate limiting
 * @param {string[]} ips - Array of IPs to lookup
 * @param {function} onProgress - Callback(done, total)
 * @returns {Promise<number>} - Count of successful lookups
 */
async function batchLookupIPs(ips, onProgress) {
    // Filter to unique, public, uncached IPs
    const toLookup = [...new Set(ips)].filter(ip =>
        ip && !isPrivateIP(ip) && !ipGeoCache.has(ip)
    );

    if (toLookup.length === 0) return 0;

    geoState.loading = true;
    geoState.totalCount = toLookup.length;
    geoState.loadedCount = 0;

    for (const ip of toLookup) {
        await lookupIP(ip);
        geoState.loadedCount++;
        if (onProgress) onProgress(geoState.loadedCount, geoState.totalCount);

        // Rate limit: ip-api.com allows 45/min ≈ 1.3s between requests
        if (geoState.loadedCount < toLookup.length) {
            await new Promise(r => setTimeout(r, 1400));
        }
    }

    geoState.loading = false;
    return geoState.loadedCount;
}

/**
 * Extract unique IPs from logs
 */
function extractIPsFromLogs(logs) {
    const ips = [];
    for (const log of logs) {
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip;
        if (ip) ips.push(ip);
    }
    return ips;
}
