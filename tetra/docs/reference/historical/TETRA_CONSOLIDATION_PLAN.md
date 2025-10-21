# Tetra Consolidation Plan
**Version:** 1.0
**Date:** 2025-10-16
**Purpose:** Consolidate canonical patterns from demos to build bash/tetra as TDS showcase

---

## Executive Summary

This document defines the architecture for **bash/tetra** - a showcase implementation that demonstrates TDS (Tetra Design System) integration while consolidating the best patterns from:

- **demo/basic/013** - Action handling
- **demo/basic/014/bash/tcurses** - TUI primitives (REPL, key control)
- **bash/tds** - Tetra Design System (chroma, layered display)
- **bash/tsm** - Service management, module loading
- **bash/rag** - Best-in-class REPL, flow states, evidence management, actions

---

## Core Principles

### 1. Strong Globals
```bash
# TETRA_SRC is non-negotiable
: "${TETRA_SRC:=$HOME/tetra}"

# Module source (strong global)
: "${MOD_SRC:=$TETRA_SRC/bash/modname}"

# Module runtime directory
: "${MOD_DIR:=$TETRA_DIR/modname}"
```

### 2. Bootstrap Pattern
```bash
# tetra ALWAYS runs in bash 5.2+
# tetra ALWAYS starts by: source ~/tetra/tetra.sh
```

### 3. [Env × Mode] → Actions
```bash
# Environment × Mode generates available actions
Context = Environment × List[Module]

# Example:
F(Local, [tetra, rag]) = {
  tetra.status, tetra.repl, tetra.demo,
  rag.select, rag.assemble, rag.flow
}
```

---

## Architecture Layers

### Layer 0: Foundation (bash/tetra/core/)
**Purpose:** Core system without UI dependencies

```
bash/tetra/core/
├── bootstrap.sh          # Entry point, validation
├── module_loader.sh      # Dependency-ordered loading
├── action_system.sh      # [Env × Mode] → verb:noun dispatch
├── state_manager.sh      # Action states, flow states
├── event_bus.sh          # Pub/sub for action events
└── symbols.sh            # @ operator resolution
```

**Key Functions:**
```bash
tetra_bootstrap()         # Validates TETRA_SRC, loads core
tetra_load_module()       # Loads module with dependencies
tetra_dispatch_action()   # Routes verb:noun to handler
tetra_emit_event()        # Publishes event to subscribers
tetra_resolve_symbol()    # @module:key.variant resolution
```

### Layer 1: Display System (bash/tds integration)
**Purpose:** TDS as first-class citizen

```
bash/tetra/display/
├── tds_adapter.sh        # Wrapper for TDS integration
├── layout.sh             # Layout system (4-line header, body, footer)
├── widgets.sh            # Reusable UI components
└── renderer.sh           # Frame rendering pipeline
```

**TDS Integration:**
```bash
# Source TDS (bash/tds provides layers 0-3)
source "$TETRA_SRC/bash/tds/tds.sh"

# Use semantic tokens
echo "$(TDS_PRIMARY)Status$(TDS_RESET): $(TDS_SUCCESS)Active$(TDS_RESET)"

# Use renderers
tds_render_markdown "README.md"
tds_render_table "$data"
```

### Layer 2: REPL System (from bash/rag)
**Purpose:** Best-in-class interactive shell

```
bash/tetra/repl/
├── repl.sh               # Main REPL loop
├── prompt_manager.sh     # Dynamic prompts (minimal/normal/twoline)
├── command_router.sh     # Slash command dispatch
├── history.sh            # Separate history management
├── completion.sh         # Tab completion tree
└── bindings.sh           # Key bindings (Ctrl+P, etc.)
```

**REPL Features:**
```bash
# Launch REPL
tetra repl

# Slash commands
/action list              # List available actions
/mode set [rag, qa]       # Set active modules
/env switch dev           # Change environment
/flow status              # Flow state
/help                     # Interactive help

# Shell commands (no prefix)
ls, pwd, cat, grep        # Run directly
```

**Prompt Modes:**
- **minimal**: `> `
- **normal**: `[local:rag] tetra> `
- **twoline**: Stats bar + context line
- **Toggle**: Ctrl+P cycles through modes

