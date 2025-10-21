#!/usr/bin/env bash
# agents.sh - Tetra Agent Core (TES-Agent 1.0)
#
# Provides common agent functionality:
# - Agent registration
# - Agent discovery
# - Session management
# - Profile management
# - Agent lifecycle

# Global agent registry
declare -gA TETRA_AGENTS=()
declare -gA TETRA_AGENT_CLASSES=()

# Agent registration
tetra_register_agent() {
    local agent_name="$1"
    local agent_class="$2"  # protocol, llm, system, service

    if [[ -z "$agent_name" ]] || [[ -z "$agent_class" ]]; then
        echo "Error: Agent name and class required" >&2
        return 1
    fi

    TETRA_AGENTS["$agent_name"]="$agent_class"
    TETRA_AGENT_CLASSES["$agent_class"]+="$agent_name "

    # Verify required functions exist
    local required_fns=(
        "${agent_name}_init"
        "${agent_name}_connect"
        "${agent_name}_execute"
        "${agent_name}_disconnect"
        "${agent_name}_cleanup"
    )

    local missing=()
    for fn in "${required_fns[@]}"; do
        if ! declare -f "$fn" >/dev/null 2>&1; then
            missing+=("$fn")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Warning: Agent '$agent_name' missing functions: ${missing[*]}" >&2
    fi

    return 0
}

# Unregister agent
tetra_unregister_agent() {
    local agent_name="$1"

    if [[ -z "${TETRA_AGENTS[$agent_name]:-}" ]]; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local agent_class="${TETRA_AGENTS[$agent_name]}"
    unset "TETRA_AGENTS[$agent_name]"

    # Remove from class list
    local agents="${TETRA_AGENT_CLASSES[$agent_class]}"
    TETRA_AGENT_CLASSES["$agent_class"]="${agents//$agent_name /}"

    return 0
}

# List all registered agents
tetra_list_agents() {
    local class_filter="${1:-}"

    if [[ -n "$class_filter" ]]; then
        # Filter by class
        echo "${TETRA_AGENT_CLASSES[$class_filter]:-}"
    else
        # List all
        for agent in "${!TETRA_AGENTS[@]}"; do
            echo "$agent"
        done | sort
    fi
}

# Get agent class
tetra_get_agent_class() {
    local agent_name="$1"
    echo "${TETRA_AGENTS[$agent_name]:-}"
}

# Check if agent is registered
tetra_is_agent() {
    local agent_name="$1"
    [[ -n "${TETRA_AGENTS[$agent_name]:-}" ]]
}

# Get agent info
tetra_agent_info() {
    local agent_name="$1"

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local agent_class="${TETRA_AGENTS[$agent_name]}"
    local agent_src="${TETRA_SRC}/bash/${agent_name}"
    local agent_dir="${TETRA_DIR}/${agent_name}"

    cat <<EOF
Agent: $agent_name
Class: $agent_class
Source: $agent_src
Runtime: $agent_dir

Functions:
  ${agent_name}_init
  ${agent_name}_connect
  ${agent_name}_execute
  ${agent_name}_disconnect
  ${agent_name}_cleanup
EOF

    # Check for session state
    local session_state="$agent_dir/config/session.state"
    if [[ -f "$session_state" ]]; then
        echo ""
        echo "Session State:"
        jq '.' "$session_state" 2>/dev/null || cat "$session_state"
    fi
}

# Get agent status
tetra_agent_status() {
    local agent_name="$1"

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local agent_dir="${TETRA_DIR}/${agent_name}"
    local session_state="$agent_dir/config/session.state"

    if [[ ! -f "$session_state" ]]; then
        echo "Status: Not initialized"
        return 0
    fi

    local connected=$(jq -r '.connected // false' "$session_state" 2>/dev/null)
    local session_id=$(jq -r '.session_id // "none"' "$session_state" 2>/dev/null)
    local connected_at=$(jq -r '.connected_at // "never"' "$session_state" 2>/dev/null)

    cat <<EOF
Status: $([ "$connected" = "true" ] && echo "Connected" || echo "Disconnected")
Session ID: $session_id
Connected At: $connected_at
State File: $session_state
EOF
}

# Initialize agent
tetra_agent_init() {
    local agent_name="$1"

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local init_fn="${agent_name}_init"
    if ! declare -f "$init_fn" >/dev/null 2>&1; then
        echo "Error: Init function '$init_fn' not found" >&2
        return 1
    fi

    echo "Initializing agent: $agent_name"
    "$init_fn"
}

# Connect to agent
tetra_agent_connect() {
    local agent_name="$1"
    shift
    local args=("$@")

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local connect_fn="${agent_name}_connect"
    if ! declare -f "$connect_fn" >/dev/null 2>&1; then
        echo "Error: Connect function '$connect_fn' not found" >&2
        return 1
    fi

    echo "Connecting to agent: $agent_name"
    "$connect_fn" "${args[@]}"
}

# Execute agent action
tetra_agent_execute() {
    local agent_name="$1"
    local action="$2"
    shift 2
    local args=("$@")

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local execute_fn="${agent_name}_execute"
    if ! declare -f "$execute_fn" >/dev/null 2>&1; then
        echo "Error: Execute function '$execute_fn' not found" >&2
        return 1
    fi

    "$execute_fn" "$action" "${args[@]}"
}

