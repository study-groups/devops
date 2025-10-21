#!/usr/bin/env bash

# TDS REPL UI Semantics
# High-level functions for rendering REPL UI components using design tokens

# Render environment indicator with appropriate token
# Args: env_name, env_index
tds_repl_render_env() {
    local env="$1"
    local index="$2"

    # Map index to token
    local tokens=(
        "repl.env.local"
        "repl.env.dev"
        "repl.env.staging"
        "repl.env.production"
    )

    local token="${tokens[$index]:-repl.env.local}"
    tds_text_color "$token"
    printf '%s' "$env"
    reset_color
}

# Render mode indicator with appropriate token
# Args: mode_name, mode_index
tds_repl_render_mode() {
    local mode="$1"
    local index="$2"

    # Map index to token
    local tokens=(
        "repl.mode.inspect"
        "repl.mode.transfer"
        "repl.mode.execute"
    )

    local token="${tokens[$index]:-repl.mode.inspect}"
    tds_text_color "$token"
    printf '%s' "$mode"
    reset_color
}

# Render action indicator with appropriate token
# Args: action_name
tds_repl_render_action() {
    local action="$1"

    if [[ -z "$action" || "$action" == "none" ]]; then
        tds_text_color "repl.action.none"
        printf 'none'
    else
        tds_text_color "repl.action.primary"
        printf '%s' "$action"
    fi
    reset_color
}

# Render org/context indicator
# Args: org_name
tds_repl_render_org() {
    local org="$1"

    if [[ -z "$org" || "$org" == "none" ]]; then
        tds_text_color "repl.org.inactive"
        printf 'none'
    else
        tds_text_color "repl.org.active"
        printf '%s' "$org"
    fi
    reset_color
}

# Render full org REPL prompt using design tokens
# Args: org, env, env_idx, mode, mode_idx, action
# Returns: Complete formatted prompt string to stdout
tds_repl_build_prompt() {
    local org="$1"
    local env="$2"
    local env_idx="$3"
    local mode="$4"
    local mode_idx="$5"
    local action="$6"

    # Build prompt: [org x env x mode] action>
    # Output directly to stdout

    # Opening bracket
    tds_text_color "repl.prompt.bracket"
    printf '['
    reset_color

    # Org
    tds_repl_render_org "$org"

    # Separator
    tds_text_color "repl.prompt.separator"
    printf ' x '
    reset_color

    # Environment
    tds_repl_render_env "$env" "$env_idx"

    # Separator
    tds_text_color "repl.prompt.separator"
    printf ' x '
    reset_color

    # Mode
    tds_repl_render_mode "$mode" "$mode_idx"

    # Closing bracket
    tds_text_color "repl.prompt.bracket"
    printf '] '
    reset_color

    # Action
    tds_repl_render_action "$action"

    # Prompt arrow
    tds_text_color "repl.prompt.arrow"
    printf '> '
    reset_color
}

# Render feedback message for environment change
# Args: env_name
tds_repl_feedback_env() {
    local env="$1"

    printf '\n'
    tds_text_color "repl.feedback.arrow"
    printf '→ '
    reset_color
    printf 'Environment: '
    tds_text_color "repl.feedback.env"
    printf '%s' "$env"
    reset_color
}

# Render feedback message for mode change
# Args: mode_name
tds_repl_feedback_mode() {
    local mode="$1"

    printf '\n'
    tds_text_color "repl.feedback.arrow"
    printf '→ '
    reset_color
    printf 'Mode: '
    tds_text_color "repl.feedback.mode"
    printf '%s' "$mode"
    reset_color
}

# Render feedback message for action change
# Args: action_name
tds_repl_feedback_action() {
    local action="$1"

    printf '\n'
    tds_text_color "repl.feedback.arrow"
    printf '→ '
    reset_color
    printf 'Action: '
    tds_text_color "repl.feedback.action"
    printf '%s' "$action"
    reset_color
}

# Render execution mode indicator
# Args: mode (shell|repl)
tds_repl_render_exec_mode() {
    local mode="$1"

    case "$mode" in
        shell|augment)
            tds_text_color "repl.exec.shell"
            echo -n "shell"
            ;;
        repl|takeover)
            tds_text_color "repl.exec.repl"
            echo -n "repl"
            ;;
        *)
            tds_text_color "text.muted"
            echo -n "$mode"
            ;;
    esac
    reset_color
}

# NOTE: Do NOT export these functions - they rely on TDS_COLOR_TOKENS associative array
# which cannot be exported to subshells. Functions work fine in same shell context.
