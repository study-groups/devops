# Interactive UI Patterns in Tetra

**Document Version:** 1.0
**Date:** 2025-11-02
**Location:** `/Users/mricos/src/devops/tetra/bash/docs/INTERACTIVE_UI_PATTERNS.md`

## Overview

This document catalogs all interactive UI systems in the Tetra codebase that use sophisticated prompt patterns, particularly the `[env x mode] action:noun >` format and related variations. These REPLs provide consistent, context-aware command interfaces across different Tetra modules.

---

## 1. Unicode Explorer UIs

### 1.1 Unicode Explorer V2 (TDS-Powered)

**Location:** `bash/repl/experiments/unicode_explorer_v2.sh`

**Format:**
```
  ⠿         (large character display)

     U+28FF  Braille  [256/256]
     ↑↓ nav | ← → banks | 1,2,3,4 | 11,22,33,44 lock | random, save, quit
     state:1 map:1234 | s=save m=edit-map []=cycle-state
 ──────────────────────────────────────────────────────────────
 ⠿⠿ ::
 ⠿⠿
```

**Architecture:**
- **Two-layer rendering system:**
  - Content Model: What to display (data)
  - Layout Regions: Where to display (presentation)

**Components:**
- Character Inspector: Browser (scope-lens into UTF-8 space)
- Glyph Matrix: 2x2 composition canvas
- Tetra Prompt: Complete composition (inspector + matrix)

**Modes:**
- `explorer`: Full layout with browser
- `qa`: Question/Answer mode (Q: / A:)
- `shell`: Shell prompt mode (>)
- `minimal`: Matrix only

**Features:**
- 4-slot matrix with remappable states
- Double-tap locking (press 1 twice to lock slot 1)
- TDS design token theming
- Responsive layout (adapts to terminal width)
- 10 curated Unicode banks:
  - Braille (U+2800, 256 chars)
  - Box (U+2500, 128 chars)
  - Block (U+2580, 32 chars)
  - BlockShade (U+2590, 16 chars)
  - BlockGeom (U+25E0, 32 chars)
  - BlockQuad (U+2596, 16 chars)
  - Arrow (U+2190, 112 chars)
  - Geometric (U+25A0, 96 chars)
  - Symbol (U+2600, 100 chars)
  - Dingbat (U+2700, 96 chars)

**Controls:**
- `↑↓`: Navigate characters
- `←→`: Switch banks
- `1-4`: Assign current character to slot
- `11-44`: Double-tap to lock/unlock slot
- `[]`: Cycle through 4 mapping states
- `r`: Random fill (respects locks)
- `m`: Edit mapping string
- `s`: Save current configuration
- `?`: QA mode
- `:`: Shell mode
- `q`: Quit

**State System:**
- 4 independent mapping configurations
- Default mappings: `1234`, `2143`, `3412`, `4321`
- Custom mappings via `m` command
- Example: `1320` = slot1, slot3, slot2, blank

### 1.2 Unicode Explorer V1 (Basic)

**Location:** `bash/repl/experiments/unicode_explorer.sh`

**Format:**
```
  ⠿

     U+28FF  Braille  [256/256]
     ↑↓ nav | ← → banks | 1,2,3,4 | SHIFT+# lock | random, save, quit
     state:1 map:1234 | s=save m=edit-map []=cycle-state
 ────────────────────────────────────────────────────────────
 🔒⠿🔒⠿ ::
 ⠿⠿
```

