#!/usr/bin/env bash
# Pulsar REPL Help System
# Using bash/tree for 18-line paginated help

# Source dependencies
if [[ -n "$TETRA_SRC" ]]; then
    source "$TETRA_SRC/bash/tree/help.sh"
fi

# Build pulsar help tree
_pulsar_build_help_tree() {
    # Main help
    tree_insert "pulsar" category \
        title="⚡ PULSAR - Interactive Engine Protocol Shell" \
        help="Control the Pulsar energy wave engine" \
        detail="Quick actions: start, hello, trinity
Type 'help <topic>' to explore"

    # Engine control
    tree_insert "pulsar.engine" category \
        title="Engine Control" \
        help="Start, stop, and manage the Pulsar engine"

    tree_insert "pulsar.engine.start" command \
        title="Start Engine" \
        help="Start the Pulsar engine" \
        synopsis="start" \
        detail="Initializes ${PULSAR_REPL_GRID_W:-160}×${PULSAR_REPL_GRID_H:-96} grid"

    tree_insert "pulsar.engine.stop" command \
        title="Stop Engine" \
        help="Stop the engine" \
        synopsis="stop" \
        detail="Cleanly shuts down and clears sprites"

    tree_insert "pulsar.engine.restart" command \
        title="Restart Engine" \
        help="Restart the engine" \
        synopsis="restart" \
        detail="Equivalent to stop + start"

    tree_insert "pulsar.engine.status" command \
        title="Engine Status" \
        help="Show engine status" \
        synopsis="status" \
        detail="Displays PID, grid size, sprite count"

    # Sprite management
    tree_insert "pulsar.sprite" category \
        title="Sprite Management" \
        help="Create and manage pulsar sprites"

    tree_insert "pulsar.sprite.spawn" command \
        title="Spawn Sprite" \
        help="Create a named pulsar sprite" \
        synopsis="spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>" \
        examples="spawn star1 80 48 18 6 0.5 0.6 0"

    tree_insert "pulsar.sprite.set" command \
        title="Set Property" \
        help="Update sprite property by name" \
        synopsis="set <name> <key> <value>" \
        examples="set star1 dtheta 1.2" \
        detail="Keys: mx, my, len0, amp, freq, dtheta, valence"

    tree_insert "pulsar.sprite.kill" command \
        title="Kill Sprite" \
        help="Remove sprite by name" \
        synopsis="kill <name>" \
        examples="kill star1"

    tree_insert "pulsar.sprite.list" command \
        title="List Sprites" \
        help="Show all named sprites" \
        synopsis="list"

    # Presets
    tree_insert "pulsar.preset" category \
        title="Preset Demos" \
        help="Quick spawn presets for instant visuals"

    tree_insert "pulsar.preset.hello" command \
        title="Hello Preset" \
        help="Single cyan pulsar at center" \
        synopsis="hello" \
        detail="Parameters: 80 48 18 6 0.5 0.6 0"

    tree_insert "pulsar.preset.trinity" command \
        title="Trinity Preset" \
        help="Three pulsars in formation" \
        synopsis="trinity" \
        detail="Left, center, right with varied parameters"

    tree_insert "pulsar.preset.dance" command \
        title="Dance Preset" \
        help="Two counter-rotating pulsars" \
        synopsis="dance" \
        detail="Demonstrates phase-locked rotation"

    # Scripts
    tree_insert "pulsar.script" category \
        title="Script Loading" \
        help="Load and execute .pql scripts"

    tree_insert "pulsar.script.load" command \
        title="Load Script" \
        help="Load and execute .pql script" \
        synopsis="load <path>" \
        examples="load scripts/orbit.pql" \
        detail="Scripts contain raw protocol commands
Comments start with #
Engine auto-starts if needed"

    # Protocol
    tree_insert "pulsar.protocol" category \
        title="Engine Protocol" \
        help="Raw Engine Protocol commands"

    tree_insert "pulsar.protocol.raw" command \
        title="Raw Command" \
        help="Send raw protocol command" \
        synopsis="raw <command>" \
        examples="raw SPAWN_PULSAR 80 48 18 6 0.5 0.6 0"

    tree_insert "pulsar.protocol.init" command \
        title="INIT Command" \
        help="Initialize grid (auto-called by start)" \
        synopsis="INIT <width> <height>"

    tree_insert "pulsar.protocol.spawn" command \
        title="SPAWN_PULSAR Command" \
        help="Spawn a pulsar sprite" \
        synopsis="SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>"

    tree_insert "pulsar.protocol.set" command \
        title="SET Command" \
        help="Set sprite property" \
        synopsis="SET <id> <key> <value>"

    tree_insert "pulsar.protocol.kill" command \
        title="KILL Command" \
        help="Kill sprite by ID" \
        synopsis="KILL <id>"

    tree_insert "pulsar.protocol.list" command \
        title="LIST_PULSARS Command" \
        help="List all sprites" \
        synopsis="LIST_PULSARS"

    # Parameters
    tree_insert "pulsar.params" category \
        title="Parameter Reference" \
        help="Detailed parameter ranges and effects"

    tree_insert "pulsar.params.position" command \
        title="Position (mx, my)" \
        help="Center position on microgrid" \
        detail="Range: 0 to grid_width/height
Grid: ${PULSAR_REPL_GRID_W:-160} × ${PULSAR_REPL_GRID_H:-96}
Microgrid units (50 per char cell)"

    tree_insert "pulsar.params.shape" command \
        title="Shape (len0, amp)" \
        help="Arm length and pulse amplitude" \
        detail="len0: Initial arm length (1-30)
amp: Pulse amplitude (1-15)
Larger values = bigger pulsars"

    tree_insert "pulsar.params.motion" command \
        title="Motion (freq, dtheta)" \
        help="Pulse frequency and rotation" \
        detail="freq: Pulse rate (0.1-2.0 Hz)
dtheta: Rotation speed (-2.0 to 2.0)
Negative = counter-clockwise"

    tree_insert "pulsar.params.valence" command \
        title="Valence (color)" \
        help="Color selection" \
        detail="0 = Cyan
1 = Green
2 = Yellow
3 = Red
4 = Magenta
5 = Blue"
}

# Main help entry point
pulsar_help() {
    local topic="${1:-pulsar}"

    # Build tree on first use
    if ! tree_exists "pulsar" 2>/dev/null; then
        _pulsar_build_help_tree
    fi

    # Show help using tree system (18-line paginated)
    tree_help_show "$topic"
}

# Export
export -f pulsar_help
export -f _pulsar_build_help_tree
