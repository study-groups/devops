#!/usr/bin/env bash

# Pulsar REPL Help System
# Narrow and deep help tree using bash/color system

# Source color system (should already be loaded via repl.sh)
COLOR_SRC="${COLOR_SRC:-$TETRA_SRC/bash/color}"
if [[ ! -f "$COLOR_SRC/color_core.sh" ]]; then
    echo "Warning: color_core.sh not found" >&2
fi

# Help color palette (simple variables, export-safe)
# Aligned with game theme: cyan/blue/orange spectrum
HELP_TITLE="66FFFF"          # Bright cyan - main titles
HELP_SECTION="8888FF"        # Purple/blue - major sections
HELP_SUBSECTION="0088FF"     # Bright blue - subsections
HELP_COMMAND="FFAA00"        # Orange - commands (high visibility)
HELP_TEXT="FFFFFF"           # White - primary text
HELP_DIM="AAAAAA"            # Light gray - secondary info
HELP_MUTED="666666"          # Dark gray - tertiary/hints
HELP_PROMPT="00AA00"         # Green - interactive prompts

# Help tree state
declare -g PULSAR_HELP_CONTEXT="main"  # Current help context
declare -g PULSAR_HELP_BREADCRUMB=()   # Navigation breadcrumb

# Color helpers using bash/color system
_help_title() {
    text_color "$HELP_TITLE"
    printf "%s" "$1"
    reset_color
}

_help_section() {
    text_color "$HELP_SECTION"
    printf "%s" "$1"
    reset_color
}

_help_subsection() {
    text_color "$HELP_SUBSECTION"
    printf "%s" "$1"
    reset_color
}

_help_command() {
    text_color "$HELP_COMMAND"
    printf "%s" "$1"
    reset_color
}

_help_text() {
    text_color "$HELP_TEXT"
    printf "%s" "$1"
    reset_color
}

_help_dim() {
    # Use theme-aware dimming if available, otherwise direct color
    if declare -f theme_aware_dim &>/dev/null; then
        local dimmed=$(theme_aware_dim "$HELP_DIM" 2)
        text_color "$dimmed"
    else
        text_color "$HELP_DIM"
    fi
    printf "%s" "$1"
    reset_color
}

_help_muted() {
    # Use theme-aware dimming if available, otherwise direct color
    if declare -f theme_aware_dim &>/dev/null; then
        local dimmed=$(theme_aware_dim "$HELP_MUTED" 3)
        text_color "$dimmed"
    else
        text_color "$HELP_MUTED"
    fi
    printf "%s" "$1"
    reset_color
}

_help_prompt() {
    text_color "$HELP_PROMPT"
    printf "▶ "
    reset_color
}

# ============================================================================
# HELP TREE NAVIGATION
# ============================================================================

pulsar_help_main() {
    echo ""
    _help_title "⚡ PULSAR REPL"
    echo " - Interactive Engine Protocol Shell"
    echo ""

    echo "Quick actions:"
    echo "  $(_help_command "start")        $(_help_dim "Start the engine and begin")"
    echo "  $(_help_command "hello")        $(_help_dim "Spawn a demo pulsar")"
    echo "  $(_help_command "trinity")      $(_help_dim "Spawn three pulsars in formation")"
    echo ""

    _help_section "Help Topics:"
    echo ""
    echo "  $(_help_command "help engine")      $(_help_text "Engine control and status")"
    echo "  $(_help_command "help sprite")      $(_help_text "Creating and managing sprites")"
    echo "  $(_help_command "help preset")      $(_help_text "Quick preset demos")"
    echo "  $(_help_command "help script")      $(_help_text "Loading and running scripts")"
    echo "  $(_help_command "help protocol")    $(_help_text "Raw Engine Protocol commands")"
    echo "  $(_help_command "help params")      $(_help_text "Parameter reference guide")"
    echo ""

    _help_muted "Navigation: Type 'help <topic>' to explore | 'help' to return here"
    echo ""
}

