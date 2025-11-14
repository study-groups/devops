# MODULE SYSTEM Specification

**Version**: 1.0
**Status**: Specification
**Date**: 2025-11-03

## Overview

The Tetra Module System provides lazy-loading, registration, and integration patterns for all tetra functionality. Modules follow a consistent structure and integrate with the boot system, action registry, REPL system, help system, and service management.

**Key Principles**:
- **Lazy loading** - Modules load on first use, not at boot
- **Strong globals** - `MOD_SRC` and `MOD_DIR` are guaranteed for all modules
- **Standard structure** - All modules follow consistent patterns
- **Progressive enhancement** - Modules gain capabilities through 4 completeness levels
- **Self-documenting** - Specifications enable LLM-based development

## Table of Contents

1. [Module Architecture](#1-module-architecture)
2. [Module Registration](#2-module-registration)
3. [Module Loading](#3-module-loading)
4. [Completeness Levels](#4-completeness-levels)
5. [Integration Points](#5-integration-points)
6. [Directory Structure](#6-directory-structure)
7. [Module Lifecycle](#7-module-lifecycle)
8. [Module Discovery](#8-module-discovery)
9. [Best Practices](#9-best-practices)
10. [See Also](#10-see-also)

---

## 1. Module Architecture

### 1.1 Module Registry

Two global associative arrays track module state:

```bash
declare -gA TETRA_MODULE_LOADERS    # module_name → loader_path
declare -gA TETRA_MODULE_LOADED     # module_name → true|false
```

### 1.2 Strong Globals

Every module has two guaranteed global variables (per CLAUDE.md):

```bash
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/<module>}"  # Source code location
MOD_DIR="${MOD_DIR:-$TETRA_DIR/<module>}"        # Runtime data location
```

These are set in `includes.sh` and exported for subprocesses.

### 1.3 Module Types

Modules fall into categories:

- **Core Modules**: Essential system functionality (utils, prompt, boot)
- **Service Modules**: Background services (tsm, tkm, tubes)
- **Integration Modules**: External integrations (git, nginx, ssh)
- **Tool Modules**: User-facing tools (rag, tdocs, melvin)
- **Infrastructure**: Internal systems (tree, help, repl, color, tds)

---

## 2. Module Registration

### 2.1 Registration Function

```bash
tetra_register_module() {
    local module_name="$1"
    local loader_path="$2"

    # Prevent overwriting existing loader path
    if [[ -z "${TETRA_MODULE_LOADERS[$module_name]:-}" ]]; then
        TETRA_MODULE_LOADERS[$module_name]="$loader_path"
    fi

    # Mark as not loaded
    if [[ -z "${TETRA_MODULE_LOADED[$module_name]:-}" ]]; then
        TETRA_MODULE_LOADED[$module_name]=false
    fi
}
```

### 2.2 Registration Location

Modules are registered in two places:

1. **bash/boot/boot_core.sh** - Essential modules (utils, prompt, tmod, qa)
2. **bash/boot/boot_modules.sh** - All other modules (50+ modules)

Example from boot_modules.sh:
```bash
tetra_register_module "tsm" "$TETRA_BASH/tsm"
tetra_register_module "org" "$TETRA_BASH/org"
tetra_register_module "rag" "$TETRA_BASH/rag"
tetra_register_module "tdocs" "$TETRA_BASH/tdocs"
# ... 46 more modules
```

### 2.3 External Modules

External modules (not in `$TETRA_SRC/bash/`) can be registered:

```bash
tetra_register_module "logtime" "$HOME/src/bash/logtime"
```

---

## 3. Module Loading

### 3.1 Lazy Loading Pattern

Modules use lazy loading to minimize boot time:

```bash
tetra_load_module() {
    local module_name="$1"

    # Check if already loaded
    if [[ "${TETRA_MODULE_LOADED[$module_name]}" == "true" ]]; then
        return 0
    fi

    # Get loader path
    local loader_path="${TETRA_MODULE_LOADERS[$module_name]}"
    if [[ -z "$loader_path" ]]; then
        echo "Warning: Unknown module '$module_name'" >&2
        return 1
    fi

    # Load includes.sh (preferred) or fallback to module file
    if [[ -f "$loader_path/includes.sh" ]]; then
        source "$loader_path/includes.sh"
    elif [[ -f "$loader_path/$(basename "$loader_path").sh" ]]; then
        source "$loader_path/$(basename "$loader_path").sh"
    else
        # Fallback: load all .sh files
        for f in "$loader_path"/*.sh; do
            [[ -f "$f" ]] && source "$f"
        done
    fi

    TETRA_MODULE_LOADED[$module_name]=true
    return 0
}
```

### 3.2 Lazy Function Stubs

Create function stubs that trigger module loading:

```bash
tetra_create_lazy_function() {
    local func_name="$1"
    local module_name="$2"

    eval "
    $func_name() {
        local args=(\"\$@\")

        # Load module
        if ! tetra_load_module \"$module_name\"; then
            echo \"Error: Failed to load module $module_name\" >&2
            return 1
        fi

        # Call real function (stub is now replaced)
        \"$func_name\" \"\${args[@]}\"
    }
    "
}
```

Example usage from boot_modules.sh:
```bash
tetra_create_lazy_function "rag_repl" "rag"
tetra_create_lazy_function "tdocs" "tdocs"
tetra_create_lazy_function "tsm" "tsm"
```

### 3.3 Load Order

1. **Boot** - boot_core.sh loads utils and prompt
2. **Register** - boot_modules.sh registers all modules
3. **Stubs** - boot_modules.sh creates lazy function stubs
4. **On Demand** - Functions trigger loading when called

---

## 4. Completeness Levels

Modules progress through 4 completeness levels (see MODULE_COMPLETENESS_CRITERIA.md):

### Level 1: Functional (Minimum)
- ✅ `includes.sh` - Module loader
- ✅ `<module>.sh` - Core functionality
- ✅ Strong globals (`MOD_SRC`, `MOD_DIR`)
- ✅ Runtime directories created

**Examples**: python, nh, nvm

### Level 2: Integrated (Standard)
- ✅ Level 1 +
- ✅ `actions.sh` - Action definitions
- ✅ `README.md` - Module documentation
- ✅ Action registry integration
- ✅ Unified logging support
- ✅ **MODULE_SPECIFICATION.md** (REQUIRED)

**Examples**: tsm, tdocs, pbase

### Level 3: Interactive (Enhanced)
- ✅ Level 2 +
- ✅ `<module>_repl.sh` - Interactive REPL
- ✅ `<module>_tree.sh` - Tree-based help
- ✅ `<module>_completion.sh` - Tab completion
- ✅ trepl registration

**Examples**: org, rag, logs, pbase

### Level 4: Complete (Gold Standard)
- ✅ Level 3 +
- ✅ `tests/` directory with test suite
- ✅ TCS 4.0 compliant paths
- ✅ Database pattern (`$MOD_DIR/db/`)
- ✅ TES integration (if applicable)
- ✅ Comprehensive documentation

**Example**: tubes (THE gold standard)

### 4.1 Specification Requirement

**Level 2+ modules MUST have a specification**:
- `bash/<module>/docs/<MODULE>_SPECIFICATION.md`
- Documents architecture, design decisions, integrations
- Required for RAG/tdocs integration

---

## 5. Integration Points

Modules integrate with 7 core systems:

### 5.1 Boot System
- **boot/boot_core.sh** - Registration and lazy loading
- **boot/boot_modules.sh** - Module registry

### 5.2 Action System (TAS)
- **actions.sh** - Defines verb:noun actions
- **action_get_actions(env, mode)** - Returns available actions
- **action_execute_action(action, env, args)** - Executes action

See: TAS_SPECIFICATION.md

### 5.3 REPL System (TRS)
- **<module>_repl.sh** - Interactive command loop
- **repl_register_module_handler()** - Register with universal REPL
- **repl_register_slash_command()** - Register slash commands

See: TRS_SPECIFICATION.md

### 5.4 Help System (Tree)
- **<module>_tree.sh** - Hierarchical help
- **tree_insert()** - Register help entries
- **tree_register_shell_completion()** - Tab completion

See: bash/tree/README.md

### 5.5 Transaction System (TTS)
- **Optional** - Used for complex multi-step operations
- **$MOD_DIR/txns/{txn-id}/** - Transaction storage
- **FSM**: NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE

See: TTS_TETRA_TRANSACTION_STANDARD.md

### 5.6 Service Management (TSM)
- **Optional** - For daemon/service modules
- **tsm_start_any_command()** - Universal process launcher
- **PM2-style metadata** - Process management

See: bash/tsm/TSM_SPECIFICATION.md

### 5.7 Endpoint Routing (TES)
- **Optional** - For remote execution modules
- **@local, @dev, @staging, @prod** - Endpoint addressing
- **SSH, Bash, Agent extensions**

See: TES_*_Extension.md

---

## 6. Directory Structure

### 6.1 Source Directory (`$MOD_SRC`)

Standard module layout:

```
bash/<module>/
├── includes.sh              # ✅ Required - Module loader
├── <module>.sh              # ✅ Required - Core functionality
├── <module>_paths.sh        # ⭐ Gold - TCS 4.0 paths
├── <module>_core.sh         # ⭐ Gold - Business logic
├── actions.sh               # ✅ Level 2+ - Action definitions
├── <module>_repl.sh         # ✅ Level 3+ - Interactive REPL
├── <module>_tree.sh         # ✅ Level 3+ - Tree help
├── <module>_completion.sh   # ✅ Level 3+ - Tab completion
├── profiles/                # ⭐ Gold - Configuration profiles
│   └── default.conf
├── tests/                   # ⭐ Gold - Test suite
│   ├── test_basic.sh
│   └── example_*.sh
├── docs/                    # ✅ Level 2+ - Documentation
│   ├── <MODULE>_SPECIFICATION.md  # ✅ Required for Level 2+
│   ├── README.md                   # ✅ User guide
│   ├── *_GUIDE.md                  # Optional guides
│   └── *_REFERENCE.md              # Optional references
└── README.md                # ✅ Level 2+ - Module overview
```

### 6.2 Runtime Directory (`$MOD_DIR`)

Standard runtime layout:

```
$TETRA_DIR/<module>/
├── db/                      # ⭐ Gold - Primary key database
│   └── *.json              # Timestamped entries
├── config/                  # ⭐ Gold - Configuration
│   └── *.conf
├── logs/                    # ⭐ Gold - Module logs
│   └── *.log
├── cache/                   # Optional - Temporary data
├── txns/                    # Optional - TTS transactions
└── [module-specific dirs]   # Custom directories
```

### 6.3 Database Pattern (Level 4)

TCS 4.0 timestamped database pattern:

```bash
# Create entry
local timestamp=$(date +%s)
local entry_file="$MOD_DIR/db/${timestamp}.json"
echo "$json_data" > "$entry_file"

# Query by timestamp
cat "$MOD_DIR/db/${timestamp}.json"

# List all entries (sorted by timestamp)
ls -1 "$MOD_DIR/db"/*.json | sort
```

**Benefits**:
- Cross-module correlation by timestamp
- Audit trail
- No external database needed

---

## 7. Module Lifecycle

### 7.1 Module Development Lifecycle

```
1. Create includes.sh + core.sh → Level 1 (Functional)
2. Add actions.sh + README → Level 2 (Integrated)
3. Add REPL + help + completion → Level 3 (Interactive)
4. Add tests + TCS paths + database → Level 4 (Complete)
```

### 7.2 Runtime Lifecycle

```
Boot
  ↓
tetra_register_module()
  ↓
tetra_create_lazy_function()  [creates stub]
  ↓
User calls function
  ↓
tetra_load_module()  [loads includes.sh]
  ↓
Module init (if defined)
  ↓
Real function executes
```

### 7.3 Module Initialization

Optional initialization function:

```bash
# In module.sh
<module>_init() {
    # Create directories
    [[ ! -d "$MOD_DIR/db" ]] && mkdir -p "$MOD_DIR/db"

    # Load configuration
    if [[ -f "$MOD_DIR/config/default.conf" ]]; then
        source "$MOD_DIR/config/default.conf"
    fi

    # Initialize subsystems
    <module>_load_plugins

    return 0
}
```

Called from includes.sh:
```bash
if declare -f <module>_init >/dev/null 2>&1; then
    <module>_init
fi
```

---

## 8. Module Discovery

### 8.1 By tdocs/RAG

Modules are discoverable through:

1. **Module specifications** - `bash/<module>/docs/<MODULE>_SPECIFICATION.md`
2. **Completeness auditing** - `tdocs audit-module <name>`
3. **Code analysis** - `rag query "how does X work" --module-spec`

### 8.2 By Users

```bash
# List all registered modules
tetra_list_modules

# Check if module is loaded
echo "${TETRA_MODULE_LOADED[rag]}"

# Load module explicitly
tetra_load_module rag

# Unload module (marks as unloaded)
tetra_unload_module rag
```

### 8.3 Module Audit

```bash
# Automated audit (from MODULE_COMPLETENESS_CRITERIA.md)
bash/utils/audit_modules.sh

# Output:
# Module           Level  includes actions REPL README
# tubes            L4     ✓        ✓       ✓    ✓
# org              L3     ✓        ✓       ✓    ✓
# rag              L3     ✓        ✓       ✓    ✓
```

---

## 9. Best Practices

### 9.1 Module Design

1. **Single Responsibility** - One clear purpose per module
2. **Minimal Dependencies** - Depend on utils, avoid circular dependencies
3. **Strong Globals** - Always use `MOD_SRC` and `MOD_DIR`
4. **Lazy Loading** - Don't load dependencies in includes.sh
5. **Progressive Enhancement** - Start at Level 1, grow to Level 4

### 9.2 Naming Conventions

- **Module name**: Lowercase, short (3-6 chars preferred)
- **Function prefix**: `<module>_function_name` (avoid conflicts)
- **File naming**: `<module>_subsystem.sh` (e.g., tubes_core.sh)
- **Directory naming**: `$TETRA_DIR/<module>/` (matches module name)

### 9.3 Documentation

- **Level 1**: Code comments sufficient
- **Level 2**: README.md + MODULE_SPECIFICATION.md required
- **Level 3**: Add user guides and reference docs
- **Level 4**: Comprehensive docs + examples + tests

### 9.4 Testing

- **Level 1-2**: Manual testing acceptable
- **Level 3**: Basic test suite recommended
- **Level 4**: Comprehensive tests required
  - Unit tests for core functions
  - Integration tests for actions
  - Example scripts demonstrating usage

---

## 10. See Also

### Specifications
- **TAS_SPECIFICATION.md** - Action system (verb:noun)
- **TRS_SPECIFICATION.md** - REPL system
- **TCS_4.0_LOGGING_STANDARD.md** - Logging patterns
- **TTS_TETRA_TRANSACTION_STANDARD.md** - Transaction FSM
- **TES_*_Extension.md** - Endpoint routing (4 extensions)
- **MODULE_COMPLETENESS_CRITERIA.md** - Detailed completeness standards

### Examples
- **TUBES_INTEGRATION_EXAMPLE.md** - Complete Level 4 module walkthrough
- **bash/tubes/** - Gold standard implementation
- **bash/tsm/TSM_SPECIFICATION.md** - Service manager spec

### Templates
- **MODULE_SPEC_TEMPLATE.md** - Template for creating module specs
- **MODULE_COMPLETENESS_CRITERIA.md** - Checklists and templates

### Tools
- **bash/utils/audit_modules.sh** - Automated completeness audit
- **tdocs module <name>** - View all docs for a module
- **tdocs spec <module>** - View module specification
- **tdocs audit-specs** - Find modules missing specifications

---

## Appendix: Current Module Status

As of 2025-11-03 audit (from MODULE_COMPLETENESS_CRITERIA.md):

- **Total modules**: 50+
- **Level 4 (Complete)**: 1 (tubes)
- **Level 3 (Interactive)**: 4 (org, rag, logs, pbase)
- **Level 2 (Integrated)**: 6 (tsm, tdocs, + 4 others)
- **Level 1 (Functional)**: Majority

**Specification Coverage**:
- Level 2+ modules require specs: 6+ specifications needed
- Current: TSM has spec, tubes needs spec
- Gap: 5+ modules need specifications created
