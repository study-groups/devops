# The Tetra REPL Mental Model

## The Big Picture: Layered Architecture

Think of Tetra as a **layered cake** where each layer provides services to the layer above:

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR MODULE (midi, org, rag, etc.)       │
│                 "Application Layer" - Business Logic        │
│                                                             │
│  Sources: repl.sh, uses prompt builders, registers cmds    │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│                    bash/repl (Universal REPL)               │
│              "Framework Layer" - REPL Infrastructure        │
│                                                             │
│  • Loop management (repl_main_loop)                        │
│  • Prompt building system (repl_build_prompt)              │
│  • Command routing (repl_process_input)                    │
│  • Slash command registry                                  │
│  • History management                                       │
└─────────────────────────────────────────────────────────────┘
        ↓ uses                ↓ uses                ↓ uses
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   bash/tcurses   │  │    bash/tds      │  │   bash/color     │
│ "Readline Input" │  │ "Display System" │  │ "Color Tokens"   │
│                  │  │                  │  │                  │
│ • Line editing   │  │ • Semantic       │  │ • Theme engine   │
│ • History        │  │   color tokens   │  │ • ANSI codes     │
│ • Completion     │  │ • Typography     │  │ • Palettes       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                            ↓ uses
                   ┌──────────────────┐
                   │   bash/prompt    │
                   │ "Shell PS1 Only" │
                   │                  │
                   │ • NOT for REPL!  │
                   │ • For bash $PS1  │
                   └──────────────────┘
```

---

## Key Insight: Two Different Prompt Systems!

### 1. **bash/prompt/** - For Regular Shell (PS1)

**Mental Model:** "The fancy thing you see at your bash shell"

```bash
# This is for your INTERACTIVE BASH SHELL
$ source ~/tetra/bash/prompt/prompt.sh
mricos@hostname:[~/code](main): _
                  ↑
            This is PS1 - your bash prompt
```

**Used for:**
- Your normal bash shell prompt
- Shows: username, hostname, git branch, python/node status
- Sets the `$PS1` environment variable
- **NOT used by REPL modules!**

**Where:** `bash/prompt/prompt.sh`

---

### 2. **bash/repl/prompt_manager.sh** - For REPL Applications

**Mental Model:** "The framework that modules use for their interactive prompts"

```bash
# This is for REPL APPLICATIONS like midi, org, rag
♫ tmc [all] cc7:64 ● >
↑
This is a REPL prompt built by your module
```

**Used for:**
- Interactive module REPLs (midi, org, rag, etc.)
- Built dynamically every loop iteration
- Module-specific, context-aware
- **This is what you use for MIDI!**

**Where:** `bash/repl/prompt_manager.sh`

---

## The Mental Model: How Your Module Builds a REPL

### Step 1: Your Module Sources the REPL Framework

```bash
#!/usr/bin/env bash
# File: midi/core/repl.sh

# Pull in the universal REPL framework
source "$TETRA_SRC/bash/repl/repl.sh"
```

**What happens:**
- `repl.sh` loads all the infrastructure
- Provides functions: `repl_run()`, `repl_build_prompt()`, etc.
- Sets up the main loop
- Loads color system, TDS, etc.

### Step 2: You Define Your Prompt Builder

```bash
# Your custom prompt builder
midi_repl_prompt() {
    # Query your module's state
    local status=$(check_service_status)
    local device=$(get_current_device)
    local cc=$(get_last_cc_value)

    # Return a prompt string (with colors!)
    echo -ne "♫ tmc [${device}] cc${cc} ${status} > "
}
```

**Mental Model:** "This is YOUR function that returns a string"

### Step 3: Register Your Builder

```bash
midi_repl() {
    # Tell REPL: "Call my function to build prompts"
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    # Start the REPL loop
    repl_run
}
```

**Mental Model:** "Add your function to an array of prompt builders"

### Step 4: The REPL Loop Calls Your Builder

```bash
# Inside bash/repl/core/loop.sh (YOU DON'T WRITE THIS)
while true; do
    # Build prompt by calling ALL registered builders
    repl_build_prompt  # ← Calls YOUR midi_repl_prompt()

    # Read user input
    read -p "$prompt" input

    # Process input
    process_command "$input"

    # Loop back - prompt rebuilt fresh!
done
```

**Mental Model:** "The framework calls your function every loop, you just return a string"

---

## How Does It Know Your Module Name?

**Answer: It doesn't need to!**

You explicitly register your builder:

```bash
# Option 1: Direct registration (new way)
REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

