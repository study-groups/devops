#!/usr/bin/env bash

# Action Registry - Refactored for clear I/O signatures
# Focus: File transfer actions across endpoint contexts

# Explicit registry list
declare -ga ACTION_REGISTRY=(
    # HELP environment actions
    "help_signatures"
    "help_contexts"
    "help_modes"
    "help_operations"
    # Meta/Help
    "show_demo"
    "show_help"
    "show_signatures"
    # Local inspection
    "view_env"
    "view_toml"
    "status_local"
    # Remote inspection (requires context)
    "status_remote"
    "view_remote_logs"
    # File operations
    "fetch_config"
    "push_config"
    "sync_files"
)

# Declare action helper
declare_action() {
    local action_name="$1"
    shift

    declare -gA "ACTION_${action_name}"
    local -n action_def="ACTION_${action_name}"

    # Defaults
    action_def[state]="idle"
    action_def[immediate]="true"
    action_def[inputs]=""           # What this action needs as input
    action_def[output]="@tui[content]"  # Primary output destination
    action_def[effects]=""          # Side effects (files written, processes started)
    action_def[can]=""              # What this action can do
    action_def[cannot]=""           # What this action cannot do
    action_def[exec_at]="@local"    # Where execution happens
    action_def[source_at]=""        # Where data comes from (for reads)
    action_def[target_at]=""        # Where data goes to (for writes)
    action_def[tes_level]="local"
    action_def[tes_operation]=""    # read, write, execute

    # Parse key=value pairs
    while [[ $# -gt 0 ]]; do
        local key="${1%%=*}"
        local value="${1#*=}"
        action_def["$key"]="$value"
        shift
    done
}

# ========== HELP ENVIRONMENT ==========
declare_action "help_signatures" \
    "verb=help" \
    "noun=signatures" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Explain action signature anatomy"

declare_action "help_contexts" \
    "verb=help" \
    "noun=contexts" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Explain execution contexts (HELP/Local/Dev/Staging/Production)"

declare_action "help_modes" \
    "verb=help" \
    "noun=modes" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Explain modes (Inspect/Transfer/Execute)"

declare_action "help_operations" \
    "verb=help" \
    "noun=operations" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Explain TES operations (read/write/execute)"

# ========== META/HELP ==========
declare_action "show_demo" \
    "verb=show" \
    "noun=demo" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Show demo information"

declare_action "show_help" \
    "verb=show" \
    "noun=help" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Display navigation help"

declare_action "show_signatures" \
    "verb=show" \
    "noun=signatures" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=List all action signatures with I/O"

# ========== LOCAL INSPECTION ==========
declare_action "view_env" \
    "verb=view" \
    "noun=env" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "source_at=@local" \
    "immediate=true" \
    "can=Display current execution context" \
    "cannot=Change environment variables"

declare_action "view_toml" \
    "verb=view" \
    "noun=toml" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "source_at=@local" \
    "immediate=true" \
    "can=Display local tetra.toml config" \
    "cannot=Edit configuration"

declare_action "status_local" \
    "verb=status" \
    "noun=local" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "immediate=true" \
    "can=Show local TSM processes" \
    "cannot=Start or stop services"

# ========== REMOTE INSPECTION (context-dependent) ==========
declare_action "status_remote" \
    "verb=status" \
    "noun=remote" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "source_at=@{context}" \
    "tes_operation=execute" \
    "immediate=true" \
    "can=Execute 'tsm list' on remote endpoint" \
    "cannot=Modify remote state"

declare_action "view_remote_logs" \
    "verb=view" \
    "noun=logs" \
    "inputs=" \
    "output=@tui[content]" \
    "exec_at=@local" \
    "source_at=@{context}" \
    "tes_operation=read" \
    "immediate=true" \
    "can=Read remote log files" \
    "cannot=Modify or delete logs"

# ========== FILE TRANSFER OPERATIONS ==========
declare_action "fetch_config" \
    "verb=fetch" \
    "noun=config" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@local[~/Downloads/config.toml]" \
    "exec_at=@local" \
    "source_at=@{context}" \
    "target_at=@local" \
    "tes_operation=read" \
    "immediate=false" \
    "can=Download tetra.toml from remote endpoint" \
    "cannot=Overwrite without confirmation"

declare_action "push_config" \
    "verb=push" \
    "noun=config" \
    "inputs=@local[~/tetra.toml]" \
    "output=@tui[content]" \
    "effects=@{context}[~/tetra.toml]" \
    "exec_at=@local" \
    "source_at=@local" \
    "target_at=@{context}" \
    "tes_operation=write" \
    "immediate=false" \
    "can=Upload local tetra.toml to remote endpoint" \
    "cannot=Push to production without review"

declare_action "sync_files" \
    "verb=sync" \
    "noun=files" \
    "inputs=@local[~/src/]" \
    "output=@tui[content]" \
    "effects=@{context}[~/src/]" \
    "exec_at=@local" \
    "source_at=@local" \
    "target_at=@{context}" \
    "tes_operation=write" \
    "immediate=false" \
    "can=Sync local source directory to remote" \
    "cannot=Delete files on remote"

# List all action signatures with full I/O details
list_action_signatures() {
    echo "Action Registry - I/O Signatures"
    echo ""

    for action_name in "${ACTION_REGISTRY[@]}"; do
        if ! declare -p "ACTION_${action_name}" &>/dev/null; then
            continue
        fi

        local -n _reg_action="ACTION_${action_name}"
        local verb="${_reg_action[verb]}"
        local noun="${_reg_action[noun]}"
        local inputs="${_reg_action[inputs]}"
        local output="${_reg_action[output]}"
        local effects="${_reg_action[effects]}"
        local exec_at="${_reg_action[exec_at]}"
        local source_at="${_reg_action[source_at]}"
        local target_at="${_reg_action[target_at]}"

        # Build signature: (inputs) → output [where effects]
        local input_sig="()"
        [[ -n "$inputs" ]] && input_sig="($inputs)"

        local output_sig="$output"
        [[ -n "$effects" ]] && output_sig="$output [where $effects]"

        printf "  %-20s %s " "$verb:$noun" "$ENDPOINT_OP"
        printf "%-50s\n" "$input_sig $FLOW_OP $output_sig"
    done
}

# Get action detail (for cursor inspection)
get_action_detail() {
    local action_name="$1"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "Action not found: $action_name"
        return 1
    fi

    local -n _action="ACTION_${action_name}"

    cat <<EOF
Action Signature Detail
$(render_separator)

${_action[verb]}:${_action[noun]}

Signature:
  (${_action[inputs]:-}) → ${_action[output]}${_action[effects]:+ [where ${_action[effects]}]}

Execution:
  runs_at:  ${_action[exec_at]:-@local}${_action[source_at]:+
  reads_from: ${_action[source_at]}}${_action[target_at]:+
  writes_to: ${_action[target_at]}}

Capabilities:
  can:    ${_action[can]:-not specified}${_action[cannot]:+
  cannot: ${_action[cannot]}}

TES:
  operation: ${_action[tes_operation]:-local}
  immediate: ${_action[immediate]:-true}
EOF
}
