# TSM Logging System

Unified logging with timestamps, delta timing, rotation, and dashboard integration.

## Timestamp Format

TSM uses **compact ISO 8601** timestamps with millisecond precision:

```
YYYYMMDDTHHMMSS.mmmZ
```

Example: `20260115T143245.123Z`

- UTC timezone (Z suffix)
- Millisecond precision (.mmm)
- Sortable as strings
- 22 characters fixed length

## Commands

### View Logs

```bash
tsm logs <name|id> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `-f, --follow` | Stream in real-time (tail -f) |
| `-n, --lines N` | Show last N lines (default: 50) |
| `--since TIME` | Filter by duration (5m, 1h) or timestamp |
| `-t, --timestamps` | Prepend compact ISO timestamps |
| `--delta` | Show delta time between lines (+SS.mmm) |
| `-e, --stderr-only` | Show only stderr |
| `-o, --stdout-only` | Show only stdout |
| `--json` | Output as JSON for dashboard |

**Examples:**
```bash
# Basic usage
tsm logs myapp              # Last 50 lines
tsm logs myapp -n 100       # Last 100 lines
tsm logs myapp -f           # Follow mode

# With timestamps
tsm logs myapp -t
# Output: 20260115T143245.123Z | Server starting...

# With delta timing
tsm logs myapp --delta
# Output: +0.000 | Server starting...
#         +0.023 | Config loaded
#         +1.456 | Database connected

# Combined
tsm logs myapp -t --delta
# Output: 20260115T143245.123Z | +0.000 | Server starting...

# JSON for scripting
tsm logs myapp --json
# Output: {"service":"myapp","entries":[{"ts":"...","delta":"+0.000","stream":"out","line":"..."}]}
```

### Log Management

```bash
# Rotate logs (moves current to archive)
tsm logs rotate <name|all> [-f|--force]

# Compress uncompressed archives
tsm logs archive <name|all>

# Remove old archives (default: >7 days)
tsm logs clean <name|all>

# Export to S3/Spaces
tsm logs export <name|all> [--destination spaces|s3]

# List archived logs
tsm logs list [name]
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TSM_LOG_ROTATION_SIZE_MB` | 10 | Rotate when log exceeds this size |
| `TSM_LOG_RETENTION_DAYS` | 7 | Keep archives for this many days |
| `TSM_LOG_COMPRESS` | true | Compress archives with gzip |
| `TSM_LOG_ARCHIVE_DIR` | `$TSM_DIR/runtime/logs` | Archive storage location |
| `TSM_LOG_S3_BUCKET` | - | S3/Spaces bucket for export |
| `TSM_LOG_S3_ENDPOINT` | - | Custom endpoint (for DO Spaces) |
| `TSM_LOG_S3_PREFIX` | `tsm/logs/` | Key prefix in bucket |

## File Locations

**Active logs (per-process):**
```
$TSM_DIR/runtime/processes/<name>/
├── current.out    # stdout stream
├── current.err    # stderr stream
├── meta.json      # process metadata
└── pid            # PID file
```

**Archived logs:**
```
$TSM_DIR/runtime/logs/<name>/
├── myapp.20260115T100000.123Z.out.gz
├── myapp.20260115T100000.123Z.err.gz
└── ...
```

## Delta Timing

Delta shows time elapsed since the previous log line:

- First line: `+0.000`
- Subsequent: `+SS.mmm` (seconds.milliseconds)

Delta is always in seconds, even for large gaps:
```
+0.000      First event
+0.023      23ms later
+3723.456   ~1 hour gap (3723 seconds)
```

## Dashboard Integration

### API Endpoint

```
GET /api/tsm/logs/:service
```

**Query params:**
| Param | Default | Description |
|-------|---------|-------------|
| `lines` | 50 | Number of lines |
| `format` | text | `text` or `json` |
| `since` | - | Time filter (5m, 1h) |
| `org` | tetra | Organization |
| `env` | local | Environment |

**JSON response:**
```json
{
  "service": "devpages-local-4000",
  "entries": [
    {
      "ts": "20260115T143245.123Z",
      "delta": "+0.000",
      "stream": "out",
      "line": "Server starting..."
    },
    {
      "ts": "20260115T143245.146Z",
      "delta": "+0.023",
      "stream": "out",
      "line": "Config loaded"
    }
  ],
  "org": "tetra",
  "env": "local",
  "format": "json"
}
```

### Watching Services

The dashboard polls watched services every 3 seconds. Services are marked for watching via the `[L]` button in the TSM panel.

## Terrain Protocol Integration

Terrain messages include dual timestamps for compatibility:

```javascript
{
  type: "event-name",
  payload: { ... },
  source: "terrain",
  timestamp: Date.now(),           // epoch ms (existing)
  ts: "20260115T143245.123Z"       // compact ISO (new)
}
```

Use `TERRAIN.compactISO()` to generate timestamps in other modules.

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/time.sh` | Timestamp utilities |
| `core/process.sh` | `tsm_logs()` command |
| `services/logging.sh` | Rotation, archival, export |
| `lib/help.sh` | Help documentation |
| `server/api/tsm.js` | REST API endpoint |
| `dashboard/js/logs.js` | Dashboard client |
| `terrain/js/core/terrain-bridge.js` | Protocol timestamps |

## Functions Reference

### Bash (lib/time.sh)

```bash
# Generate compact ISO timestamp
ts=$(tsm_timestamp)
# Returns: 20260115T143245.123Z

# Get epoch milliseconds
ms=$(tsm_epoch_ms)
# Returns: 1736956365123

# Calculate delta between timestamps
delta=$(tsm_delta 1736956365000 1736956365123)
# Returns: +0.123

# Parse duration to milliseconds
ms=$(tsm_parse_duration "5m")
# Returns: 300000

# Parse compact ISO to epoch ms
ms=$(tsm_parse_timestamp "20260115T143245.123Z")
# Returns: 1736956365123
```

### JavaScript (terrain-bridge.js)

```javascript
// Generate compact ISO timestamp
const ts = TERRAIN.compactISO();
// Returns: "20260115T143245.123Z"

// Parse compact ISO to standard ISO (dashboard/logs.js)
const iso = parseCompactISO("20260115T143245.123Z");
// Returns: "2026-01-15T14:32:45.123Z"
```
