#!/usr/bin/env bash

# Modal TOML Editor for TView
# Navigation: a/w/s/d (left/up/down/right)
# Actions: Enter (edit), d (drill in), a (drill out)

# Load dependencies
TOML_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$TOML_DIR/cursor_navigation.sh"
source "$TOML_DIR/section_manager.sh"
source "$TOML_DIR/visual_elements.sh"

# Modal editor state
declare -g MODAL_MODE="navigate"  # navigate, edit, drill
declare -g MODAL_DEPTH=0          # current drill depth
declare -ga MODAL_BREADCRUMB=()   # breadcrumb trail
declare -g MODAL_EDITING_VAR=""   # currently editing variable

# Modal navigation with awsd
modal_navigate() {
    local key="$1"

    case "$key" in
        "w"|"W")
            move_cursor_up
            ;;
        "s"|"S")
            move_cursor_down
            ;;
        "a"|"A")
            modal_drill_out
            ;;
        "d"|"D")
            modal_drill_in
            ;;
        "enter"|"return"|"")
            modal_enter_edit_mode
            ;;
        "escape"|"ESC"|"\e")
            modal_exit
            ;;
        *)
            echo "Unknown navigation key: $key"
            echo "Use: w/s (up/down), a/d (out/in), Enter (edit), ESC (quit)"
            return 1
            ;;
    esac
}

# Drill into current section (expand and focus on variables)
modal_drill_in() {
    local current_section
    current_section=$(get_current_selection)

    if [[ -n "$current_section" ]]; then
        # Expand the section
        toggle_section_expansion "$current_section"

        # Add to breadcrumb
        MODAL_BREADCRUMB+=("$current_section")
        ((MODAL_DEPTH++))

        echo "🔍 Drilled into [$current_section] (depth: $MODAL_DEPTH)"

        # Switch to variable navigation mode
        MODAL_MODE="drill"
        modal_refresh_view
        return 0
    else
        echo "❌ No section to drill into"
        return 1
    fi
}

# Drill out to parent level
modal_drill_out() {
    if [[ $MODAL_DEPTH -gt 0 ]]; then
        # Remove from breadcrumb
        local last_section="${MODAL_BREADCRUMB[-1]}"
        unset 'MODAL_BREADCRUMB[-1]'
        ((MODAL_DEPTH--))

        # Collapse the section
        if [[ -n "$last_section" ]]; then
            toggle_section_expansion "$last_section"
        fi

        echo "🔙 Drilled out of [$last_section] (depth: $MODAL_DEPTH)"

        if [[ $MODAL_DEPTH -eq 0 ]]; then
            MODAL_MODE="navigate"
        fi

        modal_refresh_view
        return 0
    else
        echo "🏠 Already at top level"
        return 1
    fi
}

# Enter edit mode for current selection
modal_enter_edit_mode() {
    case "$MODAL_MODE" in
        "navigate")
            # At section level - drill in instead
            modal_drill_in
            ;;
        "drill")
            # At variable level - enter edit mode
            local current_section
            current_section=$(get_current_selection)

            if [[ -n "$current_section" ]]; then
                echo "✏️  Entering edit mode for section [$current_section]"
                MODAL_MODE="edit"
                MODAL_EDITING_VAR="$current_section"
                modal_show_edit_interface
            fi
            ;;
        "edit")
            # Already editing - save and exit edit mode
            modal_save_edit
            ;;
        *)
            echo "Unknown modal mode: $MODAL_MODE"
            ;;
    esac
}

# Show edit interface for current variable/section
modal_show_edit_interface() {
    local section="$MODAL_EDITING_VAR"

    if [[ -z "$section" ]]; then
        echo "❌ No item selected for editing"
        return 1
    fi

    cat << EOF
✏️  TOML Edit Mode: [$section]
═══════════════════════════════

Current Variables:
$(get_section_variables "$section" | while read -r var_line; do
    echo "  📝 $var_line"
done)

📋 Edit Commands:
  edit_var <name> <value>     # Edit existing variable
  add_var <name> <value>      # Add new variable
  delete_var <name>           # Remove variable
  save                        # Save changes
  cancel                      # Cancel editing

💡 Example: edit_var server "192.168.1.100"

Press Enter again to save and exit edit mode.
EOF
}

# Save current edit and exit edit mode
modal_save_edit() {
    echo "💾 Saving changes to [$MODAL_EDITING_VAR]"
    MODAL_MODE="drill"
    MODAL_EDITING_VAR=""
    echo "✅ Edit mode saved - back to drill mode"
    modal_refresh_view
}

# Exit modal editor
modal_exit() {
    echo "👋 Exiting modal TOML editor"
    MODAL_MODE="navigate"
    MODAL_DEPTH=0
    MODAL_BREADCRUMB=()
    MODAL_EDITING_VAR=""
    return 0
}

# Refresh the modal view based on current state
modal_refresh_view() {
    clear_modal_area
    render_modal_header
    render_modal_content
    render_modal_footer
}

# Clear modal display area (implementation depends on TView)
clear_modal_area() {
    # Silent - TView handles all screen management
    return 0
}

