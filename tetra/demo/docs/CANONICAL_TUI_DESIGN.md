# Canonical TUI Design Patterns - Implementation Guide

## Quick Reference

**What works**: demo/014 + demo/013 + demo/010 color system
**What doesn't**: bash/tview (45 files, tangled concerns, unmaintainable)
**Path**: Replace tview with ~5 canonical modules

---

## Core Architecture

### Input → State → Render → Output Loop

```
┌──────────────────┐
│  Read Key/REPL   │  (gamepad_input.sh or tcurses_input)
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Update State     │  (ENV_INDEX, MODE_INDEX, ACTION_INDEX)
│ (navigation)     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Get Actions      │  From registry (context-based)
│ (for current     │  
│  env:mode)       │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Render to Buffer │  (tui_write_* functions)
│ (header,content, │
│  footer, status) │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Flush Buffer     │  (single atomic write to terminal)
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Display on Term  │
└──────────────────┘
```

---

## File Structure

```
bash/tui/
├── colors/
│   ├── color_core.sh         # ANSI code + tput setup
│   ├── color_palettes.sh     # Named color groups (4 Amigos, Tetra, etc)
│   ├── color_semantic.sh     # ENV_*, MODE_*, STATUS_* assignments
│   └── color_themes.sh       # Theme switching (optional)
├── buffer.sh                 # Double buffering abstraction
├── typography.sh             # Bold, dim, underline styles
├── header.sh                 # Header rendering
├── gamepad_input.sh          # Single-key input handling
└── animation/
    ├── oscillator.sh         # Sine wave position generator
    └── line_animator.sh      # Animated separator/progress

bash/tetra/
├── tui/
│   ├── state.sh              # ENv_INDEX, MODE_INDEX, ACTION_INDEX
│   ├── navigation.sh         # navigate_env(), navigate_mode(), etc.
│   ├── renderer.sh           # Main render loop
│   └── repl.sh               # REPL interface (slash commands)
├── actions/
│   ├── registry.sh           # declare_action() definitions
│   ├── actions_impl.sh       # action_verb_noun() implementations
│   ├── executor.sh           # execute_action() dispatcher
│   └── module_discovery.sh   # get_module_actions() for extensibility
└── tui.conf                  # Configuration constants

Shared across all modules:
bash/*/tview/
├── actions.sh                # get_actions(env), action_id() impls
├── colors.sh                 # Module-specific color overrides (optional)
└── ...other module UI code...
```

---

## 1. Color System (bash/tui/colors/)

### color_core.sh - Foundation

```bash
#!/usr/bin/env bash

# ANSI codes via tput (with fallbacks)
COLOR_RESET=$(tput sgr0 2>/dev/null || echo "")
COLOR_BOLD=$(tput bold 2>/dev/null || echo "")
COLOR_DIM=$(tput dim 2>/dev/null || echo "")

# 8 basic colors
COLOR_BLACK=$(tput setaf 0 2>/dev/null || echo "")
COLOR_RED=$(tput setaf 1 2>/dev/null || echo "")
COLOR_GREEN=$(tput setaf 2 2>/dev/null || echo "")
COLOR_YELLOW=$(tput setaf 3 2>/dev/null || echo "")
COLOR_BLUE=$(tput setaf 4 2>/dev/null || echo "")
COLOR_MAGENTA=$(tput setaf 5 2>/dev/null || echo "")
COLOR_CYAN=$(tput setaf 6 2>/dev/null || echo "")
COLOR_WHITE=$(tput setaf 7 2>/dev/null || echo "")

# 256 colors (with ANSI fallbacks)
COLOR_ORANGE=$(tput setaf 208 2>/dev/null || echo "$COLOR_YELLOW")
COLOR_PURPLE=$(tput setaf 93 2>/dev/null || echo "$COLOR_MAGENTA")
# ... etc

export COLOR_RESET COLOR_BOLD COLOR_DIM
export COLOR_BLACK COLOR_RED COLOR_GREEN COLOR_YELLOW COLOR_BLUE COLOR_MAGENTA COLOR_CYAN COLOR_WHITE
export COLOR_ORANGE COLOR_PURPLE # ... etc
```

### color_semantic.sh - Meaning

