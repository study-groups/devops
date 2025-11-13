# Tetra Module Installation Convention

## Overview

Tetra modules can provide system dependency installation scripts that run at `tetra install` time. This ensures all system-wide requirements are met before modules are used.

## Convention

### Module Install Script Location

Each module should provide an optional `install.sh` script:
```
tetra/bash/<module>/install.sh
```

### Install Script Requirements

1. **Must be executable**: `chmod +x install.sh`
2. **Must be idempotent**: Can run multiple times safely
3. **Must handle errors**: Use `set -e` or proper error checking
4. **Must support dry-run**: Check `$TETRA_INSTALL_DRY_RUN` variable
5. **Must be platform-aware**: Check `$OSTYPE` and handle appropriately

### Example Install Script

```bash
#!/usr/bin/env bash

# Module Install Script Template
# Installs system dependencies for <module>

set -e

echo "=== Installing <module> dependencies ==="

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Platform: macOS"

    # Check Homebrew
    if ! command -v brew >/dev/null 2>&1; then
        echo "❌ Homebrew required but not found"
        exit 1
    fi

    # Install dependencies
    for pkg in dependency1 dependency2; do
        if brew list "$pkg" >/dev/null 2>&1; then
            echo "✓ $pkg already installed"
        else
            echo "Installing $pkg..."
            brew install "$pkg"
        fi
    done

elif [[ "$OSTYPE" == "linux"* ]]; then
    echo "Platform: Linux"

    # Install using appropriate package manager
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y dependency1 dependency2
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y dependency1 dependency2
    else
        echo "⚠ Unsupported package manager"
        exit 1
    fi

else
    echo "⚠ Unsupported platform: $OSTYPE"
    exit 1
fi

echo "✓ Installation complete"
```

### Verification in Module

Modules should check for required dependencies in their includes.sh or initialization:

```bash
# In includes.sh or setup function
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Check if required tools are available
    if ! command -v required_tool >/dev/null 2>&1; then
        echo "Warning: required_tool not found" >&2
        echo "Run: bash $MOD_SRC/install.sh" >&2
    fi
fi
```

## TSM Example

TSM requires util-linux on macOS for optimal functionality:

### Dependencies
- **Required**: `lsof` (port scanning)
- **Optional**: `util-linux` (provides flock, setsid for better process management)

### Installation
```bash
bash $TETRA_SRC/bash/tsm/install.sh
```

### Verification
```bash
tsm doctor
```

## Global Tetra Install Command (Future)

Future enhancement: Add a `tetra install` command that:
1. Scans all modules for `install.sh` scripts
2. Runs each install script
3. Reports success/failure
4. Provides summary of installed dependencies

```bash
# Future command (not yet implemented)
tetra install           # Install all module dependencies
tetra install tsm       # Install specific module dependencies
tetra install --check   # Check status without installing
```

## Notes

- Install scripts are **optional** - modules should gracefully degrade without optional dependencies
- Required dependencies should fail fast with clear error messages
- Optional dependencies should warn but continue
- Always provide installation instructions in error/warning messages
- Test install scripts on clean systems
