# TPM File Structure

This document describes the file formats and directory structure used by TPM (Tetra Process Manager).

## Directory Structure

TPM stores all process data under `$TETRA_DIR/tpm/` with the following layout:

```
$TETRA_DIR/tpm/
├── processes/     # Process metadata files (.meta)
├── logs/          # Process log files (.out/.err)
└── pids/          # Process PID files (.pid)
```

### Environment Variables

- `$TETRA_DIR` - Base directory for tetra data, typically `/Users/username/tetra` or `/home/username/tetra`

## File Formats

### Process Metadata Files

**Location**: `$TETRA_DIR/tpm/processes/{process-name}.meta`

**Format**: Key-value pairs on a single line, space-separated

#### CLI Process Metadata
```bash
script=/path/to/script.sh pid=12345 port=3000 start_time=1694123456 type=cli
```

#### Ecosystem Process Metadata
```bash
script=./server/server.js pid=12346 port=4000 start_time=1694123500 type=ecosystem cwd=/path/to/project node_env=production
```

#### Metadata Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `script` | ✅ | Path to the script/entry point | `/path/to/server.js` |
| `pid` | ✅ | Process ID | `12345` |
| `port` | ✅ | PORT the process is running on | `3000` |
| `start_time` | ✅ | Unix timestamp when process started | `1694123456` |
| `type` | ✅ | Process type: `cli` or `ecosystem` | `cli` |
| `cwd` | ecosystem only | Working directory for ecosystem processes | `/path/to/project` |
| `node_env` | ecosystem only | NODE_ENV for ecosystem processes | `production` |

### PID Files

**Location**: `$TETRA_DIR/tpm/pids/{process-name}.pid`

**Format**: Plain text file containing only the process ID

```
12345
```

### Log Files

**Location**: `$TETRA_DIR/tpm/logs/{process-name}.{out|err}`

**Format**: Plain text logs, one entry per line

#### Standard Output
**File**: `{process-name}.out`
```
2024-01-15 10:30:00 Server starting on port 3000
2024-01-15 10:30:01 Database connected
2024-01-15 10:30:02 Ready to accept connections
```

#### Standard Error
**File**: `{process-name}.err`
```
2024-01-15 10:30:00 Warning: Deprecated API usage
2024-01-15 10:30:05 Error: Failed to connect to cache
```

## Process Naming Convention

All processes follow the pattern: `{basename}-{PORT}`

### Examples

| Script | PORT | Process Name |
|--------|------|--------------|
| `server.sh` | 3000 | `server-3000` |
| `api/backend.js` | 8080 | `backend-8080` |
| `ecosystem.config.cjs` | 4000 | `devpages-4000` |

## File Operations

### Process Startup
1. Create PID file: `$TETRA_DIR/tpm/pids/{name}.pid`
2. Create metadata file: `$TETRA_DIR/tpm/processes/{name}.meta`
3. Start logging to: `$TETRA_DIR/tpm/logs/{name}.{out,err}`

### Process Shutdown
1. Send TERM signal to PID
2. Wait 3 seconds
3. Send KILL signal if still running
4. Remove PID file

### Process Cleanup
1. Remove PID file: `$TETRA_DIR/tpm/pids/{name}.pid`
2. Remove metadata file: `$TETRA_DIR/tpm/processes/{name}.meta`
3. Remove log files: `$TETRA_DIR/tpm/logs/{name}.{out,err}`

## Cross-Platform Compatibility

### Process Detection

**macOS**: Uses `ps -p {pid}` to check if process exists
**Linux**: Uses `/proc/{pid}` directory existence

### File Paths

All paths use Unix-style forward slashes. The `$TETRA_DIR` environment variable ensures proper path resolution across platforms.

## Integration Points

### With Ecosystem Configs

TPM can start processes from `ecosystem.config.cjs` files while maintaining the same file structure:

```javascript
module.exports = {
  apps: [{
    name: "devpages-4000",      // → process name
    script: "./server/server.js", // → stored in metadata
    env: {
      PORT: "4000",             // → used for naming and metadata
      NODE_ENV: "production"    // → stored in metadata
    }
  }]
}
```

### With Tetra Ecosystem

TPM integrates with tetra's module system:
- Uses `$TETRA_DIR` for consistent data location
- Follows tetra naming conventions (`tetra_tpm_*` functions)
- Loads via tetra bootstrap system

## Future Considerations

### Log Rotation

Current structure supports simple log rotation by moving files:
- `{name}.out` → `{name}.out.1` → `{name}.out.2` → etc.
- Same pattern for `.err` files

### Clustering

Multiple instances could use extended naming:
- `server-3000-0`, `server-3000-1`, etc.
- Metadata would include instance number

### Remote Management

File structure enables remote management via:
- File synchronization
- Shared filesystem access
- API endpoints reading file data