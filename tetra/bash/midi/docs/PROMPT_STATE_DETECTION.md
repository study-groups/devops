# How REPL Detects State Changes for Prompt Updates

## TL;DR - The Answer

**The REPL rebuilds the prompt on EVERY loop iteration** (before each `read` command).

State changes are detected by:
1. **Calling prompt builders every loop** - they query current state fresh
2. **No caching** - prompt is always "live"
3. **Prompt builders check state** directly (files, sockets, globals, state container)

---

## The Flow

### 1. Main Loop (Every Iteration)

**File:** `repl/core/loop.sh`

```bash
repl_main_loop() {
    while true; do
        # ┌─────────────────────────────────────────┐
        # │ THIS HAPPENS EVERY SINGLE ITERATION!    │
        # └─────────────────────────────────────────┘

        # Build prompt FRESH
        if command -v repl_build_prompt >/dev/null 2>&1; then
            REPL_PROMPT="> "  # Default
            repl_build_prompt  # Calls ALL builders
            prompt="$REPL_PROMPT"
        fi

        # Read input with that prompt
        input=$(repl_read_input "$prompt")

        # Process input
        repl_process_input "$input"

        # Loop back - prompt rebuilt on next iteration
    done
}
```

### 2. Prompt Building (Every Loop)

**File:** `repl/prompt_manager.sh`

```bash
repl_build_prompt() {
    local prompt=""

    # Call EVERY registered builder
    for builder in "${REPL_PROMPT_BUILDERS[@]}"; do
        local fragment=$("$builder")  # Builder queries state HERE
        prompt+="$fragment"
    done

    echo "$prompt"
}
```

### 3. MIDI Prompt Builder (Queries State Fresh)

**File:** `midi/core/repl.sh`

```bash
midi_repl_prompt() {
    # ┌────────────────────────────────────────────┐
    # │ THIS IS WHERE STATE IS CHECKED - EVERY    │
    # │ TIME THE PROMPT IS BUILT (EVERY LOOP!)    │
    # └────────────────────────────────────────────┘

    local status_color="${TETRA_GREEN}"
    local status_text="ready"

    # CHECK SERVICE STATUS (fresh check every loop!)
    if ! echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then
        status_color="${TETRA_YELLOW}"
        status_text="no service"
    fi

    # CHECK LEARNING MODE (reads global/state every loop!)
    if [[ $TMC_LEARNING -eq 1 ]]; then
        status_color="${TETRA_CYAN}"
        status_text="learning"
    fi

    # CHECK DEVICE (reads global every loop!)
    local device_info=""
    if [[ -n "$TMC_CURRENT_DEVICE" ]]; then
        device_info=" [$TMC_CURRENT_DEVICE]"
    fi

    # Return the prompt fragment
    echo -ne "${TETRA_MAGENTA}midi${TETRA_NC}${device_info} ${status_color}${status_text}${TETRA_NC} > "
}
```

---

## State Detection Mechanisms

### Method 1: Query Globals/State Container (Most Common)

```bash
midi_repl_prompt() {
    # BEFORE refactor (old globals)
    if [[ $TMC_LEARNING -eq 1 ]]; then
        echo "learning"
    fi

    # AFTER refactor (state container)
    if [[ $(tmc_state_get "learning_active") == "1" ]]; then
        echo "learning"
    fi
}
```

**Pros:**
- Instant - no I/O
- Accurate if state container is properly updated

**Cons:**
- Only works if your code updates the state container
- If external process changes state, prompt won't know

### Method 2: Query Socket/Service (I/O Check)

```bash
midi_repl_prompt() {
    # Check if service is actually running
    if echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then
        status="running"
    else
        status="stopped"
    fi
}
```

**Pros:**
- Accurate - checks actual service health
- Detects crashes/external stops

**Cons:**
- I/O overhead every loop (socket call)
- Can be slow if service hung

### Method 3: Check Files/Locks

```bash
midi_repl_prompt() {
    # Check lock file
    if [[ -f "$TMC_CONFIG_DIR/.learning.lock" ]]; then
        status="learning"
    fi
}
```

**Pros:**
- Detects external state changes
- Works across processes

**Cons:**
- I/O overhead
- Filesystem lag

### Method 4: Query Process Status

```bash
midi_repl_prompt() {
    # Check if bridge process running
    if pgrep -f "node.*tmc.js" >/dev/null; then
        bridge_status="●"
    else
        bridge_status="○"
    fi
}
```

**Pros:**
- True process state
- Works even if socket fails

**Cons:**
- Slow (process table scan)
- Race conditions

---

## Timing Diagram