pulsar_help_engine() {
    echo ""
    _help_section "ENGINE CONTROL"
    echo ""

    _help_subsection "Basic Commands:"
    echo ""
    echo "  $(_help_command "start")           Start the Pulsar engine"
    echo "                    $(_help_dim "Initializes ${PULSAR_REPL_GRID_W:-160}×${PULSAR_REPL_GRID_H:-96} grid")"
    echo ""
    echo "  $(_help_command "stop")            Stop the engine"
    echo "                    $(_help_dim "Cleanly shuts down and clears sprites")"
    echo ""
    echo "  $(_help_command "restart")         Restart the engine"
    echo "                    $(_help_dim "Equivalent to stop + start")"
    echo ""
    echo "  $(_help_command "status")          Show engine status"
    echo "                    $(_help_dim "Displays PID, grid size, sprite count")"
    echo ""

    _help_subsection "Engine States:"
    echo ""
    echo "  💤 $(_help_text "Stopped")     $(_help_dim "Use 'start' to launch")"
    echo "  ⚡ $(_help_text "Running")     $(_help_dim "Ready for commands")"
    echo ""

    _help_muted "→ See also: 'help sprite' for sprite management"
    echo ""
}

pulsar_help_sprite() {
    echo ""
    _help_section "SPRITE MANAGEMENT"
    echo ""

    _help_subsection "High-Level Commands:"
    echo ""
    echo "  $(_help_command "spawn <name> <params...>")"
    echo "      Create a named pulsar sprite"
    echo "      $(_help_dim "Example: spawn star1 80 48 18 6 0.5 0.6 0")"
    echo ""
    echo "  $(_help_command "set <name> <key> <value>")"
    echo "      Update sprite property by name"
    echo "      $(_help_dim "Example: set star1 dtheta 1.2")"
    echo ""
    echo "  $(_help_command "kill <name>")"
    echo "      Remove sprite by name"
    echo "      $(_help_dim "Example: kill star1")"
    echo ""
    echo "  $(_help_command "list")"
    echo "      Show all named sprites"
    echo ""

    _help_subsection "Sprite Properties (for SET):"
    echo ""
    echo "  $(_help_text "Position:")    $(_help_command "mx my")         $(_help_dim "Center position (microgrid)")"
    echo "  $(_help_text "Shape:")       $(_help_command "len0 amp")      $(_help_dim "Arm length and pulse amplitude")"
    echo "  $(_help_text "Motion:")      $(_help_command "freq dtheta")   $(_help_dim "Pulse rate and rotation speed")"
    echo "  $(_help_text "Appearance:")  $(_help_command "valence")       $(_help_dim "Color (0-5, see 'help params')")"
    echo ""

    _help_muted "→ See also: 'help params' for detailed parameter ranges"
    echo ""
}

pulsar_help_preset() {
    echo ""
    _help_section "PRESET DEMOS"
    echo ""

    _help_text "Quick spawn presets for instant visuals:"
    echo ""
    echo "  $(_help_command "hello")           Single cyan pulsar at center"
    echo "                    $(_help_dim "Parameters: 80 48 18 6 0.5 0.6 0")"
    echo ""
    echo "  $(_help_command "trinity")         Three pulsars in formation"
    echo "                    $(_help_dim "Left, center, right with varied parameters")"
    echo ""
    echo "  $(_help_command "dance")           Two counter-rotating pulsars"
    echo "                    $(_help_dim "Demonstrates phase-locked rotation")"
    echo ""

    _help_subsection "Usage:"
    echo ""
    echo "  1. $(_help_command "start")         $(_help_dim "Launch engine")"
    echo "  2. $(_help_command "trinity")       $(_help_dim "Run preset")"
    echo "  3. Experiment with $(_help_command "set") commands"
    echo ""

    _help_muted "→ Tip: Use 'list' after presets to see sprite names"
    echo ""
}

pulsar_help_script() {
    echo ""
    _help_section "SCRIPT LOADING"
    echo ""

    _help_subsection "Commands:"
    echo ""
    echo "  $(_help_command "load <path>")     Load and execute .pql script"
    echo "                    $(_help_dim "Example: load scripts/orbit.pql")"
    echo ""

    _help_subsection "Script Format:"
    echo ""
    echo "  $(_help_text "Pulsar Query Language (.pql) scripts contain raw protocol commands:")"
    echo ""
    echo "    $(_help_dim "# Comments start with #")"
    echo "    $(_help_command "SPAWN_PULSAR 80 48 18 6 0.5 0.6 0")"
    echo "    $(_help_command "SPAWN_PULSAR 40 48 15 4 0.7 -0.8 5")"
    echo ""

    _help_subsection "Script Behavior:"
    echo ""
    echo "  • Engine auto-starts if not running"
    echo "  • INIT and RUN commands are skipped (auto-handled)"
    echo "  • Commands execute sequentially"
    echo "  • Comments and blank lines ignored"
    echo ""

    _help_muted "→ See also: 'help protocol' for available commands"
    echo ""
}

