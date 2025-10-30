#!/usr/bin/env bash
# Pulsar REPL Help System
# Using bash/tree builders for standardized help

# Source dependencies
if [[ -n "$TETRA_SRC" ]]; then
    source "$TETRA_SRC/bash/tree/builders.sh"
fi

# Completion helper - get sprite names
_pulsar_complete_sprite_names() {
    if [[ -v PULSAR_REPL_SPRITE_IDS ]]; then
        for name in "${!PULSAR_REPL_SPRITE_IDS[@]}"; do
            echo "$name"
        done
    fi
}

# Completion helper - valence (color) values
_pulsar_complete_valence() {
    echo "0"
    echo "1"
    echo "2"
    echo "3"
    echo "4"
    echo "5"
}

# Build pulsar help tree
_pulsar_build_help_tree() {
    # Main help
    tree_build_category "help.game.pulsar" \
        "⚡ PULSAR" \
        "Interactive Engine Protocol Shell - Control the Pulsar energy wave engine"

    # Engine control
    tree_build_category "help.game.pulsar.engine" \
        "Engine Control" \
        "Start, stop, and manage the Pulsar engine"

    tree_build_command "help.game.pulsar.engine.start" \
        "Start Engine" \
        "Start the Pulsar engine and initialize grid" \
        "start" \
        "start" \
        "pulsar_repl_start_engine"

    tree_build_command "help.game.pulsar.engine.stop" \
        "Stop Engine" \
        "Stop the engine and clean up sprites" \
        "stop" \
        "stop" \
        "pulsar_repl_stop_engine"

    tree_build_command "help.game.pulsar.engine.restart" \
        "Restart Engine" \
        "Restart the engine (equivalent to stop + start)" \
        "restart" \
        "restart" \
        ""

    tree_build_command "help.game.pulsar.engine.status" \
        "Engine Status" \
        "Show engine status (PID, grid size, sprite count)" \
        "status" \
        "status" \
        "pulsar_repl_status"

    # Sprite management
    tree_build_category "help.game.pulsar.sprite" \
        "Sprite Management" \
        "Create and manage pulsar sprites"

    tree_build_command "help.game.pulsar.sprite.spawn" \
        "Spawn Sprite" \
        "Create a named pulsar sprite with specified parameters" \
        "spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>" \
        "spawn star1 80 48 18 6 0.5 0.6 0" \
        "pulsar_repl_spawn"

    tree_build_command "help.game.pulsar.sprite.set" \
        "Set Property" \
        "Update sprite property by name (keys: mx, my, len0, amp, freq, dtheta, valence)" \
        "set <name> <key> <value>" \
        "set star1 dtheta 1.2" \
        "pulsar_repl_set" \
        "_pulsar_complete_sprite_names"

    tree_build_command "help.game.pulsar.sprite.kill" \
        "Kill Sprite" \
        "Remove sprite by name" \
        "kill <name>" \
        "kill star1" \
        "pulsar_repl_kill" \
        "_pulsar_complete_sprite_names"

    tree_build_command "help.game.pulsar.sprite.list" \
        "List Sprites" \
        "Show all named sprites" \
        "list" \
        "list"

    # Presets
    tree_build_category "help.game.pulsar.preset" \
        "Preset Demos" \
        "Quick spawn presets for instant visuals"

    tree_build_command "help.game.pulsar.preset.hello" \
        "Hello Preset" \
        "Single cyan pulsar at center (80 48 18 6 0.5 0.6 0)" \
        "hello" \
        "hello" \
        "pulsar_repl_preset_hello"

    tree_build_command "help.game.pulsar.preset.trinity" \
        "Trinity Preset" \
        "Three pulsars in formation (left, center, right with varied parameters)" \
        "trinity" \
        "trinity" \
        "pulsar_repl_preset_trinity"

    tree_build_command "help.game.pulsar.preset.dance" \
        "Dance Preset" \
        "Two counter-rotating pulsars demonstrating phase-locked rotation" \
        "dance" \
        "dance" \
        "pulsar_repl_preset_dance"

    # Scripts
    tree_build_category "help.game.pulsar.script" \
        "Script Loading" \
        "Load and execute .pql scripts"

    tree_build_command "help.game.pulsar.script.load" \
        "Load Script" \
        "Load and execute .pql script (raw protocol commands, # comments, auto-starts engine)" \
        "load <path>" \
        "load scripts/orbit.pql" \
        "pulsar_repl_load_script"

    # Protocol
    tree_build_category "help.game.pulsar.protocol" \
        "Engine Protocol" \
        "Raw Engine Protocol commands"

    tree_build_command "help.game.pulsar.protocol.raw" \
        "Raw Command" \
        "Send raw protocol command" \
        "raw <command>" \
        "raw SPAWN_PULSAR 80 48 18 6 0.5 0.6 0" \
        "pulsar_repl_send_raw"

    tree_build_command "help.game.pulsar.protocol.init" \
        "INIT Command" \
        "Initialize grid (auto-called by start)" \
        "INIT <width> <height>" \
        "INIT 160 96"

    tree_build_command "help.game.pulsar.protocol.spawn" \
        "SPAWN_PULSAR Command" \
        "Spawn a pulsar sprite" \
        "SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>" \
        "SPAWN_PULSAR 80 48 18 6 0.5 0.6 0"

    tree_build_command "help.game.pulsar.protocol.set" \
        "SET Command" \
        "Set sprite property" \
        "SET <id> <key> <value>" \
        "SET 1 dtheta 1.2"

    tree_build_command "help.game.pulsar.protocol.kill" \
        "KILL Command" \
        "Kill sprite by ID" \
        "KILL <id>" \
        "KILL 1"

    tree_build_command "help.game.pulsar.protocol.list" \
        "LIST_PULSARS Command" \
        "List all sprites" \
        "LIST_PULSARS" \
        "LIST_PULSARS"

    # Parameters
    tree_build_category "help.game.pulsar.params" \
        "Parameter Reference" \
        "Detailed parameter ranges and effects"

    tree_build_command "help.game.pulsar.params.position" \
        "Position (mx, my)" \
        "Center position on microgrid (0 to grid_width/height, microgrid units 50 per char)" \
        "<mx> <my>" \
        "80 48"

    tree_build_command "help.game.pulsar.params.shape" \
        "Shape (len0, amp)" \
        "Arm length (1-30) and pulse amplitude (1-15) - larger = bigger pulsars" \
        "<len0> <amp>" \
        "18 6"

    tree_build_command "help.game.pulsar.params.motion" \
        "Motion (freq, dtheta)" \
        "Pulse rate 0.1-2.0 Hz and rotation speed -2.0 to 2.0 (negative = CCW)" \
        "<freq> <dtheta>" \
        "0.5 0.6"

    tree_build_command "help.game.pulsar.params.valence" \
        "Valence (color)" \
        "Color selection: 0=Cyan 1=Green 2=Yellow 3=Red 4=Magenta 5=Blue" \
        "<valence>" \
        "0" \
        "" \
        "_pulsar_complete_valence"
}

# Main help entry point
pulsar_help() {
    local topic="${1:-help.game.pulsar}"

    # Normalize topic path - add namespace if not present
    if [[ "$topic" != help.game.pulsar* ]]; then
        # If user provides "pulsar.engine.start", convert to "help.game.pulsar.engine.start"
        if [[ "$topic" == pulsar* ]]; then
            topic="help.game.${topic}"
        else
            # Otherwise, assume it's a sub-path like "engine.start"
            topic="help.game.pulsar.${topic}"
        fi
    fi

    # Build tree on first use
    if ! tree_exists "help.game.pulsar" 2>/dev/null; then
        _pulsar_build_help_tree
    fi

    # Show help using tree system (18-line paginated)
    tree_help_show "$topic"
}

# Export
export -f pulsar_help
export -f _pulsar_build_help_tree
export -f _pulsar_complete_sprite_names
export -f _pulsar_complete_valence
