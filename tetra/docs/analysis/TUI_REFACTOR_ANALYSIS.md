# Tetra TUI Refactor Analysis

**Document Type:** Analysis
**Date:** 2025-11-04
**Location:** `/Users/mricos/src/devops/tetra/bash/docs/TUI_REFACTOR_ANALYSIS.md`

## Purpose

Analysis of the current Tetra TUI architecture and proposed refactoring to create a **REPL-centric** design where the REPL changes according to mode, with a fixed layout positioning the REPL on line 5 and status information right-justified at the top.

---

## Current Architecture Analysis

### Component Structure

The current TUI system is split across two main directories:

**`tcurses/` - Low-level terminal primitives:**
- `tcurses_screen.sh` - Terminal setup/teardown, dimensions, cursor control
- `tcurses_repl.sh` - REPL input handling, history, editing (Emacs-style keybindings)
- `tcurses_input.sh` - Raw input reading, key constants
- `tcurses_completion.sh` - TAB completion system
- `tcurses_buffer.sh` - Screen buffer management
- `tcurses_readline.sh` - Readline-like editing

**`repl/` - High-level REPL implementations:**
- `trepl.sh` - Universal REPL launcher with module registry
- `tui_repl.sh` - Character-by-character TUI REPL
- `mode_repl.sh` - Mode-switching REPL with Ctrl-Tab navigation
- Module-specific REPLs (org_repl, rag_repl, tdocs_repl, etc.)

### Current Strengths

1. **Separation of concerns:** Low-level terminal control separated from high-level REPL logic
2. **Reusable components:** tcurses components are modular and exportable
3. **Rich input handling:** Full Emacs-style editing keybindings (Ctrl-A/E/K/W, etc.)
4. **Mode awareness:** mode_repl.sh has context management (env × mode)
5. **Module registry:** trepl.sh provides centralized REPL discovery
6. **History support:** Command history with up/down navigation

### Current Weaknesses

1. **No fixed screen layout:** REPLs don't have consistent positioning
2. **Status display unclear:** No standardized status bar or header
3. **REPL not centered:** No design principle around REPL as focal point
4. **Mode handling fragmented:** Mode logic exists but not consistently applied
5. **Multiple REPL styles:** tui_repl vs mode_repl vs individual module REPLs
6. **No screen regions:** No defined regions for header/status/content/REPL/footer
7. **Inconsistent rendering:** Each REPL handles its own screen management

---

## Design Goals for Refactor

### 1. REPL-Centric Design

**Principle:** The REPL is the primary interaction point. Everything else (status, content, hints) is contextual decoration around the REPL.

**Implications:**
- REPL has a **fixed position** on screen (line 5)
- REPL prompt **changes based on mode** (module marker, context, temperature)
- Content above REPL shows **mode-specific information**
- Content below REPL shows **command output/responses**

### 2. Fixed Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Line 1: ⬡ TETRA                        status:tetra [Right]     │ ← Header
│ Line 2: [Local × Browse × tdocs]                                │ ← Context
│ Line 3: [Mode-specific content line 1]                          │ ← Content
│ Line 4: [Mode-specific content line 2]                          │ ← Content
│ Line 5: 📄 tdocs > /ls --core_                                  │ ← REPL (FIXED)
│ Line 6: [Response/output line 1]                                │ ← Response
│ Line 7: [Response/output line 2]                                │ ← Response
│ ...                                                              │
│ Line N-2: ┌─ COMMAND LOG ──────────────────────────────────┐   │ ← Log
│ Line N-1: │ /list:files @dev • 1730760123 • [TAS+TES]      │   │ ← Log
│ Line N:   │ timestamp.rag.query.code.json • [TRS]          │   │ ← Log
└─────────────────────────────────────────────────────────────────┘
```

**Alternative Layout with Side Log:**
```
┌──────────────────────────────┬──────────────────────────┐
│ ⬡ TETRA          status:tetra│  ┌─ COMMAND LOG ───────┐ │
│ [Local × Browse × tdocs]     │  │ /send:msg @prod      │ │
│ Recent: README.md, SPEC.md   │  │ [TAS+TES] 14:32:03   │ │
│ Tags: arch(12) | ref(8)      │  │                      │ │
│ 📄 tdocs > /ls --core_       │  │ 1730.rag.query.json  │ │
│ core/database.sh             │  │ [TRS] 14:31:45       │ │
│ core/metadata.sh             │  │                      │ │
│ ...                          │  │ deploy-prod-20251104 │ │
│ [modules] | Ctrl-Tab=next    │  │ [TTS] 14:30:12       │ │
└──────────────────────────────┴──────────────────────────┘
    Main Content (70%)              Log Panel (30%)
```

### 3. Mode-Driven REPL

The REPL changes its:
- **Prompt** based on current module (marker + name)
- **Completion** based on module commands
- **Command processing** delegated to module
- **Temperature indicator** shows module state

Example prompts by mode:
```bash
# tdocs module
📄 tdocs [Local:Browse]> /ls --core

# rag module
🔍 rag [Local:Query]> /flow start

