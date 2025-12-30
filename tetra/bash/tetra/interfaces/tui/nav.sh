#!/usr/bin/env bash
# Tetra TUI - Navigation
# Environment, module, and action cycling

# Navigation uses dynamic TUI_ENVS and TUI_MODULES (built by _tui_init_context)

nav_env() {
    [[ ${#TUI_ENVS[@]} -eq 0 ]] && return
    local idx="${CONTENT_MODEL[env_index]}"
    idx=$(( (idx + 1) % ${#TUI_ENVS[@]} ))
    CONTENT_MODEL[env_index]="$idx"
    CONTENT_MODEL[env]="${TUI_ENVS[$idx]}"
}

nav_module() {
    [[ ${#TUI_MODULES[@]} -eq 0 ]] && return
    local idx="${CONTENT_MODEL[module_index]}"
    idx=$(( (idx + 1) % ${#TUI_MODULES[@]} ))
    CONTENT_MODEL[module_index]="$idx"
    CONTENT_MODEL[module]="${TUI_MODULES[$idx]}"
}

nav_module_prev() {
    [[ ${#TUI_MODULES[@]} -eq 0 ]] && return
    local idx="${CONTENT_MODEL[module_index]}"
    if [[ $idx -eq 0 ]]; then
        idx=$(( ${#TUI_MODULES[@]} - 1 ))
    else
        idx=$(( idx - 1 ))
    fi
    CONTENT_MODEL[module_index]="$idx"
    CONTENT_MODEL[module]="${TUI_MODULES[$idx]}"
}

nav_action() {
    local env="${CONTENT_MODEL[env]}"
    local module="${CONTENT_MODEL[module]}"

    # Use matrix system for action discovery
    local actions_list=($(get_actions_for_context "$env" "$module" 2>/dev/null))

    if [[ ${#actions_list[@]} -gt 0 ]]; then
        local idx="${CONTENT_MODEL[action_index]}"
        idx=$(( (idx + 1) % ${#actions_list[@]} ))
        CONTENT_MODEL[action_index]="$idx"
        CONTENT_MODEL[action]="${actions_list[$idx]}"
    else
        CONTENT_MODEL[action]=""
    fi
}