### Layer 3: TUI System (from tcurses)
**Purpose:** Terminal UI for visual modes

```
bash/tetra/tui/
├── tcurses/              # Promoted from demo/basic/014
│   ├── screen.sh         # Screen management
│   ├── input.sh          # Input handling
│   ├── animation.sh      # Animation loop
│   ├── buffer.sh         # Double-buffering
│   └── modal.sh          # Modal dialogs
├── gamepad.sh            # Gamepad input (from 014)
└── header.sh             # 4-line header component
```

### Layer 4: Action System (TCS 3.0 compliant)
**Purpose:** Action registration, execution, routing

```
bash/tetra/actions/
├── registry.sh           # Action registration
├── executor.sh           # Action execution
├── metadata.sh           # Action metadata validation
└── discovery.sh          # Module action discovery
```

**Action Declaration:**
```bash
# bash/tetra/actions/core_actions.sh
tetra_register_actions() {
    declare_action "show_status" \
        "verb=show" \
        "noun=status" \
        "exec_at=@local" \
        "contexts=Local,Dev,Staging,Production" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "can=Display system status" \
        "cannot=Modify system state"
}
```

**Action States:**
```bash
# Action lifecycle states
PENDING   -> action queued
RUNNING   -> action executing
COMPLETED -> action finished successfully
FAILED    -> action errored
CANCELLED -> action aborted
```

### Layer 5: Flow System (from bash/rag)
**Purpose:** Multi-step workflows with state tracking

```
bash/tetra/flows/
├── flow_manager.sh       # Flow creation, state transitions
├── flow_states.sh        # State definitions
└── checkpoint.sh         # Checkpoint/resume support
```

**Flow States (from RAG):**
```
NEW       -> Flow created
SELECT    -> Gathering inputs
ASSEMBLE  -> Building context
SUBMIT    -> Sending to processor
APPLY     -> Applying results
VALIDATE  -> Running tests
DONE      -> Success
FAIL      -> Error state
```

**Flow API:**
```bash
# Create flow
tetra flow create "Fix bug in parser"

# Add evidence/inputs
tetra flow add-input "core/parser.sh::100,200"

# Transition states
tetra flow advance      # Move to next state
tetra flow status       # Show current state
tetra flow resume       # Resume from checkpoint
```

### Layer 6: Animation Engine
**Purpose:** Text sprites with motion, glow effects, UTF-8 groups

```
bash/tetra/animation/
├── sprite.sh             # Sprite definition and grouping
├── motion.sh             # Movement interpolation
├── effects.sh            # Glow, pulse, fade effects
└── timeline.sh           # Animation sequencing
```

**Animation Features:**
```bash
# Define sprite
tetra_sprite_create "loader" "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

# Apply effects
tetra_sprite_glow "loader" "00D4AA"    # Glow with color
tetra_sprite_pulse "status" 1000ms     # Pulse effect

# Group sprites
tetra_sprite_group "network_viz" sprite1 sprite2 sprite3

# Animate
tetra_sprite_move "loader" x:10 y:5 duration:500ms
```

---

## Action System Design

### Tetra Action Definition

An action is: **`[Env × Mode] → module.verb:noun`**

**Components:**
- **Environment**: HELP, Local, Dev, Staging, Production
- **Mode**: `List[Module]` - e.g., `[tetra, rag, qa]`
- **Module**: tetra, rag, qa, vox, deploy, etc.
- **Verb**: show, list, create, query, deploy, etc.
- **Noun**: status, flows, evidence, config, etc.

**Example Actions:**
```bash
# Local × [tetra]
Local × [tetra] = {
  tetra.show:status,
  tetra.list:modules,
  tetra.demo:animation
}

# Local × [tetra, rag]
Local × [tetra, rag] = {
  tetra.show:status,
  tetra.list:modules,
  rag.flow:create,
  rag.evidence:add,
  rag.select:files
}

# Dev × [tetra, deploy]
Dev × [tetra, deploy] = {
  tetra.show:status,
  deploy.push:files,
  deploy.show:status
}
```

### Action Routing

