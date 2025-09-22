# TSM Error Report: Port Conflict Detection & Process Visibility

## Issue Summary
TSM failed to start `devpages-4000` with generic "failed to start" message when port 4000 was already occupied by an existing Node.js process that TSM itself likely started earlier.

## Error Experience Timeline

1. **Initial Failure**: `tsm start --env local node server/server.js devpages`
   - Error: `tsm: failed to start 'devpages-4000'`
   - No indication of WHY it failed

2. **Debugging Steps Required**:
   - `tsm list` → "No processes found" (misleading - TSM wasn't tracking the existing process)
   - `tsm logs devpages-4000` → "process not found"
   - Manual port checking via `tsm doctor` revealed port 4000 was occupied
   - Had to manually kill PID 25989 to proceed

3. **Root Cause**: Port 4000 occupied by existing Node.js process (likely from previous TSM start or manual testing)

## Critical UX Gaps

### 1. **No Port Conflict Detection**
- TSM should check port availability BEFORE attempting to start
- Should report: "Port 4000 already in use by PID 25989 (node server/server.js)"

### 2. **Process Tracking Gaps**
- TSM lost track of processes it may have started
- `tsm list` showing "No processes found" while port was occupied suggests process tracking issues
- No way to discover "orphaned" processes that TSM started but lost track of

### 3. **Generic Error Messages**
- "failed to start" provides zero diagnostic information
- Should indicate specific failure reason (port conflict, missing env file, permission issues, etc.)

### 4. **Missing Process Discovery**
- No command to find processes TSM might have started but lost track of
- `tsm doctor scan` could include process discovery for common patterns

## Recommended Fixes

### Immediate Improvements
```bash
# Better error message
tsm: failed to start 'devpages-4000' - port 4000 already in use by PID 25989 (node server/server.js)
tsm: run 'tsm doctor port' to resolve port conflicts

# Enhanced doctor command
tsm doctor port --fix  # Interactive port conflict resolution
```

### Process Management
```bash
# Process discovery
tsm scan         # Find potentially orphaned TSM processes
tsm adopt <pid>  # Take ownership of running process
tsm clean        # Clean up lost process tracking
```

### Environment Validation
```bash
# Pre-flight checks before starting
tsm: checking port 4000... OCCUPIED (PID 25989)
tsm: checking env file... OK
tsm: checking command... OK
tsm: ready to start? [y/N]
```

## LLM Agent Specific Needs

### What's Missing for AI Debugging:

1. **Structured Error Output**: JSON mode for programmatic parsing
   ```bash
   tsm start --json node server.js  # Returns structured error data
   ```

2. **Comprehensive Status Commands**:
   ```bash
   tsm status --all     # All processes, ports, env files
   tsm validate <command>  # Pre-check without starting
   ```

3. **Better Introspection**:
   ```bash
   tsm why-failed <name>   # Detailed failure analysis
   tsm suggest <error>     # Suggested fixes for common errors
   ```

4. **Process Lineage Tracking**:
   ```bash
   tsm history           # What processes were started when
   tsm orphans          # Find lost processes
   ```

### AI-Friendly Workflows:
- `tsm start --dry-run` to validate before execution
- `tsm doctor --fix-all` for automated conflict resolution
- Better integration with process discovery (`ps`, `lsof`, etc.)

## Impact Assessment
- **Time Lost**: ~10 minutes of debugging for a simple port conflict
- **User Frustration**: High - generic error with no guidance
- **Process Reliability**: Medium - TSM losing track of its own processes
- **Debugging Difficulty**: High - required manual port scanning and process killing

## Priority: HIGH
This is a fundamental UX issue that breaks the "it just works" promise of TSM. Port conflicts are extremely common in development workflows.