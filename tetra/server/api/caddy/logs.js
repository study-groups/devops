// Caddy API - Logs, Errors, Stats, Metadata routes

const fs = require('fs');
const router = require('express').Router();
const {
    getCaddyPaths, runCmd, formatFileSize
} = require('./lib');

// Logs - get recent caddy logs (parsed JSON)
router.get('/logs', (req, res) => {
    const { org = 'tetra', env = 'local', lines = 50 } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        if (paths.isLocal) {
            const logFile = paths.logFile;

            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf-8');
                const logLines = content.split('\n').slice(-parseInt(lines)).filter(l => l);

                const logs = logLines.map(line => {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.request) {
                            return {
                                ts: parsed.ts,
                                status: parsed.status,
                                method: parsed.request?.method,
                                host: parsed.request?.host,
                                uri: parsed.request?.uri,
                                duration: parsed.duration,
                                remote_ip: parsed.request?.remote_ip || parsed.request?.client_ip
                            };
                        }
                        return {
                            ts: parsed.ts,
                            level: parsed.level,
                            msg: parsed.msg,
                            logger: parsed.logger
                        };
                    } catch (e) {
                        return { raw: line };
                    }
                });

                res.json({
                    logs,
                    count: logs.length,
                    source: logFile,
                    org,
                    env
                });
                return;
            }

            res.json({
                logs: [],
                count: 0,
                message: `No caddy.log found. Configure logging in Caddyfile to: ${logFile}`,
                source: logFile,
                org,
                env
            });
            return;
        }

        const cmd = `tail -n ${lines} ${paths.logDir}/*.log 2>/dev/null | jq -c 'select(.request) | {ts: .ts, status: .status, method: .request.method, host: .request.host, uri: .request.uri, duration: .duration}' 2>/dev/null || tail -n ${lines} ${paths.logDir}/*.log 2>/dev/null || echo ''`;
        const output = runCmd(cmd, org, env);

        const logs = output.trim().split('\n').filter(l => l && l.startsWith('{')).map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { raw: line };
            }
        });

        res.json({
            logs,
            count: logs.length,
            source: paths.logDir,
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, logs: [], org, env });
    }
});

