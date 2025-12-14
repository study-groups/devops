#!/usr/bin/env bash
# dev_mode.sh - Developer mode for live parameter tuning
# Provides HUD overlay and runtime parameter modification

[[ -n "${_GAME_DEV_MODE_LOADED}" ]] && return 0
_GAME_DEV_MODE_LOADED=1

# Dev mode state
declare -g DEV_MODE_ENABLED=0
declare -g DEV_MODE_SHOW_MAPPING=1        # Show stick mapping in logs
declare -g DEV_MODE_SHOW_STATE=1          # Show state variables
declare -g DEV_MODE_SHOW_FORCES=1         # Show field forces
declare -g DEV_MODE_LOG_TO_STDERR=0       # Log to stderr (visible outside engine)

# Parameter editing
declare -g -A DEV_MODE_PARAMS             # [param_name] = current_value
declare -g DEV_MODE_SELECTED_PARAM=0      # Index of selected parameter
declare -g -a DEV_MODE_PARAM_LIST         # Ordered list of parameter names

# Initialize dev mode
dev_mode_init() {
    DEV_MODE_ENABLED=1

    # Register parameters that can be edited
    DEV_MODE_PARAM_LIST=(
        "QUADRAPOLE_CONTRARY_THRESHOLD"
        "QUADRAPOLE_CONTRARY_ANGLE"
        "QUADRAPOLE_TENSION_CONSTANT"
        "QUADRAPOLE_REPULSION_CONSTANT"
        "QUADRAPOLE_MAX_SEPARATION"
        "QUADRAPOLE_MIN_SEPARATION"
    )

    # Cache current values
    for param in "${DEV_MODE_PARAM_LIST[@]}"; do
        DEV_MODE_PARAMS[$param]="${!param}"
    done

    echo "[DEV MODE] Enabled - Press 'd' to toggle, '[' and ']' to adjust params" >&2
}

# Toggle dev mode
dev_mode_toggle() {
    if [[ "$DEV_MODE_ENABLED" == "1" ]]; then
        DEV_MODE_ENABLED=0
        echo "[DEV MODE] Disabled" >&2
    else
        DEV_MODE_ENABLED=1
        echo "[DEV MODE] Enabled" >&2
    fi
}

# Log to C engine event system
# Usage: dev_mode_log_event <type> <user_id> <data>
dev_mode_log_event() {
    local type="$1"
    local user_id="$2"
    local data="$3"

    # For now, log to stderr so it's visible
    # In production, this would send a command to the C engine
    if [[ "$DEV_MODE_LOG_TO_STDERR" == "1" ]]; then
        echo "[${type}] User${user_id}: ${data}" >&2
    fi

    # TODO: Send to C engine event log
    # echo "LOG_EVENT ${type} ${user_id} ${data}" to C engine stdin
}

# Log mapping info (called from quadrapole_update)
# Usage: dev_mode_log_mapping <lx> <ly> <lvx> <lvy> <rx> <ry> <rvx> <rvy>
dev_mode_log_mapping() {
    if [[ "$DEV_MODE_ENABLED" != "1" ]] || [[ "$DEV_MODE_SHOW_MAPPING" != "1" ]]; then
        return
    fi

    local lx="$1" ly="$2" lvx="$3" lvy="$4"
    local rx="$5" ry="$6" rvx="$7" rvy="$8"

    local msg=$(printf "L[%.2f,%.2f]→V[%.1f,%.1f] R[%.2f,%.2f]→V[%.1f,%.1f]" \
        "$lx" "$ly" "$lvx" "$lvy" "$rx" "$ry" "$rvx" "$rvy")

    dev_mode_log_event "MAPPING" 0 "$msg"

    # Log to file and stderr
    if [[ -n "$DEV_LOG_FILE" ]]; then
        echo "[MAPPING] $msg" >> "$DEV_LOG_FILE"
    fi
    echo "[MAPPING] $msg" >&2
}

# Log state info
# Usage: dev_mode_log_state <bonded> <timer>
dev_mode_log_state() {
    if [[ "$DEV_MODE_ENABLED" != "1" ]] || [[ "$DEV_MODE_SHOW_STATE" != "1" ]]; then
        return
    fi

    local bonded="$1"
    local timer="$2"
    local state="BONDED"
    [[ "$bonded" == "0" ]] && state="SPLIT"

    local msg=$(printf "%s timer=%.2fs" "$state" "$timer")

    # Only log if timer is active or state changed
    if (( $(echo "$timer > 0.1" | bc -l) )) || [[ "$state" != "$DEV_MODE_LAST_STATE" ]]; then
        if [[ -n "$DEV_LOG_FILE" ]]; then
            echo "[STATE] $msg" >> "$DEV_LOG_FILE"
        fi
        echo "[STATE] $msg" >&2
        DEV_MODE_LAST_STATE="$state"
    fi
}