# Option 2: Override callback (old way, still works)
repl_build_prompt() { midi_repl_prompt; }
export -f repl_build_prompt
```

**Mental Model:** "You tell it which function to call, it doesn't guess"

---

## The Module Lifecycle

### 1. Module Initialization

```bash
# File: midi/midi.sh (main module entry)

midi_init() {
    # Set up module globals
    MIDI_SRC="$TETRA_SRC/bash/midi"
    MIDI_DIR="$TETRA_DIR/midi"

    # Source your core modules
    source "$MIDI_SRC/core/state.sh"
    source "$MIDI_SRC/core/mapper.sh"
    # etc.
}
```

### 2. REPL Entry Point

```bash
# File: midi/core/repl.sh

midi_repl() {
    # Initialize module
    midi_init 2>/dev/null || true

    # Register REPL commands
    repl_register_slash_command "start" "midi_cmd_start"
    repl_register_slash_command "learn" "midi_cmd_learn"

    # Register prompt builder
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    # Set history location
    REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

    # Run REPL
    repl_run  # ← Framework takes over
}
```

### 3. User Types Command

```
User: /learn p1
  ↓
REPL Framework:
  ↓
repl_process_input("/learn p1")
  ↓
Looks up registered command "learn"
  ↓
Calls: midi_cmd_learn "p1"
  ↓
Your function executes
  ↓
Loop back, rebuild prompt (sees new state!)
```

---

## The Relationship Between Modules

### bash/repl (Universal Framework)

**Purpose:** Provides the REPL loop, prompt building system, command routing

**Provides:**
- `repl_run()` - Main loop
- `repl_build_prompt()` - Prompt builder callback
- `repl_process_input()` - Input router callback
- `repl_register_slash_command()` - Command registry
- `REPL_PROMPT_BUILDERS` - Array of prompt functions

**Mental Model:** "The engine that runs your REPL"

---

### bash/tds (Tetra Display System)

**Purpose:** Semantic color tokens and typography for terminal UIs

**Provides:**
- Color token system: `content.heading.h1` → `#0088FF`
- Rendering functions: `tds_render_heading()`, `tds_render_code()`
- Theme switching: `tds_set_theme()`
- Markdown rendering

**Mental Model:** "A design system for terminal apps (like Tailwind but for bash)"

**Used by:**
- Prompts that want themed colors
- Modules that render rich text (help, docs)
- REPLs that support theme switching

**Example:**
```bash
# In your prompt builder
midi_repl_prompt() {
    # Use TDS color tokens instead of hardcoded ANSI
    local heading_color=$(tds_text_color "content.heading.h1")
    echo -ne "${heading_color}midi${TETRA_NC} > "
}
```

---

### bash/tcurses (Terminal Curses - Readline)

**Purpose:** Enhanced input with line editing, history, completion

**Provides:**
- `tcurses_input_read_line()` - Readline-style input
- History navigation (↑/↓)
- Line editing (← → Home End)
- Tab completion

**Mental Model:** "Bash's `read -e` on steroids"

**When used:**
- REPL auto-detects if tcurses is available
- Falls back to simple `read` if not
- You don't call it directly - REPL uses it

**Example:**
```bash
# Inside bash/repl/core/input.sh (framework code)
repl_read_input() {
    case "${REPL_MODE}" in
        readline)
            # Use tcurses for fancy input
            tcurses_input_read_line "$prompt" "$REPL_HISTORY_FILE"
            ;;
        simple)
            # Fallback to basic read
            read -r -p "$prompt" input
            ;;
    esac
}
```

---

### bash/tui (Terminal User Interface)

**Purpose:** Full-screen TUI framework with pubsub, buffers, views

**Provides:**
- Buffer management
- View system
- Event bus (pubsub)
- Full-screen rendering

**Mental Model:** "Like ncurses apps (vim, htop) but in pure bash"

**Status:** Experimental, not widely used yet

**When used:**
- Future: Full-screen MIDI controller UI
- Currently: Most REPLs use line-based (not full-screen)

---

### bash/color (Color System)

**Purpose:** Theme engine, color palettes, ANSI codes

**Provides:**
- Theme switching: `color_set_theme()`
- Palettes: `TETRA_BLUE`, `TETRA_GREEN`, etc.
- Color conversion: hex → ANSI

**Mental Model:** "The color backend for TDS"

**Used by:**
- TDS (uses color system internally)
- Prompts (can use directly: `${TETRA_CYAN}`)
- Any module that needs colors

---

### bash/prompt (Shell PS1 - NOT FOR REPL!)