```
User types command
       ↓
┌──────────────────────────────────────┐
│  REPL Loop Iteration N               │
│                                      │
│  1. Build Prompt                     │
│     ├─> Call midi_repl_prompt()     │
│     │   ├─> Check TMC_LEARNING      │ ← State queried HERE
│     │   ├─> Check socket            │ ← I/O happens HERE
│     │   └─> Check device            │ ← State queried HERE
│     └─> Assemble fragments          │
│                                      │
│  2. Display: "midi [Akai] ready > " │
│                                      │
│  3. Read Input (wait for user)      │ ← BLOCKS HERE
│     (user types: /learn p1)         │
│                                      │
│  4. Process Input                    │
│     └─> tmc_learn()                 │
│         └─> TMC_LEARNING=1          │ ← State CHANGED
│                                      │
│  5. Loop back to step 1              │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  REPL Loop Iteration N+1             │
│                                      │
│  1. Build Prompt                     │
│     ├─> Call midi_repl_prompt()     │
│     │   ├─> Check TMC_LEARNING=1    │ ← DETECTS CHANGE!
│     │   └─> Returns "learning"      │
│     └─> Assemble fragments          │
│                                      │
│  2. Display: "midi [Akai] learning >"│ ← PROMPT UPDATED!
└──────────────────────────────────────┘
```

---

## Performance Considerations

### Current MIDI Prompt Cost (Per Loop)

```bash
midi_repl_prompt() {
    # Cost: ~1ms - socket health check
    if ! echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then
        # ...
    fi

    # Cost: <1μs - variable check
    if [[ $TMC_LEARNING -eq 1 ]]; then
        # ...
    fi

    # Cost: <1μs - variable check
    if [[ -n "$TMC_CURRENT_DEVICE" ]]; then
        # ...
    fi
}

# Total: ~1-2ms per prompt build
```

**Is this too slow?**

No! Prompts are only built when waiting for user input. Even 10ms is imperceptible since humans type at ~50-200ms per keystroke.

### Optimization Strategies

#### 1. Cache with Invalidation

```bash
# Global cache
PROMPT_CACHE=""
PROMPT_CACHE_VALID=0

midi_repl_prompt() {
    # Return cached if valid
    if [[ $PROMPT_CACHE_VALID -eq 1 ]]; then
        echo "$PROMPT_CACHE"
        return
    fi

    # Build fresh
    local prompt=$(build_prompt_heavy)

    # Cache it
    PROMPT_CACHE="$prompt"
    PROMPT_CACHE_VALID=1

    echo "$prompt"
}

# Invalidate when state changes
tmc_learn() {
    TMC_LEARNING=1
    PROMPT_CACHE_VALID=0  # Force rebuild
}
```

**Pros:** Fast
**Cons:** Complex, easy to forget invalidation

#### 2. Conditional Expensive Checks

```bash
midi_repl_prompt() {
    # Always check cheap things
    local learning=$(tmc_state_get "learning_active")

    # Only check socket every N loops or on command
    if (( PROMPT_LOOP_COUNT % 10 == 0 )) || [[ $FORCE_HEALTH_CHECK -eq 1 ]]; then
        if echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then
            CACHED_SERVICE_STATUS="running"
        else
            CACHED_SERVICE_STATUS="stopped"
        fi
        FORCE_HEALTH_CHECK=0
    fi

    ((PROMPT_LOOP_COUNT++))
}
```

**Pros:** Reduces I/O
**Cons:** Prompt lags behind actual state

#### 3. Background State Monitor (Advanced)

```bash
# Background process updates state
{
    while true; do
        if echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then
            tmc_state_set "service_status" "running"
        else
            tmc_state_set "service_status" "stopped"
        fi
        sleep 1
    done
} &

# Prompt just reads cached state
midi_repl_prompt() {
    local status=$(tmc_state_get "service_status")
    # No I/O in prompt builder!
}
```

**Pros:** No prompt lag, no I/O overhead
**Cons:** Extra background process

---

## Refactored MIDI Prompt with State Container

### Current Implementation (Uses Globals)

```bash
midi_repl_prompt() {
    # OLD: Queries globals
    if [[ $TMC_LEARNING -eq 1 ]]; then
        status="learning"
    fi

    if [[ -n "$TMC_CURRENT_DEVICE" ]]; then
        device="[$TMC_CURRENT_DEVICE]"
    fi
}
```

### Refactored Implementation (Uses State Container)

