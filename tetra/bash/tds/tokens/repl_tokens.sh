#!/usr/bin/env bash

# TDS REPL Token System
# Design tokens for REPL UI elements (prompts, navigation, feedback)

# REPL-specific color tokens map semantic REPL elements to palette references
declare -gA TDS_REPL_TOKENS=(
    # Environment cycle tokens (4 states: Local, Dev, Staging, Production)
    # Uses green palette (ENV_PRIMARY) with progression from bright to cautious
    [repl.env.local]="env:0"           # ENV_PRIMARY[0] - bright green (00AA00)
    [repl.env.dev]="env:1"             # ENV_PRIMARY[1] - light green (22DD22)
    [repl.env.staging]="env:2"         # ENV_PRIMARY[2] - yellow-green (44AA44)
    [repl.env.production]="env:3"      # ENV_PRIMARY[3] - caution green (66FF66)

    # Mode cycle tokens (3 states: Inspect, Transfer, Execute)
    # Uses blue palette (MODE_PRIMARY) with progression from light to dark
    [repl.mode.inspect]="mode:0"       # MODE_PRIMARY[0] - bright blue (0088FF)
    [repl.mode.transfer]="mode:1"      # MODE_PRIMARY[1] - medium blue (0044AA)
    [repl.mode.execute]="mode:2"       # MODE_PRIMARY[2] - dark blue (4400AA)

    # REPL action/command tokens
    # Uses orange/red palette (VERBS_PRIMARY) for actions
    [repl.action.primary]="verbs:3"    # VERBS_PRIMARY[3] - orange (FFAA00)
    [repl.action.secondary]="verbs:1"  # VERBS_PRIMARY[1] - light orange (FF6644)
    [repl.action.none]="text.muted"    # Muted when no action selected

    # REPL prompt structure tokens
    [repl.prompt]="mode:0"             # MODE_PRIMARY[0] - main prompt color (changes with temperature)
    [repl.prompt.bracket]="mode:6"     # MODE_PRIMARY[6] - muted blue brackets
    [repl.prompt.separator]="text.tertiary"  # Subtle separators (x)
    [repl.prompt.arrow]="verbs:3"      # Orange arrow >

    # REPL context tokens
    [repl.org.active]="text.primary"   # Current organization name
    [repl.org.inactive]="text.muted"   # Inactive/no org

    # Execution mode indicators (shell vs REPL mode)
    [repl.exec.shell]="status.info"    # Blue - shell/augment mode
    [repl.exec.repl]="status.success"  # Green - REPL/takeover mode

    # Feedback message tokens (shown when cycling with ctrl-e, ctrl-x,m, etc)
    [repl.feedback.env]="env:1"        # Bright green - env change feedback
    [repl.feedback.mode]="mode:0"      # Bright blue - mode change feedback
    [repl.feedback.action]="verbs:3"   # Orange - action change feedback
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