# org module
🏢 org [Prod:Deploy]> /env list
```

### 4. Themed Status Display

**Top-right status:** `status:tetra` in themed color (TDS tokens)

**Status format:**
```
status:<state>
```

States:
- `tetra` - Normal operation
- `thinking` - Processing command
- `error` - Error state
- `waiting` - Waiting for input
- `mode:<name>` - Special mode active

**TDS Tokens:**
```bash
tui.status.normal    # Green or theme primary
tui.status.thinking  # Yellow/amber
tui.status.error     # Red
tui.status.waiting   # Dim/gray
```

---

## Proposed Refactored Architecture

### Component Hierarchy

```
tui/
├── tui_core.sh              # Core TUI manager (NEW)
│   ├── tui_init()           # Initialize TUI system
│   ├── tui_set_mode()       # Set current mode/module
│   ├── tui_render_frame()   # Render complete frame
│   └── tui_main_loop()      # Main event loop
│
├── tui_layout.sh            # Screen layout manager (NEW)
│   ├── Layout constants (HEADER_ROW, REPL_ROW=5, etc.)
│   ├── tui_layout_header()  # Render header (line 1)
│   ├── tui_layout_context() # Render context (line 2)
│   ├── tui_layout_content() # Render mode content (lines 3-4)
│   ├── tui_layout_repl()    # Render REPL (line 5)
│   ├── tui_layout_response()# Render response (lines 6+)
│   └── tui_layout_footer()  # Render footer (bottom)
│
├── tui_status.sh            # Status bar management (NEW)
│   ├── tui_status_set()     # Set status state
│   ├── tui_status_render()  # Render status (right-justified)
│   └── Status state tracking
│
├── tui_log.sh               # Command log with format detection (NEW)
│   ├── tui_log_add()        # Add command to log
│   ├── tui_log_parse()      # Parse for TES/TAS/TRS/TTS formats
│   ├── tui_log_render()     # Render log panel/footer
│   └── tui_log_clear()      # Clear log history
│
└── tui_mode.sh              # Mode/module integration (REFACTORED)
    ├── tui_mode_register()  # Register module REPL
    ├── tui_mode_set()       # Switch to module
    ├── tui_mode_get_prompt()# Get module's prompt
    └── tui_mode_process()   # Process command via module

tcurses/                     # Keep existing, minimal changes
├── tcurses_screen.sh        # Terminal control (unchanged)
├── tcurses_input.sh         # Input reading (unchanged)
├── tcurses_repl.sh          # REPL editing (unchanged)
└── tcurses_completion.sh    # Completion (unchanged)

repl/
├── trepl.sh                 # REFACTOR: Use tui_core
├── mode_repl.sh             # MERGE into tui_mode.sh
└── <module>_repl.sh         # REFACTOR: Register with tui_mode
```

### New Core Components

#### 1. `tui_core.sh` - Central TUI Manager

**Responsibilities:**
- Initialize/cleanup TUI system
- Manage current mode/module
- Coordinate rendering pipeline
- Main event loop
- State management

**Key Functions:**

```bash
# Initialize TUI system
# Sets up terminal, loads modules, sets default mode
tui_init() {
    tcurses_screen_init
    tui_layout_init
    tui_status_init
    tui_mode_load_registry
    tui_mode_set "${1:-tdocs}"  # Default module
}

# Set current mode/module
tui_set_mode() {
    local module="$1"
    TUI_CURRENT_MODULE="$module"
    tui_mode_set "$module"
    tui_render_frame
}

# Render complete frame
tui_render_frame() {
    tcurses_screen_move_cursor 1 1
    tui_layout_header
    tui_layout_context
    tui_layout_content
    tui_layout_repl
    tui_layout_response
    tui_layout_footer
}

# Main event loop
tui_main_loop() {
    while true; do
        tui_render_frame
        local key=$(tcurses_input_read_key_blocking)
        tui_handle_key "$key" || break
    done
    tui_cleanup
}
```

**State Variables:**
```bash
declare -g TUI_CURRENT_MODULE="tdocs"
declare -g TUI_CURRENT_ENV="Local"
declare -g TUI_CURRENT_MODE="Browse"
declare -g TUI_STATUS_STATE="tetra"
declare -g TUI_LAST_RESPONSE=""
```

#### 2. `tui_layout.sh` - Fixed Layout Manager

**Responsibilities:**
- Define screen regions (constants)
- Render each region independently
- Handle dynamic sizing within regions
- Coordinate with mode for content

**Layout Constants:**
```bash
# Fixed row positions
declare -gr TUI_HEADER_ROW=1
declare -gr TUI_CONTEXT_ROW=2
declare -gr TUI_CONTENT_START_ROW=3
declare -gr TUI_REPL_ROW=5        # FIXED: REPL always on line 5
declare -gr TUI_RESPONSE_START_ROW=6

