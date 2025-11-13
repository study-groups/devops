#!/usr/bin/env bash

# MIDI Help Tree
# Defines the tree structure for MIDI REPL tab completion and help

# Source tree system
if [[ -f "$TETRA_SRC/bash/tree/core.sh" ]]; then
    source "$TETRA_SRC/bash/tree/core.sh"
fi

# Initialize MIDI help tree
# Renamed from midi_init_help_tree to midi_tree_init for consistency
midi_tree_init() {
    local ns="help.midi"

    # Root category
    tree_insert "$ns" "category" \
        title="MIDI Control System" \
        description="MIDI controller mapping and real-time event processing"

    # Help command
    tree_insert "$ns.help" "command" \
        title="Show help information" \
        description="Display MIDI REPL commands and usage" \
        usage="help" \
        aliases="h ?"

    # Status command
    tree_insert "$ns.status" "command" \
        title="Show MIDI status" \
        description="Display controller, variant, and log mode status" \
        usage="status" \
        aliases="s"

    # Log command category
    tree_insert "$ns.log" "command" \
        title="Set or toggle log mode" \
        description="Control MIDI event logging: off, raw, semantic, or both" \
        usage="log [off|raw|semantic|both]"

    # Variant command
    tree_insert "$ns.variant" "command" \
        title="Switch to a variant" \
        description="Change active MIDI mapping variant (A, B, C, or D)" \
        usage="variant <a|b|c|d>" \
        aliases="v" \
        examples="variant a
variant b"

    # Load-map command
    tree_insert "$ns.load-map" "command" \
        title="Load a MIDI controller map" \
        description="Load a different MIDI controller mapping file" \
        usage="load-map <name>" \
        aliases="load map" \
        completion_fn="midi_complete_maps"

    # Reload command
    tree_insert "$ns.reload" "command" \
        title="Reload current MIDI map" \
        description="Reload the currently active MIDI mapping" \
        usage="reload" \
        aliases="r"

    # Reload-config command
    tree_insert "$ns.reload-config" "command" \
        title="Reload config.toml" \
        description="Reload MIDI system configuration" \
        usage="reload-config" \
        aliases="rc"

    # Devices command
    tree_insert "$ns.devices" "command" \
        title="List available MIDI devices" \
        description="Show all connected MIDI input/output devices" \
        usage="devices" \
        aliases="dev"

    # Exit commands
    tree_insert "$ns.exit" "command" \
        title="Exit the REPL" \
        description="Exit MIDI REPL and return to shell" \
        usage="exit" \
        aliases="quit q"
}

# Dynamic completion function for map names
midi_complete_maps() {
    if [[ -d "$MIDI_MAPS_DIR" ]]; then
        ls -1 "$MIDI_MAPS_DIR"/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//'
    fi
}

# Export the init function
export -f midi_tree_init

# Get completions for current context
midi_tree_complete() {
    local input="$1"
    local namespace="help.midi"

    # Parse input to build tree path
    local words=($input)
    local path="$namespace"

    # Build path from words (except last, which is being completed)
    if [[ ${#words[@]} -gt 1 ]]; then
        for ((i=0; i<${#words[@]}-1; i++)); do
            local word="${words[$i]}"
            [[ -n "$word" ]] && path="$path.$word"
        done
    fi

    # Get current word being completed
    local cur="${words[${#words[@]}-1]}"

    # Get children at this path
    local children
    if command -v tree_complete >/dev/null 2>&1; then
        children=$(tree_complete "$path" "$cur" 2>/dev/null)
    fi

    # If path has completion_values, use those
    if [[ -z "$children" ]]; then
        if command -v tree_complete_values >/dev/null 2>&1; then
            children=$(tree_complete_values "$path" 2>/dev/null)
        fi
    fi

    # If path has completion_fn, call it
    if [[ -z "$children" ]]; then
        local completion_fn
        completion_fn=$(tree_get "$path" "completion_fn" 2>/dev/null)
        if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
            children=$("$completion_fn" 2>/dev/null)
        fi
    fi

    # Filter by current word
    if [[ -n "$cur" ]]; then
        echo "$children" | grep "^$cur"
    else
        echo "$children"
    fi
}

# Export functions
export -f midi_tree_init
export -f midi_complete_maps
export -f midi_tree_complete