**Purpose:** Configure your interactive bash shell prompt

**Provides:**
- `tetra_prompt()` - Sets `$PS1`
- Git branch display
- Python/Node status indicators

**Mental Model:** "The bashrc prompt customizer - IGNORE FOR REPL APPS"

**When used:**
- Your `~/.bashrc` or `~/.bash_profile`
- **NOT** used by REPL modules!

**Example:**
```bash
# In ~/.bashrc (for your shell, not REPLs)
source ~/tetra/bash/prompt/prompt.sh
PROMPT_COMMAND=tetra_prompt
```

---

## Two REPL Patterns

### Pattern 1: Custom Routing (Full Control)

**Mental Model:** "I want to handle ALL input myself"

```bash
midi_repl() {
    # Override the input processor
    repl_process_input() {
        local input="$1"

        # Handle everything yourself
        case "$input" in
            /start) midi_cmd_start ;;
            /stop)  midi_cmd_stop ;;
            *)      echo "Send to MIDI: $input" ;;
        esac
    }
    export -f repl_process_input

    # Override prompt builder
    repl_build_prompt() {
        midi_repl_prompt
    }
    export -f repl_build_prompt

    repl_run
}
```

**Pros:**
- Total control
- Can do anything

**Cons:**
- More code
- No built-in /help, /theme, etc.

---

### Pattern 2: Built-in Routing (Register Commands)

**Mental Model:** "Let the framework handle routing, I just register commands"

```bash
midi_repl() {
    # Register commands (framework routes them)
    repl_register_slash_command "start" "midi_cmd_start"
    repl_register_slash_command "stop"  "midi_cmd_stop"
    repl_register_slash_command "learn" "midi_cmd_learn"

    # Register prompt builder
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    repl_run
    # Gets /help, /theme, /mode for FREE!
}
```

**Pros:**
- Less code
- Free built-ins: `/help`, `/theme`, `/mode`
- Standardized

**Cons:**
- Less flexibility
- Commands must be `/slash` style

---

## The Flow: User Types Command

### Example: User types `/learn p1`

```
1. REPL Loop (bash/repl/core/loop.sh)
   ├─> Build prompt
   │   └─> Calls midi_repl_prompt()
   │       └─> Returns: "♫ tmc [all] ● > "
   │
   ├─> Display: "♫ tmc [all] ● > "
   │
   ├─> Read input (wait for user)
   │   User types: /learn p1
   │
   ├─> Process input
   │   ├─> repl_process_input("/learn p1")
   │   │   ├─> Pattern 1 (custom): Your code handles it
   │   │   └─> Pattern 2 (built-in):
   │   │       ├─> Extract command: "learn"
   │   │       ├─> Extract args: "p1"
   │   │       ├─> Look up: SLASH_COMMANDS["learn"] → "midi_cmd_learn"
   │   │       └─> Call: midi_cmd_learn "p1"
   │   │
   │   └─> Your function executes
   │       ├─> tmc_state_start_learning "p1"
   │       └─> return 0
   │
   └─> Loop back to step 1
       (Prompt rebuilt, sees learning_active=1, shows "learn" status)
```

---

## How Prompt Sees State Changes

### The Magic: No Magic!

```bash
# Loop iteration N
repl_main_loop() {
    while true; do
        # 1. Build prompt (queries state FRESH)
        midi_repl_prompt()  # Reads: tmc_state_get("learning_active") → 0
        # Shows: "♫ tmc ready >"

        # 2. Read input
        input="/learn p1"

        # 3. Process
        midi_cmd_learn "p1"
            ↓
        tmc_state_set "learning_active" "1"  # ← State changes

        # 4. Loop back (rebuilds prompt)
        midi_repl_prompt()  # Reads: tmc_state_get("learning_active") → 1
        # Shows: "♫ tmc learn >"  ← AUTOMATICALLY UPDATED!
    done
}
```

**Mental Model:** "State changes are visible next iteration because prompt is rebuilt fresh"

---

## File Organization Pattern

### Typical Module Structure

```
bash/midi/                          # Your module root
├── midi.sh                         # Main entry point
├── core/
│   ├── state.sh                    # State management
│   ├── mapper.sh                   # Core logic
│   ├── repl.sh                     # REPL integration ← YOU WRITE THIS
│   └── socket_server.sh            # Service
├── lib/
│   └── errors.sh                   # Error handling
└── docs/
    └── README.md
```

### REPL Integration File (core/repl.sh)