# Dynamic calculations
TUI_CONTENT_HEIGHT=2              # Lines 3-4
TUI_RESPONSE_HEIGHT=$((HEIGHT - 8))  # Remaining space
TUI_FOOTER_START_ROW=$((HEIGHT - 1))
```

**Key Functions:**

```bash
# Render header (line 1)
tui_layout_header() {
    tcurses_screen_move_cursor $TUI_HEADER_ROW 1

    # Left side: logo/brand
    tds_text_color "tui.brand"
    printf "⬡ TETRA"
    reset_color

    # Right side: status
    tui_status_render
}

# Render context (line 2)
tui_layout_context() {
    tcurses_screen_move_cursor $TUI_CONTEXT_ROW 1

    tds_text_color "tui.context.bracket"
    printf "["
    tds_text_color "tui.context.env"
    printf "%s" "$TUI_CURRENT_ENV"
    tds_text_color "tui.context.separator"
    printf " × "
    tds_text_color "tui.context.mode"
    printf "%s" "$TUI_CURRENT_MODE"
    tds_text_color "tui.context.separator"
    printf " × "
    tds_text_color "tui.context.module"
    printf "%s" "$TUI_CURRENT_MODULE"
    tds_text_color "tui.context.bracket"
    printf "]"
    reset_color
}

# Render mode-specific content (lines 3-4)
tui_layout_content() {
    # Delegate to current module
    if declare -f "${TUI_CURRENT_MODULE}_tui_content" >/dev/null 2>&1; then
        "${TUI_CURRENT_MODULE}_tui_content" $TUI_CONTENT_START_ROW $TUI_CONTENT_HEIGHT
    else
        # Default: blank
        tcurses_screen_move_cursor $TUI_CONTENT_START_ROW 1
        printf "\n"
    fi
}

# Render REPL (line 5) - ALWAYS LINE 5
tui_layout_repl() {
    tcurses_screen_move_cursor $TUI_REPL_ROW 1

    # Get module's prompt
    local prompt=$(tui_mode_get_prompt)

    # Render REPL input line
    printf "%s%s" "$prompt" "$REPL_INPUT"

    # Cursor indicator
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        printf "█"  # Block cursor
    else
        printf "_"  # End cursor
    fi
}

# Render response area (lines 6+)
tui_layout_response() {
    local start_row=$TUI_RESPONSE_START_ROW

    # Show last response
    if [[ -n "$TUI_LAST_RESPONSE" ]]; then
        local line_num=0
        while IFS= read -r line && [[ $line_num -lt $TUI_RESPONSE_HEIGHT ]]; do
            tcurses_screen_move_cursor $((start_row + line_num)) 1
            printf "%s" "$line"
            ((line_num++))
        done <<< "$TUI_LAST_RESPONSE"
    fi
}

# Render footer (bottom lines)
tui_layout_footer() {
    tcurses_screen_move_cursor $TUI_FOOTER_START_ROW 1

    tds_text_color "tui.footer.dim"

    # Module tabs (if multiple available)
    printf "["
    # Show available modules with current highlighted
    # ...
    printf "] | "

    # Keybindings hint
    printf "Ctrl-Tab=next | ESC=menu | Ctrl-D=exit"
    reset_color
}
```

#### 3. `tui_status.sh` - Status Display Manager

**Responsibilities:**
- Track status state
- Render right-justified status
- Apply theming

**Key Functions:**

```bash
# Set status
tui_status_set() {
    local state="$1"
    TUI_STATUS_STATE="$state"
}

# Render status (right-justified on header row)
tui_status_render() {
    local status_text="status:${TUI_STATUS_STATE}"
    local width=$(tcurses_screen_width)
    local status_len=${#status_text}
    local position=$((width - status_len))

    # Move to right side
    tcurses_screen_move_cursor $TUI_HEADER_ROW $position

    # Apply themed color
    case "$TUI_STATUS_STATE" in
        tetra)    tds_text_color "tui.status.normal" ;;
        thinking) tds_text_color "tui.status.thinking" ;;
        error)    tds_text_color "tui.status.error" ;;
        waiting)  tds_text_color "tui.status.waiting" ;;
        *)        tds_text_color "tui.status.normal" ;;
    esac

    printf "%s" "$status_text"
    reset_color
}

# Get current status
tui_status_get() {
    echo "$TUI_STATUS_STATE"
}
```

#### 4. `tui_mode.sh` - Mode/Module Integration

**Responsibilities:**
- Module registration
- Mode switching
- Prompt generation
- Command delegation

**Key Functions:**

```bash
# Module registry
declare -gA TUI_MODE_REGISTRY=()
declare -gA TUI_MODE_PROMPTS=()
declare -gA TUI_MODE_HANDLERS=()

# Register a module
tui_mode_register() {
    local module="$1"
    local prompt_fn="$2"     # Function to generate prompt
    local handler_fn="$3"    # Function to process commands

    TUI_MODE_REGISTRY["$module"]=1
    TUI_MODE_PROMPTS["$module"]="$prompt_fn"
    TUI_MODE_HANDLERS["$module"]="$handler_fn"
}

# Set current module
tui_mode_set() {
    local module="$1"

    if [[ -z "${TUI_MODE_REGISTRY[$module]}" ]]; then
        echo "Unknown module: $module" >&2
        return 1
    fi

    TUI_CURRENT_MODULE="$module"

    # Load module's temperature/state if needed
    if declare -f "${module}_load_temperature" >/dev/null 2>&1; then
        "${module}_load_temperature"
    fi
}