```bash
#!/usr/bin/env bash

# Source color_core.sh and color_palettes.sh first

# Environment colors (distinct and meaningful)
ENV_LOCAL_COLOR="${COLOR_CYAN}"        # Local development
ENV_DEV_COLOR="${COLOR_GREEN}"         # Active development
ENV_STAGING_COLOR="${COLOR_YELLOW}"    # Warning: staging
ENV_PROD_COLOR="${COLOR_RED}"          # Alert: production

# Status colors (universal meanings)
STATUS_SUCCESS="${COLOR_GREEN}"        # ✓ Operation succeeded
STATUS_ERROR="${COLOR_RED}"            # ✗ Operation failed
STATUS_PENDING="${COLOR_DIM}${COLOR_WHITE}"  # ⟳ In progress
STATUS_WARNING="${COLOR_YELLOW}"       # ⚠ Warning state

# Usage in rendering:
# echo "${ENV_DEV_COLOR}dev${COLOR_RESET} environment selected"
```

**Key Rules**:
1. Define colors ONCE in color_core.sh
2. Never hardcode ANSI: No `echo "\033[31mtext\033[0m"`
3. Always end colored text with `${COLOR_RESET}`
4. Semantic assignments are optional (but recommended)

---

## 2. Buffer System (bash/tui/buffer.sh)

```bash
#!/usr/bin/env bash

# Double buffering for flicker-free rendering

declare -gA TUI_BUFFERS=(
    ["@tui[header]"]=""
    ["@tui[separator]"]=""
    ["@tui[content]"]=""
    ["@tui[footer]"]=""
)

tui_buffer_init() {
    for key in "${!TUI_BUFFERS[@]}"; do
        TUI_BUFFERS["$key"]=""
    done
}

tui_write_header() {
    local line_num="$1"
    local content="$2"
    # Track which lines were written to header
    TUI_BUFFERS["@tui[header]"]+="$(printf '%*s' "$(tput cols)" '' | tr ' ' ' ')
$content
"
}

tui_write_content() {
    local content="$1"
    TUI_BUFFERS["@tui[content]"]="$content"
}

tui_write_footer() {
    local content="$1"
    TUI_BUFFERS["@tui[footer]"]="$content"
}

tui_buffer_flush() {
    # Single atomic write to terminal
    clear  # Or use: tput clear
    echo -n "${TUI_BUFFERS[@tui[header]]}"
    echo -n "${TUI_BUFFERS[@tui[separator]]}"
    echo -n "${TUI_BUFFERS[@tui[content]]}"
    echo -n "${TUI_BUFFERS[@tui[footer]]}"
    tui_buffer_init  # Clear for next frame
}
```

**Why This Works**:
- All writes collected in memory
- Single `tui_buffer_flush()` at end of render loop
- No flicker, no race conditions
- Easy to test (capture buffer contents)
- Animation doesn't interfere with output

---

## 3. State Management (bash/tetra/tui/state.sh)

```bash
#!/usr/bin/env bash

# Minimal state for navigation and display
declare -gi ENV_INDEX=0         # Current environment selection
declare -gi MODE_INDEX=0        # Current mode (context) selection
declare -gi ACTION_INDEX=0      # Current action within env:mode

# Display state
declare -gs SHOW_DETAIL="false"
declare -gs VIEW_MODE="false"
declare -gi SCROLL_OFFSET=0

# Navigation arrays (from tui.conf or orchestrator)
declare -ga ENVIRONMENTS=()
declare -ga MODES=()

# Derived state (computed, not stored)
get_current_action_list() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    # Query orchestrator or action registry
    get_actions_for_context "$env" "$mode"
}

get_current_env() {
    echo "${ENVIRONMENTS[$ENV_INDEX]}"
}

get_current_mode() {
    echo "${MODES[$MODE_INDEX]}"
}

get_max_actions() {
    local actions=($(get_current_action_list))
    echo ${#actions[@]}
}
```

**Key Principle**: Only store what's needed for navigation. Everything else is derived.

---

## 4. Navigation (bash/tetra/tui/navigation.sh)

```bash
#!/usr/bin/env bash

# Simple array-based cycling

navigate_env() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
}

navigate_env_back() {
    ENV_INDEX=$(( (ENV_INDEX - 1) % ${#ENVIRONMENTS[@]} ))
    [[ $ENV_INDEX -lt 0 ]] && ENV_INDEX=$((${#ENVIRONMENTS[@]} - 1))
    ACTION_INDEX=0
}

navigate_mode() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
}

navigate_mode_back() {
    MODE_INDEX=$(( (MODE_INDEX - 1) % ${#MODES[@]} ))
    [[ $MODE_INDEX -lt 0 ]] && MODE_INDEX=$((${#MODES[@]} - 1))
    ACTION_INDEX=0
}

navigate_action() {
    local direction="${1:-next}"
    local max=$(get_max_actions)
    
    if [[ "$direction" == "prev" ]]; then
        ACTION_INDEX=$(( (ACTION_INDEX - 1) % max ))
        [[ $ACTION_INDEX -lt 0 ]] && ACTION_INDEX=$((max - 1))
    else
        ACTION_INDEX=$(( (ACTION_INDEX + 1) % max ))
    fi
}

# Get action ID at current position
get_selected_action() {
    local actions=($(get_current_action_list))
    echo "${actions[$ACTION_INDEX]}"
}
```

