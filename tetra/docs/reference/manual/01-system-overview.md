# Tetra System Overview

## Introduction

Tetra is a modular bash environment that provides structured process management, development tools, and service orchestration. The system is built around a module architecture that enables lazy loading, environment isolation, and extensible functionality.

## Core Architecture

### Directory Structure
```
tetra/
├── TETRA_DIR/           # Data directory (~\/tetra)
│   ├── tsm/            # Service manager data
│   ├── rag/            # RAG tools data
│   ├── claude/         # Claude integration data
│   └── modules/        # Module-specific data
└── TETRA_SRC/          # Source directory (~\/src\/devops\/tetra)
    └── bash/           # Module source code
        ├── bootloader.sh    # Main entry point
        ├── boot/           # Bootstrap components
        ├── tmod/          # Module manager
        ├── tsm/           # Service manager
        ├── rag/           # RAG tools
        └── utils/         # Shared utilities
```

### Startup Sequence

1. **Environment Setup**: `~/tetra/tetra.sh` sets `TETRA_DIR` and `TETRA_SRC`
2. **Bootloader**: Sources `$TETRA_SRC/bash/bootloader.sh`
3. **Core Loading**: Loads boot components in order:
   - `boot_core.sh` - Module system and arrays
   - `boot_modules.sh` - Module registration and lazy loading
   - `boot_aliases.sh` - Command aliases
   - `boot_prompt.sh` - Shell prompt setup
4. **Auto-loading**: Loads enabled modules based on configuration

### Module System

#### Module Registration
```bash
# Modules are registered with name and path
tetra_register_module "tsm" "$TETRA_SRC/bash/tsm"
tetra_register_module "rag" "$TETRA_SRC/bash/rag"
```

#### Lazy Loading
```bash
# Functions are stubbed until first use
tetra_create_lazy_function "tsm" "tsm"
tetra_create_lazy_function "rag_repl" "rag"
```

#### Module Loading State
- **TETRA_MODULE_LOADERS**: Maps module name → source path
- **TETRA_MODULE_LOADED**: Tracks loading status (true/false)

### Module Structure

Each module follows a standard pattern:
```
module_name/
├── includes.sh          # Entry point
├── module_name.sh       # Main functionality
├── module_name_core.sh  # Core functions
├── module_name_repl.sh  # Interactive interface
└── tests/              # Module tests
```

### Data Storage Convention

Modules store data under `$TETRA_DIR/module_name/`:
- `config/` - Configuration files
- `logs/` - Log files
- `cache/` - Temporary data
- Module-specific directories

## Module Management

### Commands
- `tmod list` - Show all modules and status
- `tmod load <module>` - Load a module
- `tmod unload <module>` - Unload a module
- `tmod status` - Show system status
- `tmod repl` - Interactive module manager

### Module States
- **Registered**: Known to the system
- **Loaded**: Functions available in current shell
- **Enabled**: Auto-loads in new shells

## Environment Reload

### The TTR Problem: A Self-Referential Paradox

The `ttr` (tetra reload) command faces a fundamental architectural challenge that reveals deep limitations in bash function management:

#### Root Cause Analysis
The reload problem is **self-referential**: TTR attempts to reload the environment, but TTR itself becomes stale and cannot be updated. Here's why:

1. **Functions Persist in Memory**: Bash functions remain loaded until explicitly removed or the shell exits
2. **No Built-in Reload Concept**: Unlike files, functions cannot be "re-sourced" to update definitions
3. **TTR Function Gets Stale**: The `tetra_reload` function itself becomes outdated when bootloader.sh is modified
4. **Cascading Staleness**: Old functions load old versions of other functions, perpetuating staleness

#### What Actually Happens

```bash
# When you edit bootloader.sh and run ttr:
ttr                          # Calls OLD version of tetra_reload
├── Old tetra_reload runs    # Uses outdated cleanup logic
├── Incomplete cleanup       # Misses many stale functions
├── Re-sources bootloader    # Loads new code BUT...
└── Old functions remain     # Previous definitions persist

# Result: Mix of old and new definitions
```

#### Why `source ~/tetra/tetra.sh` Also Fails

Even direct sourcing faces the same fundamental issue:

```bash
source ~/tetra/tetra.sh      # Sources bootloader.sh
├── No function cleanup      # Normal sourcing doesn't clean up
├── New functions ignored    # Bash won't overwrite existing functions
└── Old definitions win      # First definition takes precedence

# Result: Same stale function problem
```

#### The Chicken-and-Egg Problem

- **TTR can't fix itself** because it's subject to the same staleness it tries to solve
- **Sourcing doesn't help** because it doesn't clean up existing functions
- **Only fresh shell works** because it starts with clean function namespace

#### Workarounds and Solutions

**Reliable Methods:**
1. **New terminal + `source ~/tetra/tetra.sh`** ✅ (clean function namespace)
2. **`exec bash` + source** ✅ (replaces shell process entirely)

**Problematic Methods:**
- `ttr` ❌ (TTR function becomes stale)
- `source bootloader.sh` ❌ (no function cleanup)
- `source ~/tetra/tetra.sh` ❌ (same issue as above)

#### Architectural Implications

This reveals a fundamental limitation in bash-based environments:
- **Function-based reload is inherently fragile**
- **Any reload mechanism can become stale itself**
- **True reload requires process replacement** (new terminal/`exec bash`)

The TTR problem demonstrates why many production systems use external process managers rather than shell-function-based reloading mechanisms.

## Key Modules

- **tmod**: Module manager and system control
- **tsm**: Service/process manager with logging
- **rag**: RAG tools for code analysis and LLM integration
- **claude**: Claude Code integration
- **utils**: Shared utilities and status formatting