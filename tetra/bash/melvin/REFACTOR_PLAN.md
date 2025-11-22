# MELVIN: Universal Bash Codebase Meta-Agent

## Vision

**MELVIN = Machine Electronics Live Virtual Intelligence Network**

A general-purpose meta-agent for understanding bash codebases, with pluggable knowledge domains.

### Core Principles

1. **Generic**: Works on any bash codebase
2. **Pluggable**: Knowledge domains are modular
3. **Context-aware**: Detects project patterns automatically
4. **Portable**: No dependencies on tetra (when analyzing other projects)
5. **Intelligent**: Uses tetra-self when analyzing tetra itself

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 MELVIN Core Engine                       │
│  • Generic classification (bash patterns)                │
│  • RAG-like Q&A                                          │
│  • Pattern detection                                     │
│  • Conversational REPL                                   │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌──────▼─────────┐
│   Generic    │  │   Knowledge    │
│   Patterns   │  │   Plugins      │
│              │  │                │
│ • includes   │  │ • tetra        │
│ • actions    │  │ • bash-lib     │
│ • modules    │  │ • custom       │
└──────────────┘  └────────┬───────┘
                           │
                  ┌────────▼────────┐
                  │  tetra-self     │
                  │  (when in tetra)│
                  └─────────────────┘
```

## Use Cases

### 1. Analyzing Tetra (Home Turf)
```bash
# MELVIN in tetra context
cd ~/tetra
melvin explain rag
melvin health
melvin ask "Show modules with REPL"
melvin concepts tetra         # Tetra-specific knowledge

# Uses tetra-self module for deep integration
```

### 2. Analyzing Any Bash Project
```bash
# Point MELVIN at another codebase
melvin --root=/path/to/bash-project explain lib/utils
melvin --root=/opt/scripts health
melvin --root=~/projects/bash-lib ask "What modules are here?"