**Pattern**: Every navigation function:
1. Updates the relevant `*_INDEX` variable
2. Resets `ACTION_INDEX` when changing context
3. Uses modulo arithmetic for wrapping

---

## 5. Action System (bash/tetra/actions/)

### registry.sh - Metadata

```bash
#!/usr/bin/env bash

# Declare actions with metadata

declare_action() {
    local action_id="$1"
    shift
    
    # Create associative array for action metadata
    declare -gA "ACTION_${action_id//-/_}"
    local -n action_def="ACTION_${action_id//-/_}"
    
    # Parse key=value pairs
    while [[ $# -gt 0 ]]; do
        local key="${1%%=*}"
        local value="${1#*=}"
        action_def["$key"]="$value"
        shift
    done
}

# Example declarations
declare_action "view_env" \
    "verb=view" \
    "noun=env" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "tes_operation=read"

declare_action "fetch_config" \
    "verb=fetch" \
    "noun=config" \
    "output=@tui[content]" \
    "source_at=@remote" \
    "target_at=@local" \
    "tes_operation=read"
```

### actions_impl.sh - Implementation

```bash
#!/usr/bin/env bash

# Action functions - simple input → output

action_view_env() {
    local env="$1"
    echo "Environment: $env"
    echo "Available in context: ${ENVIRONMENTS[$ENV_INDEX]}"
}

action_fetch_config() {
    local env="$1"
    # Get config from remote
    echo "Fetching config from $env..."
    # Implementation details
}

# Each action follows the pattern:
# 1. Takes environment/context as argument
# 2. Returns output to stdout
# 3. No rendering logic (renderer handles coloring/formatting)
# 4. No side effects (or very minimal)
```

### executor.sh - Dispatch

```bash
#!/usr/bin/env bash

execute_action() {
    local action_id="$1"
    local env="$2"
    
    # Convert action_id to function name
    local func_name="action_${action_id//:/_}"
    
    # Check if function exists
    if declare -f "$func_name" >/dev/null 2>&1; then
        # Execute and capture output
        local output=$("$func_name" "$env" 2>&1)
        local exit_code=$?
        
        # Store in buffer for rendering
        TUI_BUFFERS["@tui[content]"]="$output"
        return $exit_code
    else
        echo "Error: Unknown action: $action_id"
        return 1
    fi
}
```

---

## 6. Main Render Loop (bash/tetra/tui/renderer.sh)

