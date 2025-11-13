# Tetra TUI/REPL - Quick Reference Guide

## Main Entry Points

### For TUI Applications
```bash
source "$TETRA_SRC/bash/tui/tui.sh"
tui_init [FPS] [BPM]
# ... render loop ...
tui_cleanup
```

### For REPL Applications  
```bash
source "$TETRA_SRC/bash/repl/repl.sh"
repl_register_module "mymod" "cmd1 cmd2"
repl_run ["readline"]
```

### For Module-Specific REPL
```bash
trepl org              # Launch org REPL
trepl rag              # Launch rag REPL
trepl list             # List all REPLs
```

---

## Core Subsystems at a Glance

### tcurses/ - Terminal Primitives
| Component | Purpose | Key API |
|-----------|---------|---------|
| tcurses_screen | Terminal init/state | tcurses_screen_init, cleanup, move_cursor |
| tcurses_input | Keyboard | tcurses_input_read_key, key constants |
| tcurses_buffer | Double-buffering | tcurses_buffer_write_line, render_diff |
| tcurses_animation | Frame timing | tcurses_animation_set_fps, get_beat_phase |
| tcurses_modal | Mode system | modal_set, modal_get, modal_is |
| tcurses_readline | Input loop | tcurses_readline_insert_char, redraw |
| tcurses_completion | TAB completion | repl_register_completion_words |
| tcurses_log_footer | Status log | log_footer_add, log_footer_render |
| tcurses_actions | Action dispatch | execute_action, colorize_status |
| tcurses_repl | REPL component | repl_init, repl_render, repl_history_* |

### repl/ - Universal REPL Framework
| Component | Purpose | Key API |
|-----------|---------|---------|
| repl.sh | Startup/cleanup | repl_run, repl_main_loop, setup traps |
| core/mode.sh | Mode detection | repl_detect_mode (returns "simple"/"readline") |
| core/input.sh | Input dispatch | repl_read_input (mode-aware) |
| core/loop.sh | Main loop | repl_main_loop (read-eval-print) |
| command_processor.sh | Command registry | repl_register_module, _handler, dispatch |
| prompt_manager.sh | Prompt building | repl_register_prompt_builder, build_prompt |

### tui/ - Unified TUI API
| Component | Purpose | Key API |
|-----------|---------|---------|
| tui.sh | Main entry | tui_init, tui_cleanup, tui_* aliases |
| components/header.sh | Header | header_set_size, header_render_* |
| components/footer.sh | Footer | log_footer_* (same as tcurses) |

---

## Common Tasks

### Add REPL to Module
```bash
#!/bin/bash
# mymod_repl.sh
source "$TETRA_SRC/bash/repl/repl.sh"

repl_register_module "mymod" "cmd1 cmd2 cmd3"
repl_register_slash_command "status" "mymod_status"
repl_register_prompt_builder "mymod" "mymod_prompt"

mymod_status() { echo "Status: OK"; }
mymod_prompt() { echo "[mymod] "; }

repl_run
```

### Add TAB Completion
```bash
repl_register_completion_words "word1" "word2" "word3"

# Or with hints:
repl_set_completion_hint "word1" "Description of word1"
repl_set_completion_category "word1" "TDS"

# Or dynamically:
my_completions() { 
    org list | awk '{print $1}'
}
repl_set_completion_generator "my_completions"
```

### Add Slash Command
```bash
my_command_handler() {
    echo "Command executed!"
}

repl_register_slash_command "mycommand" "my_command_handler"

# Usage: /mycommand
```

### Create TUI Application
```bash
#!/bin/bash
source "$TETRA_SRC/bash/tui/tui.sh"
source "$TETRA_SRC/bash/repl/repl.sh"

tui_init 30 120  # 30 FPS, 120 BPM

# Register modules
repl_register_module "org" "list deploy"
repl_register_slash_command "exit" "exit_app"

# Setup cleanup
trap 'tui_cleanup; exit 0' INT TERM EXIT

# Main loop
while true; do
    # Clear back buffer
    tcurses_buffer_clear
    
    # Draw content
    tcurses_buffer_write_line 1 "Title"
    tcurses_buffer_write_line 2 "Content"
    
    # Render changes only
    tcurses_buffer_render_diff
    
    # Handle input
    key=$(tcurses_input_read_key)
    case "$key" in
        "q") break ;;
        *) handle_key "$key" ;;
    esac
done

tui_cleanup
```

### Access Global State
```bash
# Input state
echo $REPL_INPUT
echo $REPL_CURSOR_POS

# Buffers
echo "${_TCURSES_BACK_BUFFER[1]}"
echo "${_TCURSES_FRONT_BUFFER[1]}"

# Screen size
echo $_TCURSES_HEIGHT x $_TCURSES_WIDTH

# Animation
echo $_TCURSES_ANIM_FPS
echo $_TCURSES_ANIM_BPM

# Modal
echo $APP_MODE

# Module context
echo $REPL_MODULE_CONTEXT
```

---

## Key Concepts

### Hybrid Execution Mode
```
Shell commands (default):  command args
Slash commands:            /command args
Shell escape (explicit):   !command args
Symbol processing:         ${var}, @{context}, :symbol
```

### Mode System (Vim-like)
```
NORMAL mode   - Read-only, navigation
COMMAND mode  - Entry with `:` prefix
REPL mode     - Interactive execution
```

