#!/usr/bin/env bash

# MIDI Module - Tetra MIDI Controller (TMC)
# Main entry point loaded by tmod

# MIDI Module Environment Variables with proper override guards
: "${MIDI_SRC:=$TETRA_SRC/bash/midi}"
: "${MIDI_DIR:=$TETRA_DIR/midi}"

# MIDI Directory Convention under TETRA_DIR
MIDI_CONFIG_DIR="${MIDI_DIR}/config"
MIDI_DEVICES_DIR="${MIDI_DIR}/devices"
MIDI_SESSIONS_DIR="${MIDI_DIR}/sessions"
MIDI_COLORS_DIR="${MIDI_DIR}/colors"
MIDI_LOGS_DIR="${MIDI_DIR}/logs"

# Override TMC_CONFIG_DIR for mapper
TMC_CONFIG_DIR="$MIDI_DIR"
export TMC_CONFIG_DIR

# MIDI Module Management
MIDI_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Source ~/tetra/tetra.sh first" >&2
    return 1
fi

# MIDI modules to source
MIDI_MODULES=(
    "$MIDI_MODULE_DIR/core/mapper.sh"
    "$MIDI_MODULE_DIR/core/learn.sh"
    "$MIDI_MODULE_DIR/core/repl.sh"
    "$MIDI_MODULE_DIR/completion.sh"
)

# Source MIDI modules
midi_source_modules() {
    local verbose="${1:-false}"
    local failed_modules=()

    for module in "${MIDI_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            if source "$module" 2>/dev/null; then
                [[ "$verbose" == "true" ]] && echo "✓ Sourced: $(basename "$module")"
            else
                local exit_code=$?
                echo "⚠ Failed to source: $(basename "$module") (exit code: $exit_code)" >&2
                failed_modules+=("$(basename "$module")")
            fi
        else
            echo "⚠ Module not found: $(basename "$module")" >&2
            failed_modules+=("$(basename "$module")")
        fi
    done

    if [[ ${#failed_modules[@]} -gt 0 ]]; then
        echo "⚠ MIDI module loaded with ${#failed_modules[@]} warning(s)" >&2
    fi
    return 0
}

# Initialize MIDI environment
midi_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi

    # Create necessary directories
    mkdir -p "$MIDI_CONFIG_DIR" "$MIDI_DEVICES_DIR" "$MIDI_SESSIONS_DIR" "$MIDI_COLORS_DIR" "$MIDI_LOGS_DIR"

    # Source modules
    midi_source_modules

    # Initialize mapper
    tmc_mapper_init

    # Set up color table from TDS if available
    if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
        source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
        tmc_sync_tds_colors
    fi
}

# Sync TDS colors to MIDI color table
tmc_sync_tds_colors() {
    local color_table="$TMC_CONFIG_DIR/colors/color_table.txt"

    # Create colors directory if needed
    mkdir -p "$(dirname "$color_table")"

    # Copy template if no existing table
    if [[ ! -f "$color_table" ]]; then
        cp "$MIDI_SRC/config/color_table_template.txt" "$color_table"
        echo "Created color table: $color_table"
    fi
}

# Main MIDI command interface (follows Tetra module pattern)
midi() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: midi <command> [args]

Service:     start stop status
Learning:    learn learn-all wizard unlearn clear learn-help
Mapping:     list mode
Session:     save load
Device:      device devices
Config:      config init
Other:       repl build help

Quick Start:
  midi start              Start TMC service
  midi repl               Interactive REPL
  midi learn VOLUME p1    Learn a control (use tab completion)

Use tab completion to explore commands: midi <tab>
For detailed help: midi help | midi learn-help
EOF
        return 0
    fi

    shift || true

    case "$action" in
        # REPL mode
        repl)
            # Parse OSC connection options
            local osc_host="$REPL_OSC_HOST"
            local osc_port="$REPL_OSC_PORT"

            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --osc-host)
                        osc_host="$2"
                        shift 2
                        ;;
                    --osc-port)
                        osc_port="$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            midi_repl "$osc_host" "$osc_port"
            ;;

        # Initialize
        init)
            midi_init
            echo "✓ MIDI module initialized"
            ;;

        # Service management
        start)
            echo "Starting MIDI service..."
            tsm start --port 1983 --name midi node "$MIDI_SRC/midi.js" -i 0 -o 0 -v
            ;;

        stop)
            tsm stop midi
            ;;

        status)
            tsm list | grep "midi" || {
                echo "MIDI service not running"
                echo "Start with: midi start"
                return 1
            }
            ;;

        # Learning mode
        learn)
            tmc_learn "$@"
            ;;

        learn-all)
            tmc_learn_all "$@"
            ;;

        wizard)
            tmc_learn_wizard
            ;;

        unlearn)
            tmc_unlearn "$@"
            ;;

        clear)
            tmc_clear_all
            ;;

        # Mapping management
        list)
            tmc_list_mappings
            ;;

        mode)
            tmc_set_mode "$@"
            ;;

        # Session management
        save)
            tmc_save_session "$@"
            ;;

        load)
            tmc_load_session "$@"
            ;;

        # Device management
        device)
            tmc_load_device "$@"
            ;;

        devices)
            "$MIDI_SRC/midi.js" -l
            ;;

        # Configuration
        config)
            local config_action="${1:-show}"
            shift || true

            case "$config_action" in
                show)
                    echo "TMC Configuration"
                    echo "================="
                    echo "Config dir: $TMC_CONFIG_DIR"
                    echo "Device dir: ${TMC_DEVICE_DIR:-none}"
                    echo "Current device: ${TMC_CURRENT_DEVICE:-none}"
                    echo ""
                    echo "Files:"
                    echo "  Hardware maps: $TMC_CONFIG_DIR/devices/*/hardware_map.txt"
                    echo "  Semantic maps: $TMC_CONFIG_DIR/devices/*/semantic_map.txt"
                    echo "  Sessions: $TMC_CONFIG_DIR/sessions/"
                    echo "  Color table: $TMC_CONFIG_DIR/colors/color_table.txt"
                    ;;

                edit)
                    local file="${1:-hardware}"
                    case "$file" in
                        hardware|hw)
                            ${EDITOR:-vi} "$TMC_DEVICE_DIR/hardware_map.txt"
                            ;;
                        semantic|sem)
                            ${EDITOR:-vi} "$TMC_DEVICE_DIR/semantic_map.txt"
                            ;;
                        colors|color)
                            ${EDITOR:-vi} "$TMC_CONFIG_DIR/colors/color_table.txt"
                            ;;
                        *)
                            echo "Unknown config file: $file"
                            echo "Use: hardware|semantic|colors"
                            return 1
                            ;;
                    esac
                    ;;

                templates)
                    echo "Config templates available at:"
                    echo "  $MIDI_SRC/config/"
                    ls -1 "$MIDI_SRC/config/"
                    ;;

                *)
                    echo "Unknown config action: $config_action"
                    echo "Use: show|edit|templates"
                    return 1
                    ;;
            esac
            ;;

        # Install dependencies
        build)
            echo "Installing Node.js dependencies..."
            cd "$MIDI_SRC"
            if npm install; then
                echo "✓ Dependencies installed"
                echo ""
                echo "Test with: $MIDI_SRC/tmc.js -l"
            else
                echo "✗ Installation failed"
                echo ""
                echo "Make sure Node.js and npm are installed"
                return 1
            fi
            ;;

        # Help
        help|--help|-h)
            tmc_help
            ;;

        learn-help)
            tmc_learn_help
            ;;

        *)
            echo "Unknown command: $action"
            echo "Use 'tmc help' for usage"
            return 1
            ;;
    esac
}