# Log field forces
# Usage: dev_mode_log_forces <distance> <force_type> <magnitude>
dev_mode_log_forces() {
    if [[ "$DEV_MODE_ENABLED" != "1" ]] || [[ "$DEV_MODE_SHOW_FORCES" != "1" ]]; then
        return
    fi

    local distance="$1"
    local force_type="$2"  # "tension" or "repulsion"
    local magnitude="$3"

    local msg=$(printf "%s: dist=%.1f force=%.2f" "$force_type" "$distance" "$magnitude")
    echo "[FORCES] $msg" >&2
}

# Cycle through parameters
dev_mode_next_param() {
    DEV_MODE_SELECTED_PARAM=$(( (DEV_MODE_SELECTED_PARAM + 1) % ${#DEV_MODE_PARAM_LIST[@]} ))
    dev_mode_show_current_param
}

dev_mode_prev_param() {
    DEV_MODE_SELECTED_PARAM=$(( (DEV_MODE_SELECTED_PARAM - 1 + ${#DEV_MODE_PARAM_LIST[@]}) % ${#DEV_MODE_PARAM_LIST[@]} ))
    dev_mode_show_current_param
}

# Show current selected parameter
dev_mode_show_current_param() {
    local param="${DEV_MODE_PARAM_LIST[$DEV_MODE_SELECTED_PARAM]}"
    local value="${!param}"
    echo "[DEV] [$DEV_MODE_SELECTED_PARAM] $param = $value" >&2
}

# Adjust parameter value
# Usage: dev_mode_adjust_param <delta>
dev_mode_adjust_param() {
    local delta="$1"
    local param="${DEV_MODE_PARAM_LIST[$DEV_MODE_SELECTED_PARAM]}"
    local current="${!param}"

    # Calculate new value
    local new_value=$(echo "scale=4; $current + $delta" | bc -l)

    # Clamp to reasonable ranges
    case "$param" in
        *THRESHOLD|*CONSTANT)
            # Keep positive
            if (( $(echo "$new_value < 0.1" | bc -l) )); then
                new_value=0.1
            fi
            ;;
        *ANGLE)
            # Keep 0-180
            if (( $(echo "$new_value < 0" | bc -l) )); then
                new_value=0
            elif (( $(echo "$new_value > 180" | bc -l) )); then
                new_value=180
            fi
            ;;
        *SEPARATION)
            # Keep positive
            if (( $(echo "$new_value < 1.0" | bc -l) )); then
                new_value=1.0
            fi
            ;;
    esac

    # Update the global variable
    eval "$param=$new_value"

    echo "[DEV] $param = $new_value (Δ$delta)" >&2
}

# Increase selected parameter
dev_mode_increase_param() {
    local param="${DEV_MODE_PARAM_LIST[$DEV_MODE_SELECTED_PARAM]}"

    # Determine step size based on parameter type
    local step=0.1
    case "$param" in
        *THRESHOLD)
            step=0.1
            ;;
        *ANGLE)
            step=5.0
            ;;
        *CONSTANT)
            step=0.1
            ;;
        *SEPARATION)
            step=1.0
            ;;
    esac

    dev_mode_adjust_param "$step"
}

# Decrease selected parameter
dev_mode_decrease_param() {
    local param="${DEV_MODE_PARAM_LIST[$DEV_MODE_SELECTED_PARAM]}"

    # Determine step size based on parameter type
    local step=-0.1
    case "$param" in
        *THRESHOLD)
            step=-0.1
            ;;
        *ANGLE)
            step=-5.0
            ;;
        *CONSTANT)
            step=-0.1
            ;;
        *SEPARATION)
            step=-1.0
            ;;
    esac

    dev_mode_adjust_param "$step"
}

# Show dev mode HUD (call periodically)
dev_mode_draw_hud() {
    if [[ "$DEV_MODE_ENABLED" != "1" ]]; then
        return
    fi

    # This would integrate with the C engine's HUD system
    # For now, we just log the current parameter
    :
}

# Save parameters to config file
# Usage: dev_mode_save_config <file>
dev_mode_save_config() {
    local file="${1:-config/quadrapole_dev.toml}"

    echo "# Quadrapole Developer Configuration" > "$file"
    echo "# Generated by dev mode at $(date)" >> "$file"
    echo "" >> "$file"
    echo "[quadrapole]" >> "$file"

    for param in "${DEV_MODE_PARAM_LIST[@]}"; do
        local value="${!param}"
        local name="${param#QUADRAPOLE_}"  # Strip prefix
        name="${name,,}"  # Lowercase
        echo "$name = $value" >> "$file"
    done

    echo "[DEV MODE] Saved config to $file" >&2
}

# Export functions
export -f dev_mode_init
export -f dev_mode_toggle
export -f dev_mode_log_event
export -f dev_mode_log_mapping
export -f dev_mode_log_state
export -f dev_mode_log_forces
export -f dev_mode_next_param
export -f dev_mode_prev_param
export -f dev_mode_show_current_param
export -f dev_mode_adjust_param
export -f dev_mode_increase_param
export -f dev_mode_decrease_param
export -f dev_mode_draw_hud
export -f dev_mode_save_config
