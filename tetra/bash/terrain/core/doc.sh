#!/usr/bin/env bash
# doc.sh - Build standalone HTML from JSON using terrain templates
#
# Injects JSON content into guide/reference/thesis templates.
# No terrain.config.json needed — just a JSON file with metadata.

terrain_doc_build() {
    local src_json="$1"
    local output="$2"

    if [[ -z "$src_json" ]]; then
        echo "Usage: terrain doc <file.json> [-o output.html]" >&2
        return 1
    fi

    if [[ ! -f "$src_json" ]]; then
        echo "File not found: $src_json" >&2
        return 1
    fi

    # Extract title
    local title
    title=$(jq -r '.metadata.title // "Untitled"' "$src_json")

    # Warn if embedded JSON is large (>500KB)
    local file_size
    file_size=$(wc -c < "$src_json" | tr -d ' ')
    if [[ $file_size -gt 512000 ]]; then
        echo "Warning: large document ($(( file_size / 1024 ))KB) — may affect browser performance" >&2
    fi

    # Detect type: explicit metadata.type first, then duck-typing
    local type
    type=$(jq -r '.metadata.type // empty' "$src_json")
    if [[ -z "$type" ]]; then
        if jq -e '.steps' "$src_json" &>/dev/null; then
            type="guide"
        elif jq -e '.groups' "$src_json" &>/dev/null; then
            type="reference"
        elif jq -e '.sections' "$src_json" &>/dev/null; then
            type="thesis"
        else
            echo "Cannot detect doc type (need steps, groups, or sections)" >&2
            return 1
        fi
    fi

    # Find template
    local template="$TERRAIN_SRC/core/templates/${type}.html"
    if [[ ! -f "$template" ]]; then
        echo "Template not found: $template" >&2
        return 1
    fi

    # Read template, replace TITLE and CONFIG via bash
    local html
    html=$(<"$template")
    html="${html//\{\{TITLE\}\}/$title}"
    html="${html//\{\{CONFIG\}\}/\{\}}"

    # Split at {{DOCUMENT}} and reassemble with JSON file content
    local before="${html%%\{\{DOCUMENT\}\}*}"
    local after="${html#*\{\{DOCUMENT\}\}}"

    if [[ -n "$output" ]]; then
        mkdir -p "$(dirname "$output")"
        { printf '%s' "$before"; cat "$src_json"; printf '%s\n' "$after"; } > "$output"
        echo "Built: $output ($type)"
    else
        printf '%s' "$before"
        cat "$src_json"
        printf '%s\n' "$after"
    fi
}

terrain_doc_help() {
    cat <<'EOF'
terrain doc - Build HTML from JSON using templates

USAGE:
    terrain doc <file.json>              Build to stdout
    terrain doc <file.json> -o out.html  Build to specific output
    terrain doc help                     Show this help

DETECTION (in priority order):
    .metadata.type     → explicit type (guide, reference, thesis)
    has "steps" array  → guide template
    has "groups" array → reference template
    has "sections"     → thesis template

TEMPLATES:
    Templates are in $TERRAIN_SRC/core/templates/
    Available: guide.html, reference.html, thesis.html
    Placeholders: {{TITLE}}, {{DOCUMENT}}, {{CONFIG}}
EOF
}

export -f terrain_doc_build terrain_doc_help
