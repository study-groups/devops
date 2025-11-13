#!/usr/bin/env bash

# MIDI Map Display Functions
# Parse and display MIDI map information from JSON files

# Display map overview
midi_map_overview() {
    local map_file="${1:-}"

    if [[ -z "$map_file" || ! -f "$map_file" ]]; then
        echo "Error: Map file not found: $map_file" >&2
        return 1
    fi

    # Parse JSON using node
    node -e "
        const fs = require('fs');
        const map = JSON.parse(fs.readFileSync('$map_file', 'utf8'));

        console.log('═══ Map Overview ═══');
        console.log('Controller:', map.controller + '[' + map.instance + ']');
        console.log('Description:', map.description || 'N/A');
        console.log('');

        // Count hardware controls
        const hw = map.hardware || {};
        const types = {};
        Object.values(hw).forEach(ctrl => {
            const type = ctrl.type || 'unknown';
            types[type] = (types[type] || 0) + 1;
        });

        console.log('Hardware:');
        Object.entries(types).sort().forEach(([type, count]) => {
            console.log('  ' + type + 's: ' + count);
        });
        console.log('  Total: ' + Object.keys(hw).length + ' controls');
        console.log('');

        // Show variants
        const variants = map.variants || {};
        console.log('Variants:');
        Object.entries(variants).forEach(([key, variant]) => {
            const mappingCount = Object.keys(variant.mappings || {}).length;
            const hwCount = Object.keys(hw).length;
            const pct = hwCount > 0 ? Math.round(mappingCount / hwCount * 100) : 0;
            console.log('  ' + key + ': ' + variant.name + ' (' + mappingCount + '/' + hwCount + ' mapped, ' + pct + '%)');
            if (variant.description) {
                console.log('     ' + variant.description);
            }
        });
    "
}

# List all hardware controls
midi_map_list_hardware() {
    local map_file="${1:-}"
    local filter_type="${2:-}"

    if [[ -z "$map_file" || ! -f "$map_file" ]]; then
        echo "Error: Map file not found: $map_file" >&2
        return 1
    fi

    node -e "
        const fs = require('fs');
        const map = JSON.parse(fs.readFileSync('$map_file', 'utf8'));
        const hw = map.hardware || {};
        const filter = '$filter_type';

        console.log('═══ Hardware Controls ═══');
        console.log('');
        console.log('Control  Type      Channel  CC/Note  Raw→Syntax');
        console.log('─────────────────────────────────────────────────');

        Object.entries(hw).sort().forEach(([syntax, ctrl]) => {
            if (filter && ctrl.type !== filter) return;

            const ch = ctrl.channel || '-';
            const val = ctrl.cc !== undefined ? 'CC' + ctrl.cc :
                       ctrl.note !== undefined ? 'N' + ctrl.note : '-';
            const type = (ctrl.type || 'unknown').padEnd(9);
            const syntaxPad = syntax.padEnd(8);

            console.log(syntaxPad + ' ' + type + ' ' + ch + '        ' + val.padEnd(8) + ' ' + syntax);
        });
    "
}

# Show mapping for specific control
midi_map_show_control() {
    local map_file="${1:-}"
    local control="${2:-}"

    if [[ -z "$map_file" || ! -f "$map_file" ]]; then
        echo "Error: Map file not found: $map_file" >&2
        return 1
    fi

    if [[ -z "$control" ]]; then
        echo "Error: Control name required" >&2
        return 1
    fi

    node -e "
        const fs = require('fs');
        const map = JSON.parse(fs.readFileSync('$map_file', 'utf8'));
        const hw = map.hardware || {};
        const ctrl = hw['$control'];

        if (!ctrl) {
            console.error('Error: Control \"$control\" not found in map');
            process.exit(1);
        }

        console.log('═══ Control: $control ═══');
        console.log('');
        console.log('Hardware:');
        console.log('  Type:', ctrl.type || 'unknown');
        console.log('  Channel:', ctrl.channel || '-');
        if (ctrl.cc !== undefined) {
            console.log('  CC:', ctrl.cc);
        }
        if (ctrl.note !== undefined) {
            console.log('  Note:', ctrl.note);
        }
        console.log('');

        const variants = map.variants || {};
        console.log('Mappings by Variant:');
        let hasMappings = false;
        Object.entries(variants).forEach(([key, variant]) => {
            const mapping = (variant.mappings || {})['$control'];
            if (mapping) {
                hasMappings = true;
                console.log('  ' + key + ': ' + variant.name);
                console.log('     Semantic: ' + mapping.semantic);
                console.log('     Range: [' + mapping.min + ', ' + mapping.max + ']');
            }
        });

        if (!hasMappings) {
            console.log('  (no mappings defined)');
        }
    "
}

