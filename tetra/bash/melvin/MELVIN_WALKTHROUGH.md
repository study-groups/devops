# MELVIN Walkthrough: Developing Features with Meta-Intelligence

This walkthrough demonstrates how to use MELVIN to understand tetra patterns, explore modules, and develop features using the "tetra way."

## Scenario: Adding a New Module to Tetra

Let's say you want to create a new module called `notes` for managing developer notes. MELVIN will guide you through understanding tetra patterns and implementing it correctly.

## Step 1: Bootstrap MELVIN

```bash
# Start in tetra root
cd ~/tetra

# Source tetra first (ALWAYS required - bash 5.2+)
source ~/tetra/tetra.sh

# Load MELVIN
source "$TETRA_SRC/bash/melvin/includes.sh"
```

**What happened:**
- Tetra environment initialized (TETRA_SRC, TETRA_DIR set)
- MELVIN loaded with tetra-specific knowledge
- Context auto-detected as "tetra"

## Step 2: Understand Current Architecture

```bash
# Get health summary
melvin health summary
```

**Output:**
```
MELVIN Health Summary
=====================
Modules found in: /Users/you/tetra/bash

Type Counts:
  LIBRARY:      8 modules
  MODULE:      12 modules (with actions.sh)
  APP:          3 modules (with TUI)
  APP+MODULE:   2 modules
  UNKNOWN:      1 directories

Total: 26 directories classified
```

**Learn:** MELVIN classified all bash/ directories. You need to decide what type your new module will be.

## Step 3: Learn the Tetra Way

```bash
# List all tetra concepts
melvin concepts
```

**Output:**
```
Available Concepts:
===================

strong_globals        - TETRA_SRC must always be set - it's the foundation...
no_dotfiles          - NEVER use . (dot) files in tetra...
lazy_loading         - Modules are registered in boot_modules.sh...
dual_directory       - Tetra separates code from state...
includes_guard       - The : "${VAR:=default}" pattern...
module_types         - LIBRARY, MODULE, APP, APP+MODULE...
boot_chain           - Bootstrap: tetra.sh → bootloader.sh...
bash_version         - Tetra ALWAYS runs in bash 5.2+...
module_structure     - Standard structure: bash/modname/...
tetra_self           - The self module provides introspection...
```

**Learn:** These are the patterns you need to follow. Let's dive deeper into the most important one.

## Step 4: Deep Dive into Strong Globals

```bash
# Explain a specific concept
melvin explain concept strong_globals
```

**Output:**
```
📚 Concept: strong_globals
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TETRA_SRC is the bedrock - it MUST be set for anything to work.

Every module follows this pattern:
  : "${MOD_SRC:=$TETRA_SRC/bash/modname}"
  : "${MOD_DIR:=$TETRA_DIR/modname}"
  export MOD_SRC MOD_DIR

Why?
  • MOD_SRC = source code location (read-only, in git)
  • MOD_DIR = runtime data (read-write, ephemeral)
  • Override guards (:) allow testing with custom paths
  • Explicit exports make dependencies crystal clear
  • Single source of truth prevents path confusion

Example:
  # In bash/mymod/includes.sh
  : "${MYMOD_SRC:=$TETRA_SRC/bash/mymod}"
  : "${MYMOD_DIR:=$TETRA_DIR/mymod}"
  export MYMOD_SRC MYMOD_DIR

Examples from codebase:
  • bash/rag/includes.sh:7
  • bash/melvin/includes.sh:9
  • bash/chroma/includes.sh:5
```

**Learn:** Your `notes` module MUST define NOTES_SRC and NOTES_DIR.

## Step 5: Study Similar Modules

```bash
# List all modules
melvin list MODULE

# Get detailed analysis of a similar module
melvin explain rag
```

**Output:**
```
bash/rag: MODULE
  Has actions.sh (with REPL)

Description:
  RAG (Retrieval-Augmented Generation) system for tetra

Features: includes actions repl
Strong globals: RAG_SRC RAG_DIR
Exported functions:
  - rag_repl
  - tetra_rag_search
  - tetra_rag_chunks

Dependencies: tree

LOC: ~2500 lines
Last modified: 2025-11-21
Registered: ✓ boot_modules.sh:44

Classification: MODULE (Has actions.sh with REPL)
```