```bash
#!/usr/bin/env bash

# 250-line main loop combining all systems

tui_main_loop() {
    local exit_flag=false
    
    while [[ "$exit_flag" != "true" ]]; do
        # ===== INPUT =====
        read -n1 -s -t 0.1 key || key=""
        
        # ===== STATE UPDATE =====
        case "$key" in
            'e') navigate_env ;;      # E for environment
            'E') navigate_env_back ;;
            'm') navigate_mode ;;     # M for mode
            'M') navigate_mode_back ;;
            'j'|'k') navigate_action ;;
            $'\n') execute_selected_action ;;
            'q') exit_flag=true ;;
            '?') show_help ;;
            '/') enter_repl_mode ;;
        esac
        
        # ===== RENDERING =====
        tui_buffer_init
        
        # Render each component
        render_header_to_buffer
        render_action_line_to_buffer
        render_content_to_buffer
        render_footer_to_buffer
        
        # ===== OUTPUT =====
        tui_buffer_flush
    done
}

render_header_to_buffer() {
    local env=$(get_current_env)
    local mode=$(get_current_mode)
    
    # Line 1: Title
    tui_write_header 0 "${COLOR_BOLD}TETRA${COLOR_RESET} | ${env} × ${mode}"
    
    # Line 2: Environment selector
    local env_line="Environments: "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            env_line+="${COLOR_BOLD}[${ENVIRONMENTS[$i]}]${COLOR_RESET} "
        else
            env_line+="${ENVIRONMENTS[$i]} "
        fi
    done
    tui_write_header 1 "$env_line"
    
    # Line 3: Mode selector
    local mode_line="Modes: "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            mode_line+="${COLOR_BOLD}[${MODES[$i]}]${COLOR_RESET} "
        else
            mode_line+="${MODES[$i]} "
        fi
    done
    tui_write_header 2 "$mode_line"
}

render_action_line_to_buffer() {
    local actions=($(get_current_action_list))
    local action_line="Actions: "
    
    for i in "${!actions[@]}"; do
        local action="${actions[$i]}"
        if [[ $i -eq $ACTION_INDEX ]]; then
            action_line+="${COLOR_BOLD}[${action}]${COLOR_RESET} "
        else
            action_line+="${action} "
        fi
    done
    
    # This goes into content buffer (after separator)
    TUI_BUFFERS["@tui[action_line]"]="$action_line"
}

render_content_to_buffer() {
    # Content was populated by execute_action()
    # Just format it with proper spacing
    if [[ -n "${TUI_BUFFERS[@tui[content]]}" ]]; then
        # Viewport: respect scroll offset
        local lines=()
        mapfile -t lines < <(echo "${TUI_BUFFERS[@tui[content]]}")
        
        local viewport=""
        local max_lines=$((LINES - 10))  # Leave room for header/footer
        
        for ((i=SCROLL_OFFSET; i<SCROLL_OFFSET+max_lines && i<${#lines[@]}; i++)); do
            viewport+="${lines[$i]}
"
        done
        
        TUI_BUFFERS["@tui[content]"]="$viewport"
    fi
}

render_footer_to_buffer() {
    local status_line=""
    local action_count=$(get_max_actions)
    
    status_line+="[${COLOR_CYAN}env${COLOR_RESET}:${ENV_INDEX+1}] "
    status_line+="[${COLOR_CYAN}mode${COLOR_RESET}:${MODE_INDEX+1}] "
    status_line+="[${COLOR_CYAN}action${COLOR_RESET}:${ACTION_INDEX+1}/$action_count] "
    status_line+="| ${COLOR_DIM}q:quit h:help /:repl${COLOR_RESET}"
    
    tui_write_footer "$status_line"
}

execute_selected_action() {
    local action_id=$(get_selected_action)
    local env=$(get_current_env)
    
    execute_action "$action_id" "$env"
}
```

---

## 7. REPL Interface (bash/tetra/interfaces/repl.sh)

```bash
#!/usr/bin/env bash

# Thin wrapper around orchestrator

tetra_repl() {
    local prompt
    local input
    
    while true; do
        # Build dynamic prompt
        prompt="[$(tetra_get_org) × $(tetra_get_env) × $(tetra_get_mode)] tetra> "
        
        # Read line (using readline/history)
        read -e -r -p "$prompt" input
        
        [[ -z "$input" ]] && continue
        
        # Dispatch
        tetra_repl_process_line "$input" || break
    done
}

tetra_repl_process_line() {
    local line="$1"
    
    if [[ "$line" == /* ]]; then
        # Slash commands
        local cmd="${line#/}"
        local cmd_name="${cmd%% *}"
        local cmd_args="${cmd#* }"
        [[ "$cmd_name" == "$cmd" ]] && cmd_args=""
        
        case "$cmd_name" in
            org)
                if [[ -n "$cmd_args" ]]; then
                    tetra_set_org "$cmd_args"
                else
                    echo "Organization: $(tetra_get_org)"
                fi
                ;;
            env)
                if [[ -n "$cmd_args" ]]; then
                    tetra_set_env "$cmd_args"
                else
                    echo "Environment: $(tetra_get_env)"
                fi
                ;;
            mode)
                if [[ -n "$cmd_args" ]]; then
                    tetra_set_mode "$cmd_args"
                else
                    echo "Mode: $(tetra_get_mode)"
                fi
                ;;
            help|h)
                tetra_repl_help
                ;;
            exit|quit|q)
                return 1  # Signal exit
                ;;
            *)
                echo "Unknown: /$cmd_name (try /help)"
                ;;
        esac
    else
        # Regular action dispatch to orchestrator
        tetra_dispatch_action "$line"
    fi
    
    return 0  # Continue loop
}

tetra_repl_help() {
    cat <<'EOF'
TETRA REPL - Quick Reference

Commands:
  /org [name]     Get or set organization
  /env [env]      Get or set environment
  /mode [mode]    Get or set mode
  /help           Show this help
  /exit, /quit    Exit REPL

Actions:
  verb:noun       Execute action (e.g., view:env, fetch:config)
                  Actions vary by context

Context:
  Currently in [org × env × mode] context
  Use /org, /env, /mode to change
EOF
}
```

