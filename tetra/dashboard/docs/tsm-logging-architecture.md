# TSM Logging Architecture & Dashboard Coordination

## How the [L] Button Works

### User Flow
1. User clicks **[L]** button on a service row in TSM panel
2. Service name is added to `state.watchedServices` Set
3. State persisted to `localStorage` as `tsm-watched-logs`
4. Message broadcast via `Terrain.Bus`:
   ```javascript
   {
       source: 'tsm',
       type: 'log-watch-change',
       services: ['devwatch', 'pbase', ...],
       org: 'tetra',
       env: 'local',
       user: ''
   }
   ```
5. Logs panel (`logs.iframe.html`) receives message and updates its filter
6. Button highlights with `active` class (teal border)

### Data Flow
```
TSM Panel                    Terrain.Bus                 Logs Panel
    │                            │                           │
    │ click [L]                  │                           │
    ├──────────────────────────► │                           │
    │   log-watch-change         │                           │
    │                            ├─────────────────────────► │
    │                            │   subscribe('*')          │
    │                            │                           │
    │                            │                    filter logs
    │                            │                    by service
```

### Code Locations
- **Toggle handler**: `dashboard/js/tsm.js:toggleLogs()`
- **State persistence**: `localStorage.getItem('tsm-watched-logs')`
- **Message send**: `Terrain.Iframe.send()` → parent → broadcast
- **Logs receiver**: `dashboard/js/logs.js` subscribes to `log-watch-change`

---

## Current Logging Infrastructure

### Log Retrieval API
**Endpoint**: `GET /api/tsm/logs/:service`

| Param | Default | Description |
|-------|---------|-------------|
| lines | 50 | Number of log lines |
| format | text | `text` or `json` |
| since | - | Time filter (e.g., "5m", "1h") |
| org | tetra | Organization |
| env | local | Environment |
| user | - | SSH user override |

**Implementation**: `server/api/tsm.js:313-366`
- Runs `tsm logs <service> -n <lines>` via shell
- For remote envs, wraps in SSH command
- JSON format includes structured entries with timestamps

### Log Storage
TSM stores logs at: `$TETRA_DIR/run/<service>/current.log`

Each service has:
- `current.log` - Active log file (rotated)
- `pid` - Process ID file
- `env` - Environment variables snapshot

### Remote Log Access
For non-local environments:
1. Dashboard reads `tetra.toml` for SSH config
2. Constructs SSH command: `ssh user@host 'source ~/tetra/tetra.sh && tsm logs ...'`
3. Returns output to browser

---

## Dashboard Iframe Coordination

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    index.html (Parent)                   │
│  ┌─────────────┐  ┌─────────────┐                       │
│  │ Terrain.Bus │  │ State Mgmt  │                       │
│  │  (pub/sub)  │  │ (org/env)   │                       │
│  └──────┬──────┘  └─────────────┘                       │
│         │                                                │
│  ┌──────┴───────────────────────────────────┐           │
│  │              postMessage                  │           │
│  ▼              ▼              ▼             ▼           │
│ ┌────┐       ┌────┐       ┌────┐       ┌────┐          │
│ │TSM │       │Logs│       │Admin│      │... │          │
│ └────┘       └────┘       └────┘       └────┘          │
│  iframe       iframe       iframe       iframe          │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### Terrain.Bus (Message Bus)
```javascript
// Subscribe to all messages
Terrain.Bus.subscribe('*', handler)

// Subscribe to specific type
Terrain.Bus.subscribe('env-change', handler)

// Publish (auto-routes parent↔iframe)
Terrain.Bus.publish({ type: 'my-event', data: {...} })

// Send to specific panel
Terrain.Bus.route('logs', msg)

// Broadcast to all except source
Terrain.Bus.broadcast(msg, excludeSource)
```

#### Terrain.Iframe (Per-iframe Helper)
```javascript
Terrain.Iframe.init({
    name: 'tsm',
    onReady: () => loadServices(),
    useSharedState: true  // auto-sync org/env
});

// Send to parent
Terrain.Iframe.send({ type: 'log-watch-change', ... })

// DOM event delegation
Terrain.Iframe.on('toggle-logs', handler)
```

