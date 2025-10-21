#!/usr/bin/env bash
# Org Mode REPL - Interactive organization management

# Source dependencies
ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

source "$ORG_SRC/org_completion.sh"
source "$ORG_SRC/org_help.sh"
source "$ORG_SRC/tetra_org.sh"
source "$TETRA_SRC/bash/nh/nh_bridge.sh" 2>/dev/null || true

# REPL state
declare -g ORG_REPL_RUNNING=false
declare -g ORG_REPL_HISTORY_FILE="${TETRA_DIR:-$HOME/tetra}/.org_history"

# Initialize REPL
org_repl_init() {
    ORG_REPL_RUNNING=true

    # Initialize completion tree
    org_completion_init_tree 2>/dev/null || true

    # Initialize help
    org_help_init 2>/dev/null || true

    # Setup readline (conditionally - don't break if it fails)
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-ignore-case on' 2>/dev/null || true

    # Load history
    [[ -f "$ORG_REPL_HISTORY_FILE" ]] && history -r "$ORG_REPL_HISTORY_FILE" 2>/dev/null || true
}

# Get prompt
org_repl_prompt() {
    local active_org=$(org_active 2>/dev/null || echo "none")
    local color_org color_prompt color_reset

    # Colors
    color_org="\[\033[1;36m\]"      # Cyan bold
    color_prompt="\[\033[1;32m\]"   # Green bold
    color_reset="\[\033[0m\]"

    if [[ "$active_org" == "none" ]]; then
        echo -e "${color_prompt}org>${color_reset} "
    else
        echo -e "${color_org}[$active_org]${color_prompt} org>${color_reset} "
    fi
}

# Execute command
org_repl_exec() {
    local line="$1"

    # Skip empty lines
    [[ -z "$line" ]] && return 0

    # Add to history
    history -s "$line"

    # Parse command
    local cmd="${line%% *}"
    local args="${line#* }"
    [[ "$cmd" == "$args" ]] && args=""

    case "$cmd" in
        help|h|\?)
            org_help $args
            ;;
        list|ls)
            org_list $args
            ;;
        active)
            org_active
            ;;
        switch|sw)
            org_switch $args
            ;;
        create)
            org_create $args
            ;;
        import)
            org_import $args
            ;;
        discover)
            org_discover $args
            ;;
        validate)
            org_validate $args
            ;;
        compile)
            tetra_compile_toml $args
            ;;
        refresh)
            tetra_org_refresh $args
            ;;
        secrets)
            # Parse secrets subcommand
            local subcmd="${args%% *}"
            local subargs="${args#* }"
            [[ "$subcmd" == "$subargs" ]] && subargs=""

            case "$subcmd" in
                init)
                    tetra_secrets_init $subargs
                    ;;
                validate)
                    tetra_secrets_validate $subargs
                    ;;
                load)
                    tetra_secrets_load $subargs
                    ;;
                list)
                    tetra_secrets_list $subargs
                    ;;
                copy)
                    tetra_secrets_copy $subargs
                    ;;
                *)
                    echo "Secrets commands: init, validate, load, list, copy"
                    ;;
            esac
            ;;
        push)
            org_push $args
            ;;
        pull)
            org_pull $args
            ;;
        rollback)
            org_rollback $args
            ;;
        history|hist)
            org_history $args
            ;;
        nh)
            # NodeHolder bridge commands
            local subcmd="${args%% *}"
            local subargs="${args#* }"
            [[ "$subcmd" == "$subargs" ]] && subargs=""

            case "$subcmd" in
                status)
                    nh_status
                    ;;
                fetch)
                    nh_fetch_latest $subargs
                    ;;
                workflow)
                    nh_show_workflow
                    ;;
                *)
                    echo "NH commands: status, fetch, workflow"
                    ;;
            esac
            ;;
        exit|quit|q)
            org_repl_cleanup
            return 1
            ;;
        "")
            # Empty command
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Type 'help' or press TAB for completion"
            ;;
    esac

    return 0
}

# Cleanup and exit
org_repl_cleanup() {
    # Save history
    mkdir -p "$(dirname "$ORG_REPL_HISTORY_FILE")" 2>/dev/null || true
    history -w "$ORG_REPL_HISTORY_FILE" 2>/dev/null || true

    ORG_REPL_RUNNING=false
    echo ""
    echo "Goodbye!"

    # Don't exit the shell, just return
    return 0
}

# Main REPL loop
org_repl() {
    org_repl_init

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  TETRA ORGANIZATION MANAGEMENT"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Type 'help' for commands, TAB for completion, 'exit' to quit"

    # Show NodeHolder status if available
    if nh_check_available 2>/dev/null; then
        echo ""
        echo "✓ NodeHolder bridge available (type 'nh status')"
    fi

    echo ""

    # Show current org
    local active_org=$(org_active 2>/dev/null || echo "none")
    if [[ "$active_org" != "none" ]]; then
        echo "Active organization: $active_org"
        echo ""
    fi

    # REPL loop
    while $ORG_REPL_RUNNING; do
        local prompt=$(org_repl_prompt)

        # Read with completion (handle Ctrl-C and Ctrl-D)
        if ! read -e -p "$prompt" line 2>/dev/null; then
            # EOF (Ctrl-D) pressed
            echo ""
            break
        fi

        # Execute command
        if ! org_repl_exec "$line"; then
            break
        fi
    done

    org_repl_cleanup

    # Return success - don't exit the shell
    return 0
}

# Quick command mode (non-interactive)
org_cmd() {
    org_repl_init
    org_repl_exec "$*"
}

# Export functions
export -f org_repl
export -f org_repl_init
export -f org_repl_exec
export -f org_repl_cleanup
export -f org_repl_prompt
export -f org_cmd