# Disconnect from agent
tetra_agent_disconnect() {
    local agent_name="$1"

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local disconnect_fn="${agent_name}_disconnect"
    if ! declare -f "$disconnect_fn" >/dev/null 2>&1; then
        echo "Error: Disconnect function '$disconnect_fn' not found" >&2
        return 1
    fi

    echo "Disconnecting from agent: $agent_name"
    "$disconnect_fn"
}

# Cleanup agent
tetra_agent_cleanup() {
    local agent_name="$1"

    if ! tetra_is_agent "$agent_name"; then
        echo "Error: Agent '$agent_name' not registered" >&2
        return 1
    fi

    local cleanup_fn="${agent_name}_cleanup"
    if ! declare -f "$cleanup_fn" >/dev/null 2>&1; then
        echo "Error: Cleanup function '$cleanup_fn' not found" >&2
        return 1
    fi

    echo "Cleaning up agent: $agent_name"
    "$cleanup_fn"
}

# Profile management
tetra_agent_list_profiles() {
    local agent_name="$1"

    local agent_src="${TETRA_SRC}/bash/${agent_name}"
    local agent_dir="${TETRA_DIR}/${agent_name}"

    local profiles=()
    local -A seen

    # System profiles
    if [[ -d "$agent_src/profiles" ]]; then
        for conf in "$agent_src/profiles"/*.conf; do
            [[ -f "$conf" ]] || continue
            local name=$(basename "$conf" .conf)
            if [[ -z "${seen[$name]:-}" ]]; then
                profiles+=("$name")
                seen["$name"]=1
            fi
        done
    fi

    # User profiles (override system)
    if [[ -d "$agent_dir/profiles" ]]; then
        for conf in "$agent_dir/profiles"/*.conf; do
            [[ -f "$conf" ]] || continue
            local name=$(basename "$conf" .conf)
            if [[ -z "${seen[$name]:-}" ]]; then
                profiles+=("$name")
                seen["$name"]=1
            fi
        done
    fi

    printf "%s\n" "${profiles[@]}" | sort -u
}

# Set agent profile
tetra_agent_set_profile() {
    local agent_name="$1"
    local profile_name="$2"

    local agent_dir="${TETRA_DIR}/${agent_name}"
    local config_dir="$agent_dir/config"

    # Validate profile exists
    if ! tetra_agent_validate_profile "$agent_name" "$profile_name"; then
        echo "Error: Profile '$profile_name' not found for agent '$agent_name'" >&2
        return 1
    fi

    # Save active profile
    mkdir -p "$config_dir"
    echo "$profile_name" > "$config_dir/profile.active"

    echo "Set active profile for '$agent_name': $profile_name"
}

# Get active profile
tetra_agent_get_profile() {
    local agent_name="$1"

    local agent_dir="${TETRA_DIR}/${agent_name}"
    local profile_file="$agent_dir/config/profile.active"

    if [[ -f "$profile_file" ]]; then
        cat "$profile_file"
    else
        echo "default"
    fi
}

# Validate profile exists
tetra_agent_validate_profile() {
    local agent_name="$1"
    local profile_name="$2"

    local agent_src="${TETRA_SRC}/bash/${agent_name}"
    local agent_dir="${TETRA_DIR}/${agent_name}"

    local user_profile="$agent_dir/profiles/$profile_name.conf"
    local system_profile="$agent_src/profiles/$profile_name.conf"

    [[ -f "$user_profile" ]] || [[ -f "$system_profile" ]]
}

# Load agent profile
tetra_agent_load_profile() {
    local agent_name="$1"
    local profile_name="${2:-$(tetra_agent_get_profile "$agent_name")}"

    local agent_src="${TETRA_SRC}/bash/${agent_name}"
    local agent_dir="${TETRA_DIR}/${agent_name}"

    local user_profile="$agent_dir/profiles/$profile_name.conf"
    local system_profile="$agent_src/profiles/$profile_name.conf"

    if [[ -f "$user_profile" ]]; then
        source "$user_profile"
        echo "Loaded profile: $user_profile" >&2
        return 0
    elif [[ -f "$system_profile" ]]; then
        source "$system_profile"
        echo "Loaded profile: $system_profile" >&2
        return 0
    else
        echo "Warning: Profile '$profile_name' not found for agent '$agent_name'" >&2
        return 1
    fi
}

# Export functions
export -f tetra_register_agent
export -f tetra_unregister_agent
export -f tetra_list_agents
export -f tetra_get_agent_class
export -f tetra_is_agent
export -f tetra_agent_info
export -f tetra_agent_status
export -f tetra_agent_init
export -f tetra_agent_connect
export -f tetra_agent_execute
export -f tetra_agent_disconnect
export -f tetra_agent_cleanup
export -f tetra_agent_list_profiles
export -f tetra_agent_set_profile
export -f tetra_agent_get_profile
export -f tetra_agent_validate_profile
export -f tetra_agent_load_profile
