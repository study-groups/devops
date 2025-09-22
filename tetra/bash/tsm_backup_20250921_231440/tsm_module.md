# TSM Module Architecture Refactor

## Problems with Current System

1. **Inconsistent Loading**: includes.sh → fallback to module.sh → glob loading
2. **Circular Dependencies**: index.sh calls functions before they're loaded
3. **Global State Issues**: Associative arrays don't persist through sourcing
4. **Mixed Architecture**: Some monolithic, some modular

## New Architecture Design

### 1. Dependency-Ordered Loading
```
tsm/
├── tsm_core.sh           # Core functions, no dependencies
├── tsm_config.sh         # Configuration (ports, settings)
├── tsm_utils.sh          # Utility functions, depends on core
├── tsm_service.sh        # Service management, depends on core+utils
├── tsm_inspect.sh        # Process inspection, depends on core
├── tsm_formatting.sh     # Output formatting, depends on core
├── tsm_doctor.sh         # Diagnostics, depends on core+utils
├── tsm_repl.sh          # REPL interface, depends on all above
├── tsm.sh               # Main interface, orchestrates everything
└── index.sh             # Metadata and completions, no function calls
```

### 2. Clean Initialization Pattern
```bash
# In tsm/tsm.sh (main orchestrator)
_tsm_load_components() {
    local TSM_DIR="$(dirname "${BASH_SOURCE[0]}")"

    # Load in dependency order
    source "$TSM_DIR/tsm_core.sh"      # Must be first
    source "$TSM_DIR/tsm_config.sh"    # Configuration
    source "$TSM_DIR/tsm_utils.sh"     # Depends on core
    source "$TSM_DIR/tsm_service.sh"   # Depends on core+utils
    source "$TSM_DIR/tsm_inspect.sh"   # Depends on core
    source "$TSM_DIR/tsm_formatting.sh" # Depends on core
    source "$TSM_DIR/tsm_doctor.sh"    # Depends on core+utils

    # Initialize global state after all functions loaded
    _tsm_init_global_state
}

# Load components once
_tsm_load_components
```

### 3. Global State Management
```bash
# In tsm_config.sh
_tsm_init_global_state() {
    # Initialize associative arrays properly
    if [[ "${BASH_VERSION%%.*}" -ge 4 ]]; then
        declare -gA TSM_NAMED_PORTS 2>/dev/null || return 1
        declare -gA TSM_PROCESS_REGISTRY 2>/dev/null || return 1

        # Set initial values
        TSM_NAMED_PORTS["devpages"]="4000"
        TSM_NAMED_PORTS["tetra"]="4444"
        TSM_NAMED_PORTS["arcade"]="8400"
        TSM_NAMED_PORTS["pbase"]="2600"
    fi
}
```

### 4. Clean Module Interface
```bash
# tsm/includes.sh becomes simple
#!/usr/bin/env bash
# TSM Module Entry Point
source "$(dirname "${BASH_SOURCE[0]}")/tsm.sh"
```

### 5. Lazy Loading Compatibility
The bootloader's lazy loading will work cleanly:
- `tetra_load_module "tsm"` sources `tsm/includes.sh`
- Which sources `tsm/tsm.sh`
- Which loads all components in the right order
- No circular dependencies or missing functions

## Implementation Plan

1. **Create tsm_config.sh** - Extract configuration and global state
2. **Refactor tsm_core.sh** - Pure core functions, no dependencies
3. **Update component files** - Remove interdependencies
4. **Rewrite tsm.sh** - Clean orchestration with dependency order
5. **Simplify includes.sh** - Single entry point
6. **Update index.sh** - Remove function calls, just metadata
7. **Test thoroughly** - Ensure no regressions

## Benefits

- **Predictable loading order** - No more circular dependencies
- **Clean separation of concerns** - Each file has a clear purpose
- **Proper global state** - Associative arrays work reliably
- **Bootloader compatible** - Works with existing lazy loading
- **Maintainable** - Clear dependencies and interfaces
- **Testable** - Can load components individually for testing