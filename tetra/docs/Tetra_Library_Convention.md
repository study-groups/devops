# Tetra Library Convention

**Version:** 1.0
**TCS Version:** 3.0
**Reference Implementation:** `bash/color/`, `bash/tcurses/`
**Status:** Canonical

---

## Related Documentation
- [Tetra Module Convention](Tetra_Module_Convention.md) - User-facing modules with TUI actions
- [Tetra Core Specification](Tetra_Core_Specification.md) - Foundational concepts (TCS 3.0)

---

## Overview

The Tetra Library Convention defines **libraries** - reusable code components that provide functions and utilities for other Tetra code (modules, scripts, TUI apps). Libraries are distinct from **modules**, which have TUI integration and user-facing actions.

### Library vs Module

| Aspect | Library | Module |
|--------|---------|--------|
| Purpose | Provide functions/utilities | User-facing functionality |
| Location | `$TETRA_SRC/bash/<name>/` | `$TETRA_SRC/bash/<name>/` |
| TUI Integration | **NO** `actions.sh` | **YES** `actions.sh` required |
| User Actions | None | verb:noun actions |
| Runtime Data | Stateless (no `$TETRA_DIR/<name>/`) | May have `$TETRA_DIR/<name>/db/` |
| Dependencies | Other libraries only | Libraries + other modules |
| Examples | `color`, `tcurses` | `vox`, `qa`, `watchdog` |

**Key Rule**: If it has `actions.sh`, it's a module. If not, it's a library.

---

## Library Structure

### Required Files

```
bash/<library>/
├── <library>.sh               # Main entry point
└── README.md                  # Library documentation
```

### Optional Files

```
bash/<library>/
├── <library>_<subsystem>.sh   # Subsystem modules
├── core/                      # Core components
├── helpers/                   # Helper functions
└── tests/                     # Library tests
```

### Anti-Pattern: NO actions.sh

Libraries **MUST NOT** have `actions.sh`. If you need TUI integration:
1. Create a separate **module** that uses the library
2. Or add TUI actions to an existing module

**Example**: `tcurses` is a library. If you need a TUI to demonstrate tcurses, create `bash/tcurses-demo/` as a module.

---

## Library Entry Point Pattern

### File: `bash/<library>/<library>.sh`

```bash
#!/usr/bin/env bash

# Library metadata
LIBRARY_NAME="<library>"
LIBRARY_VERSION="1.0.0"
LIBRARY_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source subsystems (if any)
source "$LIBRARY_DIR/<library>_subsystem1.sh"
source "$LIBRARY_DIR/<library>_subsystem2.sh"

# Initialize library (if needed)
<library>_init() {
    # Optional initialization
    # Many libraries don't need this
    return 0
}

# Main library functions
<library>_function() {
    # Implementation
}

# Export public API
export -f <library>_init
export -f <library>_function

# Version info
<library>_version() {
    echo "$LIBRARY_NAME v$LIBRARY_VERSION"
}
```

---

## Using Libraries

### From Modules

```bash
# bash/mymodule/mymodule.sh
#!/usr/bin/env bash

# Import libraries (relative to TETRA_SRC)
source "$TETRA_SRC/bash/color/color.sh"
source "$TETRA_SRC/bash/tcurses/tcurses.sh"

# Use library functions
mymodule_show_status() {
    tetra_success "Module started!"
    tcurses_init
    # ... use tcurses functions ...
    tcurses_cleanup
}
```

### From Scripts

```bash
#!/usr/bin/env bash

# Bootstrap Tetra
source ~/tetra/tetra.sh  # Sets TETRA_SRC

# Import library
source "$TETRA_SRC/bash/color/color.sh"

# Use it
tetra_log "Starting process..."
tetra_success "Done!"
```

### From TUI Applications

```bash
#!/usr/bin/env bash

# Demo 014 example
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
source "$TETRA_SRC/bash/color/color.sh"

# Build TUI
tcurses_init
# ... render with tcurses, style with color ...
tcurses_cleanup
```

---

## Library Categories

### 1. TUI Libraries

Provide terminal UI primitives.

**Example: tcurses**

```
bash/tcurses/
├── tcurses.sh              # Main entry, exports all subsystems
├── tcurses_screen.sh       # Screen management
├── tcurses_input.sh        # Input handling
├── tcurses_animation.sh    # Animation loop
├── tcurses_buffer.sh       # Double-buffering
├── README.md
└── DEBUGGING.md
```

**Usage Pattern**:
```bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
tcurses_init
tcurses_simple_loop render_fn input_fn
tcurses_cleanup
```

### 2. Utility Libraries

Provide helper functions.

**Example: color**

```
bash/color/
├── color.sh                # Main entry
├── color_core.sh           # Core color functions
├── color_palettes.sh       # Predefined palettes
├── color_themes.sh         # Theme system
└── README.md
```

**Usage Pattern**:
```bash
source "$TETRA_SRC/bash/color/color.sh"
tetra_success "Operation complete!"
echo -e "${TETRA_BLUE}Info${TETRA_NC}"
```

### 3. Integration Libraries

Wrap external tools/APIs.

**Future Examples**:
- `bash/rlwrap/` - rlwrap integration (install detection, wrappers)
- `bash/jq/` - JSON processing helpers
- `bash/fzf/` - Fuzzy finder integration

---

## Dependency Management

### Library Dependencies

Libraries can depend on:
- Other libraries
- External tools (with detection)

Libraries **MUST NOT** depend on:
- Modules (circular dependency risk)
- TUI state
- User configuration

### Dependency Declaration