pulsar_help_protocol() {
    echo ""
    _help_section "ENGINE PROTOCOL"
    echo ""

    _help_text "Raw Engine Protocol commands for advanced control:"
    echo ""

    _help_subsection "Commands:"
    echo ""
    echo "  $(_help_command "raw <command>")              Send raw protocol command"
    echo ""
    echo "  $(_help_command "INIT <w> <h>")               Initialize grid"
    echo "      $(_help_dim "Auto-sent by 'start' - rarely needed")"
    echo ""
    echo "  $(_help_command "SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <val>")"
    echo "      $(_help_dim "Create sprite (returns ID)")"
    echo ""
    echo "  $(_help_command "SET <id> <key> <value>")     Update sprite property"
    echo "      $(_help_dim "Use numeric ID, not name")"
    echo ""
    echo "  $(_help_command "KILL <id>")                  Remove sprite"
    echo "      $(_help_dim "Use numeric ID, not name")"
    echo ""
    echo "  $(_help_command "LIST_PULSARS")               List all active sprites"
    echo "      $(_help_dim "Shows IDs and parameters")"
    echo ""

    _help_subsection "Usage:"
    echo ""
    echo "  $(_help_dim "# Send raw command explicitly:")"
    echo "  $(_help_command "raw LIST_PULSARS")"
    echo ""
    echo "  $(_help_dim "# Or use protocol commands directly:")"
    echo "  $(_help_command "LIST_PULSARS")"
    echo ""

    _help_muted "→ Tip: Use high-level 'spawn/set/kill' for named sprites"
    echo ""
}

pulsar_help_params() {
    echo ""
    _help_section "PARAMETER REFERENCE"
    echo ""

    _help_subsection "Spawn Parameters:"
    echo ""
    echo "  $(_help_command "<name>")       Sprite identifier (your choice)"
    echo "  $(_help_command "<mx> <my>")    Center position in microgrid coordinates"
    echo "                  $(_help_dim "Microgrid is 2× terminal cells")"
    echo "                  $(_help_dim "Range: 0 to grid_width, 0 to grid_height")"
    echo ""
    echo "  $(_help_command "<len0>")       Base arm length"
    echo "                  $(_help_dim "Range: 8-30 (typical: 15-20)")"
    echo ""
    echo "  $(_help_command "<amp>")        Pulse amplitude (breathing effect)"
    echo "                  $(_help_dim "Range: 2-12 (typical: 4-8)")"
    echo ""
    echo "  $(_help_command "<freq>")       Pulse frequency (Hz)"
    echo "                  $(_help_dim "Range: 0.1-1.2 (typical: 0.4-0.8)")"
    echo ""
    echo "  $(_help_command "<dtheta>")     Rotation speed (radians/sec)"
    echo "                  $(_help_dim "Range: -3.14 to 3.14")"
    echo "                  $(_help_dim "Negative = clockwise, positive = counter-clockwise")"
    echo ""
    echo "  $(_help_command "<valence>")    Color index"
    echo "                  $(_help_dim "0=cyan, 1=green, 2=yellow, 3=orange, 4=red, 5=magenta")"
    echo ""

    _help_subsection "Example Values:"
    echo ""
    echo "  $(_help_text "Calm center sprite:")"
    echo "    $(_help_command "spawn calm 80 48 15 4 0.3 0.2 0")"
    echo ""
    echo "  $(_help_text "Fast spinning red:")"
    echo "    $(_help_command "spawn spin 100 60 20 8 0.9 2.5 4")"
    echo ""
    echo "  $(_help_text "Large slow magenta:")"
    echo "    $(_help_command "spawn big 80 48 28 10 0.2 -0.5 5")"
    echo ""
}

# ============================================================================
# HELP DISPATCHER
# ============================================================================

pulsar_help() {
    local topic="${1:-main}"

    case "$topic" in
        main|"")
            pulsar_help_main
            ;;
        engine|start|stop|status)
            pulsar_help_engine
            ;;
        sprite|spawn|set|kill|list)
            pulsar_help_sprite
            ;;
        preset|hello|trinity|dance)
            pulsar_help_preset
            ;;
        script|load|pql)
            pulsar_help_script
            ;;
        protocol|raw|commands)
            pulsar_help_protocol
            ;;
        param|params|parameter|parameters)
            pulsar_help_params
            ;;
        *)
            echo ""
            _help_text "Unknown help topic: "
            _help_command "$topic"
            echo ""
            echo ""
            _help_dim "Try: help (for main menu)"
            echo ""
            return 1
            ;;
    esac
}

# Export help function
export -f pulsar_help