# Uses generic bash patterns
```

### 3. Learning From Multiple Codebases
```bash
# Compare patterns across projects
melvin compare ~/tetra /opt/bash-toolkit
melvin pattern includes --examples=all
melvin concepts bash-modules    # Generic bash knowledge
```

## Core Components

### 1. Generic Classification Engine

**melvin_classify.sh** - Universal bash module classifier

```bash
# Generic detection rules (work on any bash project)
melvin_detect_module_type() {
    local dir="$1"
    local context="${2:-generic}"  # generic, tetra, custom

    # Universal patterns
    local has_includes=0
    local has_actions=0
    local has_repl=0
    local has_tui=0
    local has_tests=0

    [[ -f "$dir/includes.sh" ]] && has_includes=1
    [[ -f "$dir/actions.sh" ]] && has_actions=1
    [[ -f "$dir"/*_repl.sh ]] && has_repl=1
    [[ -f "$dir"/*_tui.sh ]] && has_tui=1
    [[ -d "$dir/tests" ]] && has_tests=1

    # Context-specific classification
    case "$context" in
        tetra)
            # Use tetra-self for deep analysis
            if command -v tetra_module_classify_by_files >/dev/null 2>&1; then
                tetra_module_classify_by_files "$dir"
                return
            fi
            ;;
        generic)
            # Generic bash module patterns
            melvin_classify_generic "$has_includes" "$has_actions" "$has_repl" "$has_tui"
            ;;
        *)
            # Custom classification via plugin
            melvin_plugin_classify "$context" "$dir"
            ;;
    esac
}

melvin_classify_generic() {
    local includes="$1" actions="$2" repl="$3" tui="$4"

    if [[ $tui -eq 1 ]]; then
        echo "APP"
    elif [[ $actions -eq 1 ]]; then
        echo "MODULE"
    elif [[ $includes -eq 1 ]]; then
        echo "LIBRARY"
    else
        echo "SCRIPT_COLLECTION"
    fi
}
```

### 2. Context Detection

**melvin_context.sh** - Automatic project context detection

```bash
# Detect what kind of project we're analyzing
melvin_detect_context() {
    local root="${1:-.}"

    # Is this tetra?
    if [[ -f "$root/tetra.sh" ]] || [[ -d "$root/bash/boot" ]]; then
        echo "tetra"
        return
    fi

    # Check for other known patterns
    if [[ -f "$root/.melvin-config" ]]; then
        # Custom configuration
        source "$root/.melvin-config"
        echo "${MELVIN_CONTEXT:-generic}"
        return
    fi

    # Generic bash project
    echo "generic"
}

# Set project root
melvin_set_root() {
    local root="${1:-.}"

    export MELVIN_ROOT="$(cd "$root" && pwd)"
    export MELVIN_CONTEXT=$(melvin_detect_context "$MELVIN_ROOT")

    echo "MELVIN analyzing: $MELVIN_ROOT"
    echo "Context: $MELVIN_CONTEXT"

    # Load context-specific knowledge
    melvin_load_knowledge "$MELVIN_CONTEXT"
}
```

### 3. Pluggable Knowledge System

**melvin_knowledge.sh** - Knowledge domain manager

```bash
# Knowledge registry
declare -gA MELVIN_KNOWLEDGE_DOMAINS=()

# Register knowledge domain
melvin_register_knowledge() {
    local domain="$1"
    local loader_func="$2"

    MELVIN_KNOWLEDGE_DOMAINS["$domain"]="$loader_func"
}

# Load knowledge for context
melvin_load_knowledge() {
    local context="$1"

    # Always load generic knowledge
    melvin_load_generic_knowledge

    # Load context-specific knowledge
    if [[ -n "${MELVIN_KNOWLEDGE_DOMAINS[$context]}" ]]; then
        ${MELVIN_KNOWLEDGE_DOMAINS[$context]}
    fi
}

# Generic bash knowledge (always available)
melvin_load_generic_knowledge() {
    declare -gA MELVIN_CONCEPTS=(
        ["includes_pattern"]="Central includes.sh for module loading"
        ["actions_pattern"]="actions.sh for user-facing commands"
        ["repl_pattern"]="Interactive *_repl.sh command interface"
        ["tui_pattern"]="Text UI in *_tui.sh files"
        ["testing"]="tests/ directory for unit tests"
        ["documentation"]="README.md + optional DEVNOTES.md"
    )
}

# Tetra-specific knowledge (loaded in tetra context)
melvin_load_tetra_knowledge() {
    # Add tetra-specific concepts
    MELVIN_CONCEPTS["strong_globals"]="TETRA_SRC required, MOD_SRC/MOD_DIR pattern"
    MELVIN_CONCEPTS["no_dotfiles"]="NEVER use . files in tetra"
    MELVIN_CONCEPTS["lazy_loading"]="boot_modules.sh registration"
    MELVIN_CONCEPTS["dual_directory"]="TETRA_SRC (code) vs TETRA_DIR (state)"

    # Enable tetra-self integration if available
    if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/self/includes.sh" ]]; then
        source "$TETRA_SRC/bash/self/includes.sh"
        MELVIN_HAS_SELF=1
    fi
}

# Register tetra knowledge
melvin_register_knowledge "tetra" "melvin_load_tetra_knowledge"
```

### 4. Unified Command Interface

**melvin.sh** - Context-aware dispatcher

```bash
melvin() {
    local cmd="${1:-help}"
    shift 2>/dev/null

    case "$cmd" in
        # Setup commands
        --root)
            melvin_set_root "$1"
            shift
            melvin "$@"
            return
            ;;

        # Analysis commands (context-aware)
        health)
            melvin_cmd_health "$@"
            ;;
        explain)
            melvin_cmd_explain "$@"
            ;;
        classify)
            melvin_cmd_classify "$@"
            ;;
        list)
            melvin_cmd_list "$@"
            ;;

        # Query commands
        ask)
            melvin_cmd_ask "$@"
            ;;

        # Knowledge commands
        concepts)
            melvin_cmd_concepts "$@"
            ;;
        pattern)
            melvin_cmd_pattern "$@"
            ;;

        # Context commands
        context)
            melvin_cmd_context "$@"
            ;;

        # Interactive
        repl)
            melvin_repl
            ;;

        *)
            melvin_cmd_help
            ;;
    esac
}

# Context-aware health check
melvin_cmd_health() {
    case "$MELVIN_CONTEXT" in
        tetra)
            # Use tetra-self if available
            if [[ $MELVIN_HAS_SELF -eq 1 ]]; then
                echo "Using tetra-self for deep analysis..."
                tetra-self audit --modules
            else
                melvin_generic_health
            fi

            # Add MELVIN insights
            echo ""
            echo "💡 MELVIN's Analysis:"
            melvin_analyze_tetra_health
            ;;
        *)
            melvin_generic_health
            ;;
    esac
}

# Generic health check
melvin_generic_health() {
    echo "MELVIN Health Check"
    echo "==================="
    echo "Root: $MELVIN_ROOT"
    echo "Context: $MELVIN_CONTEXT"
    echo ""

    # Scan directory structure
    melvin_scan_directory "$MELVIN_ROOT"

    # Classify modules
    melvin_classify_all

    # Report findings
    melvin_report_health
}
```

### 5. RAG-Like Query Engine

**melvin_ask.sh** - Universal Q&A system

```bash
# Process natural language queries
melvin_cmd_ask() {
    local query="$*"

    # Log query
    melvin_log_query "ask" "$query"

    # Classify query intent
    local intent=$(melvin_classify_query "$query")

    # Route to appropriate handler
    case "$intent" in
        find_module)
            melvin_answer_find_module "$query"
            ;;
        explain_pattern)
            melvin_answer_explain_pattern "$query"
            ;;
        list_by_feature)
            melvin_answer_list_by_feature "$query"
            ;;
        documentation)
            melvin_answer_documentation "$query"
            ;;
        compare)
            melvin_answer_compare "$query"
            ;;
        *)
            melvin_answer_general "$query"
            ;;
    esac
}

# Context-aware query classification
melvin_classify_query() {
    local query="$1"

    # Pattern matching
    case "$query" in
        *"where is"*|*"location"*|*"find"*)
            echo "find_module"
            ;;
        *"explain"*|*"what is"*|*"how does"*)
            echo "explain_pattern"
            ;;
        *"show"*|*"list"*|*"modules with"*)
            echo "list_by_feature"
            ;;
        *"documentation"*|*"docs"*|*"readme"*)
            echo "documentation"
            ;;
        *"compare"*|*"difference"*)
            echo "compare"
            ;;
        *)
            echo "general"
            ;;
    esac
}

# Generic module finder (works on any codebase)
melvin_answer_find_module() {
    local query="$1"

    # Extract module name from query
    local module_name=$(echo "$query" | grep -oE '\b[a-z_]+\b' | head -1)

    echo "🔍 Searching for: $module_name"
    echo ""

    # Search in current root
    local found=$(find "$MELVIN_ROOT" -type d -name "$module_name" 2>/dev/null)

    if [[ -n "$found" ]]; then
        for dir in $found; do
            echo "📍 Found: $dir"

            # Classify and explain
            local type=$(melvin_detect_module_type "$dir" "$MELVIN_CONTEXT")
            echo "   Type: $type"

            # Show structure
            ls -1 "$dir" | head -10 | sed 's/^/   • /'
            echo ""
        done
    else
        echo "❌ Module '$module_name' not found in $MELVIN_ROOT"
    fi
}
```

## File Structure

### MELVIN Core (Generic)

```
bash/melvin/
├── includes.sh              # Entry point
├── melvin.sh                # Main dispatcher
├── melvin_classify.sh       # Generic classification engine
├── melvin_context.sh        # Project context detection
├── melvin_knowledge.sh      # Pluggable knowledge system
├── melvin_ask.sh            # RAG-like Q&A
├── melvin_repl.sh           # Interactive interface
├── melvin_stats.sh          # Usage tracking
├── melvin_db.sh             # Query history
│
├── knowledge/               # Knowledge plugins
│   ├── generic.sh           # Generic bash patterns
│   ├── tetra.sh             # Tetra-specific knowledge
│   └── README.md            # How to create plugins
│
└── README.md                # Updated docs
```

### Integration with tetra-self

When in tetra context and `tetra-self` is available, MELVIN delegates:
- Classification → `tetra_module_classify_by_files()`
- Health checks → `tetra-self audit --modules`
- Module info → `tetra_module_discover()`
- Documentation → `tetra-self docs`

## Command Examples

### Working with Tetra

```bash
# Default context (auto-detected)
cd ~/tetra
melvin health                # Uses tetra-self
melvin explain rag           # Tetra-specific explanation
melvin concepts tetra        # Tetra philosophy
melvin ask "Show modules with REPL"

# REPL in tetra context
melvin repl
melvin> Where is RAG?
melvin> Explain strong globals
melvin> Show modules missing docs
```

### Working with Other Projects

```bash
# Point at different codebase
melvin --root=/opt/bash-toolkit health
melvin --root=/opt/bash-toolkit list

# Or cd and use
cd /path/to/bash-project
melvin health
melvin ask "What modules are here?"
melvin explain lib/utils

# REPL in generic context
melvin repl
melvin> What is the structure here?
melvin> Show me modules with tests
melvin> Explain the includes pattern
```

### Cross-Project Analysis

```bash
# Compare patterns
melvin compare ~/tetra /opt/bash-toolkit
melvin pattern includes --examples=all

# Learn generic patterns
melvin concepts bash-modules
melvin pattern actions
```

## Configuration

### Per-Project Configuration

Create `.melvin-config` in project root:

```bash
# .melvin-config
MELVIN_CONTEXT="custom"
MELVIN_ROOT_NAME="MyBashProject"

# Custom patterns
MELVIN_MODULE_PATTERN="lib/*"
MELVIN_INCLUDES_NAME="load.sh"  # Not includes.sh

# Custom knowledge
melvin_load_custom_knowledge() {
    MELVIN_CONCEPTS["my_pattern"]="My custom pattern explanation"
}

# Register
melvin_register_knowledge "custom" "melvin_load_custom_knowledge"
```

### Global Configuration

`~/.melvinrc`:

```bash
# Default root if not specified
MELVIN_DEFAULT_ROOT="${TETRA_SRC:-$HOME/tetra}"

# Known projects
declare -gA MELVIN_PROJECTS=(
    ["tetra"]="$HOME/tetra"
    ["scripts"]="/opt/bash-scripts"
    ["toolkit"]="/opt/bash-toolkit"
)

# Quick project switching
melvin_project() {
    local name="$1"
    if [[ -n "${MELVIN_PROJECTS[$name]}" ]]; then
        melvin --root="${MELVIN_PROJECTS[$name]}"
    fi
}
```

## Benefits

### 1. Portability
- Works on any bash codebase
- No tetra dependency (when analyzing other projects)
- Standalone installation possible

### 2. Flexibility
- Auto-detects project patterns
- Pluggable knowledge domains
- Custom configuration per project

### 3. Intelligence
- Deep tetra integration when available
- Generic fallbacks for unknown projects
- Learn patterns across codebases

### 4. Maintainability
- Generic code in MELVIN
- Specific code in plugins
- Clear separation of concerns

### 5. Extensibility
- Easy to add new knowledge domains
- Custom patterns via config
- Plugin system for specific frameworks

## Migration Path

### For Tetra Users
**No changes** - MELVIN auto-detects tetra context:
```bash
cd ~/tetra
melvin health        # Works as before, uses tetra-self
```

### For Non-Tetra Use
**New capability** - Point MELVIN anywhere:
```bash
melvin --root=/path/to/bash-project health
```

### For Plugin Developers
Create custom knowledge domains:
```bash
# bash/melvin/knowledge/myframework.sh
melvin_load_myframework_knowledge() {
    MELVIN_CONCEPTS["custom"]="Custom explanation"
}
melvin_register_knowledge "myframework" "melvin_load_myframework_knowledge"
```

## Implementation Steps

### Phase 1: Generic Core (2-3 hours)
1. Create `melvin_context.sh` - Context detection
2. Update `melvin_classify.sh` - Generic classification
3. Create `melvin_knowledge.sh` - Plugin system
4. Update `melvin.sh` - Context-aware dispatcher

### Phase 2: Knowledge Plugins (1-2 hours)
1. Extract tetra-specific code to `knowledge/tetra.sh`
2. Create `knowledge/generic.sh` for bash patterns
3. Add plugin loading to `includes.sh`

### Phase 3: Integration (1 hour)
1. Integrate with tetra-self when available
2. Add fallbacks for non-tetra contexts
3. Test on multiple codebases

### Phase 4: Documentation (1 hour)
1. Update README.md
2. Add plugin development guide
3. Add configuration examples
4. Document CLI options

## Success Criteria

- [ ] MELVIN works without tetra (standalone)
- [ ] MELVIN auto-detects tetra context
- [ ] MELVIN uses tetra-self when available
- [ ] MELVIN can analyze any bash project
- [ ] Plugin system works
- [ ] All commands context-aware
- [ ] Documentation complete
- [ ] Tested on 3+ different bash projects

## Example Session: Non-Tetra Project

```bash
$ melvin --root=/opt/bash-toolkit

MELVIN analyzing: /opt/bash-toolkit
Context: generic

$ melvin health

MELVIN Health Check
===================
Root: /opt/bash-toolkit
Context: generic

Directory Structure:
  lib/          12 files
  tools/         8 files
  scripts/      15 files

Module Classification:
  LIBRARY:        5
  MODULE:         3
  SCRIPT:        10

Findings:
  ✓ 8/8 modules have README.md
  ⚠ 3 modules missing tests/
  ✓ All modules follow includes.sh pattern

$ melvin ask "Show modules with tests"

🔍 Modules with test/ directories:
  • lib/utils
  • lib/network
  • tools/deploy

💡 These modules follow testing best practices.
   Consider adding tests to: lib/string, tools/backup, tools/monitor

$ melvin explain lib/utils

📍 Module: lib/utils
Type: LIBRARY
Location: /opt/bash-toolkit/lib/utils

Structure:
  • includes.sh      - Module loader
  • utils.sh         - Core functions
  • README.md        - Documentation
  • tests/           - Unit tests ✓

Functions found:
  - string_trim
  - string_upper
  - array_contains

📚 Pattern: This is a LIBRARY module (no actions.sh, just functions)
   It follows the includes.sh pattern for loading.
```

This makes MELVIN truly universal!
