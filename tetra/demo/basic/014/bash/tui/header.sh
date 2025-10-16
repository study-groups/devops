#!/usr/bin/env bash

# Header - Robust header rendering with min/med/max states
# Can grow and shrink, taking over Info output space as needed

# Header state
declare -g HEADER_SIZE="max"  # min, med, max
declare -g HEADER_REPL_ACTIVE=false
declare -g HEADER_REPL_INPUT=""
declare -g HEADER_REPL_PROMPT="> "

# Header size definitions (number of lines, excluding separator)
declare -g HEADER_MIN_LINES=1    # Just title
declare -g HEADER_MED_LINES=4    # Title + Env + Mode + Action
declare -g HEADER_MAX_LINES=7    # Title + Env + Mode + Action + Status + Info (1-2 lines)

# Set header size
header_set_size() {
    local size="${1:-max}"
    case "$size" in
        min|med|max) HEADER_SIZE="$size" ;;
        *) HEADER_SIZE="max" ;;
    esac
}

# Get current header line count
header_get_lines() {
    case "$HEADER_SIZE" in
        min) echo "$HEADER_MIN_LINES" ;;
        med) echo "$HEADER_MED_LINES" ;;
        max) echo "$HEADER_MAX_LINES" ;;
    esac
}

# Toggle REPL active state
header_repl_toggle() {
    if [[ "$HEADER_REPL_ACTIVE" == "true" ]]; then
        HEADER_REPL_ACTIVE=false
        HEADER_REPL_INPUT=""
    else
        HEADER_REPL_ACTIVE=true
    fi
}

# Set REPL input
header_repl_set_input() {
    HEADER_REPL_INPUT="$1"
}

# Render REPL line (appears above separator)
header_render_repl() {
    if [[ "$HEADER_REPL_ACTIVE" == "true" ]]; then
        printf "\033[36mREPL:\033[0m\t\t%s%s" "$HEADER_REPL_PROMPT" "$HEADER_REPL_INPUT"
        # Show cursor
        printf "\033[?25h"
    else
        printf "\033[?25l"  # Hide cursor
    fi
    echo
}

# Render title line
header_render_title() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    printf "Demo 014: Action Signatures | [\033[1;33m%s\033[0m %s \033[1;32m%s\033[0m]\n" "$env" "$CROSS_OP" "$mode"
}

# Render environment line
header_render_env() {
    printf "\033[36mEnvironment:\033[0m\t"
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            printf "\033[1;33m%s%s%s\033[0m " "$TUI_BRACKET_LEFT" "${ENVIRONMENTS[$i]}" "$TUI_BRACKET_RIGHT"
        else
            echo -n "${ENVIRONMENTS[$i]} "
        fi
    done
    echo
}

# Render mode line
header_render_mode() {
    printf "\033[35mMode:\033[0m\t\t"
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            printf "\033[1;32m%s%s%s\033[0m " "$TUI_BRACKET_LEFT" "${MODES[$i]}" "$TUI_BRACKET_RIGHT"
        else
            echo -n "${MODES[$i]} "
        fi
    done
    echo
}

# Render action line
header_render_action() {
    local actions=($(get_actions))
    printf "\033[36mAction:\033[0m\t\t"
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local verb="${current%%:*}"
        local noun="${current##*:}"

        # Refresh colors
        refresh_color_state_cached "$verb" "$noun"

        # Display as verb:noun with counter
        render_action_verb_noun "$verb" "$noun"
        printf "  (%d/%d)" $(($ACTION_INDEX + 1)) ${#actions[@]}

        # Show detail indicator
        if [[ "$SHOW_DETAIL" == "true" ]]; then
            echo -n " [detail]"
        fi
        echo
    else
        echo "[none]"
    fi
}

# Render status line
header_render_status() {
    local actions=($(get_actions))
    printf "\033[36mStatus:\033[0m\t\t"
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local state=$(get_action_state "$current")
        local state_symbol=$(get_state_symbol "$state")

        if [[ "$SHOW_DETAIL" == "true" ]]; then
            # Show action signature detail
            local action_name="${current//:/_}"
            if declare -p "ACTION_${action_name}" &>/dev/null; then
                local -n _action="ACTION_${action_name}"
                printf "%s %s - " "$state_symbol" "$state"
                printf "(%s) → %s" "${_action[inputs]:-}" "${_action[output]}"
                [[ -n "${_action[effects]}" ]] && printf " [where %s]" "${_action[effects]}"
                echo
            else
                echo "$state_symbol $state"
            fi
        else
            # Show state, and if idle, show content title
            if [[ "$state" == "idle" && -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
                # Extract first line as title
                local content_title=$(echo -e "${TUI_BUFFERS["@tui[content]"]}" | head -n1)
                printf "%s %s - %s\n" "$state_symbol" "$state" "$content_title"
            else
                echo "$state_symbol $state"
            fi
        fi
    else
        echo "○ idle"
    fi
}

# Render info line(s)
header_render_info() {
    local actions=($(get_actions))
    local env="${ENVIRONMENTS[$ENV_INDEX]}"

    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local action_name="${current//:/_}"
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _action="ACTION_${action_name}"
            printf "\033[36mInfo:\033[0m\t\t"

            # Resolve @{context} to actual env
            local context="@${env,,}"
            local resolved_source="${_action[source_at]//@\{context\}/$context}"
            local resolved_target="${_action[target_at]//@\{context\}/$context}"

            # Show full TES objects with resolved paths
            printf "exec_at=%s" "${_action[exec_at]:-@local}"
            [[ -n "$resolved_source" ]] && printf " source_at=%s" "$resolved_source"
            [[ -n "$resolved_target" ]] && printf " target_at=%s" "$resolved_target"
            [[ -n "${_action[tes_operation]}" ]] && printf " op=%s" "${_action[tes_operation]}"
            echo

            # Second info line if inputs/outputs present with resolved paths
            if [[ -n "${_action[inputs]}" || -n "${_action[effects]}" ]]; then
                printf "\t\t\t"
                if [[ -n "${_action[inputs]}" ]]; then
                    local resolved_input="${_action[inputs]//@\{context\}/$context}"
                    # Expand TETRA_ORG in paths
                    resolved_input="${resolved_input//\$TETRA_ORG/$TETRA_ORG}"
                    resolved_input="${resolved_input//\$\{TETRA_ORG\}/$TETRA_ORG}"
                    printf "in=%s " "$resolved_input"
                fi
                if [[ -n "${_action[effects]}" ]]; then
                    local resolved_effect="${_action[effects]//@\{context\}/$context}"
                    resolved_effect="${resolved_effect//\$TETRA_ORG/$TETRA_ORG}"
                    resolved_effect="${resolved_effect//\$\{TETRA_ORG\}/$TETRA_ORG}"
                    printf "out=%s" "$resolved_effect"
                fi
                echo
            fi
        fi
    fi
}

# Render complete header based on size
header_render() {
    case "$HEADER_SIZE" in
        min)
            header_render_title
            ;;
        med)
            header_render_title
            header_render_env
            header_render_mode
            header_render_action
            ;;
        max)
            header_render_title
            header_render_env
            header_render_mode
            header_render_action
            header_render_status
            header_render_info
            ;;
    esac

    # REPL line (if active, appears above separator)
    if [[ "$HEADER_REPL_ACTIVE" == "true" ]]; then
        header_render_repl
    fi
}