**Learn:** The `rag` module is a good reference. It has:
- includes.sh (entry point)
- actions.sh (commands)
- rag_repl.sh (interactive mode)
- Strong globals (RAG_SRC, RAG_DIR)

## Step 6: Interactive Exploration

```bash
# Start MELVIN REPL for interactive learning
melvin repl
```

**Inside REPL:**
```
melvin> help
Available Commands:
  health [type]         Show health summary
  explain <module>      Deep analysis of module
  classify <module>     Show classification
  list <type>           List modules by type
  concepts              Show tetra patterns
  stats                 Usage statistics
  refresh               Rebuild knowledge
  exit                  Exit REPL

melvin> health rag

bash/rag: MODULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Structure:
  ✓ includes.sh
  ✓ rag.sh
  ✓ actions.sh
  ✓ rag_repl.sh
  ✓ README.md

Strong globals: RAG_SRC RAG_DIR ✓
Classification: MODULE
Boot registered: ✓ (line 44)

melvin> concepts module_structure
📚 Concept: module_structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Standard structure: bash/modname/{includes.sh, modname.sh, actions.sh?, modname_repl.sh?, README.md}

Examples from codebase:
  • bash/rag/includes.sh
  • bash/melvin/includes.sh
  • bash/chroma/includes.sh

melvin> exit
```

**Learn:** You now understand the module structure pattern.

## Step 7: Create Your Module Structure

Now you understand the patterns. Let's create the `notes` module:

```bash
# Create module directory
mkdir -p "$TETRA_SRC/bash/notes"

# Create includes.sh
cat > "$TETRA_SRC/bash/notes/includes.sh" <<'EOF'
#!/usr/bin/env bash

# Notes Module - Strong Globals Pattern
: "${NOTES_SRC:=$TETRA_SRC/bash/notes}"
: "${NOTES_DIR:=$TETRA_DIR/notes}"
export NOTES_SRC NOTES_DIR

# Source core module
source "$NOTES_SRC/notes.sh"
EOF

# Create notes.sh
cat > "$TETRA_SRC/bash/notes/notes.sh" <<'EOF'
#!/usr/bin/env bash

# Notes Module - Core Functions

notes_init() {
    mkdir -p "$NOTES_DIR"
    echo "Notes initialized at: $NOTES_DIR"
}

notes_add() {
    local note="$1"
    if [[ -z "$note" ]]; then
        echo "Usage: notes add 'your note here'"
        return 1
    fi

    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] $note" >> "$NOTES_DIR/notes.log"
    echo "Note added."
}

notes_list() {
    if [[ -f "$NOTES_DIR/notes.log" ]]; then
        cat "$NOTES_DIR/notes.log"
    else
        echo "No notes yet. Use: notes add 'your note'"
    fi
}

export -f notes_init notes_add notes_list
EOF

# Create actions.sh (makes it a MODULE)
cat > "$TETRA_SRC/bash/notes/actions.sh" <<'EOF'
#!/usr/bin/env bash

# Notes Module - Actions Interface

notes() {
    local action="${1:-list}"
    shift || true

    case "$action" in
        init)
            notes_init "$@"
            ;;
        add|a)
            notes_add "$@"
            ;;
        list|l)
            notes_list "$@"
            ;;
        help|h)
            cat <<'HELP'
notes - Developer Notes Manager

Usage: notes <command> [args]

Commands:
  init              Initialize notes system
  add 'note'        Add a note
  list              List all notes
  help              Show this help

The Tetra Way:
  • Notes stored in: $NOTES_DIR/notes.log
  • Source code in: $NOTES_SRC
  • Strong globals: NOTES_SRC, NOTES_DIR
HELP
            ;;
        *)
            echo "Unknown command: $action"
            echo "Use 'notes help' for usage"
            return 1
            ;;
    esac
}

export -f notes
EOF

chmod +x "$TETRA_SRC/bash/notes/includes.sh"
chmod +x "$TETRA_SRC/bash/notes/notes.sh"
chmod +x "$TETRA_SRC/bash/notes/actions.sh"
```

## Step 8: Verify with MELVIN

```bash
# Check if MELVIN classifies it correctly
melvin classify notes
```

