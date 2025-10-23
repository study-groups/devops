# Instructions: Create docs/DEVELOPER_GUIDE.md

**Copy this entire file into a new Claude Code chat to create the third core document.**

---

## Context

You are creating `docs/DEVELOPER_GUIDE.md` - the guide for building Tetra modules and actions. This is THE VERBS document - it defines WHAT operations modules can perform.

## Key Insight: Module Actions = The Verbs

Module actions are operations that work on TES endpoints:
- **Format**: `verb:noun` (e.g., `push:config`, `deploy:service`)
- **Integration**: `module.action @endpoint`
- **Example**: `org push:config @dev` = push (verb) config (noun) to dev endpoint (noun from TES)

## Background

**Module Types**:
1. **Modules** (user-facing, have `actions.sh`)
   - Examples: tsm, org, tetra, tkm, vox
   - Provide CLI commands and TUI actions
   - Define `verb:noun` operations
   - Integration: `includes.sh`, `{module}.sh`, `actions.sh`, `README.md`

2. **Libraries** (utilities, no `actions.sh`)
   - Examples: repl, tds, color
   - Provide functions for modules to use
   - No direct user interaction
   - Integration: `{library}.sh`, subsystem files

**Dependencies**:
```
Modules use Libraries:
  tsm → repl, tds
  org → repl, tds
  [others] → [libraries]

Libraries use other Libraries:
  tds → color
  repl → (standalone)
```

## Key Files to Reference

**Module Examples**:
- `bash/tsm/` - Complete module (process manager)
  - `includes.sh` - Entry point
  - `tsm.sh` - Core CLI
  - `actions.sh` - TUI action registration
  - `README.md` - Documentation
  - `core/`, `process/`, `system/` - Organized submodules
- `bash/org/` - Another complete module (organization mgmt)
  - `actions.sh` - Shows verb:noun pattern
  - `compiler.sh` - tetra.toml compilation
  - `includes.sh` - Module loading

