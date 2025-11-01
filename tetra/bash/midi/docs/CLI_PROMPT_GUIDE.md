# CLI Prompt Creation in Tetra REPL System

## Terminology Clarification

### MIDI vs TMC
**They're the same thing!**

- **Module name:** `midi` (directory: `$TETRA_SRC/bash/midi/`)
- **Internal name:** `TMC` = **Tetra MIDI Controller**
- **Functions:** Prefixed with `tmc_*`
- **Socket:** `tmc.sock`
- **Bridge:** `tmc.js`

**Why both names?**
- `midi` = user-facing module name
- `TMC` = internal abbreviation (like NASA vs National Aeronautics & Space Administration)

---

## Understanding "tsmhybrid>" Prompt

The prompt you see is a **compound prompt** built from multiple sources. Let's decode it:

### Example Prompt Breakdown
```
tsmhybrid>
```

This is actually composed of multiple **prompt fragments**:

1. **`tsm`** - Service context (TSM = Tetra Service Manager)
2. **`hybrid`** - Execution mode indicator
3. **`>`** - Standard shell delimiter

### MIDI Module Prompt Example
When in MIDI REPL:
```
midi [device-name] ready >
```

Breakdown:
1. **`midi`** - Module name (in magenta)
2. **`[device-name]`** - Current MIDI device (if loaded)
3. **`ready`** - Service status (green = ready, yellow = no service, cyan = learning)
4. **`>`** - Shell delimiter

---

## How CLI Prompts Are Built

### Architecture: Prompt Builder Pattern

The Tetra REPL uses a **builder pattern** where multiple functions contribute fragments to build the final prompt.

```
┌─────────────────────────────────────────┐
│        REPL Prompt Architecture         │
└─────────────────────────────────────────┘

REPL_PROMPT_BUILDERS=[]  (array of functions)
         │
         ├─> repl_prompt_context()    → "[org × env × mode] "
         ├─> repl_prompt_mode()       → "hybrid"
         └─> midi_repl_prompt()       → "midi [device] ready > "
                                          │
                                          ↓
                           Final Prompt: "midi [Akai MPK] ready > "
```

---

## Prompt Builder System

### 1. Register a Prompt Builder

**In your module REPL (e.g., `midi/core/repl.sh`):**

```bash
# Custom prompt builder
midi_repl_prompt() {
    local status_color="${TETRA_GREEN}"
    local status_text="ready"

    # Check service status
    if ! echo "HEALTH" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null >/dev/null; then
        status_color="${TETRA_YELLOW}"
        status_text="no service"
    fi

    # Check learning mode
    if [[ $TMC_LEARNING -eq 1 ]]; then
        status_color="${TETRA_CYAN}"
        status_text="learning"
    fi

    # Show device if loaded
    local device_info=""
    if [[ -n "$TMC_CURRENT_DEVICE" ]]; then
        device_info=" [$TMC_CURRENT_DEVICE]"
    fi

    # Return prompt fragment
    echo -ne "${TETRA_MAGENTA}midi${TETRA_NC}${device_info} ${status_color}${status_text}${TETRA_NC} > "
}

# Register it in your REPL entry point
midi_repl() {
    # Register prompt builder
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    # Run REPL
    repl_run
}
```

### 2. How Builders Are Called

**In `repl/prompt_manager.sh`:**

```bash
# Build prompt from all registered builders
repl_build_prompt() {
    local prompt=""

    # Call each builder function
    for builder in "${REPL_PROMPT_BUILDERS[@]}"; do
        local fragment=$("$builder")
        prompt+="$fragment"
    done

    # Default if no builders
    if [[ -z "$prompt" ]]; then
        prompt="> "
    fi

    echo "$prompt"
}
```

### 3. Built-in Prompt Builders

**Location:** `repl/prompt_manager.sh`

```bash
# Module context
repl_prompt_module() {
    echo "$ ${module}> "
}

# Org/Env/Mode context
repl_prompt_context() {
    if command -v tetra_get_org >/dev/null 2>&1; then
        local org=$(tetra_get_org)
        local env=$(tetra_get_env)
        local mode=$(tetra_get_mode)
        echo "[${org} × ${env} × ${mode}] "
    fi
}

# Execution mode (always "hybrid")
repl_prompt_mode() {
    echo "hybrid"
}
```

---

## Creating Custom Compound Prompts

