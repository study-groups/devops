# TSM Test Suite

This directory contains comprehensive tests for the TSM (Tetra Service Manager) process lifecycle management.

## Test Files

### Test Programs
- **`test_nc_server.sh`** - Simple netcat-based server for basic testing
- **`test_persistent_server.sh`** - More persistent server that ignores SIGTERM initially

### Test Scripts
- **`test_lifecycle.sh`** - Comprehensive lifecycle test (start, stop, restart, kill, start again)
- **`test_kill_debug.sh`** - Detailed debugging test for kill functionality issues
- **`test_improved_kill.sh`** - Test for improved kill functionality with process group handling
- **`run_all_tests.sh`** - Master test runner

### Utility Files
- **`tsm_core_improved.sh`** - Improved TSM core functions with better process killing

## Usage

### Run All Tests
```bash
cd /path/to/tetra/bash/tsm/tests
./run_all_tests.sh
```

### Run Individual Tests
```bash
# Debug the kill issue specifically
./test_kill_debug.sh

# Test full lifecycle
./test_lifecycle.sh

# Test improved kill functionality
./test_improved_kill.sh
```

### Manual Testing
```bash
# Start a test server manually
tsm start ./test_nc_server.sh my-test

# Check status
tsm list

# Test killing
tsm stop my-test

# Check for leaked processes
tsm scan-ports
```

## Test Scenarios

### 1. Basic Lifecycle Test (`test_lifecycle.sh`)
- Starts a process
- Stops it gracefully
- Checks for process cleanup
- Restarts the process
- Tests force kill (delete)
- Verifies port cleanup

### 2. Kill Debug Test (`test_kill_debug.sh`)
- Focuses specifically on the kill issue you reported
- Shows detailed process tree information
- Tests both TSM stop and TSM kill
- Provides manual kill testing if TSM fails
- Shows port usage before and after kills

### 3. Improved Kill Test (`test_improved_kill.sh`)
- Compares original vs improved kill behavior
- Tests process group killing
- Handles child processes properly
- Provides detailed logging of kill operations

## Common Issues Addressed

### Process Still Exists After Kill
The tests help identify and fix issues where:
- Main process is killed but child processes remain
- Process group is not properly terminated
- Port remains occupied by zombie processes
- SIGTERM timeout is too short

### Improved Kill Logic
The improved kill functionality:
- Kills entire process groups, not just main PID
- Uses longer timeout for graceful shutdown
- Cleans up processes still using the port
- Provides detailed logging for debugging

## Test Output

Tests provide colored output:
- 🔵 **BLUE** - General test information
- 🟢 **GREEN** - Test passed
- 🔴 **RED** - Test failed
- 🟡 **YELLOW** - Warnings

## Requirements

- `nc` (netcat) - for basic server tests
- `python3` - fallback for persistent server
- `lsof` - for port checking (optional but recommended)
- `pstree` - for process tree display (optional)
- `ps` - for process information
- TSM properly set up (`tsm setup`)

## Debugging Tips

1. **Check TSM status**: `tsm list`
2. **Check ports**: `tsm scan-ports`
3. **View logs**: `tsm logs <process> -f`
4. **Manual cleanup**: `tsm delete "*"`
5. **Check for leaked processes**: `lsof -iTCP -sTCP:LISTEN`

## Test Ports

- `test_nc_server.sh` uses port 8888
- `test_persistent_server.sh` uses port 8889
- Tests clean up ports automatically
- Use different ports if these conflict with your system