**Differences from V2:**
- Simpler rendering (no TDS theming)
- Uses lock emoji 🔒 instead of color indicators
- SHIFT+number for locking (!, @, #, $)
- Same bank system and core functionality

---

## 2. Context-Based REPL Patterns

### 2.1 ORG REPL

**Location:** `bash/org/org_repl.sh:157-237`

**Format:**
```
[org] env × mode → action ▶
```

**Implementation:**
```bash
# State arrays
ENV_OPTIONS=("dev" "stage" "prod")
MODE_OPTIONS=("shell" "notebook" "workflow")
ACTION_OPTIONS=("list" "create" "delete" "modify")

# Current indices
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0

# Build prompt
current_env="${ENV_OPTIONS[$ENV_INDEX]}"
current_mode="${MODE_OPTIONS[$MODE_INDEX]}"
current_action="${ACTION_OPTIONS[$ACTION_INDEX]}"
prompt="[org] $current_env × $current_mode → $current_action ▶ "
```

**Navigation Commands:**
- `e` or `env`: Cycle environment (dev → stage → prod)
- `m` or `mode`: Cycle mode (shell → notebook → workflow)
- `a` or `action`: Cycle action (list → create → delete → modify)
- `n` or `next`: Execute current action
- `q`: Quit

**Pattern:**
- Modulo arithmetic for cycling: `ENV_INDEX = (ENV_INDEX + 1) % ${#ENV_OPTIONS[@]}`
- Separator characters: `×` (multiply sign), `→` (arrow), `▶` (play)
- Context flows left-to-right: environment → mode → action

### 2.2 GAME REPL

**Location:** `bash/game/game_repl.sh:36-95`

**Format:**
```
[org x user x game] >
```

**Example:**
```
[myorg x alice x tetris] > ls
[myorg x alice x tetris] > play
[myorg x alice x tetris] > status
```

**Implementation:**
```bash
build_prompt() {
    local org="${GAME_ORG:-default}"
    local user="${GAME_USER:-guest}"
    local game="${GAME_CURRENT:-none}"
    echo "[$org x $user x $game] > "
}
```

**Commands:**
- `ls`: List available games
- `play [game]`: Launch game
- `org [name]`: Switch organization
- `user [name]`: Switch user
- `status`: Show current context
- `help`: Display commands
- `quit`: Exit

**Three-Level Context:**
1. Organization: Workspace/tenant
2. User: Identity/profile
3. Game: Active game instance

### 2.3 TETRA REPL

**Location:** `bash/tetra/interfaces/repl.sh:12-17`

**Format:**
```
[org × env × mode] tetra>
```

**Example:**
```
[default × dev × shell] tetra> /help
[default × dev × shell] tetra> /org list
[default × dev × shell] tetra> /mode notebook
```

**Features:**
- Uses tcurses for input handling
- Slash commands for system operations
- Integration with prompt_manager.sh

**Slash Commands:**
- `/org [name]`: Switch organization
- `/env [name]`: Switch environment
- `/mode [name]`: Switch mode
- `/context`: Show full context
- `/help`: Display help

### 2.4 TKM REPL (SSH Key Management)

**Location:** `bash/tkm/tkm_repl.sh:19-27`

**Format:**
```
tkm:current_org>
```

**Example:**
```
tkm:myorg> generate alice
tkm:myorg> deploy alice prod
tkm:myorg> status
```

**Commands:**
- `generate [user]`: Generate new SSH key pair
- `deploy [user] [env]`: Deploy keys to environment
- `rotate [user]`: Rotate existing keys
- `revoke [user]`: Revoke access
- `status`: Show key status
- `list`: List all keys
- `help`: Display help

**Simpler Pattern:**
- Single context dimension (organization)
- Colon separator
- Traditional `>` prompt

### 2.5 RAG REPL (Retrieval-Augmented Generation)

**Location:** `bash/rag/rag_repl.sh`

**Format:**
```
rag> /flow start
rag> /e add evidence.txt
rag> /select keywords
rag> /assemble report
```

**Command Prefixes:**
- `/flow`: Workflow management
  - `/flow start`: Begin new workflow
  - `/flow status`: Show current flow
  - `/flow reset`: Clear workflow
- `/e`: Evidence management
  - `/e add [file]`: Add evidence
  - `/e list`: Show evidence
  - `/e clear`: Remove all
- `/select`: Selection operations
- `/assemble`: Assembly operations
- `/submit`: Submit for processing

**Pattern:**
- Prefix-based command routing
- Workflow state management
- Evidence-based processing

---

## 3. Game Engine REPLs

### 3.1 PULSAR REPL

**Location:** `bash/game/games/pulsar/pulsar_repl.sh:284-298`

**Format:**
```
⚡ pulsar >    (engine running)
💤 pulsar >    (engine stopped)
```

**Implementation:**
```bash
build_prompt() {
    local status_symbol
    if pulsar_engine_is_running; then
        status_symbol="⚡"
    else
        status_symbol="💤"
    fi
    echo "$status_symbol pulsar > "
}
```

**Commands:**
- `start`: Start game engine
- `stop`: Stop engine
- `load [sprite]`: Load sprite
- `render`: Render current frame
- `status`: Engine status
- `help`: Display help

**Features:**
- Visual engine state indicator
- Protocol-based sprite management
- Real-time status updates

### 3.2 FORMANT REPL

**Location:** `bash/game/games/formant/formant_repl.sh:63-103`

**Format:**
```
[formant 🎙️] >    (microphone mode)
[formant 🔊] >    (speaker mode)
```

**Implementation:**
```bash
build_prompt() {
    local mode_symbol
    if [[ "$FORMANT_MODE" == "input" ]]; then
        mode_symbol="🎙️"
    else
        mode_symbol="🔊"
    fi
    echo "[formant $mode_symbol] > "
}
```

**Commands:**
- `synth [text]`: Synthesize speech
- `play [file]`: Play audio file
- `record`: Start recording
- `stop`: Stop recording
- `mode [input|output]`: Switch mode
- `list`: List available voices
- `help`: Display help

**Vocal Synthesis Features:**
- Input mode: Voice recording/processing
- Output mode: Speech synthesis/playback
- Audio pipeline integration

### 3.3 ESTOFACE REPL

**Location:** `bash/game/games/estoface/core/estoface_repl.sh:170-189`

**Format:**
```
🏗️ estoface ▶    (building mode)
🔊 estoface ▶    (audio mode)
```

**Implementation:**
```bash
build_prompt() {
    local status
    if estoface_is_building; then
        status="🏗️"
    else
        status="🔊"
    fi
    echo "$status estoface ▶ "
}
```

**Commands:**
- `build`: Build facial model
- `animate`: Start animation
- `render`: Render frame
- `audio [file]`: Load audio for lip-sync
- `export [format]`: Export model
- `status`: Show build status
- `help`: Display help

**Audio-Visual Synthesis:**
- Facial modeling system
- Lip-sync integration
- TUI binary launcher
- Multi-modal output

---

## 4. Framework Components

### 4.1 Prompt Manager

**Location:** `bash/repl/prompt_manager.sh:6-82`

**Purpose:** Universal prompt building system with registerable builders

**Core Function:**
```bash
repl_prompt_context() {
    local org="${TETRA_ORG:-default}"
    local env="${TETRA_ENV:-dev}"
    local mode="${TETRA_MODE:-shell}"
    echo "[$org × $env × $mode]"
}
```

**Registration System:**
```bash
# Register custom prompt builder
register_prompt_builder() {
    local name="$1"
    local builder_func="$2"
    PROMPT_BUILDERS["$name"]="$builder_func"
}

# Use registered builder
get_prompt() {
    local builder_name="${1:-default}"
    local builder_func="${PROMPT_BUILDERS[$builder_name]}"
    if [[ -n "$builder_func" ]]; then
        "$builder_func"
    else
        repl_prompt_context
    fi
}
```

**Features:**
- Centralized prompt construction
- Plugin architecture for custom builders
- Default context builder
- Consistent separator usage (`×`)

### 4.2 TDS REPL UI Semantics

**Location:** `bash/tds/semantics/repl_ui.sh:78-125`

**Purpose:** Design token-based prompt rendering with theming support

**Core Function:**
```bash
tds_repl_build_prompt() {
    local org="$1"
    local env="$2"
    local mode="$3"

    tds_text_color "repl.context.org"
    printf "["
    tds_text_color "repl.context.value"
    printf "%s" "$org"
    reset_color

    tds_text_color "repl.context.separator"
    printf " × "
    reset_color

    tds_text_color "repl.context.env"
    printf "%s" "$env"
    reset_color

    tds_text_color "repl.context.separator"
    printf " × "
    reset_color

    tds_text_color "repl.context.mode"
    printf "%s" "$mode"
    tds_text_color "repl.context.org"
    printf "]"
    reset_color

    tds_text_color "repl.prompt.symbol"
    printf " > "
    reset_color
}
```

**Design Tokens:**
- `repl.context.org`: Organization color
- `repl.context.env`: Environment color
- `repl.context.mode`: Mode color
- `repl.context.value`: Value text color
- `repl.context.separator`: Separator color
- `repl.prompt.symbol`: Prompt symbol color

**Theming Support:**
- Consistent color schemes
- Token-based styling
- Easy theme switching
- Accessibility support

---

## 5. Prompt Pattern Analysis

### 5.1 Bracket Notation Patterns

**Three-Context Pattern:**
```
[context1 × context2 × context3]
```

**Examples:**
- `[org × env × mode]` - System context
- `[org x user x game]` - User context
- `[org x env x mode]` - Mixed notation

**Single-Context Pattern:**
```
[name]
```

**Examples:**
- `[formant 🎙️]` - With status symbol
- `[org]` - Simple wrapper

### 5.2 Separator Characters

**Unicode Multiply Sign (`×`, U+00D7):**
- Used in: org, tetra REPLs
- Visual weight: Medium
- Semantics: Cartesian product, context combination
- Example: `[org × env × mode]`

**ASCII 'x' (lowercase):**
- Used in: game REPL
- Visual weight: Light
- Semantics: Informal multiplication, casual separator
- Example: `[org x user x game]`

**Colon (`:`):**
- Used in: tkm REPL
- Visual weight: Light
- Semantics: Namespace, scope qualifier
- Example: `tkm:myorg>`

**Arrow (`→`, U+2192):**
- Used in: org REPL action flow
- Visual weight: Heavy
- Semantics: Direction, flow, causation
- Example: `env × mode → action`

### 5.3 Prompt Ending Symbols

**Right Angle Bracket (`>`):**
- Most common
- Standard shell convention
- Examples: `tkm:org>`, `rag>`, `pulsar >`

**Black Right-Pointing Triangle (`▶`, U+25B6):**
- Used in: org, estoface REPLs
- Semantics: Play, execute, action
- Example: `[org] env × mode → action ▶`

**Custom Symbols:**
- Status indicators: `⚡`, `💤`, `🎙️`, `🔊`, `🏗️`
- Mode indicators in prompt position
- Visual state representation

### 5.4 Context Flow Patterns

**Left-to-Right Hierarchy:**
```
[broader_context × specific_context × mode] command >
```

**Typical Flow:**
1. Organization/namespace (broadest)
2. Environment/user (medium)
3. Mode/state (most specific)
4. Action/command (optional)
5. Prompt symbol

**Example Breakdown:**
```
[myorg × prod × shell] tetra>
 └─┬──┘   └┬─┘   └─┬─┘   └──┬─┘
   │       │       │         └─ Interface name + prompt
   │       │       └─────────── Current mode
   │       └─────────────────── Target environment
   └─────────────────────────── Organization scope
```

---

## 6. State Management Patterns

### 6.1 Index-Based Cycling

**Pattern:**
```bash
# Define options
OPTIONS=("opt1" "opt2" "opt3")

# Current index
INDEX=0

# Cycle forward
cycle_next() {
    INDEX=$(( (INDEX + 1) % ${#OPTIONS[@]} ))
}

# Cycle backward
cycle_prev() {
    INDEX=$(( (INDEX - 1 + ${#OPTIONS[@]}) % ${#OPTIONS[@]} ))
}

# Get current value
get_current() {
    echo "${OPTIONS[$INDEX]}"
}
```

**Used in:**
- ORG REPL: env, mode, action cycling
- Unicode Explorer: bank navigation

### 6.2 Multi-State Mapping

**Pattern:**
```bash
# Multiple independent states
declare -a STATES=("" "1234" "2143" "3412" "4321")
CURRENT_STATE=1

# Apply mapping
apply_state() {
    local state="${STATES[$CURRENT_STATE]}"
    for i in {1..4}; do
        local map_char="${state:$((i-1)):1}"
        # Apply transformation
    done
}
```

**Used in:**
- Unicode Explorer: slot remapping
- Complex state transformations

### 6.3 Boolean Lock Pattern

**Pattern:**
```bash
# Lock array (1-indexed for slots)
declare -a LOCKED=(false false false false false)

# Toggle lock
toggle_lock() {
    local slot=$1
    if [[ "${LOCKED[$slot]}" == "true" ]]; then
        LOCKED[$slot]=false
    else
        LOCKED[$slot]=true
    fi
}

# Check lock before operation
if [[ "${LOCKED[$slot]}" != "true" ]]; then
    # Perform operation
fi
```

**Used in:**
- Unicode Explorer: slot locking
- Protected state management

### 6.4 Double-Tap Detection

**Pattern:**
```bash
# Track last key and time
LAST_KEY=""
LAST_KEY_TIME=0

# In input loop
current_time=$(($(date +%s) * 1000))

if [[ "$key" == "$LAST_KEY" ]]; then
    time_diff=$((current_time - LAST_KEY_TIME))
    if ((time_diff < 500)); then
        # Double-tap detected
        handle_double_tap "$key"
    fi
fi

LAST_KEY="$key"
LAST_KEY_TIME="$current_time"
```

**Used in:**
- Unicode Explorer V2: lock toggling
- Gesture-based input

---

## 7. Common UI Components

### 7.1 Character Inspector (Unicode Explorer)

**Purpose:** Scope-lens into UTF-8 space

**Layout:**
```
  ⠿         ← Large specimen

     U+28FF  Braille  [256/256]  ← Metadata
     ↑↓ nav | ← → banks | ...   ← Controls
```

**Implementation:**
```bash
render_character_inspector() {
    # Specimen line
    echo ""
    printf "  %s\n" "${CONTENT_MODEL[candidate_glyph]}"
    echo ""

    # Metadata line
    printf "     U+%s  %s  [%s]\n" \
        "${CONTENT_MODEL[candidate_code]}" \
        "${CONTENT_MODEL[candidate_category]}" \
        "${CONTENT_MODEL[candidate_position]}"
}
```

### 7.2 Separator Line

**Purpose:** Visual boundary between browser and canvas

**Implementations:**

**Simple:**
```bash
echo " ────────────────────────────────────────────────────────────"
```

**Dynamic Width:**
```bash
render_separator() {
    local sep_char="─"
    local width="${COLUMNS:-80}"
    printf " "
    for ((i=0; i<width-2; i++)); do
        printf "%s" "$sep_char"
    done
    echo ""
}
```

**Box Drawing Characters:**
- `─` (U+2500): Horizontal line
- `━` (U+2501): Heavy horizontal
- `═` (U+2550): Double horizontal

### 7.3 Control Hints

**Purpose:** Display available commands

**Pattern:**
```bash
render_controls() {
    printf "     "
    printf "↑↓ nav"
    printf " | "
    printf "← → banks"
    printf " | "
    printf "1,2,3,4"
    printf " | "
    printf "11,22,33,44 lock"
    printf " | "
    printf "random, save, quit"
    echo ""
}
```

**With TDS Theming:**
```bash
render_controls() {
    printf "     "
    tds_text_color "uex.controls.arrow"
    printf "↑↓"
    reset_color
    printf " "
    tds_text_color "uex.controls.description"
    printf "nav"
    reset_color
    tds_text_color "uex.controls.separator"
    printf " | "
    reset_color
    # ... continue pattern
}
```

### 7.4 Status Indicators

**Symbol-Based:**
```bash
# Engine status
⚡  # Running
💤  # Stopped

# Audio mode
🎙️  # Input/recording
🔊  # Output/playback

# Build status
🏗️  # Building
🔊  # Ready

# Lock status
🔒  # Locked
```

**Color-Based (TDS):**
```bash
tds_text_color "uex.slot.primary"         # Normal state
tds_text_color "uex.slot.primary_locked"  # Locked state
```

---

## 8. Rendering Architecture

### 8.1 Two-Layer System (Unicode Explorer V2)

**Layer 1: Content Model**
```bash
declare -gA CONTENT_MODEL=(
    [candidate_glyph]=" "
    [candidate_code]="0000"
    [candidate_category]="None"
    [matrix_slot_1]=" "
    [matrix_slot_2]=" "
    [matrix_slot_3]=" "
    [matrix_slot_4]=" "
    [mode_name]="explorer"
    [lock_1]="false"
    # ... etc
)
```

**Layer 2: Layout Regions**
```bash
render_frame() {
    local layout="$1"

    tput cup 0 0  # Reset cursor
    tput ed       # Clear screen

    # Render regions top to bottom
    render_character_inspector "$layout"
    render_controls "$layout"
    render_state_info "$layout"
    render_separator "$layout"
    render_glyph_matrix "$layout"
}
```

**Benefits:**
- Separation of data from presentation
- Easy layout switching
- Responsive design support
- Testable components

### 8.2 Breakpoint System

**Implementation:**
```bash
get_breakpoint() {
    local cols="${COLUMNS:-80}"

    if ((cols >= 120)); then
        echo "wide"
    elif ((cols >= 80)); then
        echo "normal"
    elif ((cols >= 60)); then
        echo "compact"
    else
        echo "minimal"
    fi
}

select_layout() {
    local mode="$1"
    local breakpoint="${2:-$(get_breakpoint)}"

    case "$mode" in
        explorer)
            case "$breakpoint" in
                minimal) echo "minimal" ;;
                compact) echo "compact" ;;
                *) echo "explorer" ;;
            esac
            ;;
        *)
            echo "$mode"
            ;;
    esac
}
```

**Breakpoints:**
- `wide` (≥120 cols): Full interface with extra padding
- `normal` (≥80 cols): Standard interface
- `compact` (≥60 cols): Reduced metadata
- `minimal` (<60 cols): Matrix only

### 8.3 Conditional Rendering

**Pattern:**
```bash
render_component() {
    local layout="$1"

    # Skip in certain layouts
    [[ "$layout" != "explorer" && "$layout" != "compact" ]] && return

    # Render component
    # ...
}
```

**Used for:**
- Hiding controls in minimal mode
- Adjusting metadata display
- Responsive layout changes

---

## 9. Input Handling Patterns

### 9.1 Escape Sequence Processing

**Pattern:**
```bash
IFS= read -rsn1 key

case "$key" in
    $'\x1b')  # Escape sequence
        read -rsn2 -t 0.01 key
        case "$key" in
            "[A")  # Up arrow
                handle_up
                ;;
            "[B")  # Down arrow
                handle_down
                ;;
            "[C")  # Right arrow
                handle_right
                ;;
            "[D")  # Left arrow
                handle_left
                ;;
        esac
        ;;

    # Direct key handling
    "q"|"Q")
        quit
        ;;

    # Single character commands
    [1-4])
        handle_slot "$key"
        ;;
esac
```

**Escape Sequences:**
- `\x1b[A`: Up arrow
- `\x1b[B`: Down arrow
- `\x1b[C`: Right arrow
- `\x1b[D`: Left arrow
- `\x1b`: Escape (mode switch)

### 9.2 Multi-Key Detection

**Shift Modifiers:**
```bash
case "$key" in
    "!")  # Shift+1
        handle_lock 1
        ;;
    "@")  # Shift+2
        handle_lock 2
        ;;
    "#")  # Shift+3
        handle_lock 3
        ;;
    "$")  # Shift+4
        handle_lock 4
        ;;
esac
```

**Double-Tap:**
```bash
# See section 6.4 for full implementation
if [[ "$key" == "$LAST_KEY" ]] && ((time_diff < 500)); then
    handle_double_tap "$key"
fi
```

### 9.3 Command Parsing

**Slash Commands:**
```bash
case "$input" in
    /org*)
        handle_org_command "${input#/org}"
        ;;
    /env*)
        handle_env_command "${input#/env}"
        ;;
    /mode*)
        handle_mode_command "${input#/mode}"
        ;;
    *)
        handle_default_command "$input"
        ;;
esac
```

**Prefix-Based Routing:**
```bash
case "$input" in
    /flow*)
        rag_handle_flow "${input#/flow}"
        ;;
    /e*|/evidence*)
        rag_handle_evidence "${input#/e}"
        ;;
    /select*)
        rag_handle_select "${input#/select}"
        ;;
esac
```

---

## 10. Persistence Patterns

### 10.1 File-Based State

**Save Pattern:**
```bash
save_slots() {
    local s1="$1" s2="$2" s3="$3" s4="$4"
    local mapping="${5:-1234}"

    # Apply mapping transformation
    local -a out=(" " " " " " " ")
    # ... mapping logic ...

    # Write to file
    printf "%s\n%s\n%s\n%s\n" \
        "${out[1]}" "${out[2]}" "${out[3]}" "${out[4]}" \
        > "$SAVE_FILE"
}
```

**Load Pattern:**
```bash
load_slots() {
    if [[ -f "$SAVE_FILE" ]]; then
        local -a loaded
        mapfile -t loaded < "$SAVE_FILE"
        echo "${loaded[0]:-}" "${loaded[1]:-}" \
             "${loaded[2]:-}" "${loaded[3]:-}"
    else
        echo " " " " " " " "  # Defaults
    fi
}
```

**Files:**
- Unicode Explorer: `current_prompt.txt`
- State format: Line-delimited values
- Graceful fallback to defaults

### 10.2 Environment Variables

**Context Storage:**
```bash
# Set context
export TETRA_ORG="myorg"
export TETRA_ENV="prod"
export TETRA_MODE="shell"

# Read context
org="${TETRA_ORG:-default}"
env="${TETRA_ENV:-dev}"
mode="${TETRA_MODE:-shell}"
```

**Game Context:**
```bash
export GAME_ORG="myorg"
export GAME_USER="alice"
export GAME_CURRENT="tetris"
```

**Benefits:**
- Shell-level persistence
- Cross-session availability
- Easy inspection/debugging

---

## 11. Terminal Control

### 11.1 Cursor Management

**Hide/Show:**
```bash
tput civis  # Hide cursor (invisible)
tput cnorm  # Show cursor (normal)
```

**Positioning:**
```bash
tput cup row col  # Move to row,col
tput cup 0 0      # Top-left corner
tput cup 8 0      # Line 8, column 0
```

**Clear Operations:**
```bash
tput clear  # Clear entire screen
tput ed     # Clear from cursor down
tput el     # Clear from cursor to end of line
```

### 11.2 Frame Rendering

**Pattern:**
```bash
render_frame() {
    # Position at top
    tput cup 0 0

    # Clear screen
    tput ed

    # Render components
    render_header
    render_body
    render_footer

    # Clear to end of each line
    tput el
}
```

**Benefits:**
- Flicker-free updates
- Efficient screen usage
- Clean line endings

### 11.3 Input Modes

**Raw Input:**
```bash
# Read single character without echo
IFS= read -rsn1 key

# Options:
# -r: Raw (don't interpret backslashes)
# -s: Silent (don't echo)
# -n1: Read 1 character
```

**Timed Input:**
```bash
# Read with timeout
read -rsn2 -t 0.01 key

# -t: Timeout in seconds
# Useful for escape sequence parsing
```

**Normal Input:**
```bash
# Read line with echo
tput cnorm  # Show cursor
read -r user_input
tput civis  # Hide cursor
```

---

## 12. Design Recommendations

### 12.1 Prompt Format Guidelines

**Context Brackets:**
- Use `[` `]` for context enclosure
- Prefer `×` (U+00D7) for formal interfaces
- Use lowercase `x` for casual/game interfaces
- Limit to 3 context levels maximum

**Separator Choices:**
- `×`: Context combination (org × env × mode)
- `:`: Namespace/scope (module:context)
- `→`: Action flow (context → action)
- `|`: Alternative/choice (opt1 | opt2)

**Prompt Symbols:**
- `>`: Standard shell convention
- `▶`: Actionable/executable interfaces
- Custom symbols: Status-dependent (⚡, 💤, 🎙️)

### 12.2 State Management Best Practices

**Index-Based Cycling:**
```bash
# Always use modulo for wrapping
INDEX=$(( (INDEX + 1) % ${#ARRAY[@]} ))

# Handle negative wrap for reverse
INDEX=$(( (INDEX - 1 + ${#ARRAY[@]}) % ${#ARRAY[@]} ))
```

**Lock Mechanism:**
```bash
# Use boolean strings for clarity
LOCKED=("false" "false" "false" "false")

# Explicit comparison
if [[ "${LOCKED[$i]}" == "true" ]]; then
    # Handle locked state
fi
```

**Double-Tap Detection:**
```bash
# Use milliseconds for portability
current_time=$(($(date +%s) * 1000))

# Reasonable threshold: 300-500ms
if ((time_diff < 500)); then
    # Double-tap confirmed
fi
```

### 12.3 Rendering Optimization

**Two-Layer Architecture:**
1. Content Model: Pure data (associative arrays)
2. Layout Layer: Pure presentation (functions)

**Conditional Rendering:**
```bash
# Skip components based on layout
[[ "$layout" != "full" ]] && return

# Adjust detail level
if [[ "$layout" == "minimal" ]]; then
    render_compact
else
    render_detailed
fi
```

**Responsive Design:**
```bash
# Use breakpoints consistently
case "$(get_breakpoint)" in
    wide)    render_wide ;;
    normal)  render_normal ;;
    compact) render_compact ;;
    minimal) render_minimal ;;
esac
```

### 12.4 TDS Integration

**When to Use TDS:**
- Complex UIs with multiple color regions
- Interfaces requiring theme support
- Professional/polished applications

**Token Naming Convention:**
```
module.component.state[.variant]

Examples:
repl.context.org
repl.prompt.symbol
uex.slot.primary_locked
uex.metadata.unicode
```

**Color Application:**
```bash
# Set color
tds_text_color "token.path"
printf "text"
reset_color

# Always reset after colored text
```

### 12.5 Documentation Standards

**File Headers:**
```bash
#!/usr/bin/env bash
# module_name.sh - One-line description
#
# SEMANTIC FRAMING:
#   term1 - Definition
#   term2 - Definition
#
# ARCHITECTURE:
#   - Component descriptions
#   - Design decisions
```

**Function Documentation:**
```bash
# Function description
# Usage: function_name arg1 arg2
# Returns: description of return value
function_name() {
    # Implementation
}
```

---

## 13. Unicode Character Reference

### 13.1 Common UI Characters

**Box Drawing:**
```
─  U+2500  Box Drawings Light Horizontal
━  U+2501  Box Drawings Heavy Horizontal
│  U+2502  Box Drawings Light Vertical
┃  U+2503  Box Drawings Heavy Vertical
═  U+2550  Box Drawings Double Horizontal
║  U+2551  Box Drawings Double Vertical
```

**Arrows:**
```
←  U+2190  Leftwards Arrow
↑  U+2191  Upwards Arrow
→  U+2192  Rightwards Arrow
↓  U+2193  Downwards Arrow
```

**Geometric:**
```
▶  U+25B6  Black Right-Pointing Triangle
▷  U+25B7  White Right-Pointing Triangle
▼  U+25BC  Black Down-Pointing Triangle
▽  U+25BD  White Down-Pointing Triangle
```

**Mathematical:**
```
×  U+00D7  Multiplication Sign
÷  U+00F7  Division Sign
±  U+00B1  Plus-Minus Sign
```

**Status Symbols:**
```
⚡  U+26A1  High Voltage Sign
💤  U+1F4A4  Sleeping Symbol
🎙️  U+1F399  Studio Microphone
🔊  U+1F50A  Speaker With Three Sound Waves
🏗️  U+1F3D7  Building Construction
🔒  U+1F512  Lock
```

### 13.2 Unicode Banks (from Unicode Explorer)

| Bank | Start | Count | Category | Example |
|------|-------|-------|----------|---------|
| Braille | U+2800 | 256 | Braille | ⠿ |
| Box | U+2500 | 128 | Box Drawing | ─ │ ┌ |
| Block | U+2580 | 32 | Block Elements | █ ▀ ▄ |
| BlockShade | U+2590 | 16 | Block Elements | ░ ▒ ▓ |
| BlockGeom | U+25E0 | 32 | Geometric | ◠ ◡ ◢ |
| BlockQuad | U+2596 | 16 | Block Elements | ▖ ▗ ▘ |
| Arrow | U+2190 | 112 | Arrows | ← ↑ → ↓ |
| Geometric | U+25A0 | 96 | Geometric | ■ □ ▲ △ |
| Symbol | U+2600 | 100 | Miscellaneous | ☀ ☁ ☂ |
| Dingbat | U+2700 | 96 | Dingbats | ✁ ✂ ✃ |

---

## 14. Testing Strategies

### 14.1 Manual Testing Checklist

**Prompt Display:**
- [ ] All context elements display correctly
- [ ] Separators render properly (not garbled)
- [ ] Unicode symbols display (not boxes/�)
- [ ] Colors apply correctly (if using TDS)
- [ ] Prompt width fits terminal

**Navigation:**
- [ ] Arrow keys work as expected
- [ ] Cycling wraps correctly (forward/backward)
- [ ] Context switches persist
- [ ] State updates immediately

**Input Handling:**
- [ ] All documented keys work
- [ ] Invalid input ignored gracefully
- [ ] Special characters handled
- [ ] Escape sequences parsed correctly

**State Management:**
- [ ] State persists across commands
- [ ] Locks function properly
- [ ] Save/load works correctly
- [ ] Defaults apply when appropriate

**Terminal Compatibility:**
- [ ] Works in bash 5.2+
- [ ] Works in various terminal emulators
- [ ] Handles window resize
- [ ] Cursor hidden during operation
- [ ] Cursor restored on exit

### 14.2 Automated Testing

**Unit Tests:**
```bash
# Test cycling logic
test_cycle_next() {
    INDEX=0
    OPTIONS=("a" "b" "c")

    cycle_next
    assert_equal "$INDEX" "1"

    cycle_next
    assert_equal "$INDEX" "2"

    cycle_next
    assert_equal "$INDEX" "0"  # Wrapped
}
```

**Integration Tests:**
```bash
# Test prompt building
test_prompt_build() {
    TETRA_ORG="test"
    TETRA_ENV="dev"
    TETRA_MODE="shell"

    result=$(repl_prompt_context)
    expected="[test × dev × shell]"

    assert_equal "$result" "$expected"
}
```

### 14.3 Performance Considerations

**Frame Rate:**
- Target: 30+ FPS for smooth interaction
- Minimize rendering work per frame
- Use incremental updates when possible

**Input Latency:**
- Target: <100ms response time
- Avoid blocking operations in input loop
- Use timeouts appropriately

**Memory Usage:**
- Keep state arrays reasonably sized
- Avoid memory leaks in loops
- Clean up on exit

---

## 15. Common Issues and Solutions

### 15.1 Unicode Display Issues

**Problem:** Boxes or � instead of Unicode characters

**Solutions:**
1. Verify terminal supports UTF-8:
   ```bash
   echo $LANG  # Should include UTF-8
   export LANG=en_US.UTF-8
   ```

2. Check font support:
   - Use fonts with good Unicode coverage
   - Examples: Noto Sans Mono, DejaVu Sans Mono

3. Test specific character:
   ```bash
   printf "\U25B6"  # Should show ▶
   ```

### 15.2 Escape Sequence Problems

**Problem:** Arrow keys print `^[[A` instead of navigating

**Solutions:**
1. Ensure raw input mode:
   ```bash
   IFS= read -rsn1 key  # -r is critical
   ```

2. Check escape sequence parsing:
   ```bash
   case "$key" in
       $'\x1b')  # Use $'\x1b' not "\e"
           read -rsn2 -t 0.01 key
           ;;
   esac
   ```

3. Terminal compatibility:
   - Some terminals use different sequences
   - Test with standard terminfo entries

### 15.3 Color Not Working

**Problem:** TDS colors not displaying

**Solutions:**
1. Verify TDS loaded:
   ```bash
   type tds_text_color &>/dev/null || source tds.sh
   ```

2. Check token exists:
   ```bash
   tds_text_color "module.component.state"
   # Should not error
   ```

3. Terminal color support:
   ```bash
   tput colors  # Should return 8, 16, 256, or more
   ```

### 15.4 State Not Persisting

**Problem:** State resets unexpectedly

**Solutions:**
1. Check file permissions:
   ```bash
   touch "$SAVE_FILE"  # Verify writable
   ```

2. Verify save calls:
   ```bash
   # Add debug logging
   save_slots() {
       echo "Saving: $*" >&2
       # ... actual save logic
   }
   ```

3. Environment variables:
   ```bash
   # Export for persistence
   export TETRA_ORG="myorg"  # Not just: TETRA_ORG="myorg"
   ```

### 15.5 Cursor Visible After Exit

**Problem:** Cursor remains hidden after program exits

**Solutions:**
1. Trap exit signals:
   ```bash
   cleanup() {
       tput cnorm  # Restore cursor
       tput clear
   }
   trap cleanup EXIT INT TERM
   ```

2. Ensure cleanup in all paths:
   ```bash
   quit_repl() {
       tput cnorm
       tput clear
       exit 0
   }
   ```

---

## 16. Future Directions

### 16.1 Potential Enhancements

**Mouse Support:**
- Click to select slots
- Drag to reorder
- Scroll wheel for navigation

**History System:**
- Command history with up/down
- Search history with Ctrl+R
- Persistent history file

**Autocomplete:**
- Tab completion for commands
- Context-aware suggestions
- Fuzzy matching

**Help System:**
- In-app help viewer
- Context-sensitive help
- Interactive tutorials

### 16.2 Standardization Opportunities

**Shared Input Handler:**
- Common key binding system
- Pluggable key maps
- Rebinding support

**Unified State Manager:**
- Generic state persistence
- Transaction support
- Undo/redo capability

**Component Library:**
- Reusable UI components
- Consistent styling
- Easy composition

**Testing Framework:**
- REPL testing utilities
- Mock input generation
- Output verification

### 16.3 Documentation Needs

**Video Tutorials:**
- Screen recordings of each REPL
- Feature demonstrations
- Best practices

**Interactive Examples:**
- Live coding sessions
- Step-by-step guides
- Common use cases

**API Reference:**
- Complete function signatures
- Parameter descriptions
- Return value documentation
- Usage examples

---

## Appendix A: Quick Reference

### Common Patterns Summary

**Prompt Formats:**
```
[org × env × mode]           # System context
[org x user x game]          # User context
module:context>              # Simple scope
symbol module ▶              # Status + name
```

**State Cycling:**
```bash
INDEX=$(( (INDEX + 1) % ${#ARRAY[@]} ))
```

**Lock Check:**
```bash
[[ "${LOCKED[$i]}" == "true" ]] && return
```

**TDS Color:**
```bash
tds_text_color "token.path"
printf "text"
reset_color
```

**Frame Render:**
```bash
tput cup 0 0; tput ed
render_components
tput el
```

### File Locations Quick Reference

| Component | Path |
|-----------|------|
| Unicode Explorer V2 | `bash/repl/experiments/unicode_explorer_v2.sh` |
| Unicode Explorer V1 | `bash/repl/experiments/unicode_explorer.sh` |
| ORG REPL | `bash/org/org_repl.sh` |
| Game REPL | `bash/game/game_repl.sh` |
| Tetra REPL | `bash/tetra/interfaces/repl.sh` |
| TKM REPL | `bash/tkm/tkm_repl.sh` |
| RAG REPL | `bash/rag/rag_repl.sh` |
| Pulsar REPL | `bash/game/games/pulsar/pulsar_repl.sh` |
| Formant REPL | `bash/game/games/formant/formant_repl.sh` |
| Estoface REPL | `bash/game/games/estoface/core/estoface_repl.sh` |
| Prompt Manager | `bash/repl/prompt_manager.sh` |
| TDS REPL UI | `bash/tds/semantics/repl_ui.sh` |

---

## Appendix B: Terminal Compatibility Matrix

| Terminal | Unicode | 256 Color | True Color | Notes |
|----------|---------|-----------|------------|-------|
| iTerm2 | ✓ | ✓ | ✓ | Excellent support |
| Terminal.app | ✓ | ✓ | ✓ | macOS default |
| Alacritty | ✓ | ✓ | ✓ | Fast, modern |
| kitty | ✓ | ✓ | ✓ | GPU-accelerated |
| GNOME Terminal | ✓ | ✓ | ✓ | Linux standard |
| Konsole | ✓ | ✓ | ✓ | KDE default |
| xterm | ✓ | ✓ | ~ | Limited true color |
| tmux | ✓ | ✓ | ~ | Need 256 color mode |
| screen | ✓ | ~ | ✗ | Basic color only |

**Legend:**
- ✓ Full support
- ~ Partial support
- ✗ Not supported

---

## Document Changelog

**Version 1.0 (2025-11-02):**
- Initial comprehensive documentation
- Cataloged all 10+ interactive UI systems
- Documented common patterns and best practices
- Added testing strategies and troubleshooting
- Created quick reference guides

---

**End of Document**

For questions, improvements, or additions, please update this document and increment the version number.