```bash
midi_repl_prompt() {
    # NEW: Queries state container
    local learning=$(tmc_state_get "learning_active")
    local device=$(tmc_state_get "device_id")
    local broadcast_mode=$(tmc_state_get "broadcast_mode")

    # NEW: Show last CC (your priority!)
    local last_cc_controller=$(tmc_state_get "last_cc_controller")
    local last_cc_value=$(tmc_state_get "last_cc_value")

    # Build status
    local status="ready"
    local status_color="${TETRA_GREEN}"

    # Check service (I/O - consider caching)
    if ! echo "HEALTH" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null >/dev/null; then
        status="halt"
        status_color="${TETRA_RED}"
    fi

    # Learning overrides
    if [[ "$learning" == "1" ]]; then
        status="learn"
        status_color="${TETRA_CYAN}"
    fi

    # Build prompt fragments
    local mode_indicator="${TETRA_BLUE}♫${TETRA_NC}"
    local module_name="${TETRA_CYAN}tmc${TETRA_NC}"
    local device_info=""
    local cc_info=""
    local mode_info="[${broadcast_mode}]"

    if [[ -n "$device" ]]; then
        device_info=" ${TETRA_DIM}[$device]${TETRA_NC}"
    fi

    if [[ -n "$last_cc_controller" ]]; then
        cc_info=" ${TETRA_YELLOW}cc${last_cc_controller}:${last_cc_value}${TETRA_NC}"
    fi

    # Assemble
    echo -ne "${mode_indicator} ${module_name}${device_info} ${mode_info}${cc_info} ${status_color}${status}${TETRA_NC} > "
}
```

**Result:**
```
♫ tmc [Akai] [all] cc7:64 ready >     # Normal
♫ tmc [all] halt >                     # Service stopped
♫ tmc [Akai] [syntax] cc21:100 learn > # Learning mode
```

---

## State Change Notification Pattern

### Problem: How to force prompt rebuild mid-loop?

Currently, prompts only rebuild between commands. But what if external process changes state?

### Solution 1: Return Code 2 (Prompt Changed)

**File:** `repl/core/loop.sh:59`

```bash
case $process_status in
    0)  # Continue
        continue
        ;;
    1)  # Exit
        break
        ;;
    2)  # Prompt changed (mode switch, theme change, etc), rebuild
        continue  # ← Loops back, rebuilds prompt
        ;;
esac
```

**Usage:**

```bash
tmc_repl_cmd_mode() {
    local new_mode="$1"
    tmc_set_mode "$new_mode"  # Changes state
    return 2  # Signal prompt changed
}
```

### Solution 2: Signal Handler (Advanced)

```bash
# In REPL setup
trap 'REPL_PROMPT_DIRTY=1' USR1

# External process
kill -USR1 $REPL_PID  # Signal prompt needs rebuild

# In prompt builder
midi_repl_prompt() {
    if [[ $REPL_PROMPT_DIRTY -eq 1 ]]; then
        # Rebuild expensive stuff
        CACHED_STATUS=$(check_service_health)
        REPL_PROMPT_DIRTY=0
    fi
    # Use cache
}
```

---

## Best Practices for TMC Prompt

### 1. Use State Container (We Did This!)

```bash
✅ local learning=$(tmc_state_get "learning_active")
❌ if [[ $TMC_LEARNING -eq 1 ]]; then
```

### 2. Cache Expensive I/O

```bash
# Don't do this on EVERY loop:
❌ if echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then

# Do this:
✅ Cache service status, invalidate on /start and /stop commands
```

### 3. Show What Matters Most

For TMC, **CC values matter**, so:

```bash
✅ Show last CC prominently: cc7:64
✅ Show broadcast mode: [all]
✅ Show status: ready/halt/learn
```

### 4. Keep It Fast

Target: <5ms per prompt build
- State container reads: <1μs each
- Cached values: <1μs
- Socket health check: ~1ms (consider caching)

---

## Summary

### How State Changes Are Detected

1. **Prompt rebuilt every loop** (before each `read`)
2. **Builders query state fresh** each time
3. **No automatic notification** - builders must check
4. **State changes visible next iteration**

### For TMC Refactor

```bash
midi_repl_prompt() {
    # Fast: Query state container
    local learning=$(tmc_state_get "learning_active")
    local device=$(tmc_state_get "device_id")
    local mode=$(tmc_state_get "broadcast_mode")
    local cc_ctrl=$(tmc_state_get "last_cc_controller")
    local cc_val=$(tmc_state_get "last_cc_value")

    # Slower: Check service (consider caching)
    local service_up=0
    if echo "HEALTH" | nc -U "$TMC_SOCKET" 2>/dev/null >/dev/null; then
        service_up=1
    fi

    # Build prompt showing CC values prominently
    # ...
}
```

### Key Insight

**You don't need to "notify" the REPL of state changes!**

Just update the state container:
```bash
tmc_state_set_last_cc "$channel" "$controller" "$value"
```

Next time the prompt builds (next loop iteration), it will see the new value automatically.

---

## Next Steps for Refactor

1. ✅ Update prompt to use `tmc_state_get()` instead of globals
2. ✅ Show CC values in prompt (your priority!)
3. ⏳ Consider caching service health check
4. ⏳ Test prompt performance with high-frequency CC events

Would you like me to implement the refactored prompt with CC value display?
