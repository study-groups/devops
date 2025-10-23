# REPL Architecture Design

## Core Insight

**Don't build prompts in the REPL loop—call registered builders that modules provide.**

The REPL core should have no hardcoded knowledge of what modules do. Instead, modules register prompt builder functions, and the core orchestrates calling them in order to construct the final prompt dynamically.

## Design Principles

### 1. Separation of Concerns

```
┌─────────────────────────────────────────────┐
│ REPL Core (bash/tetra/repl/)                │
│  - Input loop management                    │
│  - Prompt builder orchestration             │
│  - Slash command dispatch                   │
│  - Mode switching (basic/enhanced/tui)      │
└─────────────────────────────────────────────┘
                    ↓ uses
┌─────────────────────────────────────────────┐
│ Module REPLs (bash/rag/, bash/tsm/, etc.)   │
│  - Register prompt builders                 │
│  - Register slash commands                  │
│  - Business logic implementation            │
│  - Module-specific state management         │
└─────────────────────────────────────────────┘
```

### 2. Plugin-Based Prompt Building

```bash
# Modules register their prompt components
repl_register_prompt_builder "name" "function_name"

# Core calls all registered builders
repl_build_prompt() {
    for builder in "${REPL_PROMPT_BUILDERS[@]}"; do
        prompt+="$($builder)"
    done
    echo "$prompt"
}
```

### 3. Three-Mode Strategy

| Mode | Input Handler | Use Case | Dependencies |
|------|---------------|----------|--------------|
| **basic** | `read -r -p` | Universal, no deps | None |
| **enhanced** | `tcurses_input_read` | Readline-like, colors | tcurses |
| **tui** | Buffer integration | Full-screen apps | TUI framework |

**Progressive Enhancement**: Auto-detect capabilities, fall back gracefully.

```bash
REPL_MODE="${REPL_MODE:-$(repl_detect_mode)}"
```

## Architecture Components

### Directory Structure

```
bash/tetra/repl/
├── repl_core.sh          # Basic REPL (no color, no TUI)
├── repl_enhanced.sh      # Enhanced REPL (colors, features)
├── prompt_manager.sh     # Dynamic prompt building
├── input_handler.sh      # Input processing abstraction
└── adapters/
    ├── tui_adapter.sh    # TUI integration
    └── action_adapter.sh # Action system integration
```

### Core Interfaces

#### Prompt Manager

```bash
# Register a prompt builder
repl_register_prompt_builder "name" "function_name"

# Build dynamic prompt
prompt="$(repl_build_prompt)"

# Prompt builder signature
builder_function() {
    # Return string fragment or empty
    echo "[component]"
}
```

#### Input Handler

```bash
# Mode-specific input reading
repl_read_input() {
    case "$REPL_MODE" in
        basic)    read -r -p "$1" ;;
        enhanced) tcurses_input_read_line "$1" ;;
        tui)      repl_read_tui "$1" ;;
    esac
}
```

#### Command Processor

```bash
# Process input with action integration
repl_process_input() {
    # Slash commands (meta)
    [[ "$input" == /* ]] && repl_process_slash_command "${input#/}"

    # Action dispatch
    command -v tetra_dispatch_action >/dev/null && tetra_dispatch_action $input

    # Shell passthrough
    eval "$input"
}
```

### Control Flow

Return codes signal REPL state:

```bash
return 0  # Continue normally
return 1  # Exit REPL
return 2  # Prompt state changed, rebuild
```

## Module Integration Pattern

### Minimal Module REPL

```bash
# bash/mymod/mymod_repl.sh

source "$TETRA_SRC/bash/tetra/repl/repl_core.sh"
source "$TETRA_SRC/bash/tetra/repl/prompt_manager.sh"

mymod_repl() {
    # Register prompt components
    repl_register_prompt_builder "mymod_state" "mymod_prompt_state"

    # Register slash commands
    repl_register_slash_command "status" "mymod_cmd_status"

    # Run REPL
    repl_run enhanced
}

mymod_prompt_state() {
    local state="$(mymod_get_state)"
    echo "[${state}]"
}

mymod_cmd_status() {
    echo "Module status: $(mymod_get_status)"
}
```