# Show all mappings for a variant
midi_map_show_variant() {
    local map_file="${1:-}"
    local variant="${2:-}"

    if [[ -z "$map_file" || ! -f "$map_file" ]]; then
        echo "Error: Map file not found: $map_file" >&2
        return 1
    fi

    if [[ -z "$variant" ]]; then
        echo "Error: Variant required (a, b, c, or d)" >&2
        return 1
    fi

    node -e "
        const fs = require('fs');
        const map = JSON.parse(fs.readFileSync('$map_file', 'utf8'));
        const variants = map.variants || {};
        const variant = variants['$variant'];
        const hw = map.hardware || {};

        if (!variant) {
            console.error('Error: Variant \"$variant\" not found in map');
            process.exit(1);
        }

        console.log('═══ Variant: $variant - ' + variant.name + ' ═══');
        if (variant.description) {
            console.log(variant.description);
        }
        console.log('');

        const mappings = variant.mappings || {};
        const count = Object.keys(mappings).length;
        const total = Object.keys(hw).length;

        console.log('Mappings: ' + count + '/' + total + ' controls');
        console.log('');
        console.log('Control  CC/Note  Semantic           Range');
        console.log('─────────────────────────────────────────────────────');

        Object.entries(mappings).sort().forEach(([ctrl, mapping]) => {
            const hwInfo = hw[ctrl] || {};
            const val = hwInfo.cc !== undefined ? ('CC' + hwInfo.cc).padEnd(8) :
                       hwInfo.note !== undefined ? ('N' + hwInfo.note).padEnd(8) :
                       '-'.padEnd(8);
            const semantic = (mapping.semantic || '-').padEnd(18);
            const range = '[' + mapping.min + ', ' + mapping.max + ']';

            console.log(ctrl.padEnd(8) + ' ' + val + ' ' + semantic + ' ' + range);
        });
    "
}

# Search for semantic name across all variants
midi_map_search() {
    local map_file="${1:-}"
    local search_term="${2:-}"

    if [[ -z "$map_file" || ! -f "$map_file" ]]; then
        echo "Error: Map file not found: $map_file" >&2
        return 1
    fi

    if [[ -z "$search_term" ]]; then
        echo "Error: Search term required" >&2
        return 1
    fi

    node -e "
        const fs = require('fs');
        const map = JSON.parse(fs.readFileSync('$map_file', 'utf8'));
        const variants = map.variants || {};
        const hw = map.hardware || {};
        const search = '$search_term'.toLowerCase();

        console.log('═══ Search Results: \"$search_term\" ═══');
        console.log('');

        let found = false;
        Object.entries(variants).forEach(([key, variant]) => {
            const mappings = variant.mappings || {};
            const matches = [];

            Object.entries(mappings).forEach(([ctrl, mapping]) => {
                if (mapping.semantic && mapping.semantic.toLowerCase().includes(search)) {
                    matches.push({ ctrl, mapping });
                }
            });

            if (matches.length > 0) {
                found = true;
                console.log('Variant ' + key + ': ' + variant.name);
                matches.forEach(({ ctrl, mapping }) => {
                    const hwInfo = hw[ctrl] || {};
                    const val = hwInfo.cc !== undefined ? 'CC' + hwInfo.cc :
                               hwInfo.note !== undefined ? 'N' + hwInfo.note : '-';
                    console.log('  ' + ctrl.padEnd(8) + ' (' + val.padEnd(5) + ') → ' +
                               mapping.semantic + ' [' + mapping.min + ', ' + mapping.max + ']');
                });
                console.log('');
            }
        });

        if (!found) {
            console.log('No matches found.');
        }
    "
}

# Export functions
export -f midi_map_overview
export -f midi_map_list_hardware
export -f midi_map_show_control
export -f midi_map_show_variant
export -f midi_map_search
