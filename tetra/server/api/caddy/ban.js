// Caddy API - Fail2Ban, Ban, Unban routes

const router = require('express').Router();
const { getCaddyPaths, runCmd } = require('./lib');

// Fail2Ban - get fail2ban status and banned IPs
router.get('/fail2ban', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let result = {
            status: 'unknown',
            active: false,
            jails: [],
            banned: [],
            recent: [],
            totalBanned: 0,
            org,
            env
        };

        if (paths.isLocal) {
            result.status = 'not-applicable';
            result.message = 'fail2ban runs on remote servers';
        } else {
            try {
                const active = runCmd('systemctl is-active fail2ban 2>/dev/null || echo "inactive"', org, env).trim();
                result.active = active === 'active';
                result.status = active;

                if (result.active) {
                    const jailOutput = runCmd(`fail2ban-client status 2>/dev/null | grep "Jail list" | sed 's/.*:\s*//' | tr -d ' '`, org, env).trim();
                    result.jails = jailOutput.split(',').filter(j => j);

                    for (const jail of result.jails) {
                        try {
                            const banned = runCmd(`fail2ban-client status ${jail} 2>/dev/null | grep "Banned IP list" | sed 's/.*:\s*//'`, org, env).trim();
                            const ips = banned.split(/\s+/).filter(ip => ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/));
                            for (const ip of ips) {
                                result.banned.push({ ip, jail });
                            }
                        } catch (e) { /* skip this jail */ }
                    }
                    result.totalBanned = result.banned.length;

                    try {
                        const recentOutput = runCmd(`grep -E 'Ban|Unban' /var/log/fail2ban.log 2>/dev/null | tail -20 || journalctl -u fail2ban --no-pager -n 50 2>/dev/null | grep -E 'Ban|Unban' | tail -20`, org, env).trim();
                        const lines = recentOutput.split('\n').filter(l => l);
                        result.recent = lines.map(line => {
                            const banMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?(Ban|Unban)\s+(\d+\.\d+\.\d+\.\d+)/i);
                            if (banMatch) {
                                return {
                                    time: banMatch[1],
                                    action: banMatch[2].toLowerCase(),
                                    ip: banMatch[3]
                                };
                            }
                            return { raw: line };
                        }).filter(e => e.action || e.raw);
                    } catch (e) { /* no recent logs */ }
                }
            } catch (e) {
                result.status = 'error';
                result.error = e.message;
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Ban IP
router.post('/ban', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const { ip, jail = 'caddy-noscript', duration } = req.body;

    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    const paths = getCaddyPaths(org, env);

    if (paths.isLocal) {
        return res.json({ error: 'Ban only available on remote servers', org, env });
    }

    try {
        let cmd = `fail2ban-client set ${jail} banip ${ip}`;

        if (duration) {
            const durationMap = {
                '10m': 600,
                '1h': 3600,
                '24h': 86400,
                '7d': 604800,
                'permanent': -1
            };
            const seconds = durationMap[duration] || parseInt(duration) || 600;
            cmd = `fail2ban-client set ${jail} bantime ${seconds} && fail2ban-client set ${jail} banip ${ip}`;
        }

        const result = runCmd(cmd, org, env);
        res.json({ success: true, ip, jail, duration, result: result.trim(), org, env });
    } catch (err) {
        res.status(500).json({ error: err.message, ip, jail, org, env });
    }
});

// Unban IP
router.post('/unban', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const { ip, jail = 'caddy-noscript' } = req.body;

    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    const paths = getCaddyPaths(org, env);

    if (paths.isLocal) {
        return res.json({ error: 'Unban only available on remote servers', org, env });
    }

    try {
        const result = runCmd(`fail2ban-client set ${jail} unbanip ${ip}`, org, env);
        res.json({ success: true, ip, jail, result: result.trim(), org, env });
    } catch (err) {
        res.status(500).json({ error: err.message, ip, jail, org, env });
    }
});

module.exports = router;