```bash
# User input
tetra show status

# Parse
module="tetra"
verb="show"
noun="status"

# Check context
current_env="Local"
current_mode=["tetra", "rag"]

# Validate
F(Local, ["tetra", "rag"]) contains "tetra.show:status" ✓

# Execute
tetra_execute_action "show:status"
```

### Action State Machine

```
   ┌─────────┐
   │ PENDING │
   └────┬────┘
        │
        ▼
   ┌─────────┐
   │ RUNNING │────────┐
   └────┬────┘        │
        │             ▼
        ▼        ┌───────────┐
   ┌───────────┐ │ CANCELLED │
   │ COMPLETED │ └───────────┘
   └───────────┘
        │
        ▼
   ┌────────┐
   │ FAILED │
   └────────┘
```

**State Transitions:**
```bash
tetra_action_state_transition() {
    local action_id=$1
    local from_state=$2
    local to_state=$3

    # Validate transition
    case "$from_state:$to_state" in
        PENDING:RUNNING|PENDING:CANCELLED) ;;
        RUNNING:COMPLETED|RUNNING:FAILED|RUNNING:CANCELLED) ;;
        *) return 1 ;;
    esac

    # Emit event
    tetra_emit_event "action.state.changed" \
        "action_id=$action_id" \
        "from=$from_state" \
        "to=$to_state"

    # Update state
    echo "$to_state" > "$TETRA_DIR/tetra/actions/$action_id.state"
}
```

---

## Flow System Design

### Flow States (from RAG)

```
NEW       - Flow created, ready for input
SELECT    - Gathering evidence/inputs
ASSEMBLE  - Building context from inputs
SUBMIT    - Processing (e.g., sending to LLM)
APPLY     - Applying outputs
VALIDATE  - Validation/testing
DONE      - Successfully completed
FAIL      - Failed, needs intervention
```

### Flow State Machine

```
    NEW
     │
     ▼
   SELECT ◄────┐
     │         │
     ▼         │
  ASSEMBLE     │
     │         │
     ▼         │
   SUBMIT      │
     │         │
     ▼         │
   APPLY       │
     │         │
     ▼         │
  VALIDATE     │
     │         │
     ├─────────┘ (fold - iterate)
     │
     ├──► DONE
     │
     └──► FAIL
```

### Flow-Action Relationship

**Flows contain actions:**
```bash
# Flow 001: "Fix parser bug"
flow_id="flow-1729123456"
flow_state="SELECT"

# Actions within flow
action_001: evidence.add:file   [COMPLETED]
action_002: evidence.add:file   [RUNNING]
action_003: context.assemble    [PENDING]
```

**Flow Checkpoint:**
```bash
$TETRA_DIR/tetra/flows/flow-1729123456/
├── state.json           # Current state
├── events.ndjson        # Event log
├── checkpoint.json      # Resume point
├── inputs/              # Flow inputs
│   ├── 100_parser.sh.input
│   └── 110_test.sh.input
└── outputs/             # Flow outputs
    └── result.json
```

---

## Pub/Sub Event System

### Event Bus Architecture

```bash
# bash/tetra/core/event_bus.sh

# Global event registry
declare -A TETRA_EVENT_SUBSCRIBERS

# Subscribe to event
tetra_subscribe() {
    local event_type="$1"
    local handler="$2"

    TETRA_EVENT_SUBSCRIBERS["$event_type"]+="$handler "
}

# Emit event
tetra_emit_event() {
    local event_type="$1"
    shift
    local event_data="$@"

    # Log event
    tetra_log_event "$event_type" "$event_data"

    # Call subscribers
    for handler in ${TETRA_EVENT_SUBSCRIBERS["$event_type"]}; do
        "$handler" "$event_type" "$event_data" &
    done
}

# Event types
tetra_emit_event "action.started" "action_id=001" "module=tetra" "verb=show"
tetra_emit_event "action.completed" "action_id=001" "status=success"
tetra_emit_event "flow.state.changed" "flow_id=123" "from=SELECT" "to=ASSEMBLE"
tetra_emit_event "tui.key.pressed" "key=Ctrl+P"
```

### Key Mapping System

