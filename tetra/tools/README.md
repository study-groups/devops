# Tetra Tools

Development and debugging utilities for the Tetra framework.

## Directory Structure

```
tools/
├── debug/              Debug and diagnostic tools
│   ├── analyze_returns.sh         Analyze return statement patterns
│   ├── find_all_returns.sh        Find all return statements in codebase
│   ├── preflight_check.sh         Pre-flight check before sourcing tetra
│   ├── safe_source_tetra.sh       Safe wrapper to source with error handling
│   ├── debug_incremental.sh       Incremental component testing
│   └── capture_terminal_state.sh  Capture terminal state for debugging
└── bootloader/         Bootloader reference implementations
    └── tetra_entry.sh             Example ~/tetra/tetra.sh entry point
```

## Debug Tools

### analyze_returns.sh
Comprehensive analysis of return statement usage patterns. Identifies problematic patterns like:
- Returns outside functions
- Returns in subshells/pipes
- Returns without error handling
- Returns with no explicit value

```bash
./tools/debug/analyze_returns.sh
```

### find_all_returns.sh
Simple script to find and list every return statement in the codebase with file:line references.

```bash
./tools/debug/find_all_returns.sh > return_audit.txt
```

### preflight_check.sh
Run this before sourcing tetra to check for:
- Environment conflicts
- Function/alias conflicts
- Missing directories
- Variable pollution
- Existing tetra state

```bash
bash tools/debug/preflight_check.sh
```

### safe_source_tetra.sh
Wrapper that sources tetra with comprehensive error handling and debugging support.

```bash
# Normal sourcing
source tools/debug/safe_source_tetra.sh

# With debug output
source tools/debug/safe_source_tetra.sh --debug

# With full trace
source tools/debug/safe_source_tetra.sh --trace

# With log file
source tools/debug/safe_source_tetra.sh --trace --log
```

### debug_incremental.sh
Tests each bootloader component step-by-step to isolate failures. Tests:
- Individual components
- Cumulative loading sequence
- Full bootloader with/without auto-loading

```bash
bash tools/debug/debug_incremental.sh
# Check: /tmp/tetra_incremental_*.log
```

### capture_terminal_state.sh
Captures complete terminal and shell state before attempting to source tetra. Useful for diagnosing terminal crashes.

```bash
source tools/debug/capture_terminal_state.sh
# Then follow the suggested test options
```

## Bootloader Tools

### tetra_entry.sh
Reference implementation of ~/tetra/tetra.sh entry point. Shows minimal setup:
- Sets TETRA_DIR and TETRA_SRC
- Sources bootloader from repo
- Handles local config

## Usage Patterns

### Debugging a Crash
```bash
# 1. Capture current state
source tools/debug/capture_terminal_state.sh

# 2. Run preflight check
bash tools/debug/preflight_check.sh

# 3. Try incremental debug
bash tools/debug/debug_incremental.sh

# 4. Try safe source with trace
source tools/debug/safe_source_tetra.sh --trace --log
```

### Auditing Return Statements
```bash
# Quick list
./tools/debug/find_all_returns.sh | less

# Full analysis
./tools/debug/analyze_returns.sh > return_analysis.txt

# Focus on specific module
grep "bash/tsm" return_analysis.txt
```

### Setting Up ~/tetra
```bash
# Copy reference entry point
cp tools/bootloader/tetra_entry.sh ~/tetra/tetra.sh

# Edit TETRA_DIR to match your setup
vim ~/tetra/tetra.sh

# Test it
source tools/debug/safe_source_tetra.sh --debug
```

## Development Workflow

1. **Before making changes:** Run `preflight_check.sh` to baseline
2. **After making changes:** Run `debug_incremental.sh` to verify
3. **If broken:** Use `safe_source_tetra.sh --trace` to isolate
4. **Regular audits:** Run `find_all_returns.sh` to track technical debt

## Log Locations

All debug tools create logs in `/tmp/`:
- `tetra_preflight_*.log` - Preflight checks
- `tetra_incremental_*.log` - Incremental debug
- `tetra_source_*.log` - Safe source attempts
- `tetra_terminal_state_*.log` - Terminal state captures
