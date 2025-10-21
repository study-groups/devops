# bash/repl - Universal REPL Library

**Version:** 1.0.0
**Type:** Tetra Library
**Status:** Stable

## Overview

Universal REPL (Read-Eval-Print Loop) library for all Tetra modules. Provides a consistent, mode-aware interface with dynamic prompt building, slash command registration, and runtime theme switching.

## Features

- **Three-mode progressive enhancement**: basic → enhanced → tui
- **Dynamic prompt system**: Modules register builders
- **Slash command registration**: Extensible command system
- **Runtime theme switching**: Integrated with bash/color themes
- **History management**: Per-module history files
- **Color support**: Auto-detect and graceful degradation

## Installation

No installation needed - source the entry point:

```bash
source "$TETRA_SRC/bash/repl/repl.sh"
```

## Dependencies

- **Required**: `TETRA_SRC` global variable
- **Required**: bash/color library
- **Required**: bash/tds (Tetra Design System - for design tokens)
- **Optional**: bash/tcurses (for enhanced mode)
- **Optional**: bash/tui (for TUI mode)

## Quick Start

### Minimal Module REPL

```bash
#!/usr/bin/env bash
# bash/mymod/mymod_repl.sh

source "$TETRA_SRC/bash/repl/repl.sh"

# Register prompt builder
mymod_prompt() {
    echo "[mymod]> "
}
repl_register_prompt_builder "mymod" "mymod_prompt"

# Register slash command
mymod_cmd_status() {
    echo "Module status: OK"
}
repl_register_slash_command "status" "mymod_cmd_status"

# Run REPL (mode auto-detected)
mymod_repl() {
    REPL_HISTORY_FILE="${TETRA_DIR}/mymod/history"
    repl_run
}

mymod_repl
```

## Three-Mode System

| Mode | Input Handler | Features | When Used |
|------|---------------|----------|-----------|
| **basic** | `read -r -p` | Simple prompts, no color | No dependencies |
| **enhanced** | `tcurses_input_read_line` | Colors, readline, history | Interactive terminal + tcurses |
| **tui** | Buffer integration | Full-screen, pubsub | TUI framework active |

Mode is **auto-detected** unless explicitly specified:

```bash
repl_run              # Auto-detect
repl_run basic        # Force basic mode
repl_run enhanced     # Force enhanced mode
```

## Prompt System

### Register Prompt Builders

Modules register functions that return prompt fragments:

```bash
# Simple static prompt
mymod_prompt_simple() {
    echo "mymod> "
}
repl_register_prompt_builder "simple" "mymod_prompt_simple"

# Dynamic context-aware prompt
mymod_prompt_context() {
    local state=$(mymod_get_state)
    echo "[${state}] mymod> "
}
repl_register_prompt_builder "context" "mymod_prompt_context"

# Color-coded prompt
mymod_prompt_colored() {
    printf "%bmymod>%b " "$(mode_color 0)" "$(reset_color)"
}
repl_register_prompt_builder "colored" "mymod_prompt_colored"
```

### Built-in Prompt Builders

```bash
repl_prompt_basic       # Simple "> "
repl_prompt_context     # [org × env × mode] (if tetra context available)
```

### Multi-part Prompts

Register multiple builders for composite prompts:

```bash
# Results in: "[flow:stage] rag> "
repl_register_prompt_builder "flow" "rag_prompt_flow_state"
repl_register_prompt_builder "base" "rag_prompt_base"
```

## Slash Commands

### Register Commands

```bash
repl_register_slash_command "command" "handler_function"
```

### Handler Function Signature

```bash
handler_function() {
    local args="$*"  # All arguments after /command
    # ... do work ...
    return 0  # 0=continue, 1=exit, 2=prompt changed
}
```

### Return Codes

- `0` - Continue REPL normally
- `1` - Exit REPL
- `2` - Prompt state changed, rebuild prompt

### Built-in Slash Commands