```bash
# bash/tetra/repl/bindings.sh

# Register key binding
tetra_bind_key() {
    local key="$1"
    local action="$2"

    # Use bash's bind -x for execution
    bind -x "\"$key\": $action"
}

# Bind Ctrl+P to toggle prompt
tetra_bind_key $'\C-p' 'toggle_prompt_mode'

# Bind Ctrl+F to flow status
tetra_bind_key $'\C-f' 'tetra_dispatch_action flow:status'

# Bind Ctrl+E to evidence list
tetra_bind_key $'\C-e' 'tetra_dispatch_action evidence:list'
```

---

## Integration with Existing Systems

### TDS Integration (bash/tds)

```bash
# bash/tetra/display/tds_adapter.sh

# Source TDS
source "$TETRA_SRC/bash/tds/tds.sh"

# Semantic token usage
tetra_display_status() {
    local status="$1"

    case "$status" in
        RUNNING)
            echo "$(TDS_SUCCESS)$status$(TDS_RESET)"
            ;;
        FAILED)
            echo "$(TDS_ERROR)$status$(TDS_RESET)"
            ;;
        *)
            echo "$(TDS_MUTED)$status$(TDS_RESET)"
            ;;
    esac
}

# Use TDS renderers
tetra_render_help() {
    tds_render_markdown "$TETRA_SRC/docs/HELP.md"
}
```

### Module Loading (from TSM pattern)

```bash
# bash/tetra/core/module_loader.sh

# Load modules in dependency order
tetra_load_modules() {
    local verbose="${1:-false}"

    # Core modules (no dependencies)
    _tetra_load "core/bootstrap.sh"
    _tetra_load "core/symbols.sh"
    _tetra_load "core/event_bus.sh"

    # Display layer (depends on TDS)
    _tetra_load "display/tds_adapter.sh"
    _tetra_load "display/layout.sh"

    # REPL layer
    _tetra_load "repl/prompt_manager.sh"
    _tetra_load "repl/command_router.sh"
    _tetra_load "repl/repl.sh"

    # Action system
    _tetra_load "actions/registry.sh"
    _tetra_load "actions/executor.sh"

    # Flow system
    _tetra_load "flows/flow_manager.sh"
    _tetra_load "flows/flow_states.sh"
}

_tetra_load() {
    local module="$1"
    local path="$TETRA_SRC/bash/tetra/$module"

    if [[ -f "$path" ]]; then
        source "$path" || {
            echo "Failed to load: $module" >&2
            return 1
        }
    fi
}
```

### REPL Integration (from RAG best practices)

```bash
# bash/tetra/repl/repl.sh

tetra_repl() {
    # Initialize systems
    tetra_prompt_manager_init
    tetra_history_init
    tetra_completion_init

    # Welcome
    echo "$(TDS_PRIMARY)Tetra Interactive Shell$(TDS_RESET)"
    echo "$(TDS_MUTED)Type /help for commands$(TDS_RESET)"

    # REPL loop
    while true; do
        # Build prompt
        local prompt=$(build_prompt)

        # Read input
        read -p "$prompt" input

        [[ -z "$input" ]] && continue

        # Route command
        if [[ "$input" == /* ]]; then
            # Slash command
            tetra_route_command "${input#/}"
        else
            # Shell command
            eval "$input"
        fi
    done
}

# Command routing
tetra_route_command() {
    local cmd="$1"
    shift || true
    local args=("$@")

    case "$cmd" in
        action|a)
            tetra_cmd_action "${args[@]}"
            ;;
        flow|f)
            tetra_cmd_flow "${args[@]}"
            ;;
        mode|m)
            tetra_cmd_mode "${args[@]}"
            ;;
        env|e)
            tetra_cmd_env "${args[@]}"
            ;;
        help|h)
            tetra_cmd_help "${args[@]}"
            ;;
        *)
            echo "Unknown command: /$cmd"
            ;;
    esac
}
```

---

## File Structure

