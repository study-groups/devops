# Tetra Module System Reference

The Tetra Module System provides a robust, Erlang-inspired architecture for building modular bash applications. This document uses the **Tetra Service Manager (TSM)** as a concrete example throughout.

## Architecture Overview

### Two-Level Module Architecture

**Tetra Modules** (Top Level)
- Self-contained applications like `tsm`, `tview`, `rag`
- Discovered and managed by the global module registry
- Each implements the standard Tetra Module Interface
- Independent and can be developed/deployed separately

**Internal Components** (Within Modules)
- Functional units within a Tetra module (e.g., TSM's analytics, resource_manager)
- Handle specific responsibilities within the module
- Follow deferred initialization patterns to prevent circular dependencies

```
📦 Tetra Module System
├── 🔧 tsm (Tetra Service Manager)
│   ├── 📁 core/ (config, utils, lifecycle)
│   ├── 📁 system/ (analytics, resource_manager, monitor)
│   ├── 📁 services/ (definitions, registry, startup)
│   ├── 📁 process/ (inspection, lifecycle, management)
│   └── 📁 interfaces/ (cli, repl)
├── 🎨 tview (Terminal UI Framework)
├── 🤖 rag (Retrieval Augmented Generation)
└── 🛠️ utils (Shared utilities)
```

## Tetra Module Interface

Every Tetra module must implement these standard functions:

### Discovery Functions
```bash
# Required: Actions this module supports
tsm_module_actions() {
    echo "start stop restart delete list services logs ports doctor repl"
}

# Required: Data/properties this module manages
tsm_module_properties() {
    echo "processes services logs ports status config environment"
}

# Required: Module metadata and current status
tsm_module_info() {
    echo "TSM - Tetra Service Manager"
    echo "Purpose: Local development process and service management"
    echo "Active Processes: $(tsm list 2>/dev/null | grep -c "TSM ID" || echo "0")"
}

# Required: Initialize the module after all components loaded
tsm_module_init() {
    _tsm_init_global_state
    echo "TSM module initialized successfully"
}
```

### Strong Globals Pattern

Modules rely on **strong globals** that must be set before anything works:

```bash
# TETRA_SRC - Root source directory (absolute requirement)
export TETRA_SRC="/path/to/tetra"

# MOD_SRC - Module-specific source directory
MOD_SRC="$TETRA_SRC/bash/tsm"

# MOD_DIR - Module runtime directory (unless testing)
MOD_DIR="$TETRA_DIR/tsm"
```

## Component Architecture (TSM Example)

### Component Lifecycle Interface

Every internal component implements a standard lifecycle:

```bash
# Component metadata - discoverable by the module system
_tsm_component_resource_manager_info() {
    echo "name:resource_manager"
    echo "type:system"
    echo "dependencies:config"
    echo "optional_dependencies:"
    echo "description:Process limits and resource management for macOS EMFILE issues"
    echo "implementations:bash"
}

# Initialization - called explicitly after all components loaded
_tsm_component_resource_manager_init() {
    tsm_init_resource_manager
}

# Start operations - for background services
_tsm_component_resource_manager_start() {
    echo "Resource manager monitoring started"
}

# Graceful shutdown
_tsm_component_resource_manager_stop() {
    tsm_cleanup_all_processes
}
```

### Deferred Initialization Pattern

**Problem:** Auto-initialization during sourcing causes circular dependencies and fork bombs.

**Solution:** Separate loading from initialization:

```bash
# ❌ Bad: Auto-initialization when sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    tsm_init_resource_manager  # Causes fork loops!
fi

# ✅ Good: Deferred initialization
# Files only declare functions during sourcing
# Explicit initialization after all files loaded
_tsm_component_resource_manager_init() {
    tsm_init_resource_manager
}
```

### Loading Phases

**Phase 1: Pure Loading**
```bash
# include.sh - Load all component files (no execution)
source "$MOD_SRC/core/config.sh"       # Functions only
source "$MOD_SRC/core/utils.sh"        # Functions only
source "$MOD_SRC/system/resource_manager.sh"  # Functions only
```

**Phase 2: Module Initialization**
```bash
# After all files loaded, initialize the module
tsm_module_init() {
    _tsm_init_global_state
    # Components initialized if needed
}
```

## Module Registry Integration

### Registration
```bash
# Automatic registration when module loads successfully
MOD_NAME="tsm"
MOD_STATUS="active"
MOD_ACTIONS=$(tsm_module_actions)
MOD_PROPERTIES=$(tsm_module_properties)

tetra_register_module "$MOD_NAME" "$MOD_STATUS" "$MOD_ACTIONS" "$MOD_PROPERTIES"
```

### Discovery
```bash
# List all registered modules
tetra list modules

# Get module capabilities
tetra query tsm actions      # start stop restart...
tetra query tsm properties   # processes services logs...
```

## Best Practices

### 1. Component Organization
```bash
bash/tsm/
├── core/           # Essential components (config, utils)
├── system/         # System-level components (monitoring, resources)
├── services/       # Service management components
├── process/        # Process lifecycle components
├── interfaces/     # User interfaces (CLI, REPL)
├── integrations/   # External system integrations
└── include.sh      # Single entry point for all components
```

### 2. Dependency Management
- **Core first:** Load configuration and utilities before everything else
- **Dependency order:** System modules before service modules before interfaces
- **No circular deps:** Components don't source each other during loading
- **Function-level deps:** Components call each other after all files loaded

### 3. Error Handling
```bash
# Graceful degradation for missing dependencies
if command -v lua >/dev/null 2>&1; then
    # Enhanced Lua implementation available
    tsm_use_lua_analytics
else
    # Fallback to bash implementation
    tsm_use_bash_analytics
fi
```

### 4. Testing Isolation
```bash
# Test-specific overrides
if [[ "$TETRA_TESTING" == "true" ]]; then
    MOD_DIR="/tmp/tetra_test/tsm"
    # Use test-specific directories and configurations
fi
```

## Action Function Signatures

Standard pattern for module actions:

```bash
# Property-based pattern with flexible options
tsm_action_start() {
    local service_name="${1:-all}"
    local -A options=()

    # Parse --key=value options
    shift
    while [[ $# -gt 0 ]]; do
        if [[ "$1" =~ ^--([^=]+)=(.+)$ ]]; then
            options["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
        fi
        shift
    done

    # Standard return format: status:details
    echo "success:Started $service_name with options"
}
```

**Usage:**
```bash
tsm start web --env=prod --port=8080
tsm list --format=json --filter=running
tsm logs api --lines=100 --follow=true
```

## Multi-Implementation Support

Components can have multiple implementations with graceful fallback:

```bash
# Directory structure
components/
├── analytics.sh         # Bash implementation (always available)
├── analytics.lua        # Enhanced Lua version (optional)
└── analytics.py         # Python version (optional)

# Runtime selection
if [[ -f "$MOD_SRC/analytics.lua" ]] && command -v lua >/dev/null; then
    implementation="lua"
elif [[ -f "$MOD_SRC/analytics.py" ]] && command -v python3 >/dev/null; then
    implementation="python"
else
    implementation="bash"  # Always available fallback
fi
```

## Integration Example

### Creating a New Tetra Module

1. **Create module structure:**
```bash
mkdir -p bash/mymodule/{core,components,interfaces}
```

2. **Implement module interface:**
```bash
# bash/mymodule/mymodule.sh
mymodule_module_actions() {
    echo "process analyze report"
}

mymodule_module_properties() {
    echo "data results config"
}

mymodule_module_info() {
    echo "MyModule - Data Processing Tool"
}

mymodule_module_init() {
    _mymodule_init_state
    echo "MyModule initialized successfully"
}
```

3. **Register with Tetra:**
```bash
# Module automatically discovered and registered
tetra list modules  # Shows: mymodule (active)
```

4. **Use from other modules:**
```bash
# From TSM or any other module
tetra invoke mymodule process --input=/path/to/data
```

This architecture provides a robust foundation for building modular, maintainable bash applications that follow proven patterns from systems like Erlang/OTP while remaining true to bash's simplicity and Unix philosophy.