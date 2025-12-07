#!/usr/bin/env bash

# TDS Unicode Explorer Token System
# Design tokens for Unicode Explorer UI elements

# Unicode Explorer-specific color tokens map semantic elements to palette references
declare -gA TDS_UNICODE_TOKENS=(
    # Slot display colors
    [uex.slot.primary]="mode:0"           # MODE_PRIMARY[0] - primary slots (1,2)
    [uex.slot.secondary]="mode:1"         # MODE_PRIMARY[1] - secondary slots (3,4)
    [uex.slot.locked]="verbs:2"           # VERBS_PRIMARY[2] - locked indicator (orange)
    [uex.slot.character]="text.primary"   # Character display

    # Delimiters (mode-dependent)
    [uex.delimiter.explore]="text.primary"     # :: default exploration mode
    [uex.delimiter.qa]="status.info"           # Q: question/answer mode (blue)
    [uex.delimiter.shell]="status.success"     # > shell prompt mode (green)

    # Metadata display
    [uex.metadata.unicode]="nouns:0"          # NOUNS_PRIMARY[0] - Unicode code (purple)
    [uex.metadata.category]="text.secondary"   # Category name
    [uex.metadata.position]="text.tertiary"    # Position indicator [n/total]
    [uex.metadata.char]="mode:2"              # Large character display

    # Controls and navigation
    [uex.controls.key]="content.code.inline"      # Key hints (1,2,3,4 etc)
    [uex.controls.separator]="text.muted"         # | separators
    [uex.controls.description]="text.secondary"    # Description text
    [uex.controls.arrow]="env:3"                  # Arrow indicators (↑↓←→)

    # State information
    [uex.state.label]="text.muted"       # state:, map: labels
    [uex.state.value]="mode:0"           # State values
    [uex.state.mapping]="nouns:1"        # Mapping string

    # Navigation feedback
    [uex.feedback.bank]="env:0"          # ENV_PRIMARY[0] - bank change (green)
    [uex.feedback.char]="mode:0"         # MODE_PRIMARY[0] - char change (blue)
    [uex.feedback.lock]="verbs:2"        # Lock toggle feedback (orange)
    [uex.feedback.mode]="nouns:0"        # Mode change feedback (purple)

    # Border and separator
    [uex.separator.line]="text.muted"    # Horizontal separator line
    [uex.separator.char]="text.muted"    # Separator character (─)

    # Bank indicators
    [uex.bank.name]="env:1"              # Bank name display
    [uex.bank.index]="text.tertiary"     # Bank index number

    # Help overlay
    [uex.help.header]="content.heading.h2"        # Help header
    [uex.help.key]="content.code.inline"          # Key in help
    [uex.help.description]="text.primary"         # Help text
    [uex.help.border]="border"                    # Help box border

    # Mode indicators
    [uex.mode.explore]="mode:0"          # Explore mode color
    [uex.mode.qa]="status.info"          # Q&A mode color
    [uex.mode.shell]="status.success"    # Shell mode color
)

# Merge Unicode Explorer tokens into main TDS token map
# This allows tds_text_color() and tds_resolve_color() to work with these tokens
# Guard: only merge if TDS_COLOR_TOKENS is declared as associative array
if declare -p TDS_COLOR_TOKENS &>/dev/null; then
    for key in "${!TDS_UNICODE_TOKENS[@]}"; do
        TDS_COLOR_TOKENS["$key"]="${TDS_UNICODE_TOKENS["$key"]}"
    done
fi

# Helper function to apply unicode explorer token colors
uex_color() {
    local token="$1"
    local text="$2"
    tds_text_color "uex.$token"
    printf "%s" "$text"
    reset_color
}

# Show Unicode Explorer tokens with their resolved colors (for debugging)
tds_show_unicode_tokens() {
    echo "TDS Unicode Explorer Token System"
    echo "=================================="
    echo

    local -a sections=(
        "Slot:uex.slot.primary uex.slot.secondary uex.slot.locked uex.slot.character"
        "Delimiter:uex.delimiter.explore uex.delimiter.qa uex.delimiter.shell"
        "Metadata:uex.metadata.unicode uex.metadata.category uex.metadata.position uex.metadata.char"
        "Controls:uex.controls.key uex.controls.separator uex.controls.description uex.controls.arrow"
        "State:uex.state.label uex.state.value uex.state.mapping"
        "Mode:uex.mode.explore uex.mode.qa uex.mode.shell"
    )

    for section in "${sections[@]}"; do
        local label="${section%%:*}"
        local keys="${section#*:}"
        echo "$label Tokens:"
        for key in $keys; do
            local mapping="${TDS_COLOR_TOKENS[$key]:-<not set>}"
            local resolved
            resolved=$(tds_resolve_color "$key" 2>/dev/null) || resolved="N/A"
            # Print swatch with color, then info
            tds_text_color "$key" 2>/dev/null
            printf "  ■"
            reset_color 2>/dev/null
            printf " %-32s %s → %s\n" "$key" "$mapping" "$resolved"
        done
        echo
    done
}

# Export functions
export -f uex_color
export -f tds_show_unicode_tokens
