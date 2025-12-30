#!/usr/bin/env bash

# TDS REPL Token System
# Design tokens for REPL UI elements (prompts, navigation, feedback)

# REPL-specific color tokens map semantic REPL elements to palette references
declare -gA TDS_REPL_TOKENS=(
    # Environment cycle tokens (4 states: Local, Dev, Staging, Production)
    # Uses PRIMARY palette with progression
    [repl.env.local]="primary:0"       # PRIMARY[0] - red
    [repl.env.dev]="primary:1"         # PRIMARY[1] - orange
    [repl.env.staging]="primary:2"     # PRIMARY[2] - yellow
    [repl.env.production]="primary:3"  # PRIMARY[3] - green

    # Mode cycle tokens (3 states: Inspect, Transfer, Execute)
    # Uses SECONDARY palette with progression
    [repl.mode.inspect]="secondary:0"  # SECONDARY[0]
    [repl.mode.transfer]="secondary:1" # SECONDARY[1]
    [repl.mode.execute]="secondary:2"  # SECONDARY[2]

    # REPL action/command tokens
    # Uses SEMANTIC palette for actions
    [repl.action.primary]="semantic:1"    # SEMANTIC[1] - warning/orange
    [repl.action.secondary]="semantic:0"  # SEMANTIC[0] - error/red
    [repl.action.none]="text.muted"       # Muted when no action selected

    # REPL prompt structure tokens
    [repl.prompt]="secondary:0"        # SECONDARY[0] - main prompt color
    [repl.prompt.bracket]="surface:5"  # SURFACE[5] - muted brackets
    [repl.prompt.separator]="text.tertiary"  # Subtle separators (x)
    [repl.prompt.arrow]="semantic:1"   # Orange arrow >

    # REPL context tokens
    [repl.org.active]="text.primary"   # Current organization name
    [repl.org.inactive]="text.muted"   # Inactive/no org

    # Execution mode indicators (shell vs REPL mode)
    [repl.exec.shell]="status.info"    # Blue - shell/augment mode
    [repl.exec.repl]="status.success"  # Green - REPL/takeover mode

    # Feedback message tokens (shown when cycling with ctrl-e, ctrl-x,m, etc)
    [repl.feedback.env]="primary:1"    # Orange - env change feedback
    [repl.feedback.mode]="secondary:0" # Secondary - mode change feedback
    [repl.feedback.action]="semantic:1" # Orange - action change feedback
    [repl.feedback.arrow]="text.secondary"  # Arrow indicator →

    # REPL help/info tokens
    [repl.help.header]="content.heading.h2"
    [repl.help.command]="content.code.inline"
    [repl.help.description]="text.secondary"
)

# Merge REPL tokens into main TDS token map
# This allows tds_text_color() and tds_resolve_color() to work with REPL tokens
for key in "${!TDS_REPL_TOKENS[@]}"; do
    TDS_COLOR_TOKENS["$key"]="${TDS_REPL_TOKENS["$key"]}"
done

# Show REPL-specific tokens with their resolved colors
tds_show_repl_tokens() {
    echo "TDS REPL Token System"
    echo "====================="
    echo

    echo "Environment Tokens (cycle with Ctrl+E):"
    for key in repl.env.local repl.env.dev repl.env.staging repl.env.production; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Mode Tokens (cycle with Ctrl+X,M):"
    for key in repl.mode.inspect repl.mode.transfer repl.mode.execute; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Action Tokens:"
    for key in repl.action.primary repl.action.secondary repl.action.none; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Prompt Structure Tokens:"
    for key in repl.prompt.bracket repl.prompt.separator repl.prompt.arrow; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Feedback Tokens:"
    for key in repl.feedback.env repl.feedback.mode repl.feedback.action repl.feedback.arrow; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo
}