```bash
/help [topic]     # Show help
/exit, /quit, /q  # Exit REPL
/theme [name]     # Change color theme
/history [n]      # Show last n commands
/clear            # Clear screen
```

## Theme Integration

### Using Themes in REPL

```bash
# User can switch themes at runtime
mymod> /theme list
Base themes:
  light      - Light background, bright colors
  dark       - Dark background, muted colors
  solarized  - Solarized background

Palette themes:
  default    - Built-in Tetra palettes
  tokyo_night
  nord

Current: dark/default

mymod> /theme tokyo_night
Theme changed to: dark/tokyo_night
```

### Theme-Aware Prompts

```bash
mymod_prompt_themed() {
    # Colors automatically update with theme
    printf "%bState:%b " "$(env_color 2)" "$(reset_color)"
    printf "%b%s>%b " "$(mode_color 0)" "mymod" "$(reset_color)"
}
```

### Register Theme Callback

```bash
mymod_on_theme_change() {
    local type="$1"    # base/palette
    local value="$2"   # theme name
    # React to theme change (e.g., redraw TUI)
}
theme_register_callback "mymod_on_theme_change"
```

## Advanced Usage

### Context-Aware REPL

```bash
#!/usr/bin/env bash

source "$TETRA_SRC/bash/repl/repl.sh"

# Module state
MYMOD_STATE="idle"

# Dynamic prompt shows state
mymod_prompt() {
    local color
    case "$MYMOD_STATE" in
        idle)    color=$(env_color 0) ;;
        working) color=$(verbs_color 2) ;;
        done)    color=$(env_color 2) ;;
    esac
    printf "%b[%s]%b mymod> " "$color" "$MYMOD_STATE" "$(reset_color)"
}
repl_register_prompt_builder "state" "mymod_prompt"

# Command changes state
mymod_cmd_start() {
    MYMOD_STATE="working"
    return 2  # Prompt changed, rebuild
}
repl_register_slash_command "start" "mymod_cmd_start"

# Run
REPL_HISTORY_FILE="${TETRA_DIR}/mymod/history"
repl_run
```

### Shell Passthrough

Commands starting with `!` execute as shell commands:

```bash
mymod> !ls -l
total 42
-rw-r--r--  myfile.sh

mymod> !git status
On branch main
```

### Action System Integration

If `tetra_dispatch_action` is available, non-slash, non-shell commands dispatch to it:

```bash
mymod> deploy staging    # Calls tetra_dispatch_action deploy staging
```

## TUI Integration

For TUI mode, set output handler:

```bash
source "$TETRA_SRC/bash/tui/tui.sh"
source "$TETRA_SRC/bash/repl/repl.sh"

# Output goes to TUI content region
REPL_OUTPUT_HANDLER="tui_update_content"
repl_run
```

## TDS Design Tokens (New!)

### Why Use Design Tokens?

Instead of hardcoding ANSI escape codes like `\033[38;5;46m`, use semantic design tokens:

**Before (hardcoded):**
```bash
prompt="\033[38;5;46mProduction\033[0m> "  # What is 46?
```

**After (design tokens):**
```bash
tds_text_color "repl.env.production"  # Semantic and themeable!
echo -n "Production"
reset_color
```

### Available REPL Tokens

The TDS REPL token system provides semantic names for all REPL UI elements:

#### Environment Tokens
- `repl.env.local` - Local environment (bright green)
- `repl.env.dev` - Development (light green)
- `repl.env.staging` - Staging (yellow-green)
- `repl.env.production` - Production (caution color)

#### Mode Tokens
- `repl.mode.inspect` - Inspect mode (bright blue)
- `repl.mode.transfer` - Transfer mode (medium blue)
- `repl.mode.execute` - Execute mode (dark blue)

#### Action Tokens
- `repl.action.primary` - Primary action (orange)
- `repl.action.secondary` - Secondary action (light orange)
- `repl.action.none` - No action selected (muted)

