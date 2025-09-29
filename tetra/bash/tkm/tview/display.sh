#!/usr/bin/env bash

# TKM Display Helper Functions for TView
# Provides rendering utilities for TKM-specific displays

# Source dependencies
TKM_TVIEW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$TKM_TVIEW_DIR/provider.sh" ]] && source "$TKM_TVIEW_DIR/provider.sh"
[[ -f "$TKM_TVIEW_DIR/actions.sh" ]] && source "$TKM_TVIEW_DIR/actions.sh"
[[ -f "$TKM_TVIEW_DIR/secrets.sh" ]] && source "$TKM_TVIEW_DIR/secrets.sh"

# Render TKM-specific status indicators
render_tkm_status_indicator() {
    local env="$1"
    local status="${TKM_SSH_STATUS[${env}_status]:-unknown}"
    local latency="${TKM_SSH_STATUS[${env}_latency]:-}"

    case "$status" in
        "local")
            echo "$(render_status_indicator "success" "Local Access")"
            ;;
        "connected")
            echo "$(render_status_indicator "success" "Connected ${latency:+($latency)}")"
            ;;
        "disconnected")
            echo "$(render_status_indicator "error" "Disconnected")"
            ;;
        "testing"|"pending")
            echo "$(render_status_indicator "warning" "Testing...")"
            ;;
        *)
            echo "$(render_status_indicator "info" "Unknown")"
            ;;
    esac
}

# Render SSH key status
render_tkm_key_status() {
    local env="$1" user="$2"
    local key_status="${TKM_KEY_STATUS[${env}_${user}_status]:-unknown}"
    local key_age="${TKM_KEY_STATUS[${env}_${user}_age]:-}"

    case "$key_status" in
        "valid")
            echo "${GREEN}●${COLOR_RESET}${user}${key_age:+ ($key_age)}"
            ;;
        "expiring")
            echo "${YELLOW}◐${COLOR_RESET}${user}${key_age:+ ($key_age)}"
            ;;
        "expired")
            echo "${RED}●${COLOR_RESET}${user}${key_age:+ (EXPIRED $key_age)}"
            ;;
        "missing")
            echo "${RED}○${COLOR_RESET}${user} (missing)"
            ;;
        *)
            echo "${GRAY}?${COLOR_RESET}${user} (unknown)"
            ;;
    esac
}

# Render secrets status
render_secrets_status_indicator() {
    local local_status=$(secrets_get_env_status "local" 2>/dev/null | head -1)
    local dev_status=$(secrets_get_env_status "dev" 2>/dev/null | head -1)
    local staging_status=$(secrets_get_env_status "staging" 2>/dev/null | head -1)

    local status_count=0
    [[ "$local_status" == "configured" ]] && ((status_count++))
    [[ "$dev_status" == "configured" ]] && ((status_count++))
    [[ "$staging_status" == "configured" ]] && ((status_count++))

    case $status_count in
        3) echo "$(render_status_indicator "success" "All Envs Configured")" ;;
        2) echo "$(render_status_indicator "warning" "Partially Configured")" ;;
        1) echo "$(render_status_indicator "warning" "Minimal Configuration")" ;;
        *) echo "$(render_status_indicator "error" "Secrets Missing")" ;;
    esac
}

# Render action list for environment
render_tkm_action_list() {
    local env="$1"
    local start_index="${2:-0}"
    local actions=($(tkm_get_env_actions "$env"))

    local item_index=$start_index
    for action in "${actions[@]}"; do
        local action_name="$(tkm_get_action_name "$action")"
        local requirements="$(tkm_get_action_requirements "$action" "$env" 2>/dev/null)"

        local color="$GREEN"
        local suffix=""

        if [[ -n "$requirements" ]]; then
            if [[ "$requirements" =~ ^ERROR ]]; then
                color="$RED"
                suffix=" ⚠"
            elif [[ "$requirements" =~ ^WARNING|^CAUTION ]]; then
                color="$YELLOW"
                suffix=" ⚠"
            fi
        fi

        echo "$(highlight_line "  $action_name$suffix" "$(is_current_item $item_index)" "$color")"
        ((item_index++))
    done
}

# Count local SSH keys
count_local_ssh_keys() {
    find "$HOME/.ssh" -name "*.key" -o -name "id_*" -not -name "*.pub" 2>/dev/null | wc -l | tr -d ' '
}

# Render file status
render_file_status() {
    local file="$1"

    if [[ -f "$file" ]]; then
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        local mod_time=$(stat -f%m "$file" 2>/dev/null || stat -c%Y "$file" 2>/dev/null || echo "0")
        local age=$(( $(date +%s) - mod_time ))
        local age_str=""

        if [[ $age -gt 86400 ]]; then
            age_str="($(( age / 86400 ))d ago)"
        elif [[ $age -gt 3600 ]]; then
            age_str="($(( age / 3600 ))h ago)"
        else
            age_str="(recent)"
        fi

        echo "${GREEN}✓${COLOR_RESET} ${size}b $age_str"
    else
        echo "${RED}✗${COLOR_RESET} missing"
    fi
}

# Render SSH agent status
render_ssh_agent_status() {
    if [[ -n "${SSH_AGENT_PID:-}" ]] && kill -0 "$SSH_AGENT_PID" 2>/dev/null; then
        local key_count=$(ssh-add -l 2>/dev/null | wc -l | tr -d ' ')
        echo "${GREEN}Running${COLOR_RESET} (${key_count} keys loaded)"
    elif pgrep -x ssh-agent >/dev/null 2>&1; then
        echo "${YELLOW}Running${COLOR_RESET} (not connected)"
    else
        echo "${RED}Not running${COLOR_RESET}"
    fi
}

# Get environment description from config
get_tkm_env_description() {
    local env="$1"
    echo "${TKM_AMIGOS_DATA[tkm_${env}_description]:-No description available}"
}

# Render environment details for individual env views
render_tkm_env_details() {
    local env="$1"
    local host="$(tkm_get_env_host "$env")"
    local users=($(echo "${TKM_AMIGOS_DATA[tkm_${env}_users]:-env root}" | tr -d '"[],' | tr ' ' '\n'))

    echo "Environment: $(tkm_get_env_name "$env")"
    echo "Host: $host"
    echo "SSH Status: $(render_tkm_status_indicator "$env")"
    echo "Description: $(get_tkm_env_description "$env")"
    echo ""
    echo "User Access:"
    for user in "${users[@]}"; do
        [[ -z "$user" ]] && continue
        echo "  $user: $(render_tkm_key_status "$env" "$user")"
    done
    echo ""
    echo "Recent Activity:"
    tkm_action_view_logs "$env" 2>/dev/null | tail -3 || echo "  No recent activity"
}

# Format action output for tview
format_tkm_action_output() {
    local action="$1" env="$2"

    echo "=== $(tkm_get_action_name "$action") - $env ==="
    echo "$(tkm_get_action_description "$action" "$env")"
    echo ""

    local requirements="$(tkm_get_action_requirements "$action" "$env" 2>/dev/null)"
    if [[ -n "$requirements" ]]; then
        echo "REQUIREMENTS:"
        echo "$requirements"
        echo ""
    fi
}

# Get action by index for environment
get_tkm_action_by_index() {
    local env="$1" index="$2"
    local actions=($(tkm_get_env_actions "$env"))

    if [[ $index -ge 0 && $index -lt ${#actions[@]} ]]; then
        echo "${actions[$index]}"
    else
        echo ""
    fi
}