### Example 1: Simple Module Prompt

```bash
# File: mymodule/core/repl.sh

mymodule_repl_prompt() {
    echo -ne "${TETRA_CYAN}mymodule${TETRA_NC} > "
}

mymodule_repl() {
    REPL_PROMPT_BUILDERS+=("mymodule_repl_prompt")
    repl_run
}
```

**Result:** `mymodule >`

### Example 2: Status-Aware Prompt

```bash
mymodule_repl_prompt() {
    local status="●"  # Green dot
    local color="${TETRA_GREEN}"

    # Check if service running
    if ! pgrep -f mymodule_service >/dev/null; then
        status="○"  # Empty circle
        color="${TETRA_RED}"
    fi

    echo -ne "${TETRA_BLUE}mymodule${TETRA_NC} ${color}${status}${TETRA_NC} > "
}
```

**Result:**
- Service running: `mymodule ● >`
- Service stopped: `mymodule ○ >`

### Example 3: Multi-Part Compound Prompt

```bash
# Part 1: Module name
my_prompt_module() {
    echo -ne "${TETRA_MAGENTA}myapp${TETRA_NC}"
}

# Part 2: Current context
my_prompt_context() {
    local ctx=$(get_current_context)
    if [[ -n "$ctx" ]]; then
        echo -ne " [${ctx}]"
    fi
}

# Part 3: Mode indicator
my_prompt_mode() {
    local mode=$(get_mode)
    echo -ne " ${TETRA_CYAN}${mode}${TETRA_NC}"
}

# Part 4: Delimiter
my_prompt_delimiter() {
    echo -ne " > "
}

# Register all parts
myapp_repl() {
    REPL_PROMPT_BUILDERS+=(
        "my_prompt_module"
        "my_prompt_context"
        "my_prompt_mode"
        "my_prompt_delimiter"
    )
    repl_run
}
```

**Result:** `myapp [production] dev > `

---

## Semantic Suggestions for MIDI/TMC Prompts

### Current MIDI Prompt
```
midi [Akai MPK] ready >
```

### Proposed Alternatives

#### Option 1: Service-Centric
```
tmc [device] ●>     # Green dot when service running
tmc [device] ○>     # Empty circle when stopped
tmc [device] ◉>     # Learning mode
```

#### Option 2: Mode-First
```
hybrid:tmc ready>
hybrid:tmc learn>
hybrid:tmc halt>
```

#### Option 3: Status Emoji
```
tmc 🎹 ready>       # Musical keyboard for MIDI
tmc 🎹 learn>
tmc ⚠ halt>
```

#### Option 4: Minimal
```
♫ ready>            # Music note
♫ learn>
♫ halt>
```

#### Option 5: CC-Value Aware (since CC values are priority!)
```
tmc [p1:64] ready>   # Show last CC control and value
tmc [s1:127] ready>
tmc ready>           # No recent CC
```

#### Option 6: Layer-Aware
```
tmc[raw]>           # Broadcast mode in brackets
tmc[syntax]>
tmc[semantic]>
tmc[all]>
```

---

## Implementation Example: New TMC Prompt

Let's redesign the MIDI prompt based on your priorities:

```bash
# File: midi/core/repl.sh

tmc_repl_prompt() {
    local mode_color="${TETRA_BLUE}"
    local mode_symbol="♫"  # Music note

    # Service status with symbol
    local status_symbol="●"
    local status_color="${TETRA_GREEN}"

    if ! echo "HEALTH" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null >/dev/null; then
        status_symbol="○"
        status_color="${TETRA_RED}"
    fi

    # Learning mode overrides
    if [[ $(tmc_state_get "learning_active") == "1" ]]; then
        status_symbol="◉"
        status_color="${TETRA_CYAN}"
    fi

    # Show broadcast mode
    local broadcast_mode=$(tmc_state_get "broadcast_mode")
    local mode_text="[${broadcast_mode}]"

    # Show last CC if available (YOUR PRIORITY!)
    local cc_info=""
    local last_cc_controller=$(tmc_state_get "last_cc_controller")
    local last_cc_value=$(tmc_state_get "last_cc_value")
    if [[ -n "$last_cc_controller" ]]; then
        cc_info=" ${TETRA_DIM}cc${last_cc_controller}=${last_cc_value}${TETRA_NC}"
    fi

    # Device name if loaded
    local device=""
    local device_id=$(tmc_state_get "device_id")
    if [[ -n "$device_id" ]]; then
        device=" ${TETRA_DIM}[${device_id}]${TETRA_NC}"
    fi

    # Assemble prompt
    echo -ne "${mode_color}${mode_symbol}${TETRA_NC} "                    # ♫
    echo -ne "${TETRA_CYAN}tmc${TETRA_NC}"                                # tmc
    echo -ne "${device}"                                                   # [device]
    echo -ne " ${TETRA_YELLOW}${mode_text}${TETRA_NC}"                   # [all]
    echo -ne "${cc_info}"                                                  # cc7=64
    echo -ne " ${status_color}${status_symbol}${TETRA_NC}"               # ●
    echo -ne " > "                                                         # >
}
```

