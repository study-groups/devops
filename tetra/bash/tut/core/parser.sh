#!/usr/bin/env bash
# parser.sh - JSON tutorial parsing utilities
#
# Provides consistent jq queries for tutorial JSON structure.
# Renderers use these to extract content without duplicating jq calls.
# All functions are internal (prefixed with _tut_).

# Get metadata field
_tut_meta() {
    local json_file="$1"
    local field="$2"
    local default="${3:-}"

    jq -r ".metadata.$field // \"$default\"" "$json_file"
}

# Get step count
_tut_step_count() {
    local json_file="$1"
    jq '.steps | length' "$json_file"
}

# Get step field
_tut_step() {
    local json_file="$1"
    local step_idx="$2"
    local field="$3"
    local default="${4:-}"

    jq -r ".steps[$step_idx].$field // \"$default\"" "$json_file"
}

# Get content block count for a step
_tut_content_count() {
    local json_file="$1"
    local step_idx="$2"

    jq ".steps[$step_idx].content | length" "$json_file"
}

# Get content block field
_tut_content() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"
    local field="$4"
    local default="${5:-}"

    jq -r ".steps[$step_idx].content[$block_idx].$field // \"$default\"" "$json_file"
}

# Get terminal line count for a step
_tut_terminal_count() {
    local json_file="$1"
    local step_idx="$2"

    jq ".steps[$step_idx].terminal | length" "$json_file"
}

# Get terminal line field
_tut_terminal() {
    local json_file="$1"
    local step_idx="$2"
    local line_idx="$3"
    local field="$4"
    local default="${5:-}"

    jq -r ".steps[$step_idx].terminal[$line_idx].$field // \"$default\"" "$json_file"
}

# Get nested content count (for boxes)
_tut_nested_count() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    jq ".steps[$step_idx].content[$block_idx].content | length" "$json_file"
}

# Get nested content field
_tut_nested() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"
    local nested_idx="$4"
    local field="$5"
    local default="${6:-}"

    jq -r ".steps[$step_idx].content[$block_idx].content[$nested_idx].$field // \"$default\"" "$json_file"
}

# Get list items as newline-separated string
_tut_list_items() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    jq -r ".steps[$step_idx].content[$block_idx].items[]" "$json_file"
}

# Get nested list items
_tut_nested_list_items() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"
    local nested_idx="$4"

    jq -r ".steps[$step_idx].content[$block_idx].content[$nested_idx].items[]" "$json_file"
}

# Get command block commands
_tut_commands() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    jq -r ".steps[$step_idx].content[$block_idx].commands[]" "$json_file"
}

# Get nested command block commands
_tut_nested_commands() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"
    local nested_idx="$4"

    jq -r ".steps[$step_idx].content[$block_idx].content[$nested_idx].commands[]" "$json_file"
}

# Check if feature is enabled (default true)
_tut_feature() {
    local json_file="$1"
    local feature="$2"
    local default="${3:-true}"

    jq -r ".features.$feature // $default" "$json_file"
}

# Check if theme exists
_tut_has_theme() {
    local json_file="$1"
    jq -r '.theme != null' "$json_file"
}

# Get theme color overrides as CSS
_tut_theme_css() {
    local json_file="$1"

    jq -r '.theme.colors // {} | to_entries[] | "            --\(.key | gsub("([A-Z])"; "-\(.[0:1] | ascii_downcase)")): \(.value);"' "$json_file" 2>/dev/null
}
