#!/usr/bin/env bash

# TView Action Modal System - Clean modal interface for actions
# Single responsibility: Handle action modal display and interaction

# Source dependencies
source "$(dirname "${BASH_SOURCE[0]}")/tview_actions_content.sh"

# Launch direct TOML editor that takes over completely
open_action_modal() {
    # Launch TOML editor for ALL TOML environments
    if [[ "$CURRENT_MODE" == "TOML" ]]; then
        # Set the correct TOML file for the current environment
        set_active_toml_for_env "$CURRENT_ENV"
        start_toml_editor_takeover
    else
        # For non-TOML modes, show simple info and return
        echo "Action info for: $CURRENT_MODE $CURRENT_ENV"
        echo "Press any key to continue..."
        read -n1 -s
    fi
}

# TOML editor that completely takes over the terminal
start_toml_editor_takeover() {
    # Load TOML sections
    local -a toml_sections=()
    if [[ -f "$ACTIVE_TOML" ]]; then
        while IFS= read -r line; do
            if [[ $line =~ ^\[([^]]+)\] ]]; then
                toml_sections+=("${BASH_REMATCH[1]}")
            fi
        done < "$ACTIVE_TOML"
    else
        toml_sections=("No TOML file found")
    fi

    local current_index=0
    local total=${#toml_sections[@]}

    # Main TOML editor loop
    while true; do
        # Clear screen and show editor
        clear
        echo "🔧 TOML Editor - $(basename "$ACTIVE_TOML")"
        echo "═══════════════════════════════════════════════════"
        echo ""
        echo "Navigate sections: i (up) k (down) | l (expand) | v (view) | j (out) | q (exit)"
        echo ""

        # Show all sections with current one highlighted
        for i in "${!toml_sections[@]}"; do
            if [[ $i -eq $current_index ]]; then
                echo "→ [${toml_sections[$i]}]"  # Highlighted
            else
                echo "  [${toml_sections[$i]}]"  # Normal
            fi
        done

        echo ""
        echo "Controls: i=up, k=down, l=expand, v=view, j=OUT, q=EXIT to TView"
        echo ""

        # Read single key input
        read -n1 -s key

        case "$key" in
            'q'|'Q')
                # Q exits to TView main
                break
                ;;
            $'\e'|$'\033')
                # ESC key - exit immediately
                break
                ;;
            'j'|'J')
                # j = OUT (undo dive, stay in TOML editor)
                break
                ;;
            'i'|'I')
                # i = Move up
                if [[ $current_index -gt 0 ]]; then
                    ((current_index--))
                fi
                ;;
            'k'|'K')
                # k = Move down
                if [[ $current_index -lt $((total - 1)) ]]; then
                    ((current_index++))
                fi
                ;;
            'l'|'L'|$'\n'|$'\r')
                # l = Expand section (drill in)
                show_toml_section_content "${toml_sections[$current_index]}"
                ;;
            'v'|'V')
                # v = View TOML file with glow
                view_toml_with_glow "$ACTIVE_TOML"
                ;;
            *)
                # Ignore other keys
                ;;
        esac
    done

    # Force immediate screen refresh when returning to main TView
    clear
    if command -v redraw_screen >/dev/null 2>&1; then
        redraw_screen
    fi
}

# Show content of a TOML section
show_toml_section_content() {
    local section_name="$1"

    clear
    echo "📄 Section: [$section_name]"
    echo "═══════════════════════════════════════════"
    echo ""

    local in_section=false
    local content_shown=false

    while IFS= read -r line; do
        # Check if we've entered our target section
        if [[ $line =~ ^\[([^\]]+)\] ]]; then
            if [[ "${BASH_REMATCH[1]}" == "$section_name" ]]; then
                in_section=true
                continue
            else
                # Entered a different section, stop
                if [[ $in_section == true ]]; then
                    break
                fi
            fi
        fi

        # Show content if we're in the target section
        if [[ $in_section == true ]]; then
            if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
                echo "  $line"
                content_shown=true
            fi
        fi
    done < "$ACTIVE_TOML"

    if [[ $content_shown == false ]]; then
        echo "  (empty section)"
    fi

    echo ""
    echo "Press any key to return..."
    read -n1
}

# View TOML file with glow
view_toml_with_glow() {
    local toml_file="$1"

    if [[ ! -f "$toml_file" ]]; then
        echo "TOML file not found: $toml_file"
        return 1
    fi

    # Check if glow is available
    if ! command -v glow >/dev/null 2>&1; then
        # Fallback to basic viewing
        clear
        echo "📄 TOML File: $(basename "$toml_file")"
        echo "═══════════════════════════════════════════"
        echo ""
        cat "$toml_file"
        echo ""
        echo "Press any key to return..."
        read -n1
        return 0
    fi

    # Create a temporary markdown file for glow
    local temp_md=$(mktemp --suffix=.md)
    {
        echo "# TOML Configuration: $(basename "$toml_file")"
        echo ""
        echo '```toml'
        cat "$toml_file"
        echo '```'
    } > "$temp_md"

    # View with glow in pager mode
    glow "$temp_md" --pager

    # Cleanup
    rm -f "$temp_md"
}

# Set the correct TOML file based on environment
set_active_toml_for_env() {
    local env="$1"

    case "$env" in
        "TETRA")
            # Main tetra.toml file
            if [[ -f "$TETRA_DIR/config/tetra.toml" ]]; then
                export ACTIVE_TOML="$TETRA_DIR/config/tetra.toml"
            elif [[ -f "tetra.toml" ]]; then
                export ACTIVE_TOML="tetra.toml"
            fi
            ;;
        "LOCAL")
            # Look for local environment files
            if [[ -f "$TETRA_DIR/env/local.env" ]]; then
                # Convert env to toml for viewing (create temp file if needed)
                local temp_toml="/tmp/local_env.toml"
                echo "# Local Environment Configuration" > "$temp_toml"
                echo "" >> "$temp_toml"
                echo "[environment]" >> "$temp_toml"
                while IFS='=' read -r key value; do
                    [[ "$key" =~ ^[[:space:]]*# ]] && continue
                    [[ -z "$key" ]] && continue
                    echo "$key = \"$value\"" >> "$temp_toml"
                done < "$TETRA_DIR/env/local.env"
                export ACTIVE_TOML="$temp_toml"
            elif [[ -f "local.toml" ]]; then
                export ACTIVE_TOML="local.toml"
            fi
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            # Look for environment-specific files
            local env_lower="${env,,}"
            if [[ -f "${env_lower}.toml" ]]; then
                export ACTIVE_TOML="${env_lower}.toml"
            elif [[ -f "$TETRA_DIR/config/${env_lower}.toml" ]]; then
                export ACTIVE_TOML="$TETRA_DIR/config/${env_lower}.toml"
            elif [[ -f "$TETRA_DIR/env/${env_lower}.env" ]]; then
                # Convert env to toml for viewing
                local temp_toml="/tmp/${env_lower}_env.toml"
                echo "# $env Environment Configuration" > "$temp_toml"
                echo "" >> "$temp_toml"
                echo "[environment]" >> "$temp_toml"
                while IFS='=' read -r key value; do
                    [[ "$key" =~ ^[[:space:]]*# ]] && continue
                    [[ -z "$key" ]] && continue
                    echo "$key = \"$value\"" >> "$temp_toml"
                done < "$TETRA_DIR/env/${env_lower}.env"
                export ACTIVE_TOML="$temp_toml"
            fi
            ;;
    esac

}