#### Prompt Structure Tokens
- `repl.prompt.bracket` - Brackets and delimiters
- `repl.prompt.separator` - Separators (x, |, etc)
- `repl.prompt.arrow` - Prompt arrow (>)

#### Feedback Tokens
- `repl.feedback.env` - Environment change feedback
- `repl.feedback.mode` - Mode change feedback
- `repl.feedback.action` - Action change feedback
- `repl.feedback.arrow` - Feedback arrow (→)

### TDS Helper Functions

```bash
# Render components with semantic colors
tds_repl_render_env "Production" 3      # Environment indicator
tds_repl_render_mode "Execute" 2        # Mode indicator
tds_repl_render_action "deploy:config"  # Action indicator
tds_repl_render_org "my-org"            # Org/context indicator

# Build complete prompt (org-style)
prompt=$(tds_repl_build_prompt \
    "my-org" "Production" 3 \
    "Execute" 2 \
    "deploy:config")

# Show feedback for state changes
tds_repl_feedback_env "Production" >&2
tds_repl_feedback_mode "Execute" >&2
tds_repl_feedback_action "deploy:config" >&2
```

### Example: Org REPL Pattern

See `bash/org/org_repl.sh` for a complete implementation using TDS design tokens:

```bash
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/tds/tds.sh"

# State
ORG_REPL_ENV_INDEX=0
ORG_REPL_ENVIRONMENTS=("Local" "Dev" "Staging" "Production")

# Prompt builder using TDS
_org_build_prompt() {
    local org=$(_org_active)
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"

    tds_repl_build_prompt "$org" "$env" "$ORG_REPL_ENV_INDEX" \
                         "Inspect" 0 "none"
}

# Navigation with feedback
_org_cycle_env() {
    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % 4 ))

    # Clear input to prevent visual glitch
    READLINE_LINE=""
    READLINE_POINT=0

    # Show immediate feedback
    tds_repl_feedback_env "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" >&2
}

# Bind to Ctrl+E
bind -x '"\C-e": _org_cycle_env'

# Export callbacks
repl_build_prompt() { _org_build_prompt; }
repl_process_input() { local input="$1"; echo "Got: $input"; }
export -f repl_build_prompt repl_process_input

repl_run
```

### Keyboard Navigation Best Practice

When implementing state cycling (Ctrl+E, Ctrl+X,M, etc):

```bash
_my_cycle_handler() {
    # 1. Update state
    STATE_INDEX=$(( (STATE_INDEX + 1) % ${#STATES[@]} ))

    # 2. Clear readline input (CRITICAL - prevents visual glitches)
    READLINE_LINE=""
    READLINE_POINT=0

    # 3. Show immediate feedback (new prompt displays on next Enter)
    tds_repl_feedback_env "${STATES[$STATE_INDEX]}" >&2
}
```

**Why this pattern?**
- `read -e` evaluates prompt only once at start of input
- `bind -x` callbacks can't refresh the prompt mid-input
- Clearing `READLINE_LINE` prevents terminal artifacts
- Feedback provides immediate visual confirmation
- Updated prompt displays naturally when user presses Enter

### Extending TDS for Your Module

Create custom tokens for module-specific UI:

```bash
# bash/tds/tokens/mymod_tokens.sh
declare -A TDS_MYMOD_TOKENS=(
    [mymod.status.idle]="env:4"      # Green
    [mymod.status.busy]="verbs:0"    # Red
    [mymod.status.done]="mode:0"     # Blue
)

# Merge into main token map
for key in "${!TDS_MYMOD_TOKENS[@]}"; do
    TDS_COLOR_TOKENS[$key]="${TDS_MYMOD_TOKENS[$key]}"
done

# Use in your REPL
tds_text_color "mymod.status.idle"
echo "Ready"
reset_color
```

### Theme Support

Since REPL uses TDS tokens, theme switching automatically updates colors:

```bash
# User switches theme
theme_set_base "light"

# REPL colors update automatically on next prompt
# No code changes needed!
```

## Color Support

### Auto-Detection

REPL automatically detects color support via bash/color:

```bash
if [[ $COLOR_ENABLED -eq 1 ]]; then
    # Colors available
else
    # Fallback to plain text
fi
```

### Using Colors in Prompts (Legacy)

```bash
mymod_prompt() {
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        # Old way (deprecated - use TDS tokens instead)
        printf "%bmymod>%b " "$(mode_color 0)" "$(reset_color)"
    else
        echo "mymod> "
    fi
}
```

**Note**: Prefer TDS design tokens over direct color functions for better theming support.

## Examples

### RAG REPL Pattern

```bash
rag_prompt_flow_state() {
    local flow=$(get_current_flow)
    local stage=$(get_flow_stage)
    printf "%b[%s:%s]%b " "$(mode_color 1)" "$flow" "$stage" "$(reset_color)"
}

rag_prompt_base() {
    printf "%brag>%b " "$(mode_color 0)" "$(reset_color)"
}

repl_register_prompt_builder "flow" "rag_prompt_flow_state"
repl_register_prompt_builder "base" "rag_prompt_base"

# Registers slash commands
repl_register_slash_command "evidence" "rag_cmd_evidence"
repl_register_slash_command "flow" "rag_cmd_flow"

REPL_HISTORY_FILE="${TETRA_DIR}/rag/history"
repl_run
```

### Tetra Context REPL

```bash
tetra_prompt_context() {
    local org=$(tetra_get_org)
    local env=$(tetra_get_env)
    local mode=$(tetra_get_mode)
    printf "[%s × %s × %s] " "$org" "$env" "$mode"
}

tetra_prompt_base() {
    printf "%btetra>%b " "$(mode_color 0)" "$(reset_color)"
}

repl_register_prompt_builder "context" "tetra_prompt_context"
repl_register_prompt_builder "base" "tetra_prompt_base"

REPL_HISTORY_FILE="${TETRA_DIR}/tetra/repl_history"
repl_run
```

## API Reference

### Core Functions

```bash
repl_run [mode]                          # Main entry point
repl_register_prompt_builder name fn     # Register prompt builder
repl_register_slash_command cmd fn       # Register slash command
```

### Internal Functions (advanced)

```bash
repl_detect_mode                         # Auto-detect REPL mode
repl_read_input prompt                   # Read input (mode-specific)
repl_main_loop                           # Main REPL loop
repl_process_input input                 # Process input line
repl_dispatch_slash cmd                  # Dispatch slash command
repl_build_prompt                        # Build prompt from builders
```

## Configuration

### Environment Variables

```bash
REPL_MODE=""              # Override mode detection
REPL_HISTORY_FILE=""      # History file path
REPL_OUTPUT_HANDLER=""    # TUI output handler
TETRA_THEME="dark"        # Default theme
```

### Module Setup

```bash
# Set module-specific history
REPL_HISTORY_FILE="${TETRA_DIR}/mymod/history"

# Set output handler for TUI
REPL_OUTPUT_HANDLER="mymod_tui_update"

# Run
repl_run
```

## Testing

Test the library:

```bash
cd $TETRA_SRC
source bash/repl/repl.sh

# Register test prompt
test_prompt() { echo "test> "; }
repl_register_prompt_builder "test" "test_prompt"

# Run
REPL_HISTORY_FILE="/tmp/test_history"
repl_run basic
```

## Related Documentation

- [bash/tds](../tds/README.md) - Tetra Design System (design tokens)
- [bash/color](../color/README.md) - Color system
- [bash/tcurses](../tcurses/README.md) - Terminal primitives
- [bash/tui](../tui/README.md) - TUI framework
- [REPL_ARCHITECTURE.md](../../docs/REPL_ARCHITECTURE.md) - Design docs

---

**Maintained by:** Tetra Project
**License:** Part of Tetra ecosystem