# Render modal header with navigation info
render_modal_header() {
    local breadcrumb_str=""
    if [[ ${#MODAL_BREADCRUMB[@]} -gt 0 ]]; then
        breadcrumb_str=" → $(IFS=' → '; echo "${MODAL_BREADCRUMB[*]}")"
    fi

    cat << EOF
🔧 Modal TOML Editor${breadcrumb_str}
════════════════════════════════════════════════
Mode: $MODAL_MODE | Depth: $MODAL_DEPTH | File: $(basename "${ACTIVE_TOML:-none}")

EOF
}

# Render modal content based on current mode and depth
render_modal_content() {
    case "$MODAL_MODE" in
        "navigate")
            render_navigation_view
            ;;
        "drill")
            render_drill_view
            ;;
        "edit")
            modal_show_edit_interface
            ;;
        *)
            echo "Unknown modal mode: $MODAL_MODE"
            ;;
    esac
}

# Render navigation view (section overview)
render_navigation_view() {
    if [[ ! -f "$ACTIVE_TOML" ]]; then
        echo "❌ No TOML file loaded"
        echo "💡 Set ACTIVE_TOML environment variable"
        return 1
    fi

    # Initialize if needed
    if [[ ${#ACTIVE_MULTISPANS[@]} -eq 0 ]]; then
        init_toml_cursor "$ACTIVE_TOML" >/dev/null 2>&1
    fi

    echo "📋 Sections (w/s to navigate, d to drill in):"
    echo ""

    # Render sections with current selection highlighted
    for i in "${!ACTIVE_MULTISPANS[@]}"; do
        local section="${ACTIVE_MULTISPANS[$i]}"
        local is_current="false"

        if [[ $i -eq $CURRENT_ITEM ]]; then
            is_current="true"
        fi

        render_section_visual "$section" "$is_current" "  " "$ACTIVE_TOML"
    done
}

# Render drill view (variables in current section)
render_drill_view() {
    local current_section="${MODAL_BREADCRUMB[-1]}"

    if [[ -z "$current_section" ]]; then
        echo "❌ No section drilled into"
        return 1
    fi

    echo "📝 Variables in [$current_section] (w/s to navigate, Enter to edit):"
    echo ""

    local variables
    variables=$(get_section_variables "$current_section")

    if [[ -n "$variables" ]]; then
        local var_index=0
        while IFS= read -r var_line; do
            local prefix="  "
            if [[ $var_index -eq 0 ]]; then  # Simple selection for now
                prefix="→ "
            fi

            local colored_var
            colored_var=$(colorize_variable "$var_line")
            echo -e "${prefix}${colored_var}"
            ((var_index++))
        done <<< "$variables"
    else
        echo "  ⚪ No variables in this section"
        echo ""
        echo "💡 Press Enter to add variables"
    fi
}

# Render modal footer with help
render_modal_footer() {
    echo ""
    echo "────────────────────────────────────────────────"

    case "$MODAL_MODE" in
        "navigate")
            echo "🎯 Navigation: w/s (up/down) | d (drill in) | Enter (expand) | ESC (quit)"
            ;;
        "drill")
            echo "🔍 Drill Mode: w/s (select var) | a (drill out) | Enter (edit) | ESC (quit)"
            ;;
        "edit")
            echo "✏️  Edit Mode: Enter (save & exit) | ESC (cancel)"
            ;;
        *)
            echo "❓ Unknown mode - press ESC to quit"
            ;;
    esac
}

# Initialize modal TOML editor
init_modal_editor() {
    local toml_file="${1:-$ACTIVE_TOML}"

    if [[ ! -f "$toml_file" ]]; then
        return 1
    fi

    # Initialize navigation silently
    init_toml_cursor "$toml_file" >/dev/null 2>&1

    # Reset modal state
    MODAL_MODE="navigate"
    MODAL_DEPTH=0
    MODAL_BREADCRUMB=()
    MODAL_EDITING_VAR=""

    # No screen output during initialization
    return 0
}

# Handle single keypress in modal mode
modal_handle_key() {
    local key="$1"

    case "$key" in
        "w"|"W") modal_navigate "w" ;;
        "a"|"A") modal_navigate "a" ;;
        "s"|"S") modal_navigate "s" ;;
        "d"|"D") modal_navigate "d" ;;
        ""|"\n") modal_navigate "enter" ;;
        "q"|"Q"|$'\e'|"ESC") modal_navigate "escape" ;;
        *)
            echo "Invalid key: $key"
            echo "Use: w/a/s/d, Enter, ESC"
            ;;
    esac
}

# Interactive modal loop (for testing outside TView)
modal_interactive_loop() {
    echo "🎮 Starting interactive modal editor loop"
    echo "Press keys: w/a/s/d, Enter, q"
    echo ""

    init_modal_editor "$ACTIVE_TOML"

    while true; do
        echo ""
        echo "Press key (w/a/s/d/Enter/ESC): "
        read -n1 -r input
        echo  # Add newline after single char input

        case "$input" in
            $'\e'|"q")  # ESC or q to quit
                modal_exit
                break
                ;;
            "r")
                modal_refresh_view
                ;;
            *)
                modal_handle_key "$input"
                ;;
        esac
    done
}