### RAG Example (Migrated)

```bash
# bash/rag/bash/rag_repl.sh

rag_repl() {
    # Register based on prompt mode
    case "${RAG_PROMPT_MODE:-normal}" in
        minimal)
            repl_register_prompt_builder "basic" "repl_prompt_basic"
            ;;
        normal)
            repl_register_prompt_builder "flow" "rag_prompt_flow_state"
            repl_register_prompt_builder "basic" "repl_prompt_basic"
            ;;
        twoline)
            repl_register_prompt_builder "stats" "rag_prompt_stats_line"
            repl_register_prompt_builder "flow" "rag_prompt_flow_state"
            ;;
    esac

    # Register RAG slash commands
    repl_register_slash_command "e" "rag_cmd_evidence"
    repl_register_slash_command "flow" "rag_cmd_flow"
    repl_register_slash_command "cli" "rag_cmd_toggle_prompt"

    repl_run enhanced
}

rag_prompt_flow_state() {
    local flow="$(get_current_flow)"
    local stage="$(get_flow_stage)"

    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        echo "$(text_color "7AA2F7")[${flow}:${stage}]$(reset_color)"
    else
        echo "[${flow}:${stage}]"
    fi
}

rag_prompt_stats_line() {
    # First line: stats with evidence meters
    local evidence_count="$(get_evidence_count)"
    local selected_count="$(get_selected_count)"
    echo "Evidence: ◆${evidence_count} ●${selected_count}\n"
}
```

### TUI-Integrated Example (Demo 010)

```bash
# demo/basic/010/bash/app/repl.sh

demo_repl_init() {
    # TUI mode
    REPL_MODE=tui

    # Register prompt builders
    repl_register_prompt_builder "demo_env" "demo_prompt_env"
    repl_register_prompt_builder "demo_web" "demo_prompt_web_status"

    # Output goes to TUI content region
    REPL_OUTPUT_HANDLER="demo_update_content"
}

demo_prompt_env() {
    local env="${ENVIRONMENTS[$ENV_INDEX],,}"
    local mode="${MODES[$MODE_INDEX],,}"
    echo "${env}:${mode}"
}

demo_prompt_web_status() {
    is_web_server_running && echo "[web:$WEB_SERVER_PORT]"
}

demo_update_content() {
    local output="$1"
    update_content_region "$output"
}
```

## Configuration

### Global REPL Settings

```bash
# ~/.tetra/repl.conf

# REPL mode: basic|enhanced|tui (auto-detected if not set)
REPL_MODE=enhanced

# Prompt style: minimal|normal|verbose
REPL_PROMPT_STYLE=normal

# Enable shell passthrough for non-action commands
REPL_SHELL_PASSTHROUGH=1

# Color support
COLOR_ENABLED=1
```

### Module-Specific Settings

```bash
# Per-module prompt modes
RAG_PROMPT_MODE=twoline   # minimal|normal|twoline
TSM_PROMPT_MODE=status    # normal|status|detailed
QA_PROMPT_MODE=normal     # minimal|normal
```

## Action System Integration

### Via Dispatcher Adapter

```bash
# bash/tetra/repl/adapters/action_adapter.sh

repl_dispatch_action() {
    local input="$1"

    # Check if action dispatcher available
    if command -v tetra_dispatch_action >/dev/null 2>&1; then
        tetra_dispatch_action $input
        return $?
    fi

    # Fallback
    echo "Action system not available" >&2
    return 1
}
```

### Action-Aware Prompts

From REPL_Progressive_Enhancement.md:

```
[org × env × mode] tetra>                      # No action
[org × env × mode] module.verb:noun>           # Action selected
[org × env × mode] module.verb:noun @target::> # With TES endpoint
```

Module registers action state in prompt:

```bash
repl_register_prompt_builder "action" "repl_prompt_current_action"

repl_prompt_current_action() {
    local action="$(tetra_get_current_action)"
    [[ -n "$action" ]] && echo "$action>"
}
```

## TUI Integration

### Separation of Concerns

From demo/docs/separation.md:

```
User Input → TUI → REPL → Business Logic → REPL → TUI → Display
```

**TUI (Interface)**:
- Layout, colors, input handling, rendering
- Manages screen regions, buffers, navigation

**REPL (Content)**:
- Command processing, business logic
- State management, action execution

### Communication Pattern

```bash
# REPL outputs to handler instead of stdout
REPL_OUTPUT_HANDLER="tui_update_content"

repl_output() {
    local text="$1"

    if [[ -n "$REPL_OUTPUT_HANDLER" ]]; then
        $REPL_OUTPUT_HANDLER "$text"
    else
        echo "$text"
    fi
}
```

## Reference Implementations

### Current Mature Implementations

| REPL | File | Key Features |
|------|------|--------------|
| **RAG** | `bash/rag/bash/rag_repl.sh` | Three prompt modes, flow-state-aware, evidence management |
| **Tetra** | `bash/tetra/interfaces/repl.sh` | Context-aware, action dispatch, tcurses integration |
| **Demo 010** | `demo/basic/010/bash/app/repl.sh` | TUI-integrated, web server management |
| **TCurses** | `demo/basic/014/bash/tcurses/tcurses_repl.sh` | Full readline emulation, cursor management |

### Key Patterns to Adopt

1. **RAG**: Prompt manager with mode switching, slash command system
2. **Tetra**: Context functions, return code signaling
3. **Demo 010**: TUI buffer integration, state-based prompts
4. **TCurses**: Readline emulation, history management

## Implementation Roadmap

1. **Create bash/tetra/repl/prompt_manager.sh**
   - Prompt builder registration
   - Builder orchestration
   - Built-in builders (basic, context)

2. **Create bash/tetra/repl/repl_core.sh**
   - Basic mode implementation
   - Input loop with dynamic prompts
   - Slash command dispatch

3. **Add enhanced mode**
   - Integrate tcurses_input_read_line
   - Color support
   - History management

4. **Create TUI adapter**
   - Output handler interface
   - Buffer integration
   - Coordinate with TUI framework

5. **Migrate existing REPLs**
   - RAG: use new prompt manager
   - Tetra: unify with core
   - Demos: standardize on adapters

6. **Documentation**
   - Module integration guide
   - Prompt builder API
   - TUI integration examples

## Benefits of This Architecture

1. **Modularity**: Core has zero knowledge of module internals
2. **Flexibility**: Modules control their own prompt components
3. **Progressive Enhancement**: Graceful degradation from TUI → enhanced → basic
4. **Consistency**: All REPLs use same core, slash commands, control flow
5. **Testability**: Each component can be tested independently
6. **Extensibility**: New modules just register builders, no core changes

## Key Invariants

1. **TETRA_SRC must be set**: All paths relative to this global
2. **Prompt builders return strings**: Empty string = no contribution
3. **Return codes signal state**: 0=continue, 1=exit, 2=refresh
4. **Slash commands start with /**: No collision with actions or shell
5. **Mode detection is automatic**: Unless explicitly overridden
6. **Modules register, core orchestrates**: No hardcoded module knowledge

## Related Documents

- `docs/REPL_Progressive_Enhancement.md` - Enhancement vision
- `demo/docs/separation.md` - TUI/REPL separation principles
- `bash/rag/docs/REPL_FEATURES.md` - RAG REPL feature documentation
- `docs/Tetra_Library_Convention.md` - Module structure conventions
- `docs/TES_Agent_Extension.md` - Action system integration