**Library Examples**:
- `bash/repl/` - REPL framework
  - `core/repl_core.sh` - Main REPL loop
  - `command_processor.sh` - Command handling
  - NO actions.sh (it's a library)
- `bash/tds/tds.sh` - Display system
  - Layered architecture (Layer 0-7)
  - Used by modules for formatting
  - NO actions.sh
- `bash/color/` - Color system
  - `color_core.sh` - Core functions
  - `color_themes.sh` - Theme system
  - NO actions.sh

**Boot Sequence**:
- `~/tetra/tetra.sh` - Bootstrap
- `bash/bootloader.sh` - Module loader
- `bash/boot/boot_modules.sh` - Module registry (40+ modules)

## Document Requirements

**File**: `docs/DEVELOPER_GUIDE.md`

**Audience**: Developers building Tetra modules and extensions

**Length**: ~700-900 lines

**Sections**:

### 1. Header & Overview (30-50 lines)
```markdown
# Tetra Developer Guide

Building modules and libraries for the Tetra ecosystem.

## Overview

This guide covers:
- **Module Actions**: The verbs - defining operations
- **Libraries**: Reusable utilities
- **Integration**: REPLs, TUIs, and TES endpoints
- **Boot System**: How modules load
```

### 2. Module vs Library (80-120 lines)

**Key Rule**: If it has `actions.sh`, it's a module. Otherwise, it's a library.

**Comparison Table**:
| Aspect | Module | Library |
|--------|--------|---------|
| Has actions.sh | ✅ YES | ❌ NO |
| User commands | ✅ (tsm start) | ❌ |
| TUI integration | ✅ YES | ❌ (but provides frameworks) |
| REPL integration | ✅ YES | ❌ (but provides REPL framework) |
| CLI | ✅ YES | ❌ |
| Runtime data | May have $TETRA_DIR/module/db/ | Stateless |
| Examples | tsm, org, tkm | repl, tds, color |
| Purpose | User-facing operations | Utilities for modules |

**When to create a module**:
- User needs to interact with it
- Provides `verb:noun` operations
- Operates on TES endpoints
- Has state/data to manage

**When to create a library**:
- Provides utility functions
- Used by multiple modules
- No direct user interaction
- Stateless (or minimal state)

### 3. Module Structure & Convention (120-180 lines)

**Required Files**:
```
bash/{module}/
├── includes.sh              # Module entry point (REQUIRED)
├── {module}.sh              # Core functionality (REQUIRED)
├── actions.sh               # TUI integration (REQUIRED for modules)
└── README.md                # Documentation (REQUIRED)
```

**Optional Structure**:
```
bash/{module}/
├── core/                    # Core components
├── helpers/                 # Helper functions
├── interfaces/              # REPLs, CLIs
├── integrations/            # External integrations
└── tests/                   # Module tests
```

**Example: TSM Structure**:
```
bash/tsm/
├── includes.sh              # Entry: source this to load TSM
├── tsm.sh                   # CLI: tsm command
├── actions.sh               # TUI: declare_action calls
├── README.md
├── core/                    # 13 files: config, utils, metadata, etc.
├── process/                 # 4 files: lifecycle, management, list
├── system/                  # 9 files: doctor, ports, monitor, etc.
├── services/                # 3 files: definitions, registry, startup
├── interfaces/              # 1 file: repl_v2.sh
├── integrations/            # 3 files: nginx, systemd, tview
└── tests/                   # 10 test files
```

**includes.sh Pattern**:
```bash
#!/usr/bin/env bash

# Module entry point
MOD_SRC="${MOD_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/mymodule}"

# Source core functionality
source "$MOD_SRC/mymodule.sh"

# Optional: Register actions if TUI support
if declare -f declare_action >/dev/null 2>&1; then
    source "$MOD_SRC/actions.sh"
    mymodule_register_actions
fi

# Export main function
export -f mymodule
```

### 4. Module Actions Pattern (180-250 lines)

**actions.sh Structure**:
```bash
#!/usr/bin/env bash

# Import module functionality
source "$(dirname "${BASH_SOURCE[0]}")/mymodule.sh"

# Register actions with TUI
mymodule_register_actions() {
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Declare each action
    declare_action "push_config" \
        "verb=push" \
        "noun=config" \
        "exec_at=@local" \
        "target_at=@{context}" \
        "contexts=Dev,Staging,Production" \
        "modes=Transfer" \
        "tes_operation=write" \
        "immediate=false" \
        "inputs=config_file,target" \
        "effects=@{context}[/etc/config]" \
        "can=Push configuration to target environment" \
        "cannot=Modify system configurations"
}

# Execute actions
mymodule_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    local verb="${action%%:*}"
    local noun="${action##*:}"

    case "$action" in
        push:config)
            mymodule_action_push_config "${args[@]}"
            ;;
        deploy:service)
            mymodule_action_deploy_service "${args[@]}"
            ;;
        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

# Action implementations
mymodule_action_push_config() {
    local target="${1:-@dev}"
    local config_file="${2:-config.toml}"

    # Resolve TES endpoint
    local connector=$(tes_resolve "$target" "connector")

    # Perform operation
    scp "$config_file" "$connector":/etc/config/
}

export -f mymodule_register_actions
export -f mymodule_execute_action
```

**Action Metadata Fields**:
- `verb`: What operation (push, deploy, list, view, etc.)
- `noun`: What target (config, service, logs, etc.)
- `exec_at`: Where verb executes (@local, @dev, etc.)
- `source_at`: Where data comes from
- `target_at`: Where data goes to
- `contexts`: Which environments (Local, Dev, Staging, Production)
- `modes`: Which modes (Inspect, Transfer, Execute)
- `tes_operation`: TES operation type (read, write, execute, local)
- `immediate`: Execute immediately or require confirmation
- `inputs`: Required/optional parameters
- `effects`: What changes (filesystem paths, resources)
- `can`: What this action does
- `cannot`: Limitations/boundaries

**Verb:Noun Pattern**:
Common verbs: push, pull, deploy, start, stop, list, view, check, validate
Common nouns: config, service, logs, keys, status, health

Examples:
- `push:config` - Deploy configuration files
- `deploy:service` - Deploy application service
- `list:services` - Show available services
- `view:logs` - Display log output
- `check:health` - Verify service health

### 5. TES Integration in Actions (120-180 lines)

Show how actions consume TES endpoints:

**Resolution Levels**:
```bash
# Level 1: Address (for ping, basic connectivity)
check_connectivity() {
    local target="$1"
    local address=$(tes_resolve "$target" "address")
    ping -c 1 "$address"
}

# Level 3: Connector (most common for SSH operations)
push_files() {
    local target="$1"
    local connector=$(tes_resolve "$target" "connector")
    scp ./files/* "$connector":/remote/path/
}

# Level 5: Locator (for specific resource operations)
update_config() {
    local target="$1"
    local path="/etc/myapp/config.toml"
    local locator=$(tes_resolve "$target" "locator" "$path")
    # Returns: user@host:/etc/myapp/config.toml
    scp config.toml "$locator"
}
```

**Handling Local vs Remote**:
```bash
deploy_config() {
    local target="$1"

    if [[ "$target" == "@local" ]] || tes_is_local "$target"; then
        # Local operation
        cp config.toml /etc/myapp/
    else
        # Remote operation
        local connector=$(tes_resolve "$target" "connector")
        scp config.toml "$connector":/etc/myapp/
    fi
}
```

**Multi-Target Operations**:
```bash
deploy_to_all() {
    local targets=("@dev" "@staging" "@prod")

    for target in "${targets[@]}"; do
        echo "Deploying to $target..."
        deploy_service "$target"
    done
}
```

### 6. Library Structure & Convention (80-120 lines)

**Required Files**:
```
bash/{library}/
├── {library}.sh             # Main entry point
└── README.md                # Documentation
```

**Optional Structure**:
```
bash/{library}/
├── {library}_core.sh        # Core functionality
├── {library}_utils.sh       # Utilities
├── core/                    # Core components
└── tests/                   # Tests
```

**NO actions.sh** - This is the key difference!

**Example: TDS (Display System)**:
```
bash/tds/
├── tds.sh                   # Entry point (layers 0-7)
├── core/
│   ├── ansi.sh              # Layer 0: ANSI utilities
│   └── semantic_colors.sh   # Layer 1.5: Semantic colors
├── themes/                  # Layer 2: Theme system
├── tokens/                  # Layer 3: Color tokens
├── layout/                  # Layer 4: Layouts
├── components/              # Layer 5: Components
├── semantics/               # Layer 6: Display semantics
└── renderers/               # Layer 7: Content renderers
```

**Library Entry Point Pattern**:
```bash
#!/usr/bin/env bash

# Library initialization
LIB_SRC="${LIB_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Load components
source "$LIB_SRC/core/mylib_core.sh"
source "$LIB_SRC/mylib_utils.sh"

# Export public API
export -f mylib_public_function
export -f mylib_another_function

# Mark as loaded
export MYLIB_LOADED=true
```

### 7. REPL Integration (100-150 lines)

How modules add REPL commands:

**Using the repl Library**:
```bash
# In bash/mymodule/interfaces/mymodule_repl.sh

source "$TETRA_SRC/bash/repl/core/repl_core.sh"

mymodule_repl_main() {
    # Register module commands
    repl_register_command "list" "mymodule_repl_cmd_list"
    repl_register_command "start" "mymodule_repl_cmd_start"
    repl_register_command "stop" "mymodule_repl_cmd_stop"

    # Register slash commands
    repl_register_slash_command "help" "mymodule_repl_slash_help"
    repl_register_slash_command "history" "mymodule_repl_slash_history"

    # Start REPL loop
    repl_main "mymodule" "mymodule_cmd_handler"
}

mymodule_cmd_handler() {
    local cmd="$1"
    shift
    local args=("$@")

    case "$cmd" in
        list)
            mymodule_list "${args[@]}"
            ;;
        start)
            mymodule_start "${args[@]}"
            ;;
        *)
            echo "Unknown command: $cmd"
            return 1
            ;;
    esac
}
```

**REPL Command vs Slash Command**:
- **Command**: Module operation (`list`, `start`, `stop`)
- **Slash Command**: REPL control (`/help`, `/history`, `/exit`)

**Example: TSM REPL**:
```bash
$ tsm repl
tsm> list
ID  Name          Status    Port
0   web-server    online    8000
1   api-service   online    3000

tsm> logs 0 -f
[Following logs...]

tsm> /help
Available commands:
  list              List running services
  start <name>      Start a service
  stop <id|name>    Stop a service
  logs <id> [-f]    View logs
  /help             Show this help
  /exit             Exit REPL
```

### 8. TUI Integration (80-120 lines)

How modules expose actions to TUIs (like demo 014):

**TUI discovers modules** by:
1. Loading module `actions.sh`
2. Calling `{module}_register_actions()`
3. Filtering by Context (Environment × Mode)

**Context Filtering**:
```bash
# In actions.sh
declare_action "deploy_prod" \
    "contexts=Production" \     # ONLY in Production
    "modes=Execute"             # ONLY in Execute mode
```

**TUI only shows this action when**:
- Current environment = Production
- Current mode = Execute

**Mode Definitions**:
- **Inspect**: Read-only operations (view, list, check)
- **Transfer**: Data movement (push, pull, sync)
- **Execute**: State changes (deploy, start, stop, restart)

**Example Context Matrix**:
```
                  Inspect         Transfer        Execute
Local             view:toml       import:json     compile:toml
Dev               check:health    push:config     deploy:service
Staging           view:status     sync:assets     validate:deployment
Production        view:logs       pull:backup     [restricted]
```

### 9. Boot System & Module Loading (100-150 lines)

**Boot Sequence**:
1. User: `source ~/tetra/tetra.sh`
2. `tetra.sh` sources `bash/bootloader.sh`
3. `bootloader.sh` sources `bash/boot/boot_modules.sh`
4. `boot_modules.sh` registers 40+ modules via `tetra_register_module`
5. Modules are lazy-loaded on first use

**Module Registration**:
```bash
# In bash/boot/boot_modules.sh
tetra_register_module "tsm" "$TETRA_BASH/tsm"
tetra_register_module "org" "$TETRA_BASH/org"
tetra_register_module "tkm" "$TETRA_BASH/tkm"
# ... 40+ more modules
```

**Lazy Loading**:
```bash
# User types: tsm list
# Boot system:
# 1. Check if tsm is loaded (TETRA_MODULE_LOADED array)
# 2. If not, source $TETRA_BASH/tsm/includes.sh
# 3. Mark as loaded
# 4. Execute: tsm list
```

**Manual Loading**:
```bash
tmod load tsm          # Load TSM module
tmod list loaded       # Show loaded modules
tmod list available    # Show all registered modules
```

**Module Dependencies**:
```bash
# In includes.sh
# If your module needs a library:
source "$TETRA_SRC/bash/repl/core/repl_core.sh"
source "$TETRA_SRC/bash/tds/tds.sh"
```

### 10. Strong Globals Convention (60-80 lines)

**Required Globals** (from CLAUDE.md):
- `TETRA_SRC`: Source code directory (e.g., `/Users/user/src/devops/tetra`)
- `TETRA_DIR`: Runtime data directory (e.g., `/Users/user/tetra`)
- `MOD_SRC`: Module source (e.g., `$TETRA_SRC/bash/mymodule`)
- `MOD_DIR`: Module runtime (e.g., `$TETRA_DIR/mymodule`)

**Module Pattern**:
```bash
# In includes.sh
MOD_SRC="${MOD_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/mymodule}"

# Create runtime directories
mkdir -p "$MOD_DIR"/{db,logs,config}

# Use in module
source "$MOD_SRC/core/mymodule_core.sh"
LOG_FILE="$MOD_DIR/logs/mymodule.log"
```

**Why Strong Globals?**
- Modules can count on TETRA_SRC being set
- No relative path guessing
- Consistent across all modules
- Easy to override for testing

### 11. Testing Modules (60-80 lines)

**Test Structure**:
```
bash/{module}/tests/
├── run_all_tests.sh         # Test runner
├── test_{feature}_1.sh      # Individual tests
├── test_{feature}_2.sh
└── README.md                # Test documentation
```

**Example Test**:
```bash
#!/usr/bin/env bash
# test_mymodule_basic.sh

# Load test framework
source "$TETRA_SRC/bash/test/test_framework.sh"

# Load module
source "$TETRA_SRC/bash/mymodule/includes.sh"

# Test cases
test_module_loads() {
    assert_function_exists "mymodule"
}

test_basic_operation() {
    result=$(mymodule test-input)
    assert_equals "expected-output" "$result"
}

# Run tests
run_tests
```

See `bash/tsm/tests/` for comprehensive examples (50 tests, 93% coverage).

### 12. Module Dependency Graph (60-80 lines)

Show the actual dependencies:

```
tetra.sh (bootstrap)
  ↓
bootloader.sh (loader core)
  ↓
boot/boot_modules.sh (40+ modules registered)
  ↓
┌─────────────────────────────────────┐
│ MODULES (user-facing, actions.sh)  │
├─────────────────────────────────────┤
│ tsm  → repl, tds                    │
│ org  → repl, tds                    │
│ tkm  → (independent)                │
│ vox  → (independent)                │
│ ...  → [other modules]              │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ LIBRARIES (utilities, no actions)  │
├─────────────────────────────────────┤
│ repl → (standalone framework)       │
│ tds  → color                        │
│ color → (standalone)                │
└─────────────────────────────────────┘
```

**Dependency Rules**:
1. Modules can depend on libraries
2. Modules should NOT depend on other modules
3. Libraries can depend on other libraries
4. Libraries should NOT depend on modules
5. Avoid circular dependencies

### 13. Best Practices (80-100 lines)

**Naming**:
- Module names: lowercase, descriptive (tsm, org, tkm)
- Functions: `module_verb_noun` or `module_action_verb_noun`
- Files: lowercase with underscores (my_module_core.sh)

**Function Naming**:
- Public API: `tetra_module_*` or `module_*`
- Internal: `_module_*` (leading underscore)
- Actions: `module_action_verb_noun`

**Error Handling**:
```bash
mymodule_operation() {
    local input="$1"

    # Validate inputs
    if [[ -z "$input" ]]; then
        echo "Error: input required" >&2
        return 1
    fi

    # Check dependencies
    if ! command -v jq >/dev/null; then
        echo "Error: jq not installed" >&2
        return 1
    fi

    # Perform operation with error checking
    result=$(dangerous_command) || {
        echo "Error: operation failed" >&2
        return 1
    }

    echo "$result"
}
```

**Logging**:
```bash
# Use TCS 4.0 logging standard
tetra_log_success "module" "operation" "target" "{\"key\":\"value\"}"
tetra_log_error "module" "operation" "error message"
```

**Documentation**:
- README.md in module root (user guide)
- Inline comments for complex logic
- Function docstrings for public API
- Examples in README

### 14. Common Patterns (60-80 lines)

**Pattern 1: CLI + REPL + TUI**
```bash
# CLI (bash/mymodule/mymodule.sh)
mymodule() {
    case "$1" in
        list) mymodule_list ;;
        start) mymodule_start "$2" ;;
        *)
            echo "Usage: mymodule {list|start|stop}"
            return 1
            ;;
    esac
}

# REPL (bash/mymodule/interfaces/mymodule_repl.sh)
mymodule_repl_main() {
    repl_register_command "list" "mymodule_list"
    repl_main "mymodule" "mymodule_cmd_handler"
}

# TUI (bash/mymodule/actions.sh)
mymodule_register_actions() {
    declare_action "list" "verb=list" "noun=items" ...
}
```

**Pattern 2: Configuration Management**
```bash
# Load config
mymodule_load_config() {
    local config_file="$MOD_DIR/config/mymodule.toml"
    if [[ -f "$config_file" ]]; then
        # Parse TOML...
    fi
}

# Save config
mymodule_save_config() {
    local config_file="$MOD_DIR/config/mymodule.toml"
    cat > "$config_file" <<EOF
[mymodule]
setting = "value"
EOF
}
```

**Pattern 3: Database Operations**
```bash
# Module database location
DB_DIR="$MOD_DIR/db"
DB_FILE="$DB_DIR/mymodule.db"

# Use timestamp-based primary keys (TCS convention)
mymodule_create_record() {
    local timestamp=$(date +%s)
    local data="$1"
    echo "$timestamp|$data" >> "$DB_FILE"
}
```

### 15. Reference (40-60 lines)

**Related Documentation**:
- [README.md](README.md) - Project overview
- [TES.md](TES.md) - Endpoint specification
- [CORE_SPECIFICATION.md](CORE_SPECIFICATION.md) - TCS 4.0 reference
- [bash/tsm/README.md](../bash/tsm/README.md) - TSM example
- [bash/org/README.md](../bash/org/README.md) - Org example

**Module Examples**:
- TSM: Process manager (most complete example)
- Org: Organization management with TES integration
- TKM: SSH key management

**Library Examples**:
- repl: REPL framework
- tds: Display system
- color: Color/theme system

## Writing Guidelines

1. **Code-heavy**: Show actual implementations
2. **Real examples**: Use tsm, org as examples
3. **Patterns**: Extract common patterns
4. **Practical**: Focus on "how to build"
5. **Reference**: Link to example modules

## Tone

- Practical and hands-on
- Code-focused (this is a developer guide)
- Clear explanations of patterns
- Encouraging experimentation

## Create the File

Create `docs/DEVELOPER_GUIDE.md` as THE guide for building Tetra modules and libraries.

**After completion**: This becomes the verbs reference - how to build operations in Tetra.