// Errors - get recent errors only
router.get('/errors', (req, res) => {
    const { org = 'tetra', env = 'local', lines = 50 } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        if (paths.isLocal) {
            const logFile = paths.logFile;

            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf-8');
                const logLines = content.split('\n').filter(l => l);

                const errors = [];
                for (const line of logLines) {
                    try {
                        const parsed = JSON.parse(line);
                        const isError = parsed.level === 'error' ||
                                       (parsed.status && parsed.status >= 500);
                        if (isError) {
                            errors.push({
                                ts: parsed.ts,
                                status: parsed.status,
                                level: parsed.level,
                                msg: parsed.msg,
                                uri: parsed.request?.uri
                            });
                        }
                    } catch (e) {
                        if (line.toLowerCase().includes('error')) {
                            errors.push({ raw: line });
                        }
                    }
                }

                res.json({
                    errors: errors.slice(-parseInt(lines)),
                    count: errors.length,
                    source: logFile,
                    org,
                    env
                });
                return;
            }

            res.json({
                errors: [],
                count: 0,
                message: 'No caddy.log found',
                source: logFile,
                org,
                env
            });
            return;
        }

        const cmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -c 'select(.level == "error" or (.status // 0) >= 500) | {ts: .ts, status: .status, level: .level, msg: .msg, uri: .request.uri}' 2>/dev/null | tail -n ${lines} || echo ''`;
        const output = runCmd(cmd, org, env);

        const errors = output.trim().split('\n').filter(l => l && l.startsWith('{')).map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { raw: line };
            }
        });

        res.json({
            errors,
            count: errors.length,
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, errors: [], org, env });
    }
});

// Stats - longterm log statistics
router.get('/stats', (req, res) => {
    const { org = 'tetra', env = 'local', period = '24h' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let result = {
            period,
            summary: {
                totalRequests: 0,
                errorCount: 0,
                avgDuration: 0,
                uniqueIPs: 0
            },
            topIPs: [],
            topPaths: [],
            statusCodes: [],
            hourlyRequests: [],
            org,
            env
        };

        if (paths.isLocal) {
            const logFile = paths.logFile;
            if (fs.existsSync(logFile)) {
                try {
                    const content = fs.readFileSync(logFile, 'utf-8');
                    const lines = content.split('\n').filter(l => l);

                    const logs = [];
                    const ipCounts = {};
                    const pathCounts = {};
                    const statusCounts = {};
                    let totalDuration = 0;
                    let durationCount = 0;
                    let errorCount = 0;

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.request) {
                                logs.push(parsed);

                                const ip = parsed.request?.remote_ip || parsed.request?.client_ip || 'unknown';
                                ipCounts[ip] = (ipCounts[ip] || 0) + 1;

                                const uri = parsed.request?.uri || '/';
                                pathCounts[uri] = (pathCounts[uri] || 0) + 1;

                                const status = parsed.status || 0;
                                statusCounts[status] = (statusCounts[status] || 0) + 1;
                                if (status >= 500) errorCount++;

                                if (parsed.duration) {
                                    totalDuration += parsed.duration;
                                    durationCount++;
                                }
                            }
                        } catch (e) { /* skip non-JSON lines */ }
                    }

                    result.summary = {
                        totalRequests: logs.length,
                        errorCount,
                        avgDuration: durationCount > 0 ? (totalDuration / durationCount).toFixed(3) : 0,
                        uniqueIPs: Object.keys(ipCounts).length
                    };

                    const sortedIPs = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    const maxIPCount = sortedIPs[0]?.[1] || 1;
                    result.topIPs = sortedIPs.map(([ip, count]) => ({
                        ip, count, percent: Math.round((count / maxIPCount) * 100)
                    }));

                    const sortedPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    const maxPathCount = sortedPaths[0]?.[1] || 1;
                    result.topPaths = sortedPaths.map(([path, count]) => ({
                        path, count, percent: Math.round((count / maxPathCount) * 100)
                    }));

                    const total = logs.length || 1;
                    const sortedStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
                    result.statusCodes = sortedStatus.map(([code, count]) => ({
                        code, count, percent: Math.round((count / total) * 100)
                    }));

                } catch (e) {
                    result.message = `Error parsing logs: ${e.message}`;
                }
            } else {
                result.message = `No log file found at ${logFile}`;
            }
        } else {
            try {
                const statsCmd = `
                    cat ${paths.logDir}/*.log 2>/dev/null | jq -s '
                        {
                            total: length,
                            errors: [.[] | select(.status >= 500 or .level == "error")] | length,
                            avgDuration: (if length > 0 then ([.[].duration // 0] | add / length) else 0 end),
                            uniqueIPs: ([.[].request.remote_ip // .[].request.client_ip] | unique | length)
                        }
                    ' 2>/dev/null || echo '{"total":0,"errors":0,"avgDuration":0,"uniqueIPs":0}'
                `;
                const summaryOutput = runCmd(statsCmd, org, env).trim();
                try {
                    const summary = JSON.parse(summaryOutput);
                    result.summary = {
                        totalRequests: summary.total || 0,
                        errorCount: summary.errors || 0,
                        avgDuration: (summary.avgDuration || 0).toFixed(3),
                        uniqueIPs: summary.uniqueIPs || 0
                    };
                } catch (e) { /* use defaults */ }

                const topIPsCmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -r '.request.remote_ip // .request.client_ip // empty' | sort | uniq -c | sort -rn | head -10 | awk '{print $1 "|" $2}'`;
                const topIPsOutput = runCmd(topIPsCmd, org, env).trim();
                if (topIPsOutput) {
                    const maxCount = parseInt(topIPsOutput.split('\n')[0].split('|')[0]) || 1;
                    result.topIPs = topIPsOutput.split('\n').filter(l => l).map(line => {
                        const [count, ip] = line.split('|');
                        return { ip, count: parseInt(count), percent: Math.round((parseInt(count) / maxCount) * 100) };
                    });
                }

                const topPathsCmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -r '.request.uri // empty' | sort | uniq -c | sort -rn | head -10 | awk '{print $1 "|" $2}'`;
                const topPathsOutput = runCmd(topPathsCmd, org, env).trim();
                if (topPathsOutput) {
                    const maxCount = parseInt(topPathsOutput.split('\n')[0].split('|')[0]) || 1;
                    result.topPaths = topPathsOutput.split('\n').filter(l => l).map(line => {
                        const [count, path] = line.split('|');
                        return { path, count: parseInt(count), percent: Math.round((parseInt(count) / maxCount) * 100) };
                    });
                }

                const statusCmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -r '.status // empty' | sort | uniq -c | sort -rn | awk '{print $1 "|" $2}'`;
                const statusOutput = runCmd(statusCmd, org, env).trim();
                if (statusOutput) {
                    const total = statusOutput.split('\n').filter(l => l).reduce((sum, line) => sum + parseInt(line.split('|')[0]), 0) || 1;
                    result.statusCodes = statusOutput.split('\n').filter(l => l).map(line => {
                        const [count, code] = line.split('|');
                        return { code, count: parseInt(count), percent: Math.round((parseInt(count) / total) * 100) };
                    });
                }

            } catch (e) {
                console.warn('[Caddy] Stats fetch error:', e.message);
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Metadata - log analysis settings and resource usage
router.get('/metadata', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let result = {
            analysis: {
                enabled: true,
                filterLevel: 'standard',
                jsonParsing: true
            },
            resources: {
                cpuPercent: 0,
                memoryMB: 0,
                diskUsageMB: 0,
                openFiles: 0
            },
            logFile: null,
            files: [],
            org,
            env
        };

        if (paths.isLocal) {
            try {
                const pid = runCmd('pgrep -f "caddy run" 2>/dev/null | head -1 || echo ""', org, env).trim();
                if (pid) {
                    const ps = runCmd(`ps -p ${pid} -o %cpu,%mem,rss 2>/dev/null | tail -1 || echo "0 0 0"`, org, env).trim();
                    const [cpu, mem, rss] = ps.split(/\s+/).map(Number);
                    result.resources.cpuPercent = cpu || 0;
                    result.resources.memoryMB = Math.round((rss || 0) / 1024);
                }
            } catch (e) { /* ignore */ }

            const logFile = paths.logFile;
            if (fs.existsSync(logFile)) {
                try {
                    const stats = fs.statSync(logFile);
                    const sizeBytes = stats.size;

                    let lineCount;
                    if (sizeBytes < 10 * 1024 * 1024) {
                        const content = fs.readFileSync(logFile, 'utf-8');
                        lineCount = content.split('\n').filter(l => l.trim()).length;
                    } else {
                        const fd = fs.openSync(logFile, 'r');
                        const sampleSize = 64 * 1024;
                        const buffer = Buffer.alloc(sampleSize);
                        fs.readSync(fd, buffer, 0, sampleSize, 0);
                        fs.closeSync(fd);

                        const sampleLines = buffer.toString('utf-8').split('\n').length - 1;
                        const avgLineSize = sampleSize / sampleLines;
                        lineCount = Math.round(sizeBytes / avgLineSize);
                    }

                    result.logFile = {
                        path: logFile,
                        size: formatFileSize(sizeBytes),
                        sizeBytes,
                        lines: lineCount,
                        modified: stats.mtime.toISOString().replace('T', ' ').slice(0, 19)
                    };
                } catch (e) {
                    console.warn('[Caddy] Error reading log file stats:', e.message);
                }
            }

            result.files = [{
                name: 'caddy.log',
                size: result.logFile?.size || 'N/A',
                age: result.logFile?.modified || 'unknown'
            }];
        } else {
            try {
                const procStats = runCmd(`
                    pid=$(pgrep -f "caddy" | head -1)
                    if [ -n "$pid" ]; then
                        ps -p $pid -o %cpu,%mem,rss --no-headers 2>/dev/null | awk '{print $1, $2, $3}'
                        lsof -p $pid 2>/dev/null | wc -l
                    else
                        echo "0 0 0"
                        echo "0"
                    fi
                `, org, env).trim().split('\n');

                const [cpu, mem, rss] = (procStats[0] || '0 0 0').split(/\s+/).map(Number);
                result.resources.cpuPercent = cpu || 0;
                result.resources.memoryMB = Math.round((rss || 0) / 1024);
                result.resources.openFiles = parseInt(procStats[1]) || 0;

                const diskUsage = runCmd(`du -sm ${paths.logDir} 2>/dev/null | cut -f1 || echo "0"`, org, env).trim();
                result.resources.diskUsageMB = parseInt(diskUsage) || 0;

                const fileList = runCmd(`
                    ls -lh ${paths.logDir}/*.log 2>/dev/null | awk '{
                        split($9, a, "/");
                        name = a[length(a)];
                        size = $5;
                        print name "|" size "|" $6 " " $7
                    }'
                `, org, env).trim();

                if (fileList) {
                    result.files = fileList.split('\n').filter(l => l).map(line => {
                        const [name, size, date] = line.split('|');
                        return { name, size, age: date };
                    });
                }

                try {
                    const hasJson = runCmd(`grep -c 'format json' ${paths.caddyfile} 2>/dev/null || echo "0"`, org, env).trim();
                    result.analysis.jsonParsing = parseInt(hasJson) > 0;
                } catch (e) { /* ignore */ }

            } catch (e) {
                console.warn('[Caddy] Metadata fetch error:', e.message);
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

module.exports = router;
