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

    # Detect type by top-level keys
    local type
    if jq -e '.steps' "$src_json" &>/dev/null; then
        type="guide"
    elif jq -e '.groups' "$src_json" &>/dev/null; then
        type="reference"
    elif jq -e '.sections' "$src_json" &>/dev/null; then
        type="reference"
    else
        echo "Cannot detect doc type (need steps, groups, or sections)" >&2
        return 1
    fi

    # Find template
    local template="$TERRAIN_SRC/core/templates/${type}.html"
    if [[ ! -f "$template" ]]; then
        echo "Template not found: $template" >&2
        return 1
    fi

    # Read JSON content
    local json_content
    json_content=$(<"$src_json")

    # Read template and perform substitutions
    local html
    html=$(<"$template")
    html="${html//\{\{TITLE\}\}/$title}"
    html="${html//\{\{CONFIG\}\}/\{\}}"

    # Use awk for DOCUMENT replacement (JSON may contain special chars)
    local result
    result=$(awk -v doc="$json_content" '{gsub(/\{\{DOCUMENT\}\}/, doc); print}' <<< "$html")

    if [[ -n "$output" ]]; then
        mkdir -p "$(dirname "$output")"
        printf '%s\n' "$result" > "$output"
        echo "Built: $output ($type)"
    else
        printf '%s\n' "$result"
    fi
}

terrain_doc_help() {
    cat <<'EOF'
terrain doc - Build HTML from JSON using templates

USAGE:
    terrain doc <file.json>              Build to stdout
    terrain doc <file.json> -o out.html  Build to specific output
    terrain doc help                     Show this help

DETECTION:
    has "steps" array  → guide template
    has "groups" array → reference template
    has "sections"     → reference template (thesis fallback)

TEMPLATES:
    Templates are in $TERRAIN_SRC/core/templates/
    Placeholders: {{TITLE}}, {{DOCUMENT}}, {{CONFIG}}
EOF
}

export -f terrain_doc_build terrain_doc_help