#### Terrain.State (Shared Context)
```javascript
Terrain.State.org      // Current org
Terrain.State.env      // Current env
Terrain.State.user     // SSH user

Terrain.State.apiUrl('/api/tsm/ls')  // Build URL with params
Terrain.State.onEnvChange(callback)  // React to changes
```

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `ready` | iframe → parent | Iframe loaded |
| `env-change` | parent → iframes | Org/env changed |
| `log-watch-change` | tsm → logs | Watch list updated |
| `view-logs` | tsm → parent | Request log panel focus |
| `timing-update` | parent → admin | Performance metrics |

---

## Improvement Opportunities

### 1. Log Aggregation
**Current**: Each service has separate log file, fetched individually
**Improvement**: Unified log stream with service tags

```javascript
// Proposed: Multi-service log stream
GET /api/tsm/logs/stream?services=devwatch,pbase&format=ndjson

// Response (newline-delimited JSON)
{"ts":"2025-01-17T10:00:00Z","service":"devwatch","level":"info","msg":"..."}
{"ts":"2025-01-17T10:00:01Z","service":"pbase","level":"error","msg":"..."}
```

### 2. Log Persistence & Search
**Current**: Only tail of current.log available
**Improvement**: Indexed log storage with search

Options:
- SQLite FTS5 for local search
- Loki for remote aggregation
- Simple file rotation with grep-based search

### 3. Real-time Streaming
**Current**: Polling every 5 seconds
**Improvement**: WebSocket or SSE for live tail

```javascript
// Server-Sent Events approach
GET /api/tsm/logs/:service/stream

// Client
const es = new EventSource('/api/tsm/logs/devwatch/stream');
es.onmessage = (e) => appendLog(JSON.parse(e.data));
```

### 4. Log Correlation
**Current**: Logs are per-service silos
**Improvement**: Request tracing across services

- Add trace ID to requests
- Correlate logs by trace ID
- Show request flow across services

### 5. Structured Logging
**Current**: Plain text logs
**Improvement**: JSON structured logs

```javascript
// In services
logger.info({ event: 'request', path: '/api/foo', duration: 42 })

// Enables filtering
GET /api/tsm/logs/devwatch?filter=level:error&filter=event:request
```

---

## Admin Panel Coordination

### Current Role
`admin.iframe.html` serves as monitoring dashboard:
- Capture storage stats
- Iframe load times
- Activity log

### Potential TSM Integration

Admin could coordinate TSM operations:

1. **Fleet Overview**
   - All services across all envs in one view
   - Health status matrix (local/dev/staging/prod)

2. **Log Analysis**
   - Error rate trends
   - Log volume metrics
   - Alert thresholds

3. **Deployment Coordination**
   - Pre-deploy health checks
   - Rolling restart orchestration
   - Rollback triggers

### Implementation Pattern
```javascript
// Admin subscribes to TSM events
Terrain.Bus.subscribe('*', (msg) => {
    if (msg.source === 'tsm') {
        logActivity(msg);
        updateMetrics(msg);
    }
});

// Admin can command TSM
function restartAll(env) {
    Terrain.Bus.publish({
        type: 'tsm-command',
        action: 'restart-all',
        env: env
    });
}
```

---

## Proposed Info Tab Content

### For TSM Panel Info Tab

**Section 1: Service Management**
- TSM = Tetra Service Manager
- Services defined in `.tsm` files
- Start/stop/restart via CLI or dashboard
- Auto-restart on crash (patrol mode)

**Section 2: Log System**
- Logs stored in `$TETRA_DIR/run/<service>/`
- [L] button watches service in Logs panel
- Recent logs shown in expanded view
- Full logs in dedicated Logs panel

**Section 3: Remote Execution**
- Configure in `tetra.toml`: `[env.prod] host = "1.2.3.4"`
- SSH tunneling for remote commands
- Same interface for local and remote

**Section 4: Environment Model**
```
org (tetra, nh, pj)
 └── env (local, dev, staging, prod)
      └── services (devwatch, pbase, ...)
```

---

## File References

| File | Purpose |
|------|---------|
| `dashboard/js/tsm.js` | TSM panel logic |
| `dashboard/js/logs.js` | Logs panel logic |
| `dashboard/js/terrain-iframe.js` | Cross-iframe communication |
| `server/api/tsm.js` | TSM REST API |
| `bash/tsm/tsm.sh` | TSM CLI |
| `bash/tsm/core/process.sh` | Process management |