```
bash/tetra/
├── tetra.sh                     # Main entry point
├── core/
│   ├── bootstrap.sh             # Validation, initialization
│   ├── module_loader.sh         # Dependency loading
│   ├── action_system.sh         # [Env × Mode] dispatch
│   ├── state_manager.sh         # State tracking
│   ├── event_bus.sh             # Pub/sub system
│   └── symbols.sh               # @symbol resolution
├── display/
│   ├── tds_adapter.sh           # TDS integration
│   ├── layout.sh                # Layout system
│   ├── widgets.sh               # UI components
│   └── renderer.sh              # Rendering
├── repl/
│   ├── repl.sh                  # Main REPL loop
│   ├── prompt_manager.sh        # Dynamic prompts
│   ├── command_router.sh        # Slash commands
│   ├── history.sh               # History management
│   ├── completion.sh            # Tab completion
│   └── bindings.sh              # Key bindings
├── tui/
│   ├── tcurses/                 # Promoted from demo/014
│   ├── gamepad.sh
│   └── header.sh
├── actions/
│   ├── registry.sh              # Action registration
│   ├── executor.sh              # Action execution
│   ├── metadata.sh              # Metadata validation
│   ├── discovery.sh             # Module discovery
│   └── core_actions.sh          # Built-in actions
├── flows/
│   ├── flow_manager.sh          # Flow lifecycle
│   ├── flow_states.sh           # State definitions
│   └── checkpoint.sh            # Resume support
└── animation/
    ├── sprite.sh                # Sprite system
    ├── motion.sh                # Movement
    ├── effects.sh               # Visual effects
    └── timeline.sh              # Sequencing

$TETRA_DIR/tetra/
├── actions/                     # Action state
│   ├── action-001.state
│   └── action-001.log
├── flows/                       # Flow state
│   ├── flow-123/
│   │   ├── state.json
│   │   ├── events.ndjson
│   │   ├── checkpoint.json
│   │   ├── inputs/
│   │   └── outputs/
├── config/
│   ├── mode.conf                # Active modules
│   └── env.conf                 # Current environment
└── logs/
    └── tetra.jsonl              # Unified log
```

---

## Implementation Phases

### Phase 1: Core Foundation
**Goal:** Bootstrap, module loading, action system

**Tasks:**
1. Create bash/tetra/ structure
2. Implement core/bootstrap.sh
3. Implement core/module_loader.sh (TSM pattern)
4. Implement core/action_system.sh ([Env × Mode] routing)
5. Implement core/event_bus.sh (pub/sub)
6. Test: Load tetra, dispatch action

### Phase 2: Display Integration
**Goal:** TDS as first-class citizen

**Tasks:**
1. Implement display/tds_adapter.sh
2. Create semantic token wrappers
3. Implement layout system (4-line header, body, footer)
4. Test: Render status with TDS colors

### Phase 3: REPL System
**Goal:** Best-in-class interactive shell

**Tasks:**
1. Port RAG REPL patterns
2. Implement prompt_manager.sh (3 modes)
3. Implement command_router.sh (slash commands)
4. Implement history.sh (separate from shell)
5. Implement bindings.sh (Ctrl+P, etc.)
6. Test: Launch tetra repl, toggle prompts

### Phase 4: Action Registry
**Goal:** TCS 3.0 compliant actions

**Tasks:**
1. Implement actions/registry.sh
2. Implement actions/executor.sh
3. Create core_actions.sh (show:status, list:modules)
4. Test: Register action, execute from REPL

### Phase 5: Flow System
**Goal:** Multi-step workflows

**Tasks:**
1. Port RAG flow_manager.sh
2. Implement flow states (NEW → DONE)
3. Implement checkpoint/resume
4. Test: Create flow, advance states

### Phase 6: Animation Engine
**Goal:** Text sprites, motion, effects

**Tasks:**
1. Implement sprite.sh (UTF-8 groups)
2. Implement motion.sh (interpolation)
3. Implement effects.sh (glow, pulse)
4. Test: Animate network visualization

### Phase 7: TUI Integration
**Goal:** Promote tcurses, build demos

**Tasks:**
1. Promote demo/basic/014/bash/tcurses → bash/tcurses/
2. Update demos to use bash/tcurses
3. Create tetra TUI mode
4. Test: Launch tetra with TUI

---

## Success Criteria

### Tetra Module is Complete When:

✅ **Structure**: Follows bash/tetra/ with all layers
✅ **Bootstrap**: Validates TETRA_SRC, loads modules
✅ **Actions**: [Env × Mode] dispatch working
✅ **TDS**: Semantic tokens used throughout
✅ **REPL**: 3 prompt modes, slash commands, history
✅ **Flows**: Create flow, advance states, checkpoint
✅ **Events**: Pub/sub working for key actions
✅ **Key Bindings**: Ctrl+P, Ctrl+F, Ctrl+E work
✅ **Animation**: Sprites, motion, glow effects
✅ **TUI**: Optional visual mode with tcurses
✅ **Documentation**: TETRA_GUIDE.md with examples

### Demo Requirements:

Each demo must show:
1. **Action routing**: `tetra show status`
2. **Flow workflow**: Create → Select → Done
3. **REPL features**: Prompt toggle, slash commands
4. **TDS styling**: Consistent colors, semantic tokens
5. **Animation**: At least one sprite effect

---

## Migration Strategy

### Promoting tcurses to Library

**Current Location:**
```
demo/basic/014/bash/tcurses/
```

**Target Location:**
```
bash/tcurses/              # Promoted library
demo/basic/014/bash/tcurses -> ../../bash/tcurses (symlink)
```

**Steps:**
1. Copy demo/basic/014/bash/tcurses/ → bash/tcurses/
2. Update imports in tcurses files to use relative paths
3. Create symlink in demo
4. Update bash/tetra/ to source from bash/tcurses/
5. Add README.md to bash/tcurses/
6. Document in docs/Tetra_Library_Convention.md

### Extracting RAG Patterns

**Patterns to Extract:**

1. **REPL Loop** (rag_repl.sh):
   - Prompt building
   - Command routing (/ prefix)
   - History management
   - Custom ls coloring

2. **Prompt Manager** (prompt_manager.sh):
   - 3 modes: minimal, normal, twoline
   - Dynamic state display
   - Ctrl+P toggle

3. **Flow Manager** (flow_manager.sh):
   - State machine (8 states)
   - Event logging (ndjson)
   - Checkpoint/resume