---

## 8. Key Design Rules

### Rule 1: Separation of Concerns
- **TUI Layer** (`bash/tui/`, `bash/tetra/interfaces/`): I/O, state, rendering
- **Orchestrator** (`bash/tetra/`): Context, action dispatch, business logic
- **Modules** (`bash/*/tview/`): Module-specific actions (via `get_actions()`)

**Test**: If TUI code calls a system command (ssh, curl, etc.), you've violated this.

### Rule 2: State is Simple
- Global state: `ENV_INDEX`, `MODE_INDEX`, `ACTION_INDEX`, display flags
- Everything else is computed from these
- Navigation always follows: `(index ± 1) % array_length`
- No side effects in state updates

**Test**: If you're managing more than 10 global variables, refactor.

### Rule 3: Colors Are Consistent
- Define once in `color_core.sh`
- Use variables always: `${COLOR_RED}text${COLOR_RESET}`
- Never hardcode ANSI escapes
- Semantic names for meaning: `ENV_PROD_COLOR`, `STATUS_ERROR`

**Test**: Grep for `\033\[` - should find nothing except in color_core.sh

### Rule 4: Rendering is Buffered
- All writes go to `TUI_BUFFERS` associative array
- Single `tui_buffer_flush()` at end of render loop
- No terminal writes during state updates or calculations
- Animation (oscillator) computes values, doesn't write terminal

**Test**: No `printf` or `echo` in navigation/state code, only in buffer writes.

### Rule 5: Actions are Pure Functions
- Input: environment/context
- Output: text (stdout) or status code
- No rendering logic
- No global state mutations
- Easy to test in isolation

**Test**: Can you call the action function in a subprocess? If yes, it's pure.

### Rule 6: Extensibility via Discovery
- New module provides `bash/*/tview/actions.sh` with `get_actions(env, mode)`
- TUI loads dynamically via `get_module_actions()`
- No hardcoded list of actions
- Each module self-contained

**Test**: Can you add a new module without editing tview code? If yes, extensibility works.

---

## 9. Configuration (tui.conf)

```bash
#!/usr/bin/env bash

# TUI Configuration - can be overridden by calling code

# Navigation contexts (usually from orchestrator)
export ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
export MODES=("Inspect" "Transfer" "Execute")

# Display
export TUI_HEADER_LINES=3
export TUI_FOOTER_LINES=2
export TUI_MIN_CONTENT_HEIGHT=10

# Animation (optional)
export TUI_ANIMATION_ENABLED=true
export TUI_ANIMATION_SPEED=50  # milliseconds per frame

# Colors (optional - can be overridden)
export TUI_THEME="default"  # or "high-contrast", "monochrome"
```

---

## 10. Implementation Checklist

```
Phase 1: Core Infrastructure
[ ] bash/tui/colors/ - color_core.sh, color_semantic.sh
[ ] bash/tui/buffer.sh - double buffering
[ ] bash/tui/typography.sh - bold, dim, underline
[ ] bash/tetra/tui/state.sh - minimal state

Phase 2: Navigation & Input
[ ] bash/tui/gamepad_input.sh - single-key input
[ ] bash/tetra/tui/navigation.sh - env, mode, action navigation
[ ] bash/tetra/tui/renderer.sh - main loop (copy from demo/014)

Phase 3: Action System
[ ] bash/tetra/actions/registry.sh - declare_action()
[ ] bash/tetra/actions/actions_impl.sh - action_verb_noun() functions
[ ] bash/tetra/actions/executor.sh - execute_action() dispatcher
[ ] bash/tetra/actions/module_discovery.sh - get_module_actions()

Phase 4: REPL & Orchestrator Integration
[ ] bash/tetra/interfaces/repl.sh - REPL loop (refactor from tview)
[ ] bash/tetra/orchestrator.sh - context management
[ ] bash/tetra/dispatcher.sh - action dispatch

Phase 5: Module Integration
[ ] Verify each module has bash/MODULE/tview/actions.sh
[ ] Each module implements get_actions(env, mode)
[ ] Each module implements action functions
```

---

## Conclusion

This canonical design:
- **Simplifies** from 45 files → ~10 core files
- **Clarifies** concerns: TUI handles I/O, orchestrator handles business logic
- **Improves** testability: actions are pure functions
- **Enables** extensibility: modules self-register
- **Reduces** bugs: minimal state, predictable navigation
- **Increases** maintainability: clear separation, simple patterns