**Results:**
```
♫ tmc [Akai] [all] cc7=64 ● >         # Running, last CC was controller 7 = 64
♫ tmc [syntax] ○ >                    # Stopped, syntax mode
♫ tmc [Akai] [semantic] ◉ >           # Learning mode
```

---

## Color Reference

Available colors from Tetra system:

```bash
TETRA_BLACK='\033[0;30m'
TETRA_RED='\033[0;31m'
TETRA_GREEN='\033[0;32m'
TETRA_YELLOW='\033[0;33m'
TETRA_BLUE='\033[0;34m'
TETRA_MAGENTA='\033[0;35m'
TETRA_CYAN='\033[0;36m'
TETRA_WHITE='\033[0;37m'
TETRA_DIM='\033[2m'
TETRA_NC='\033[0m'  # No Color / Reset
```

---

## Best Practices

### 1. Keep It Concise
❌ Bad: `tetra-midi-controller [Akai MPK Mini] semantic-mode learning-active ready-to-receive >`
✅ Good: `♫ tmc [Akai] ◉ >`

### 2. Use Visual Indicators
✅ Symbols: `● ○ ◉ ♫ 🎹 ⚠`
✅ Colors: Status-dependent
✅ Brackets: For context `[device]` `[mode]`

### 3. Priority Information First
For TMC, since **CC values are most important**:
✅ Show last CC value prominently
✅ Show broadcast mode (affects CC output)
✅ Device name (different devices = different CC mappings)

### 4. Make Status Obvious
✅ Color-coded: Green = good, Red = stopped, Cyan = special mode
✅ Symbols change meaning
✅ Text changes: "ready" → "halt" → "learn"

---

## Integration with TSM/Hybrid Mode

### Why "hybrid"?

In the Tetra REPL system, "hybrid" means:
- **Shell commands by default** (runs in bash)
- **Module commands with `/`** (slash commands)

Example in MIDI REPL:
```bash
♫ tmc > ls -la              # Shell command (bash)
♫ tmc > /start              # Module command (TMC)
♫ tmc > /learn p1           # Module command (TMC)
♫ tmc > echo "test"         # Shell command (bash)
```

### TSM Integration

The **TSM (Tetra Service Manager)** manages the MIDI service, so prompts often show:
- Service running status
- Socket availability
- Process health

---

## Summary

### Current Understanding
1. **MIDI = TMC** (same thing, different names)
2. **Prompts are compound** (built from multiple builder functions)
3. **"hybrid" mode** = shell-by-default, slash-for-module
4. **Builders are stackable** - each adds a fragment

### Your Options for TMC Prompt

Pick a semantic style:

**Option A: CC-Priority** (shows last CC value)
```bash
♫ tmc cc7=64 [all] ● >
```

**Option B: Status-First** (service health priority)
```bash
tmc [Akai] ● [all] >
```

**Option C: Minimal** (just essentials)
```bash
♫ ● >
```

**Option D: Mode-Centric** (broadcast mode priority)
```bash
tmc[semantic] ● >
```

### Recommendation for TMC

Given that **CC values are your priority**, I suggest:

```bash
♫ tmc [all] cc7:64 ● >
```

Where:
- `♫` = Music note (MIDI context)
- `tmc` = Module name
- `[all]` = Broadcast mode (raw/syntax/semantic/all)
- `cc7:64` = Last CC controller & value
- `●` = Service status (●=running, ○=stopped, ◉=learning)

This puts CC value information front and center while keeping the prompt clean and informative.

Would you like me to implement this new prompt design?
