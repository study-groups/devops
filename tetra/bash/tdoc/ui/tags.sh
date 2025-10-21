#!/usr/bin/env bash

# TDOC Tag System
# Color-coded tag rendering using TDS tokens

# Tag color mappings to TDS tokens (global associative array)
declare -gA TDOC_TAG_COLORS

# Category colors
TDOC_TAG_COLORS[core]="status.info"
TDOC_TAG_COLORS[other]="status.warning"

# Type colors
TDOC_TAG_COLORS[spec]="mode:0"
TDOC_TAG_COLORS[guide]="env:1"
TDOC_TAG_COLORS[reference]="mode:1"
TDOC_TAG_COLORS[bug-fix]="status.error"
TDOC_TAG_COLORS[refactor]="verbs:3"
TDOC_TAG_COLORS[plan]="interactive.link"
TDOC_TAG_COLORS[summary]="text.secondary"
TDOC_TAG_COLORS[investigation]="nouns:3"
TDOC_TAG_COLORS[spike]="verbs:1"

# Status colors
TDOC_TAG_COLORS[draft]="text.tertiary"
TDOC_TAG_COLORS[stable]="status.success"
TDOC_TAG_COLORS[deprecated]="text.muted"

# Default
TDOC_TAG_COLORS[default]="text.tertiary"

# Render a tag with color coding
tdoc_render_tag() {
    local tag="$1"
    local show_symbol="${2:-true}"

    # Skip empty tags
    [[ -z "$tag" ]] && return 0

    # Get color token for this tag (use default if not found)
    local token="${TDOC_TAG_COLORS[default]}"
    if [[ -n "${TDOC_TAG_COLORS[$tag]}" ]]; then
        token="${TDOC_TAG_COLORS[$tag]}"
    fi

    # Render with color
    if [[ "$TDS_LOADED" == "true" ]]; then
        tds_text_color "$token"
        [[ "$show_symbol" == "true" ]] && printf "◆ "
        printf "%s" "$tag"
        reset_color
    else
        # Fallback without color
        [[ "$show_symbol" == "true" ]] && printf "◆ "
        printf "%s" "$tag"
    fi
}

# Render category badge
tdoc_render_category_badge() {
    local category="$1"

    if [[ "$TDS_LOADED" == "true" ]]; then
        if [[ "$category" == "core" ]]; then
            tds_color_swatch "status.info"
            printf " CORE "
            reset_color
        else
            tds_color_swatch "status.warning"
            printf " OTHER "
            reset_color
        fi
    else
        # Fallback
        printf "[%s]" "$(echo "$category" | tr '[:lower:]' '[:upper:]')"
    fi
}

# Render type badge
tdoc_render_type_badge() {
    local type="$1"

    # Skip empty type
    [[ -z "$type" ]] && return 0

    local token="${TDOC_TAG_COLORS[default]}"
    if [[ -n "${TDOC_TAG_COLORS[$type]}" ]]; then
        token="${TDOC_TAG_COLORS[$type]}"
    fi

    if [[ "$TDS_LOADED" == "true" ]]; then
        tds_text_color "$token"
        printf " %s " "$type"
        reset_color
    else
        printf "[%s]" "$type"
    fi
}

# Render status indicator
tdoc_render_status() {
    local status="$1"

    # Skip empty status
    [[ -z "$status" ]] && return 0

    local token="${TDOC_TAG_COLORS[default]}"
    if [[ -n "${TDOC_TAG_COLORS[$status]}" ]]; then
        token="${TDOC_TAG_COLORS[$status]}"
    fi

    if [[ "$TDS_LOADED" == "true" ]]; then
        tds_text_color "$token"
        case "$status" in
            stable)
                printf "✓ %s" "$status"
                ;;
            draft)
                printf "◇ %s" "$status"
                ;;
            deprecated)
                printf "✗ %s" "$status"
                ;;
            *)
                printf "• %s" "$status"
                ;;
        esac
        reset_color
    else
        printf "[%s]" "$status"
    fi
}

# Render full tag list
tdoc_render_tag_list() {
    local tags_json="$1"

    # Extract tags from JSON array
    local tags=$(echo "$tags_json" | grep -o '"[^"]*"' | tr -d '"')

    if [[ -z "$tags" ]]; then
        return 0
    fi

    echo "$tags" | while read -r tag; do
        [[ -z "$tag" ]] && continue
        tdoc_render_tag "$tag"
        printf " "
    done
}

# Render metadata header for a document
tdoc_render_metadata_header() {
    local meta_json="$1"

    # Extract fields
    local category=$(echo "$meta_json" | grep -o '"category": "[^"]*"' | cut -d'"' -f4)
    local type=$(echo "$meta_json" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local status=$(echo "$meta_json" | grep -o '"status": "[^"]*"' | cut -d'"' -f4)
    local module=$(echo "$meta_json" | grep -o '"module": "[^"]*"' | cut -d'"' -f4)
    local tags=$(echo "$meta_json" | grep -o '"tags": \[[^\]]*\]')

    # Render header
    tdoc_render_category_badge "$category"
    printf "  "
    tdoc_render_type_badge "$type"
    printf "  "

    if [[ -n "$module" ]]; then
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "structural.accent"
            printf "module:%s" "$module"
            reset_color
        else
            printf "module:%s" "$module"
        fi
        printf "  "
    fi

    tdoc_render_status "$status"
    printf "\n"

    # Render tags if present
    if [[ -n "$tags" ]]; then
        printf "Tags: "
        tdoc_render_tag_list "$tags"
        printf "\n"
    fi
}

# Render compact one-line metadata summary
tdoc_render_compact() {
    local meta_json="$1"
    local doc_path="$2"

    local category=$(echo "$meta_json" | grep -o '"category": "[^"]*"' | cut -d'"' -f4)
    local type=$(echo "$meta_json" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)

    # Category (5 chars)
    printf "%-5s  " "$(echo "$category" | tr '[:lower:]' '[:upper:]')"

    # Type (10 chars)
    tdoc_render_tag "$type" false
    printf "%-10s  " ""

    # Filename
    local filename=$(basename "$doc_path")
    if [[ "$TDS_LOADED" == "true" ]]; then
        tds_text_color "text.primary"
        printf "%s" "$filename"
        reset_color
    else
        printf "%s" "$filename"
    fi
}