**Output:**
```
bash/notes: MODULE

Classification reasoning:
  ✓ Has includes.sh
  ✓ Has actions.sh
  ○ No REPL file (*_repl.sh)
  ○ No TUI file (*_tui.sh)

Type: MODULE
Pattern: Provides actions interface
```

**Success!** MELVIN recognizes your module as a proper MODULE.

## Step 9: Full Health Check

```bash
# Get detailed health report for your new module
melvin health notes
```

**Output:**
```
bash/notes: MODULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Structure:
  ✓ includes.sh
  ✓ notes.sh
  ✓ actions.sh
  ○ README.md (missing)

Strong globals: NOTES_SRC NOTES_DIR ✓
Classification: MODULE
Boot registered: ✗ (not in boot_modules.sh)

Recommendations:
  • Add README.md for documentation
  • Register in bash/boot/boot_modules.sh for lazy loading
  • Consider adding notes_repl.sh for interactive mode
```

**Learn:** MELVIN identifies what's missing and suggests next steps.

## Step 10: Test Your Module

```bash
# Source your module
source "$TETRA_SRC/bash/notes/includes.sh"

# Test it
notes init
notes add "MELVIN helped me build this module the tetra way!"
notes list
```

**Output:**
```
Notes initialized at: /Users/you/tetra_dir/notes
Note added.
[2025-11-21 14:30:00] MELVIN helped me build this module the tetra way!
```

## Step 11: Track Your Learning

```bash
# Check MELVIN's usage stats
melvin stats
```

**Output:**
```
MELVIN Usage Statistics
=======================

Total queries: 15
Hit rate: 93.3%
Popular queries:
  • concepts (5 times)
  • explain rag (3 times)
  • health summary (2 times)

Last refresh: 2025-11-21 14:00:00
Staleness: 0 days (fresh ✓)

Knowledge domains loaded:
  • generic
  • tetra
```

## What You Learned

Through this walkthrough, MELVIN taught you:

1. **Strong Globals Pattern**: Every module MUST define MOD_SRC and MOD_DIR
2. **No Dotfiles Rule**: NEVER use hidden config files
3. **Module Classification**: MODULE type requires actions.sh
4. **Directory Structure**: Standard bash/modname/ layout
5. **Tetra Bootstrap**: How modules integrate via boot system
6. **Best Practices**: Explicit exports, override guards, dual directories

## Advanced Usage: Exploring a Concept

Let's say you're curious about lazy loading:

```bash
# Ask MELVIN to explain with context
melvin explain concept lazy_loading
```

**Output:**
```
⏳ Lazy Loading Pattern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Modules are registered but not loaded until first use.
This keeps shell startup fast.

In bash/boot/boot_modules.sh:
  tetra_register_module "modname" "$TETRA_BASH/modname"
  tetra_create_lazy_function "modname_func" "modname"

First call to modname_func() triggers module load.

Registered modules in boot_modules.sh:
  • 44:tetra_register_module "rag" "$TETRA_BASH/rag"
  • 45:tetra_create_lazy_function "rag" "rag"
  • 52:tetra_register_module "melvin" "$TETRA_BASH/melvin"
```

Now you understand how to add your module to the boot chain!

## Workflow Summary

**MELVIN-Guided Development:**

1. `melvin health summary` - Understand current state
2. `melvin concepts` - Learn patterns
3. `melvin explain <module>` - Study examples
4. Build your feature following patterns
5. `melvin classify <module>` - Verify correctness
6. `melvin health <module>` - Get recommendations
7. `melvin stats` - Track learning progress

## Interactive Learning Mode

```bash
# Start REPL for sustained exploration
melvin repl
```

Inside REPL, you can rapidly explore without typing "melvin" prefix:

```
melvin> list MODULE
melvin> explain rag
melvin> concepts strong_globals
melvin> health summary
```

This is perfect for:
- Learning tetra patterns
- Exploring unfamiliar modules
- Validating architectural decisions
- Getting instant feedback

## Next Steps

- Add `notes_repl.sh` for interactive mode
- Create comprehensive README.md
- Register in `boot_modules.sh` for lazy loading
- Add tests in `tests/`
- Use `melvin refresh` if codebase changes significantly

---

**MELVIN**: Machine Electronics Live Virtual Intelligence Network
*Your meta-agent for understanding the tetra way*

Precision above all. 🎯
