#!/usr/bin/env bash
# Tetra TUI - Initialization & Content Model
# Source dependencies and set up state

: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source TDS for color system
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
else
    echo "Error: TDS not found at $TDS_SRC" >&2
    return 1
fi

# Source buffer system
source "$TETRA_SRC/bash/tetra/rendering/buffer.sh"

# Source action system
source "$TETRA_SRC/bash/tetra/rendering/actions.sh"

# Source mode-module-repl system
source "$TETRA_SRC/bash/tetra/modes/matrix.sh"
source "$TETRA_SRC/bash/repl/temperature_loader.sh"
source "$TETRA_SRC/bash/repl/mode_repl.sh"

# Source module action interfaces (conditionally)
[[ -f "$TETRA_SRC/bash/org/action_interface.sh" ]] && \
    source "$TETRA_SRC/bash/org/action_interface.sh"
[[ -f "$TETRA_SRC/bash/tsm/action_interface.sh" ]] && \
    source "$TETRA_SRC/bash/tsm/action_interface.sh"
[[ -f "$TETRA_SRC/bash/deploy/action_interface.sh" ]] && \
    source "$TETRA_SRC/bash/deploy/action_interface.sh"

# Source bug mode (unicode explorer easter egg)
source "$TETRA_SRC/bash/tetra/modes/bug.sh"

# Tetra branded spinner
declare -ga TETRA_SPINNER=(
    $'\u00B7'    # · - idle/waiting
    $'\u2025'    # ‥ - initializing
    $'\u2026'    # … - processing
    $'\u22EF'    # ⋯ - working
    $'\u2059'    # ⁙ - completing
)

# Spinner state constants
TETRA_SPINNER_IDLE=0
TETRA_SPINNER_INIT=1
TETRA_SPINNER_PROC=2
TETRA_SPINNER_WORK=3
TETRA_SPINNER_DONE=4

# Content model - central state
declare -gA CONTENT_MODEL=(
    [org]=""
    [env]=""
    [env_index]="0"
    [module]=""
    [module_index]="0"
    [action]=""
    [action_index]="0"
    [action_state]="idle"
    [spinner_state]="0"
    [status_line]=""
    [header_size]="max"
    [command_mode]="false"
    [command_input]=""
    [view_mode]="false"
    [scroll_offset]="0"
    [preview_mode]="false"
    [animation_enabled]="true"
    [separator_position]="0"
)

# Dynamic context lists (populated on init)
declare -ga TUI_ENVS=()
declare -ga TUI_MODULES=()

# Content buffers
declare -gA TUI_BUFFERS=(
    ["@tui[header]"]=""
    ["@tui[separator]"]=""
    ["@tui[command]"]=""
    ["@tui[content]"]=""
    ["@tui[cli]"]=""
    ["@tui[footer]"]=""
    ["@tui[status]"]=""
)

# Build module list from bash/*
_tui_build_module_list() {
    TUI_MODULES=()
    local bash_dir="$TETRA_SRC/bash"

    for dir in "$bash_dir"/*/; do
        [[ -d "$dir" ]] || continue
        local name="$(basename "$dir")"
        # Skip non-modules
        [[ "$name" == "tetra" ]] && continue
        [[ "$name" == "wip" ]] && continue
        [[ ! -f "$dir/${name}.sh" && ! -f "$dir/includes.sh" ]] && continue
        TUI_MODULES+=("$name")
    done

    # Sort
    IFS=$'\n' TUI_MODULES=($(sort <<<"${TUI_MODULES[*]}")); unset IFS
}

# Build env list from org module
_tui_build_env_list() {
    TUI_ENVS=()
    if declare -f org_env_names >/dev/null 2>&1; then
        local envs
        envs=$(org_env_names 2>/dev/null)
        if [[ -n "$envs" ]]; then
            readarray -t TUI_ENVS <<< "$envs"
        fi
    fi
    # Fallback if no envs
    [[ ${#TUI_ENVS[@]} -eq 0 ]] && TUI_ENVS=("local" "dev" "staging" "prod")
}

# Initialize context from org module
_tui_init_context() {
    # Get org from org module
    if declare -f org_active >/dev/null 2>&1; then
        CONTENT_MODEL[org]="$(org_active 2>/dev/null)"
    fi
    [[ -z "${CONTENT_MODEL[org]}" ]] && CONTENT_MODEL[org]="none"

    # Build lists
    _tui_build_env_list
    _tui_build_module_list

    # Set initial values
    if [[ ${#TUI_ENVS[@]} -gt 0 ]]; then
        CONTENT_MODEL[env]="${TUI_ENVS[0]}"
        CONTENT_MODEL[env_index]=0
    fi

    if [[ ${#TUI_MODULES[@]} -gt 0 ]]; then
        CONTENT_MODEL[module]="${TUI_MODULES[0]}"
        CONTENT_MODEL[module_index]=0
    fi
}
