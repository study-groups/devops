# TUBES Integration Example

**Version**: 1.0
**Type**: Reference Example
**Module**: tubes
**Completeness Level**: 4 (Gold Standard)
**Date**: 2025-11-03

## Overview

This document demonstrates **how to build a Level 4 (Gold Standard) module** using tubes as the complete, working example. Tubes implements terminal FIFO networks and shows integration with all major Tetra systems.

**What you'll learn**:
- Complete module structure (includes.sh → core → actions → REPL → tests)
- TCS 4.0 path management
- Action system integration (TAS)
- REPL integration (TRS)
- Unified logging
- Database patterns
- Service management (TSM)

**Prerequisites**: Read MODULE_SYSTEM_SPECIFICATION.md first.

---

## Table of Contents

1. [Module Structure](#1-module-structure)
2. [Registration & Loading](#2-registration--loading)
3. [Strong Globals & Paths](#3-strong-globals--paths)
4. [Core Functionality](#4-core-functionality)
5. [Action System Integration](#5-action-system-integration)
6. [Database Pattern](#6-database-pattern)
7. [REPL Integration (Future)](#7-repl-integration-future)
8. [Testing](#8-testing)
9. [Service Management](#9-service-management)
10. [Complete File Reference](#10-complete-file-reference)

---

## 1. Module Structure

### 1.1 Directory Layout

tubes follows the Level 4 (Gold Standard) structure:

```
bash/tubes/
├── includes.sh              # Module loader (entry point)
├── tubes.sh                 # Main dispatcher
├── tubes_paths.sh           # TCS 4.0 path functions
├── tubes_core.sh            # Business logic (FIFO management)
├── tubes_router.sh          # Router daemon
├── actions.sh               # TUI integration (verb:noun actions)
├── profiles/                # Configuration profiles
│   └── default.conf
├── tests/                   # Test suite
│   ├── test_basic.sh
│   ├── test_send_receive.sh
│   └── example_simple_network.sh
├── docs/                    # Documentation
│   └── (future: TUBES_SPECIFICATION.md)
├── IMPLEMENTATION_SUMMARY.md
├── QUICK_START.md
└── README.md
```

### 1.2 Runtime Directory

```
$TETRA_DIR/tubes/
├── db/                      # Tube metadata (JSON)
├── config/                  # Configuration files
│   └── registry.json       # Active tubes registry
├── fifos/                   # FIFO files (named pipes)
│   ├── tube1               # FIFO for tube1
│   ├── tube1.control       # Control FIFO for tube1
│   └── tube2
└── logs/                    # Module logs
    └── router.log          # Router daemon log
```

---

## 2. Registration & Loading

### 2.1 Module Registration

From `bash/boot/boot_modules.sh`:

```bash
# tubes is not currently registered - THIS IS THE GAP
# Should be added:
tetra_register_module "tubes" "$TETRA_BASH/tubes"
```

**NOTE**: tubes is complete but not yet registered with boot system. This is a todo item.

### 2.2 includes.sh (Module Loader)

**File**: `bash/tubes/includes.sh`

```bash
#!/usr/bin/env bash

# tubes Module Includes - Standard tetra module entry point

# Follow tetra convention: MOD_SRC for source code, MOD_DIR for runtime data
# Per CLAUDE.md: "MOD_SRC is a strong global. A module can count on it."
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/tubes}"  # Source files
MOD_DIR="${MOD_DIR:-$TETRA_DIR/tubes}"        # Runtime data

# Backward compatibility - modules may still reference TUBES_*
TUBES_SRC="$MOD_SRC"
TUBES_DIR="$MOD_DIR"

# Create runtime directories if they don't exist
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/db" ]] && mkdir -p "$MOD_DIR/db"
[[ ! -d "$MOD_DIR/config" ]] && mkdir -p "$MOD_DIR/config"
[[ ! -d "$MOD_DIR/fifos" ]] && mkdir -p "$MOD_DIR/fifos"
[[ ! -d "$MOD_DIR/logs" ]] && mkdir -p "$MOD_DIR/logs"

# Export for subprocesses
export MOD_SRC MOD_DIR TUBES_SRC TUBES_DIR

# Source the main tubes module (which sources paths, core, router)
source "$MOD_SRC/tubes.sh"

# Initialize on load
if declare -f tubes_init >/dev/null 2>&1; then
    tubes_init
fi
```

**Key Features**:
- ✅ Strong globals (`MOD_SRC`, `MOD_DIR`)
- ✅ Backward compatibility (`TUBES_SRC`, `TUBES_DIR`)
- ✅ Runtime directory creation (Level 4 requirement)
- ✅ Subdirectories: db, config, fifos, logs
- ✅ Export for subprocesses
- ✅ Automatic initialization

---

## 3. Strong Globals & Paths

### 3.1 Path Management (TCS 4.0)

**File**: `bash/tubes/tubes_paths.sh`

```bash
#!/usr/bin/env bash

# tubes_paths.sh - TCS 3.0 compliant path functions
# Defines all path-related functions for the tubes module

# Strong globals (per CLAUDE.md)
: "${TUBES_SRC:=$TETRA_SRC/bash/tubes}"
: "${TUBES_DIR:=$TETRA_DIR/tubes}"

# Export for subprocesses
export TUBES_SRC TUBES_DIR

# Get the primary database directory for tubes
tubes_get_db_dir() {
    echo "$TUBES_DIR/db"
}

# Get the config directory
tubes_get_config_dir() {
    echo "$TUBES_DIR/config"
}

# Get the FIFOs directory
tubes_get_fifos_dir() {
    echo "$TUBES_DIR/fifos"
}

# Get the active tubes registry
tubes_get_registry() {
    echo "$(tubes_get_config_dir)/registry.json"
}

# Get tube FIFO path
tubes_get_tube_path() {
    local tube_name="$1"
    echo "$(tubes_get_fifos_dir)/$tube_name"
}

# Get control FIFO path
tubes_get_control_path() {
    local tube_name="$1"
    echo "$(tubes_get_fifos_dir)/${tube_name}.control"
}

# Get router PID file
tubes_get_router_pid() {
    echo "$(tubes_get_config_dir)/router.pid"
}

# Get router log file
tubes_get_router_log() {
    echo "$TUBES_DIR/logs/router.log"
}

# Initialize directories (called from tubes_init)
tubes_init_dirs() {
    local dirs=(
        "$(tubes_get_db_dir)"
        "$(tubes_get_config_dir)"
        "$(tubes_get_fifos_dir)"
        "$(dirname $(tubes_get_router_log))"
    )

    for dir in "${dirs[@]}"; do
        [[ ! -d "$dir" ]] && mkdir -p "$dir"
    done
}
```

**Key Features**:
- ✅ All paths in one file (TCS 4.0 pattern)
- ✅ Getter functions (not direct variable access)
- ✅ Centralized directory initialization
- ✅ Easy to modify paths without touching business logic

### 3.2 Why Path Functions?

**Benefits**:
1. **Centralized** - One place to change paths
2. **Testable** - Can mock path functions
3. **Debuggable** - Add logging to path functions
4. **Flexible** - Easy to add new path types

**Anti-pattern** (Don't do this):
```bash
# BAD: Hardcoded paths scattered throughout code
mkfifo "$TUBES_DIR/fifos/$tube_name"
echo "$json" > "$TUBES_DIR/db/${timestamp}.json"
```

**Correct pattern**:
```bash
# GOOD: Use path functions
mkfifo "$(tubes_get_tube_path "$tube_name")"
echo "$json" > "$(tubes_get_db_dir)/${timestamp}.json"
```

---

## 4. Core Functionality

### 4.1 Main Dispatcher

**File**: `bash/tubes/tubes.sh`

```bash
#!/usr/bin/env bash

# tubes.sh - Main tubes module entry point

# Source all tube components
source "${TUBES_SRC}/tubes_paths.sh"
source "${TUBES_SRC}/tubes_core.sh"
source "${TUBES_SRC}/tubes_router.sh"

# Initialize the tubes module
tubes_init() {
    tubes_init_dirs

    # Log initialization
    if declare -f tetra_log_info >/dev/null 2>&1; then
        tetra_log_info "tubes" "init" "compact" "jsonl"
    fi

    return 0
}

# Main tubes command dispatcher
tubes() {
    local subcommand="${1:-help}"
    shift 2>/dev/null || true

    case "$subcommand" in
        create)
            tubes_create "$@"
            ;;
        delete)
            tubes_delete "$@"
            ;;
        list)
            tubes_list
            ;;
        send)
            tubes_send "$@"
            ;;
        receive)
            tubes_receive "$@"
            ;;
        router)
            tubes_router "$@"
            ;;
        help|--help|-h)
            tubes_help
            ;;
        *)
            echo "Unknown command: $subcommand"
            tubes_help
            return 1
            ;;
    esac
}

# Help text
tubes_help() {
    cat <<'EOF'
tubes - Terminal FIFO networks

USAGE:
  tubes <command> [arguments]

COMMANDS:
  create <name> [description]  Create a new tube
  delete <name>                Delete a tube
  list                         List all tubes
  send <name> <message>        Send message to tube
  receive <name>               Receive message from tube
  router start|stop|status     Control router daemon

EXAMPLES:
  tubes create myapp "My application endpoint"
  tubes send myapp "Hello, world!"
  tubes receive myapp
  tubes router start

EOF
}
```

**Key Features**:
- ✅ Component sourcing (paths → core → router)
- ✅ Initialization function
- ✅ Unified logging integration
- ✅ Command dispatcher pattern
- ✅ Help text

---

## 5. Action System Integration

### 5.1 Action Definitions

**File**: `bash/tubes/actions.sh`

```bash
#!/usr/bin/env bash

# tubes/actions.sh - TUI integration for tubes module

# Action: Create a tube
tubes_action_create() {
    local tube_name="$1"
    local description="${2:-Terminal endpoint}"

    tetra_log_info "tubes" "create" "compact" "jsonl" "$tube_name"

    if tubes_create "$tube_name" "$description"; then
        tetra_log_success "tubes" "create" "compact" "jsonl" "$tube_name"
        return 0
    else
        tetra_log_error "tubes" "create" "compact" "jsonl" "$tube_name"
        return 1
    fi
}

# Action: Send message
tubes_action_send() {
    local tube_name="$1"
    local message="$2"

    tetra_log_info "tubes" "send" "compact" "jsonl" "$tube_name"

    if tubes_send "$tube_name" "$message"; then
        tetra_log_success "tubes" "send" "compact" "jsonl" "$tube_name"
        return 0
    else
        tetra_log_error "tubes" "send" "compact" "jsonl" "$tube_name"
        return 1
    fi
}

# Action: Receive message
tubes_action_receive() {
    local tube_name="$1"

    tetra_log_info "tubes" "receive" "compact" "jsonl" "$tube_name"

    if tubes_receive "$tube_name"; then
        tetra_log_success "tubes" "receive" "compact" "jsonl" "$tube_name"
        return 0
    else
        tetra_log_error "tubes" "receive" "compact" "jsonl" "$tube_name"
        return 1
    fi
}

# Action: List tubes
tubes_action_list() {
    tetra_log_info "tubes" "list" "compact" "jsonl"
    tubes_list
}
```

**Key Features**:
- ✅ Unified logging (tetra_log_info, success, error)
- ✅ Action naming: `<module>_action_<verb>`
- ✅ Wrapper pattern: action → core function
- ✅ Consistent error handling

### 5.2 TAS Integration Pattern

Following TAS_SPECIFICATION.md, actions use `verb:noun` syntax:

```
create:tube  → tubes_action_create()
send:message → tubes_action_send()
list:tubes   → tubes_action_list()
```

**Environment × Mode Matrix**:
```
Local:Inspect  → view:tubes, list:tubes
Local:Execute  → create:tube, delete:tube, send:message
Dev:Execute    → deploy:router, restart:router
```

---

## 6. Database Pattern

### 6.1 TCS 4.0 Timestamped Database

tubes uses the Level 4 database pattern for tube metadata:

```bash
# Create tube metadata entry
tubes_create() {
    local tube_name="$1"
    local description="$2"

    # Generate timestamp
    local timestamp=$(date +%s)

    # Create JSON metadata
    local meta_json="{
  \"timestamp\": $timestamp,
  \"tube_name\": \"$tube_name\",
  \"description\": \"$description\",
  \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"status\": \"active\",
  \"messages_sent\": 0,
  \"messages_received\": 0
}"

    # Write to database
    echo "$meta_json" > "$(tubes_get_db_dir)/${timestamp}.json"

    # Update registry
    tubes_register_tube "$tube_name" "$timestamp"
}

# Query by tube name (uses registry)
tubes_get_metadata() {
    local tube_name="$1"

    # Get timestamp from registry
    local timestamp=$(tubes_get_timestamp_for_tube "$tube_name")
    [[ -z "$timestamp" ]] && return 1

    # Read metadata file
    cat "$(tubes_get_db_dir)/${timestamp}.json"
}

# List all tubes (iterate database)
tubes_list() {
    for meta_file in "$(tubes_get_db_dir)"/*.json; do
        [[ ! -f "$meta_file" ]] && continue

        # Extract fields
        local tube_name=$(jq -r '.tube_name' "$meta_file")
        local status=$(jq -r '.status' "$meta_file")
        local created=$(jq -r '.created' "$meta_file")

        printf "%-20s %-10s %s\n" "$tube_name" "$status" "$created"
    done
}
```

**Key Features**:
- ✅ Timestamp-based files (`{timestamp}.json`)
- ✅ JSON format (queryable with jq)
- ✅ Registry for name → timestamp lookup
- ✅ Cross-module correlation possible (shared timestamps)
- ✅ Audit trail (never delete, just update status)

### 6.2 Registry Pattern

tubes maintains a registry for fast name lookups:

```json
{
  "myapp": 1699027845,
  "logger": 1699027900,
  "api": 1699028001
}
```

This avoids scanning all JSON files to find a tube by name.

---

## 7. REPL Integration (Future)

### 7.1 REPL Structure (Not Yet Implemented)

**Future file**: `bash/tubes/tubes_repl.sh`

```bash
#!/usr/bin/env bash

# tubes REPL - Interactive tube management

source "$TUBES_SRC/includes.sh"

# Register with universal REPL
if declare -f repl_register_module_handler >/dev/null 2>&1; then
    repl_register_module_handler "tubes" tubes_repl_handler
fi

# REPL command handler
tubes_repl_handler() {
    local input="$1"

    case "$input" in
        create*)
            tubes_repl_create ${input#create }
            ;;
        send*)
            tubes_repl_send ${input#send }
            ;;
        list)
            tubes list
            ;;
        *)
            echo "Unknown tubes command: $input"
            return 1
            ;;
    esac
}

# Interactive tube creation
tubes_repl_create() {
    echo "Create new tube"
    read -p "Tube name: " tube_name
    read -p "Description: " description

    tubes create "$tube_name" "$description"
}

# Slash commands
repl_register_slash_command "/tubes" tubes_repl
repl_register_slash_command "/tube" tubes_repl_create
```

**TODO**: Implement tubes_repl.sh to reach Level 3 (Interactive)

---

## 8. Testing

### 8.1 Test Structure

**File**: `bash/tubes/tests/test_basic.sh`

```bash
#!/usr/bin/env bash

# Basic tubes functionality tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUBES_SRC="$(dirname "$SCRIPT_DIR")"

source "$TUBES_SRC/includes.sh"

# Test counter
tests_passed=0
tests_failed=0

# Test: Create tube
test_create_tube() {
    echo "Test: Create tube"

    local tube_name="test_tube_$$"

    if tubes_create "$tube_name" "Test tube"; then
        echo "  ✓ Tube created"
        ((tests_passed++))
    else
        echo "  ✗ Failed to create tube"
        ((tests_failed++))
        return 1
    fi

    # Verify FIFO exists
    local tube_path=$(tubes_get_tube_path "$tube_name")
    if [[ -p "$tube_path" ]]; then
        echo "  ✓ FIFO created"
        ((tests_passed++))
    else
        echo "  ✗ FIFO not created"
        ((tests_failed++))
    fi

    # Cleanup
    tubes_delete "$tube_name" >/dev/null 2>&1
}

# Test: Send/receive message
test_send_receive() {
    echo "Test: Send/receive message"

    local tube_name="test_msg_$$"
    local test_message="Hello, tubes!"

    tubes_create "$tube_name" "Test message tube" >/dev/null

    # Send in background
    (sleep 0.1; tubes_send "$tube_name" "$test_message") &

    # Receive
    local received=$(tubes_receive "$tube_name")

    if [[ "$received" == "$test_message" ]]; then
        echo "  ✓ Message sent and received"
        ((tests_passed++))
    else
        echo "  ✗ Message mismatch"
        echo "    Expected: $test_message"
        echo "    Got: $received"
        ((tests_failed++))
    fi

    # Cleanup
    tubes_delete "$tube_name" >/dev/null 2>&1
}

# Run tests
echo "Running tubes basic tests..."
echo ""

test_create_tube
test_send_receive

echo ""
echo "Tests passed: $tests_passed"
echo "Tests failed: $tests_failed"

exit $tests_failed
```

**Key Features**:
- ✅ Self-contained (sources includes.sh)
- ✅ Test isolation (unique tube names with $$)
- ✅ Cleanup (deletes test tubes)
- ✅ Clear output (✓/✗)
- ✅ Exit code reflects failures

### 8.2 Example Scripts

**File**: `bash/tubes/tests/example_simple_network.sh`

```bash
#!/usr/bin/env bash

# Example: Simple 3-node tube network
# Demonstrates basic tube usage

source "${TETRA_SRC}/bash/tubes/includes.sh"

echo "Creating simple tube network..."

# Create tubes
tubes create app "Application endpoint"
tubes create logger "Logging endpoint"
tubes create monitor "Monitoring endpoint"

echo ""
echo "Tubes created:"
tubes list

echo ""
echo "Sending test messages..."

# Send messages
tubes send app "User logged in"
tubes send app "Processing request"
tubes send logger "Log: Request processed"

echo ""
echo "Network ready. Use 'tubes receive <name>' to read messages."
echo "Example: tubes receive app"
```

---

## 9. Service Management

### 9.1 Router Daemon

**File**: `bash/tubes/tubes_router.sh` (excerpt)

```bash
# Start the router daemon
tubes_router_start() {
    local router_pid_file=$(tubes_get_router_pid)
    local router_log=$(tubes_get_router_log)

    # Check if already running
    if [[ -f "$router_pid_file" ]]; then
        local pid=$(cat "$router_pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Router already running (PID: $pid)"
            return 0
        fi
    fi

    # Start router in background
    tubes_router_daemon >> "$router_log" 2>&1 &
    local router_pid=$!

    echo "$router_pid" > "$router_pid_file"
    echo "Router started (PID: $router_pid)"
}

# Router daemon main loop
tubes_router_daemon() {
    while true; do
        # Route messages between tubes
        tubes_route_messages

        # Small delay to avoid busy loop
        sleep 0.1
    done
}
```

### 9.2 TSM Integration (Future)

tubes router can be managed by TSM:

```bash
# Start router via TSM
tsm start bash/tubes/tubes_router.sh router

# Check status
tsm list | grep router

# Stop router
tsm stop router
```

**Benefits**:
- Automatic restart on failure
- PM2-style process management
- Centralized service monitoring

---

## 10. Complete File Reference

### 10.1 All Files with Line Counts

```
bash/tubes/
├── includes.sh (33 lines)           # Module loader
├── tubes.sh (77 lines)              # Main dispatcher
├── tubes_paths.sh (50 lines)        # Path functions
├── tubes_core.sh (200+ lines)       # FIFO management
├── tubes_router.sh (150+ lines)     # Router daemon
├── actions.sh (46 lines)            # TUI integration
├── profiles/default.conf            # Configuration
├── tests/
│   ├── test_basic.sh (~100 lines)
│   ├── test_send_receive.sh
│   └── example_simple_network.sh
├── IMPLEMENTATION_SUMMARY.md
├── QUICK_START.md
└── README.md
```

### 10.2 Integration Summary

| System | Status | Files | Notes |
|--------|--------|-------|-------|
| Boot | ⚠️ Pending | boot_modules.sh | Need to register tubes |
| Paths | ✅ Complete | tubes_paths.sh | TCS 4.0 compliant |
| Core | ✅ Complete | tubes_core.sh | FIFO management |
| Actions | ✅ Complete | actions.sh | TUI integration |
| Database | ✅ Complete | Built-in | Timestamped JSON |
| REPL | ⚠️ Pending | (future) | Need tubes_repl.sh |
| Help | ⚠️ Pending | (future) | Need tubes_tree.sh |
| Completion | ⚠️ Pending | (future) | Need completion.sh |
| Tests | ✅ Complete | tests/*.sh | Basic + examples |
| Docs | ⚠️ Pending | (future) | Need TUBES_SPECIFICATION.md |

### 10.3 Upgrade Path to Full Level 4

Current: **Level 2.5** (between Integrated and Interactive)

To reach Level 4:
1. ✅ **Done**: includes.sh, core, actions, tests
2. ⚠️ **TODO**: Register with boot system
3. ⚠️ **TODO**: Add tubes_repl.sh (REPL integration)
4. ⚠️ **TODO**: Add tubes_tree.sh (help system)
5. ⚠️ **TODO**: Add tubes_completion.sh (tab completion)
6. ⚠️ **TODO**: Create TUBES_SPECIFICATION.md

---

## Lessons Learned

### What tubes Does Well

1. **Clear Separation** - paths/core/router are cleanly separated
2. **Path Functions** - All paths centralized in tubes_paths.sh
3. **Strong Globals** - Consistent use of MOD_SRC/MOD_DIR
4. **Directory Creation** - Runtime dirs created automatically
5. **Unified Logging** - Actions use tetra_log_* consistently
6. **Test Coverage** - Good mix of unit and example tests

### What Could Be Improved

1. **Boot Registration** - Not yet registered with boot system
2. **REPL Missing** - No interactive interface yet
3. **Help Missing** - No tree-based help
4. **Documentation** - Needs TUBES_SPECIFICATION.md
5. **Error Handling** - Could be more robust in some functions

### Key Takeaways

1. **Start Small** - tubes started at Level 1, grew to Level 2.5
2. **Paths First** - tubes_paths.sh made everything else easier
3. **Test Early** - tests/ directory from the start
4. **Document As You Go** - README, QUICK_START, IMPLEMENTATION_SUMMARY
5. **Follow Patterns** - Consistent with other modules (org, rag)

---

## Next Steps

To use tubes as a template for your own module:

1. **Copy Structure** - Use tubes/ as template
2. **Rename Files** - tubes_*.sh → yourmod_*.sh
3. **Update Paths** - Change TUBES_SRC/DIR to YOURMOD_SRC/DIR
4. **Implement Core** - Focus on business logic first
5. **Add Actions** - TUI integration next
6. **Create Tests** - Examples + unit tests
7. **Write Spec** - Use MODULE_SPEC_TEMPLATE.md
8. **Add REPL** - Interactive interface (Level 3)
9. **Add Help** - Tree-based help (Level 3)
10. **Register** - Add to boot_modules.sh

---

## See Also

- **MODULE_SYSTEM_SPECIFICATION.md** - Complete module system reference
- **MODULE_COMPLETENESS_CRITERIA.md** - Level 1-4 definitions
- **MODULE_SPEC_TEMPLATE.md** - Template for module specifications
- **TAS_SPECIFICATION.md** - Action system (verb:noun)
- **TCS_4.0_LOGGING_STANDARD.md** - Unified logging
- **bash/tsm/TSM_SPECIFICATION.md** - Service management