```bash
# bash/tcurses/tcurses.sh

# Optional dependencies (with fallback)
tcurses_check_rlwrap() {
    if ! command -v rlwrap >/dev/null 2>&1; then
        echo "Warning: rlwrap not found (enhanced editing disabled)" >&2
        echo "  macOS: brew install rlwrap" >&2
        echo "  Linux: apt install rlwrap / yum install rlwrap" >&2
        return 1
    fi
    return 0
}

# Required dependencies (hard failure)
tcurses_check_bash_version() {
    if [[ "${BASH_VERSINFO[0]}" -lt 5 ]]; then
        echo "Error: Bash 5.2+ required (found $BASH_VERSION)" >&2
        return 1
    fi
    return 0
}
```

### External Tool Integration

When a library wraps external tools:

1. **Check availability** at initialization
2. **Warn with install instructions** if missing
3. **Provide fallback** if possible
4. **Hard fail** if critical

```bash
library_init() {
    # Critical dependency
    library_check_bash_version || return 1

    # Optional dependency
    if library_check_rlwrap; then
        LIBRARY_HAS_RLWRAP=true
    else
        LIBRARY_HAS_RLWRAP=false
    fi

    return 0
}
```

---

## Library Promotion

### When to Promote from Demo to Library

A component in `demo/basic/XXX/bash/<name>/` should be promoted to `bash/<name>/` when:

1. **Reusable** - Multiple demos or modules need it
2. **Stable API** - Function signatures won't change frequently
3. **Well-tested** - Has examples and test coverage
4. **Documented** - README explains usage

### Promotion Checklist

- [ ] Create `bash/<library>/` directory
- [ ] Move source files from demo
- [ ] Update imports in demo to use `$TETRA_SRC/bash/<library>/`
- [ ] Add README.md with usage examples
- [ ] Update CLAUDE.md to reference new location
- [ ] Test with existing demos/modules

**Example**: `tcurses` should be promoted:
```bash
# Before
demo/basic/014/bash/tcurses/

# After
bash/tcurses/
demo/basic/014/bash/tcurses -> ../../bash/tcurses (symlink)
```

---

## Best Practices

### Naming

- **Library name**: Lowercase, descriptive (`tcurses`, `color`, `rlwrap`)
- **Functions**: Prefixed with library name (`tcurses_init`, `tetra_log`)
- **Variables**: Uppercase with library prefix (`TCURSES_VERSION`, `TETRA_RED`)

### Initialization

- **Optional**: Most libraries don't need explicit init
- **Required**: Only if state setup needed (tcurses terminal mode)
- **Idempotent**: Safe to call `_init()` multiple times

### Error Handling

```bash
library_function() {
    # Validate inputs
    if [[ -z "$1" ]]; then
        echo "Error: parameter required" >&2
        return 1
    fi

    # Check state
    if [[ "$LIBRARY_INITIALIZED" != "true" ]]; then
        echo "Error: call library_init first" >&2
        return 1
    fi

    # Do work
    # ...

    return 0
}
```

### Documentation

Every library MUST have:

```markdown
# Library Name

Brief description.

## Installation

No installation needed - just source the file.

## Dependencies

- Bash 5.2+
- Optional: rlwrap (brew install rlwrap)

## Quick Start

\`\`\`bash
source "$TETRA_SRC/bash/library/library.sh"
library_init
library_function "arg"
\`\`\`

## API Reference

### library_init

Initialize the library.

**Usage**: `library_init`

**Returns**: 0 on success, 1 on error

### library_function

Do something useful.

**Usage**: `library_function ARG`

**Parameters**:
- `ARG`: Description of argument

**Returns**: Result value
```

---

## Examples

### Example 1: tcurses (TUI Library)

```bash
#!/usr/bin/env bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"

render() {
    local first=$1
    tcurses_screen_move_cursor 1 1
    echo "Hello from TCurses!"
}

handle_input() {
    local key=$1
    [[ "$key" == "q" ]] && return 1
    return 0
}

tcurses_init
tcurses_setup_cleanup_trap
tcurses_simple_loop render handle_input
```

### Example 2: color (Utility Library)

```bash
#!/usr/bin/env bash
source "$TETRA_SRC/bash/color/color.sh"

# Simple logging
tetra_log "Starting deployment..."
tetra_success "Deployment complete!"
tetra_error "Failed to connect"

# Status coloring
status=$(tetra_status_color "running")
echo "Service: $status"
```

### Example 3: Module Using Libraries

```bash
# bash/mymodule/mymodule.sh
#!/usr/bin/env bash

# Import libraries
source "$TETRA_SRC/bash/color/color.sh"
source "$TETRA_SRC/bash/tcurses/tcurses.sh"

mymodule_show_interactive() {
    tcurses_init

    render() {
        tetra_success "Module running!"
    }

    handle_input() {
        [[ "$1" == "q" ]] && return 1
        return 0
    }

    tcurses_simple_loop render handle_input
    tcurses_cleanup
}
```

---

## Migration Guide

### Migrating Demo Code to Library

**Before** (demo-specific):
```bash
# demo/basic/014/bash/tcurses/tcurses.sh
TCURSES_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$TCURSES_DIR/tcurses_screen.sh"
```

**After** (library):
```bash
# bash/tcurses/tcurses.sh
TCURSES_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$TCURSES_DIR/tcurses_screen.sh"

# Demo now uses it
# demo/basic/014/demo.sh
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
```

---

## Future Libraries

Candidates for library extraction:

1. **bash/rlwrap/** - rlwrap integration with install detection
2. **bash/terminal/** - Terminal capability detection
3. **bash/layout/** - TUI layout system (from demo 014)
4. **bash/keyboard/** - Advanced keyboard handling
5. **bash/render/** - Rendering utilities

---

## Version History

- **1.0** (2025-10-16) - Initial library convention established
  - Defined library vs module distinction
  - Established structure and patterns
  - Referenced tcurses and color as canonical examples