# Get module's prompt
tui_mode_get_prompt() {
    local prompt_fn="${TUI_MODE_PROMPTS[$TUI_CURRENT_MODULE]}"

    if [[ -n "$prompt_fn" ]] && declare -f "$prompt_fn" >/dev/null 2>&1; then
        "$prompt_fn"
    else
        # Default prompt
        echo "▶ "
    fi
}

# Process command via module
tui_mode_process() {
    local input="$1"
    local handler_fn="${TUI_MODE_HANDLERS[$TUI_CURRENT_MODULE]}"

    if [[ -n "$handler_fn" ]] && declare -f "$handler_fn" >/dev/null 2>&1; then
        TUI_LAST_RESPONSE=$("$handler_fn" "$input")
    else
        TUI_LAST_RESPONSE="No handler for module: $TUI_CURRENT_MODULE"
    fi
}

# Load module registry from trepl
tui_mode_load_registry() {
    # Source trepl to get TREPL_REGISTRY
    source "$TETRA_SRC/bash/repl/trepl.sh"

    # Register each module
    for module in "${!TREPL_REGISTRY[@]}"; do
        # Default registrations
        tui_mode_register "$module" \
            "${module}_build_prompt" \
            "${module}_process_command"
    done
}
```

#### 5. `tui_log.sh` - Command Log with Format Detection

**Responsibilities:**
- Track command history
- Detect and parse TES, TAS, TRS, TTS formats
- Render log panel with syntax highlighting
- Provide log filtering and search

**Key Functions:**

```bash
# Log entry structure
declare -ga TUI_LOG_ENTRIES=()      # Array of log entries
declare -g TUI_LOG_MAX_SIZE=100     # Max log entries

# Log entry format: "timestamp|command|formats|module"
# Example: "1730760123|/send:msg @prod|TAS+TES|org"