4. **Evidence Selector** (evidence_selector.sh):
   - Selector syntax (::, #)
   - Rank-based numbering
   - $e variables

**Adaptation Strategy:**
```bash
# RAG: evidence_add "file.sh::100,200"
# Tetra: tetra_input_add "file.sh::100,200"

# RAG: flow_create "description"
# Tetra: tetra_flow_create "description"

# Keep RAG-specific naming in rag module
# Use tetra_ prefix for generalized versions
```

---

## Canonical Code Examples

### Example 1: Action Registration

```bash
# bash/tetra/actions/core_actions.sh

tetra_register_core_actions() {
    # Status action
    declare_action "show_status" \
        "verb=show" \
        "noun=status" \
        "exec_at=@local" \
        "contexts=Local,Dev,Staging,Production" \
        "modes=tetra" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Display Tetra system status" \
        "cannot=Modify system state"

    # Module list action
    declare_action "list_modules" \
        "verb=list" \
        "noun=modules" \
        "exec_at=@local" \
        "contexts=Local,Dev,Staging,Production" \
        "modes=tetra" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=List all loaded Tetra modules" \
        "cannot=Load or unload modules"
}

tetra_execute_core_action() {
    local action="$1"
    shift

    case "$action" in
        show:status)
            tetra_show_status "$@"
            ;;
        list:modules)
            tetra_list_modules "$@"
            ;;
        *)
            echo "Unknown core action: $action"
            return 1
            ;;
    esac
}

export -f tetra_register_core_actions
export -f tetra_execute_core_action
```

### Example 2: Flow Creation

```bash
# bash/tetra/flows/flow_manager.sh

tetra_flow_create() {
    local description="$1"

    # Generate flow ID
    local flow_id="flow-$(date +%s)"
    local flow_dir="$TETRA_DIR/tetra/flows/$flow_id"

    # Create structure
    mkdir -p "$flow_dir"/{inputs,outputs}

    # Initialize state
    cat > "$flow_dir/state.json" <<EOF
{
  "flow_id": "$flow_id",
  "description": "$description",
  "state": "NEW",
  "created_at": "$(date -Iseconds)",
  "updated_at": "$(date -Iseconds)"
}
EOF

    # Log event
    tetra_flow_log_event "$flow_id" "flow.created" \
        "description=$description"

    # Set as active
    ln -sf "$flow_dir" "$TETRA_DIR/tetra/flows/active"

    echo "✓ Flow created: $flow_id"
    echo "  Description: $description"
    echo "  State: NEW"
}
```

### Example 3: Event Subscription

```bash
# bash/tetra/core/event_bus.sh

# Subscribe to flow state changes
tetra_subscribe "flow.state.changed" "on_flow_state_changed"

on_flow_state_changed() {
    local event_type="$1"
    local event_data="$2"

    # Parse event data
    local flow_id=$(echo "$event_data" | grep -o 'flow_id=[^ ]*' | cut -d= -f2)
    local from=$(echo "$event_data" | grep -o 'from=[^ ]*' | cut -d= -f2)
    local to=$(echo "$event_data" | grep -o 'to=[^ ]*' | cut -d= -f2)

    # Update prompt color
    if type update_prompt_color >/dev/null 2>&1; then
        update_prompt_color "$to"
    fi

    # Log to unified log
    tetra_log "flow" "state_changed" "$flow_id" "success" \
        "{\"from\":\"$from\",\"to\":\"$to\"}"
}
```

### Example 4: Sprite Animation

```bash
# bash/tetra/animation/sprite.sh

# Define loader sprite
tetra_sprite_create "loader" "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

# Animate loader
tetra_sprite_animate() {
    local sprite_name="$1"
    local duration="${2:-infinite}"

    local frames=(${TETRA_SPRITES[$sprite_name]})
    local frame_count=${#frames[@]}
    local frame_idx=0

    while true; do
        # Clear line
        printf "\r\033[K"

        # Print frame with glow
        printf "%s %s" \
            "$(tetra_effect_glow "${frames[$frame_idx]}" "00D4AA")" \
            "Loading..."

        # Next frame
        frame_idx=$(( (frame_idx + 1) % frame_count ))

        sleep 0.1
    done
}

# Network visualization
tetra_demo_network() {
    local nodes=("◉" "◉" "◉" "◉")
    local positions=(10 30 50 70)

    # Group sprites
    tetra_sprite_group "network" "${nodes[@]}"

    # Pulse effect on all
    for node in "${nodes[@]}"; do
        tetra_effect_pulse "$node" 1000ms &
    done

    # Draw connections
    while true; do
        for i in {0..3}; do
            local x1=${positions[$i]}
            local x2=${positions[$(((i+1) % 4))]}
            tetra_draw_line $x1 5 $x2 5 "$(TDS_ACCENT)"
        done
        sleep 0.05
    done
}
```

---

## Next Steps

### Immediate Actions:

1. **Create base structure**: `mkdir -p bash/tetra/{core,display,repl,actions,flows,animation}`
2. **Implement bootstrap**: Start with `bash/tetra/core/bootstrap.sh`
3. **Port module loader**: Adapt TSM pattern to `core/module_loader.sh`
4. **Extract RAG REPL**: Copy relevant functions to `repl/`
5. **Integrate TDS**: Create `display/tds_adapter.sh`

### First Milestone:

**Goal:** Launch `tetra repl` with basic action dispatch

**Test:**
```bash
source ~/tetra/tetra.sh
tetra repl

# In REPL:
/action list        # Shows available actions
/mode set [tetra]   # Sets active modules
tetra show status   # Dispatches to tetra.show:status
/help               # Shows help
Ctrl+P              # Toggles prompt mode
```

---

## Conclusion

This consolidation plan provides:

1. **Clear architecture** - Layered system with well-defined responsibilities
2. **Canonical patterns** - Best practices from 013, 014, tcurses, tds, tsm, rag
3. **TDS showcase** - TDS integrated at display layer as first-class citizen
4. **Action system** - TCS 3.0 compliant [Env × Mode] → verb:noun dispatch
5. **Flow system** - RAG's proven flow state machine adapted for general use
6. **REPL excellence** - Best-in-class interactive shell with prompt modes
7. **Event-driven** - Pub/sub for extensibility
8. **Animation ready** - Framework for text sprites and effects
9. **Migration path** - Clear steps from demos to canonical library

The result will be **bash/tetra** - a showcase that demonstrates every Tetra principle while providing a solid foundation for future development.