### Double-Buffering
```
Back Buffer   (write)  ──┐
                         ├─> Differential Compare ──> Screen
Front Buffer  (cache)  ──┘
```

### Module Registry Pattern
```bash
repl_register_module "name" "cmd1 cmd2"
repl_register_module_handler "name.cmd1" "handler_function"
repl_set_module_context "name"
repl_dispatch_slash "cmd1 arg"
```

### Prompt Builders
```bash
repl_register_prompt_builder "name" "function"
# function outputs prompt fragment
# Multiple builders are concatenated
```

---

## Key Variables (Read-Only, Don't Modify)

### Screen State
- `_TCURSES_HEIGHT`, `_TCURSES_WIDTH` - Terminal size
- `_TCURSES_INITIALIZED` - Is initialized
- `_TCURSES_IN_ALTBUF` - Using alternate screen

### Input State
- `REPL_INPUT` - Current input text
- `REPL_CURSOR_POS` - Cursor position in input
- `REPL_HISTORY[]` - History array
- `REPL_MODE` - "simple" or "readline"

### Buffers
- `_TCURSES_BACK_BUFFER[]` - Back buffer (associative)
- `_TCURSES_FRONT_BUFFER[]` - Front buffer cache

### Animation
- `_TCURSES_ANIM_FPS` - Frames per second
- `_TCURSES_ANIM_BPM` - Beats per minute
- `_TCURSES_ANIM_BEAT_PHASE` - 0.0 to 1.0

### Module System
- `REPL_MODULE_REGISTRY[]` - Registered modules
- `REPL_MODULE_CONTEXT` - Active module
- `REPL_SLASH_HANDLERS[]` - Slash command handlers

---

## Special Keys

```bash
TCURSES_KEY_UP         - Up arrow
TCURSES_KEY_DOWN       - Down arrow
TCURSES_KEY_LEFT       - Left arrow
TCURSES_KEY_RIGHT      - Right arrow
TCURSES_KEY_ESC        - Escape
TCURSES_KEY_ENTER      - Enter/Return
TCURSES_KEY_TAB        - Tab
TCURSES_KEY_BACKSPACE  - Backspace/Delete
TCURSES_KEY_CTRL_C     - Ctrl-C
TCURSES_KEY_CTRL_D     - Ctrl-D (EOF)
TCURSES_KEY_CTRL_Z     - Ctrl-Z (suspend)
```

---

## Color Codes (for status display)

```bash
Green     #9ECE6A  - ok, success
Red       #F7768E  - error, fail
Yellow    #E0AF68  - warning, pending
Purple    #BB9AF7  - change, exec
Cyan      #7DCFFF  - module names
Default   #7AA2F7  - generic
```

---

## Return Codes from repl_process_input()

```
0  - Continue (normal)
1  - Exit REPL
2  - Mode changed, rebuild prompt on same line
```

---

## Typical File Organization for Module

```
mymodule/
  ├── mymodule.sh          - Main module
  ├── mymodule_commands.sh - Command handlers
  ├── mymodule_repl.sh     - REPL integration
  ├── README.md            - Documentation
  └── demo.sh              - Interactive demo
```

---

## Testing & Debugging

### Run TUI Demo
```bash
$TETRA_SRC/bash/tcurses/demo.sh
$TETRA_SRC/bash/tui/demo.sh
```

### Run REPL Test
```bash
trepl org              # Launch real REPL
trepl list             # See all available
```

### Debug Key Codes
```bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
tcurses_input_debug_keys
# Press keys to see their codes
```

### View Screen State
```bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
tcurses_screen_debug_state
```

---

## Common Patterns

### Pattern: Status Indicator
```bash
log_footer_add "org" "ok" "deployment complete"
log_footer_add "org" "error" "failed to deploy"
log_footer_add "org" "exec" "running deployment"
```

### Pattern: Dynamic Prompt
```bash
my_prompt() {
    local module=$(repl_get_module_context)
    echo "[$module] > "
}
repl_register_prompt_builder "ctx" "my_prompt"
```

### Pattern: Command Handler
```bash
my_handler() {
    local args="$@"
    case "$args" in
        "status") show_status ;;
        "help") show_help ;;
        *) echo "Unknown: $args" ;;
    esac
}
repl_register_slash_command "mymod" "my_handler"
```

### Pattern: Input Handler (Low-level)
```bash
while true; do
    key=$(tcurses_input_read_key)
    
    case "$key" in
        "q"|"Q") break ;;
        "$TCURSES_KEY_UP") scroll_up ;;
        "$TCURSES_KEY_DOWN") scroll_down ;;
        *) handle_char "$key" ;;
    esac
done
```

---

## Quick Troubleshooting

**REPL not recognizing commands**
- Check: `repl_get_module_context` returns correct module
- Check: Command is registered: `repl_register_module "name" "cmd"`

**Colors not showing**
- Check: `source "$TETRA_SRC/bash/color/color.sh"` is loaded
- Check: `COLOR_ENABLED=1` is set

**Input not working**
- Check: Terminal is in raw mode: `tcurses_screen_init`
- Check: Not in subshell (global state lost)

**Screen corruption**
- Call: `tcurses_buffer_render_full()` to redraw entire screen
- Or: `tcurses_screen_cleanup && tcurses_screen_init`

**Performance issues**
- Use: `tcurses_buffer_render_diff()` instead of `render_full()`
- Reduce: FPS setting (tui_init 15 120)