# Add command to log
tui_log_add() {
    local command="$1"
    local timestamp=$(date +%s)
    local module="$TUI_CURRENT_MODULE"

    # Parse command for Tetra formats
    local formats=$(tui_log_parse "$command")

    # Create log entry
    local entry="${timestamp}|${command}|${formats}|${module}"

    # Add to log
    TUI_LOG_ENTRIES+=("$entry")

    # Trim if over max size
    if [[ ${#TUI_LOG_ENTRIES[@]} -gt $TUI_LOG_MAX_SIZE ]]; then
        TUI_LOG_ENTRIES=("${TUI_LOG_ENTRIES[@]: -$TUI_LOG_MAX_SIZE}")
    fi
}

# Parse command for Tetra format signatures
tui_log_parse() {
    local command="$1"
    local -a detected=()

    # TES Detection: @endpoint patterns
    # Telltale signs: @local, @dev, @staging, @prod, @<name>
    if [[ "$command" =~ @[a-zA-Z0-9_-]+ ]]; then
        detected+=("TES")
    fi

    # TAS Detection: /action:noun patterns
    # Telltale signs: /action:noun, /action::contract:noun, /module.action:noun
    if [[ "$command" =~ /[a-zA-Z_]+(::|:)[a-zA-Z_]+ ]]; then
        detected+=("TAS")
    fi

    # TRS Detection: timestamp.module.type.kind.format patterns
    # Telltale signs: numeric timestamp + dots + file extension
    if [[ "$command" =~ [0-9]{10,}\.[a-z]+\.[a-z]+.*\.[a-z]{2,4} ]]; then
        detected+=("TRS")
    fi

    # TTS Detection: transaction slug-timestamp patterns
    # Telltale signs: {slug}-{timestamp} or state.json or events.ndjson
    if [[ "$command" =~ [a-z-]+-[0-9]{8}T[0-9]{6} ]] || \
       [[ "$command" =~ state\.json|events\.ndjson ]]; then
        detected+=("TTS")
    fi

    # Return formats joined with +
    if [[ ${#detected[@]} -gt 0 ]]; then
        local IFS='+'
        echo "${detected[*]}"
    else
        echo "CMD"  # Generic command
    fi
}

# Render log in footer (compact mode)
tui_log_render_footer() {
    local num_entries="${1:-3}"  # Show last N entries
    local width=$(tcurses_screen_width)
    local start_row=$(($(tcurses_screen_height) - num_entries))

    # Get last N entries
    local total=${#TUI_LOG_ENTRIES[@]}
    local start_idx=$((total > num_entries ? total - num_entries : 0))

    # Render each entry
    local row=$start_row
    for ((i=start_idx; i<total; i++)); do
        local entry="${TUI_LOG_ENTRIES[$i]}"
        IFS='|' read -r timestamp command formats module <<< "$entry"

        # Format: command • time • [FORMATS]
        local time_str=$(date -r "$timestamp" '+%H:%M:%S' 2>/dev/null || echo "$timestamp")

        # Truncate command if too long
        local max_cmd_len=$((width - 30))
        if [[ ${#command} -gt $max_cmd_len ]]; then
            command="${command:0:$((max_cmd_len-3))}..."
        fi

        # Move to position
        tcurses_screen_move_cursor $row 1

        # Render with format highlighting
        tds_text_color "tui.log.command"
        printf "%s" "$command"
        reset_color

        tds_text_color "tui.log.separator"
        printf " • "
        reset_color

        tds_text_color "tui.log.time"
        printf "%s" "$time_str"
        reset_color

        tds_text_color "tui.log.separator"
        printf " • "
        reset_color

        # Format badges with colors
        tui_log_render_format_badge "$formats"

        ((row++))
    done
}

# Render log in side panel (full mode)
tui_log_render_panel() {
    local panel_width="${1:-30}"      # Panel width in columns
    local panel_height="${2:-20}"     # Panel height in rows
    local panel_x="${3:-$(($(tcurses_screen_width) - panel_width))}"
    local panel_y="${4:-3}"           # Start below header

    # Draw panel border
    tds_text_color "tui.log.border"
    tcurses_screen_move_cursor $panel_y $panel_x
    printf "┌─ COMMAND LOG "
    printf '%*s' $((panel_width - 16)) '' | tr ' ' '─'
    printf "┐"

    # Render entries
    local total=${#TUI_LOG_ENTRIES[@]}
    local start_idx=$((total > panel_height - 2 ? total - (panel_height - 2) : 0))

    local row=$((panel_y + 1))
    for ((i=start_idx; i<total; i++)); do
        local entry="${TUI_LOG_ENTRIES[$i]}"
        IFS='|' read -r timestamp command formats module <<< "$entry"

        tcurses_screen_move_cursor $row $panel_x
        printf "│ "

        # Truncate command to fit panel
        local max_len=$((panel_width - 4))
        if [[ ${#command} -gt $max_len ]]; then
            command="${command:0:$((max_len-3))}..."
        fi

        tds_text_color "tui.log.command"
        printf "%-${max_len}s" "$command"
        reset_color

        printf " │"

        # Next line: format badge and time
        ((row++))
        tcurses_screen_move_cursor $row $panel_x
        printf "│ "

        tui_log_render_format_badge "$formats"

        local time_str=$(date -r "$timestamp" '+%H:%M:%S' 2>/dev/null || echo "??:??:??")
        tds_text_color "tui.log.time"
        printf " %s" "$time_str"
        reset_color

        # Pad to panel width
        local used=$((${#formats} + 10))
        printf "%*s │" $((panel_width - used - 4)) ""

        ((row++))
    done

    # Bottom border
    tcurses_screen_move_cursor $((panel_y + panel_height - 1)) $panel_x
    printf "└"
    printf '%*s' $((panel_width - 2)) '' | tr ' ' '─'
    printf "┘"
    reset_color
}

# Render format badge with color coding
tui_log_render_format_badge() {
    local formats="$1"

    # Split formats by +
    IFS='+' read -ra parts <<< "$formats"

    printf "["
    local first=true
    for format in "${parts[@]}"; do
        [[ "$first" == "false" ]] && printf "+"
        first=false

        # Color based on format type
        case "$format" in
            TES)
                tds_text_color "tui.log.format.tes"
                printf "TES"
                ;;
            TAS)
                tds_text_color "tui.log.format.tas"
                printf "TAS"
                ;;
            TRS)
                tds_text_color "tui.log.format.trs"
                printf "TRS"
                ;;
            TTS)
                tds_text_color "tui.log.format.tts"
                printf "TTS"
                ;;
            CMD)
                tds_text_color "tui.log.format.cmd"
                printf "CMD"
                ;;
            *)
                printf "%s" "$format"
                ;;
        esac
        reset_color
    done
    printf "]"
}

# Clear log
tui_log_clear() {
    TUI_LOG_ENTRIES=()
}

# Get log entries matching format
tui_log_filter() {
    local format="$1"

    for entry in "${TUI_LOG_ENTRIES[@]}"; do
        IFS='|' read -r timestamp command formats module <<< "$entry"
        if [[ "$formats" =~ $format ]]; then
            echo "$entry"
        fi
    done
}

# Export log to file
tui_log_export() {
    local output_file="${1:-$TETRA_DIR/logs/tui_session_$(date +%s).log}"

    {
        echo "# Tetra TUI Command Log"
        echo "# Generated: $(date)"
        echo ""

        for entry in "${TUI_LOG_ENTRIES[@]}"; do
            IFS='|' read -r timestamp command formats module <<< "$entry"
            local time_str=$(date -r "$timestamp" '+%Y-%m-%d %H:%M:%S')
            printf "[%s] [%s] [%s] %s\n" "$time_str" "$module" "$formats" "$command"
        done
    } > "$output_file"

    echo "Log exported to: $output_file"
}
```

**State Variables:**
```bash
declare -ga TUI_LOG_ENTRIES=()      # Log entries array
declare -g TUI_LOG_MAX_SIZE=100     # Max entries to keep
declare -g TUI_LOG_MODE="footer"    # Display mode: footer, panel, hidden
declare -g TUI_LOG_PANEL_WIDTH=30   # Panel width if mode=panel
```

**Format Detection Patterns:**

| Format | Telltale Signs | Example | Pattern |
|--------|---------------|---------|---------|
| **TES** | `@endpoint` | `@prod`, `@staging` | `@[a-zA-Z0-9_-]+` |
| **TAS** | `/action:noun` | `/send:msg`, `/list:files` | `/[a-zA-Z_]+:` |
| **TAS+Contract** | `/action::contract:noun` | `/send::auth:msg` | `/[a-zA-Z_]+::[a-zA-Z_]+:` |
| **TRS** | `timestamp.attrs.ext` | `1730760123.rag.query.json` | `[0-9]{10,}\.[a-z]+\.[a-z]+.*\.[a-z]{2,4}` |
| **TTS** | `slug-timestamp` | `deploy-20251104T143022` | `[a-z-]+-[0-9]{8}T[0-9]{6}` |
| **TTS+Files** | `state.json`, `events.ndjson` | Transaction state files | `state\.json\|events\.ndjson` |

**Integration with Command Processing:**

```bash
# In tui_core.sh main loop, after command execution:
tui_handle_key() {
    local key="$1"

    case "$key" in
        "$TCURSES_KEY_ENTER")
            local input="$REPL_INPUT"

            # Add to log BEFORE processing
            tui_log_add "$input"

            # Process command
            tui_mode_process "$input"

            # Re-render to show updated log
            tui_render_frame
            ;;
    esac
}
```

---

## Migration Strategy

### Phase 1: Create New Components (Non-Breaking)

1. **Create `tui/` directory structure:**
   ```bash
   mkdir -p bash/tui
   ```

2. **Implement core components:**
   - Write `tui_core.sh` with basic structure
   - Write `tui_layout.sh` with fixed layout
   - Write `tui_status.sh` with status rendering
   - Write `tui_mode.sh` with registration system

3. **Add TDS tokens:**
   ```bash
   # In tds/tokens/tui.sh
   tui.brand="#00D9FF"
   tui.status.normal="#00FF87"
   tui.status.thinking="#FFD700"
   tui.status.error="#FF5F5F"
   tui.status.waiting="#888888"
   tui.context.bracket="#666666"
   tui.context.env="#00D9FF"
   tui.context.mode="#AF87FF"
   tui.context.module="#FFD700"
   tui.context.separator="#666666"
   tui.footer.dim="#666666"

   # Log component colors
   tui.log.border="#5F87AF"
   tui.log.command="#FFFFFF"
   tui.log.time="#888888"
   tui.log.separator="#444444"

   # Format-specific badges
   tui.log.format.tes="#00D9FF"     # Cyan - endpoints
   tui.log.format.tas="#AF87FF"     # Purple - actions
   tui.log.format.trs="#FFD700"     # Yellow - records
   tui.log.format.tts="#FF87AF"     # Pink - transactions
   tui.log.format.cmd="#666666"     # Gray - generic
   ```

4. **Test in isolation:**
   - Create `bash/tui/demo.sh` to test layout
   - Verify line 5 REPL positioning
   - Test status right-alignment
   - Test mode switching

### Phase 2: Migrate One Module (Proof of Concept)

1. **Choose pilot module:** `tdocs` (good candidate - has REPL, well-defined)

2. **Refactor tdocs_repl.sh:**
   ```bash
   # OLD: tdocs_repl.sh defines full REPL loop
   # NEW: tdocs_repl.sh registers with tui_mode

   source "$TETRA_SRC/bash/tui/tui_mode.sh"

   # Define prompt builder
   tdocs_build_prompt() {
       local marker="📄"
       tds_text_color "tui.module.tdocs"
       printf "%s tdocs" "$marker"
       reset_color
       printf " > "
   }

   # Define command processor
   tdocs_process_command() {
       local input="$1"
       # Existing command processing logic
       # ...
   }

   # Define content renderer (optional)
   tdocs_tui_content() {
       local start_row="$1"
       local height="$2"
       # Render tdocs-specific content (recent docs, etc.)
   }

   # Register with TUI
   tui_mode_register "tdocs" \
       "tdocs_build_prompt" \
       "tdocs_process_command"
   ```

3. **Update trepl.sh:**
   ```bash
   # Launch via new TUI core instead of old REPL
   trepl_launch() {
       local module="$1"

       # Source TUI core
       source "$TETRA_SRC/bash/tui/tui_core.sh"

       # Initialize TUI with module
       tui_init "$module"

       # Run main loop
       tui_main_loop
   }
   ```

4. **Test pilot:**
   ```bash
   trepl tdocs
   # Should see:
   # Line 1: ⬡ TETRA                                    status:tetra
   # Line 2: [Local × Browse × tdocs]
   # Line 3-4: (tdocs content)
   # Line 5: 📄 tdocs > _
   # Line 6+: (response area)
   # Bottom: [tdocs | rag | org] | Ctrl-Tab=next | ESC=menu | Ctrl-D=exit
   ```

### Phase 3: Migrate Remaining Modules

1. **Migrate in order:**
   - rag_repl.sh
   - org_repl.sh
   - qa_repl.sh
   - (etc.)

2. **Each module needs:**
   - `<module>_build_prompt()` function
   - `<module>_process_command()` function
   - Optional: `<module>_tui_content()` for lines 3-4

3. **Update TREPL_REGISTRY** to point to new TUI-enabled REPLs

### Phase 4: Deprecate Old Components

1. **Mark as deprecated:**
   - `mode_repl.sh` → merged into `tui_mode.sh`
   - `tui_repl.sh` → replaced by `tui_core.sh`

2. **Update documentation:**
   - Update INTERACTIVE_UI_PATTERNS.md
   - Create TUI_ARCHITECTURE.md
   - Update module READMEs

3. **Remove after transition period:**
   - Archive old implementations
   - Clean up imports

---

## Example Usage (After Refactor)

### Starting a REPL

```bash
# Via trepl (unchanged interface)
trepl tdocs

# Direct TUI launch
source "$TETRA_SRC/bash/tui/tui_core.sh"
tui_init "tdocs"
tui_main_loop
```

### Screen Layout in Action

**With Footer Log (Default):**
```
⬡ TETRA                                                    status:tetra
[Local × Browse × tdocs]
Recent: README.md, SPEC.md, GUIDE.md
Tags: architecture(12) | reference(8) | tutorial(5)
📄 tdocs > /ls --core_
core/database.sh
core/metadata.sh
core/classify.sh

┌─ COMMAND LOG ──────────────────────────────────────────────────┐
│ /send:message @prod • 14:32:03 • [TAS+TES]                     │
│ 1730760123.rag.query.code.json • 14:31:45 • [TRS]              │
│ deploy-staging-20251104T143022 • 14:30:12 • [TTS]              │
└─────────────────────────────────────────────────────────────────┘
[tdocs | rag | org | qa] | Ctrl-Tab=next | Ctrl-L=log | Ctrl-D=exit
```

**With Side Panel Log (Ctrl-L to toggle):**
```
⬡ TETRA              status:tetra  ┌─ COMMAND LOG ───────┐
[Local × Browse × tdocs]           │ /send:msg @prod      │
Recent: README.md, SPEC.md         │ [TAS+TES] 14:32:03   │
Tags: arch(12) | ref(8)            │                      │
📄 tdocs > /view README_           │ /list:files @dev     │
README.md - Architecture docs      │ [TAS+TES] 14:31:58   │
Last modified: 2025-11-04          │                      │
                                   │ 1730.rag.query.json  │
[tdocs | rag | org] | Ctrl-Tab=... │ [TRS] 14:31:45       │
                                   │                      │
                                   │ deploy-staging-...   │
                                   │ [TTS] 14:30:12       │
                                   └──────────────────────┘
```

After switching to RAG module (Ctrl-Tab):

```
⬡ TETRA                                                 status:thinking
[Local × Query × rag]
Active flow: evidence_collection
Evidence: 3 files loaded | Embeddings: ready
🔍 rag > /flow status_
Flow: evidence_collection
State: selecting
Evidence: doc1.txt, doc2.txt, doc3.txt
Next: /select keywords

[tdocs | rag | org | qa] | Ctrl-Tab=next | ESC=menu | Ctrl-D=exit
```

### Module Registration Pattern

```bash
# In any module's REPL file (e.g., mymodule_repl.sh)

# 1. Define prompt builder
mymodule_build_prompt() {
    printf "🎯 mymodule > "
}

# 2. Define command processor
mymodule_process_command() {
    local input="$1"

    case "$input" in
        /help)
            echo "MyModule commands: /do, /list, /quit"
            ;;
        /do*)
            echo "Doing something..."
            ;;
        *)
            echo "Unknown command: $input"
            ;;
    esac
}

# 3. Optional: Define content renderer
mymodule_tui_content() {
    local start_row="$1"
    local height="$2"

    tcurses_screen_move_cursor $start_row 1
    printf "MyModule status: Active"
    tcurses_screen_move_cursor $((start_row + 1)) 1
    printf "Current task: Processing"
}

# 4. Register with TUI system
tui_mode_register "mymodule" \
    "mymodule_build_prompt" \
    "mymodule_process_command"
```

---

## Benefits of Refactored Design

### 1. Consistency
- **Every REPL** has same layout
- **Line 5** is always the input line
- **Status** always top-right
- **Context** always line 2

### 2. Predictability
- Users know where to look for information
- Muscle memory for navigation
- Consistent keybindings across modules

### 3. Modularity
- Modules just implement 2-3 functions
- Core TUI handles all rendering
- Easy to add new modules

### 4. Maintainability
- Single source of truth for layout
- Changes to layout affect all modules
- Clear separation of concerns

### 5. Extensibility
- Easy to add new regions (e.g., sidebar)
- TDS theming applies consistently
- Plugins can register without forking

### 6. Debugging
- Clear state in `TUI_*` globals
- Single render pipeline
- Easy to add debug overlay

---

## TDS Token Requirements

### New Tokens Needed

```bash
# Brand/Logo
tui.brand                 # Tetra logo color

# Status states
tui.status.normal         # Green - normal operation
tui.status.thinking       # Yellow - processing
tui.status.error          # Red - error state
tui.status.waiting        # Gray - waiting for input

# Context display
tui.context.bracket       # Gray - brackets
tui.context.env           # Cyan - environment
tui.context.mode          # Purple - mode
tui.context.module        # Yellow - module name
tui.context.separator     # Gray - × separator

# Footer
tui.footer.dim            # Dim gray
tui.footer.active         # Highlighted module
tui.footer.keybinding     # Keybinding text

# Log component
tui.log.border            # Blue-gray - panel border
tui.log.command           # White - command text
tui.log.time              # Gray - timestamp
tui.log.separator         # Dark gray - bullets/separators

# Format badges (color-coded by type)
tui.log.format.tes        # Cyan - TES endpoints (@prod, @dev)
tui.log.format.tas        # Purple - TAS actions (/send:msg)
tui.log.format.trs        # Yellow - TRS records (timestamp.*.json)
tui.log.format.tts        # Pink - TTS transactions (slug-timestamp)
tui.log.format.cmd        # Gray - Generic commands

# Module-specific (optional)
tui.module.tdocs          # tdocs theme color
tui.module.rag            # rag theme color
tui.module.org            # org theme color
# etc.
```

**Color Rationale:**
- **TES (Cyan)**: Endpoints are destinations, like water flowing to a location
- **TAS (Purple)**: Actions are operations, magical/powerful
- **TRS (Yellow)**: Records are data artifacts, bright and findable
- **TTS (Pink)**: Transactions are processes, dynamic and flowing
- **CMD (Gray)**: Generic commands, neutral/background

---

## Open Questions

1. **Multi-line REPL input?**
   - Current design assumes single-line input
   - Should we support multi-line editing?
   - If yes, how does it affect line 5 positioning?

2. **Window resize handling?**
   - How should layout adapt to terminal resize?
   - Should REPL_ROW be dynamic based on height?
   - Or keep fixed and scroll content?

3. **Content area flexibility?**
   - Lines 3-4 are fixed for content
   - What if module needs more space?
   - Should content be scrollable?

4. **Response area scrolling?**
   - Long responses need scrolling
   - Page up/down support?
   - Auto-scroll to latest?

5. **Module switching animation?**
   - Instant switch or transition effect?
   - Preserve input across switches?
   - Clear response on switch?

6. **Global commands?**
   - Should some commands work across all modules?
   - `/help`, `/exit`, `/switch <module>`?
   - How to distinguish from module commands?

7. **Log display mode?**
   - Footer (default), side panel, or hidden?
   - Should user be able to toggle via keybinding (Ctrl-L)?
   - Persistent preference across sessions?

8. **Log persistence?**
   - Should log be saved to file automatically?
   - On every command or on exit?
   - Where to store: `$TETRA_DIR/logs/tui_session.log`?

9. **Log filtering?**
   - Filter by format type (show only TAS, only TES, etc.)?
   - Search within log?
   - Interactive log viewer mode?

10. **Format detection edge cases?**
    - What if command contains multiple formats?
    - Should we highlight format patterns within command text?
    - How to handle false positives?

---

## Next Steps

### Immediate (This Week)

1. ✅ Create this analysis document
2. ✅ Add command log specification
3. ⬜ Create `bash/tui/` directory
4. ⬜ Implement `tui_core.sh` skeleton
5. ⬜ Implement `tui_layout.sh` with fixed positions
6. ⬜ Implement `tui_status.sh`
7. ⬜ Implement `tui_log.sh` with format parser
8. ⬜ Create demo.sh to visualize layout and log

### Short-term (Next Week)

1. ⬜ Implement `tui_mode.sh` registration system
2. ⬜ Test log format detection with sample commands
3. ⬜ Migrate tdocs_repl.sh as pilot
4. ⬜ Test pilot with log integration
5. ⬜ Document module migration pattern
6. ⬜ Create TDS tokens for TUI and log

### Medium-term (This Month)

1. ⬜ Migrate remaining module REPLs
2. ⬜ Update trepl.sh to use new TUI
3. ⬜ Deprecate old components
4. ⬜ Update documentation
5. ⬜ Add tests for TUI layout

### Long-term (Future)

1. ⬜ Multi-line input support
2. ⬜ Advanced scrolling/paging
3. ⬜ Module switching animations
4. ⬜ Plugin system for TUI extensions
5. ⬜ Mouse support (click to switch modules)

---

## References

- `bash/docs/INTERACTIVE_UI_PATTERNS.md` - Existing UI patterns
- `bash/repl/docs/TUI_VS_REPL.md` - TUI vs REPL distinctions
- `bash/tcurses/` - Low-level terminal components
- `bash/repl/` - Current REPL implementations
- `bash/tds/` - Tetra Design System (theming)

---

**Document Status:** Draft for review
**Author:** Analysis
**Review Date:** TBD
**Implementation Status:** Not started