```bash
#!/usr/bin/env bash
# File: midi/core/repl.sh

# ============ DEPENDENCIES ============
source "$TETRA_SRC/bash/repl/repl.sh"  # Universal REPL
source "$MIDI_SRC/core/state.sh"       # Your state
source "$MIDI_SRC/core/mapper.sh"      # Your logic

# ============ PROMPT BUILDER ============
midi_repl_prompt() {
    # Query your state
    local status=$(tmc_state_get "learning_active")

    # Return prompt string
    echo -ne "♫ tmc > "
}

# ============ COMMANDS ============
midi_cmd_start() {
    # Your command implementation
    echo "Starting TMC service..."
    tsm start tmc
}

midi_cmd_learn() {
    local syntax="$1"
    tmc_state_start_learning "$syntax"
    echo "Learning mode: Move a control to map to $syntax"
}

# ============ MAIN ENTRY ============
midi_repl() {
    # Initialize
    midi_init 2>/dev/null || true

    # Register commands
    repl_register_slash_command "start" "midi_cmd_start"
    repl_register_slash_command "learn" "midi_cmd_learn"

    # Register prompt
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    # Set history
    REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

    # Run
    repl_run
}

# Export
export -f midi_repl
```

---

## Mental Model Summary

### Think of It Like This:

1. **Your Module** = The app (midi, org, rag)
   - Defines: commands, state, logic
   - Provides: prompt builder function
   - Calls: `repl_run()` to start

2. **bash/repl** = The framework
   - Provides: loop, routing, registry
   - Calls: your prompt builder
   - Manages: history, modes, slash commands

3. **bash/tds** = The design system
   - Provides: semantic color tokens
   - Like: Tailwind CSS for terminal
   - Optional: you can use raw ANSI instead

4. **bash/tcurses** = The input handler
   - Provides: readline-style editing
   - Auto-detected: framework uses if available
   - Invisible: you don't call it directly

5. **bash/color** = The color engine
   - Provides: theme switching, palettes
   - Backend: for TDS and direct use
   - Optional: use ANSI codes directly if you prefer

6. **bash/prompt** = NOT FOR REPL!
   - For: your bash shell PS1
   - Ignore: when building REPL apps

---

## Key Takeaways

### 1. Prompts Are Rebuilt Every Loop
- No "notification" needed
- Just update state, prompt sees it next iteration
- Performance is fine (only happens while waiting for user)

### 2. You Don't Need to Know Module Name
- You explicitly register your builder
- Framework calls YOUR function
- No magic module name detection

### 3. Two Different Prompt Systems
- **bash/prompt/** = Shell PS1 (ignore for REPLs)
- **bash/repl/prompt_manager.sh** = REPL prompts (use this!)

### 4. Layered Architecture
- Your module uses bash/repl
- bash/repl uses bash/tds, bash/tcurses, bash/color
- Each layer provides services to layer above

### 5. Two Patterns
- **Pattern 1:** Override callbacks (full control)
- **Pattern 2:** Register commands (easier, standardized)

---

## Next Steps for MIDI Refactor

1. ✅ **State management done** - Using `tmc_state_get/set()`

2. ⏳ **Refactor prompt** - Use state container:
   ```bash
   midi_repl_prompt() {
       local cc=$(tmc_state_get "last_cc_value")
       local mode=$(tmc_state_get "broadcast_mode")
       echo "♫ tmc [$mode] cc$cc ● > "
   }
   ```

3. ⏳ **Optional: Use TDS colors** - Instead of hardcoded ANSI:
   ```bash
   local heading=$(tds_text_color "content.heading.h1")
   echo "${heading}tmc${TETRA_NC} > "
   ```

4. ⏳ **Optional: Migrate to Pattern 2** - If you want built-in commands

---

## Questions You Should Be Able to Answer Now

**Q: How does REPL know when to rebuild the prompt?**
A: Every loop iteration, before reading input.

**Q: How does it know to call MY prompt builder?**
A: You register it: `REPL_PROMPT_BUILDERS+=("midi_repl_prompt")`

**Q: What's the difference between bash/prompt and bash/repl?**
A: bash/prompt is for shell PS1, bash/repl is for REPL apps. Different things!

**Q: How does my prompt see state changes?**
A: You update state with `tmc_state_set()`, next loop iteration your prompt builder queries it with `tmc_state_get()`.

**Q: Do I need to use TDS?**
A: No, optional. You can use raw ANSI codes. TDS gives you semantic tokens and themes.

**Q: What's bash/tui for?**
A: Full-screen TUIs (like htop). Not needed for line-based REPLs like MIDI.

Ready to refactor the MIDI prompt now?