# Show help
tmc_help() {
    cat <<EOF
TMC - Tetra MIDI Controller
============================

A bidirectional MIDI mapping system with socket-based pub/sub.

USAGE
  tmc <command> [options]

SERVICE MANAGEMENT
  start           Start TMC service (via TSM)
  stop            Stop TMC service
  status          Show service status

LEARNING MODE
  learn <semantic> [syntax] [min] [max]
                  Learn a mapping interactively
                  Examples:
                    tmc learn VOLUME p1 0.0 1.0
                    tmc learn TRIGGER_KICK b1a

  learn-all <type>
                  Batch learn controls (pots|sliders|buttons|transport)

  wizard          Step-by-step learning wizard

  unlearn <name>  Remove a mapping

  clear           Clear all mappings

MAPPING MANAGEMENT
  list            Show all current mappings

  mode <mode>     Set broadcast mode
                  Modes: raw|syntax|semantic|all

SESSION MANAGEMENT
  save [name]     Save mappings to session (default: default)

  load [name]     Load mappings from session

DEVICE MANAGEMENT
  device <id>     Load device configuration

  devices         List available MIDI devices

CONFIGURATION
  config show     Show configuration paths
  config edit <file>
                  Edit config (hardware|semantic|colors)
  config templates
                  List available templates

BUILD
  build           Build tmc binary from source

HELP
  help            Show this help
  learn-help      Show learning mode help

EXAMPLES

  # Start TMC service
  tsm start bash $MIDI_SRC/core/socket_server.sh tmc

  # Learn volume control
  tmc learn VOLUME p1 0.0 1.0
  # (move pot 1 on your controller)

  # Learn all pots
  tmc learn-all pots

  # Set broadcast mode
  tmc mode semantic

  # Save session
  tmc save my-setup

  # Check status
  tmc status

ARCHITECTURE

  Hardware (MIDI) → tmc.c → Socket → Mapper → Subscribers
                              ↓
                         Learning Mode
                              ↓
                         Config Files

  Two-layer mapping:
    1. Hardware (CC/NOTE) → Syntax (p1, s1, b1a)
    2. Syntax → Semantic (VOLUME, TRIGGER_KICK)

CONTROL NAMES

  Pots:      p1-p8         (rotary knobs)
  Sliders:   s1-s8         (faders)
  Buttons:   b1a-b8d       (4 buttons × 8 paths = 32 buttons)
  Transport: play, pause, stop, back, fwd, fback, ffwd,
             up, down, left, right

For more info: tmc learn-help

EOF
}

# Initialize module when sourced
midi_init

# Export functions
export -f midi
export -f midi_init
export -f midi_source_modules
export -f tmc_sync_tds_colors
