#!/usr/bin/env bash

# TDOC Tag System
# Color-coded tag rendering using TDS tokens

# Tag color mappings to TDS tokens (global associative array)
# NOTE: These are kept for backwards compatibility but prefer using tdocs.* tokens
declare -gA TDOC_TAG_COLORS

# Category colors (use tdocs.category.* tokens instead)
TDOC_TAG_COLORS[core]="tdocs.category.core"
TDOC_TAG_COLORS[other]="tdocs.category.other"

# Type colors (use tdocs.type.* tokens instead)
TDOC_TAG_COLORS[specification]="tdocs.type.specification"
TDOC_TAG_COLORS[standard]="tdocs.type.standard"
TDOC_TAG_COLORS[guide]="tdocs.type.guide"
TDOC_TAG_COLORS[reference]="tdocs.type.reference"
TDOC_TAG_COLORS[example]="tdocs.type.example"
TDOC_TAG_COLORS[temporal]="tdocs.type.temporal"
TDOC_TAG_COLORS[investigation]="tdocs.type.investigation"
TDOC_TAG_COLORS[bug-fix]="tdocs.type.bug-fix"
TDOC_TAG_COLORS[refactor]="tdocs.type.refactor"
TDOC_TAG_COLORS[plan]="tdocs.type.plan"
TDOC_TAG_COLORS[summary]="tdocs.type.summary"

# Status colors (use tdocs.status.* tokens instead)
TDOC_TAG_COLORS[draft]="tdocs.status.draft"
TDOC_TAG_COLORS[stable]="tdocs.status.stable"
TDOC_TAG_COLORS[deprecated]="tdocs.status.deprecated"

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
            tds_text_color "tdocs.category.core"
            printf " CORE "
            reset_color
        else
            tds_text_color "tdocs.category.other"
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

    # Try to use specific type token, fallback to default
    local token="tdocs.type.${type}"
    if [[ -z "${TDS_COLOR_TOKENS[$token]:-}" ]]; then
        token="text.secondary"
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

    # Try to use specific status token, fallback to default
    local token="tdocs.status.${status}"
    if [[ -z "${TDS_COLOR_TOKENS[$token]:-}" ]]; then
        token="text.secondary"
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
            tds_text_color "tdocs.module"
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

# Truncate path in the center with ellipsis
_tdoc_truncate_path() {
    local path="$1"
    local max_width="$2"

    # If path fits, return as-is
    if [[ ${#path} -le $max_width ]]; then
        echo "$path"
        return 0
    fi

    # Calculate how much to keep on each side
    local keep=$((max_width - 3))  # Reserve 3 chars for "..."
    local left=$((keep / 2))
    local right=$((keep - left))

    # Truncate: "start...end"
    echo "${path:0:$left}...${path: -$right}"
}

# Render compact one-line metadata summary
tdoc_render_compact() {
    local meta_json="$1"
    local doc_path="$2"
    local number_width="${3:-0}"  # Optional: width reserved for number prefix

    local category=$(echo "$meta_json" | grep -o '"category": "[^"]*"' | cut -d'"' -f4)
    local type=$(echo "$meta_json" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local module=$(echo "$meta_json" | grep -o '"module": "[^"]*"' | cut -d'"' -f4)
    local rank=$(echo "$meta_json" | grep -o '"rank": [0-9.]*' | cut -d' ' -f2)
    local recency_boost=$(echo "$meta_json" | grep -o '"recency_boost": [0-9.]*' | cut -d' ' -f2)

    # Get display path (relative to TETRA_SRC if possible, otherwise TETRA_DIR)
    local display_path="$doc_path"
    if [[ -n "$TETRA_SRC" ]] && [[ "$doc_path" == "$TETRA_SRC"* ]]; then
        display_path="${doc_path#$TETRA_SRC/}"
    elif [[ -n "$TETRA_DIR" ]] && [[ "$doc_path" == "$TETRA_DIR"* ]]; then
        display_path="~/.tetra/${doc_path#$TETRA_DIR/}"
    fi

    # Fixed column widths for consistent alignment
    local cols="${COLUMNS:-120}"
    local category_width=5      # "CORE" or "OTHER"
    local type_width=16          # Type name
    local module_width=12        # Module name (or empty)
    local spacing=8              # Total spacing (2 spaces between each column)

    # Calculate path width: total - (number + category + type + module + spacing)
    # Account for number prefix if present (e.g., "  1. " = 5 chars)
    local path_max_width=$((cols - number_width - category_width - type_width - module_width - spacing))

    # Ensure minimum path width
    [[ $path_max_width -lt 35 ]] && path_max_width=35

    # Truncate path if needed
    display_path=$(_tdoc_truncate_path "$display_path" "$path_max_width")

    # Determine if this is a fresh doc (recency boost > 0.01 means < 7 days old for notes)
    local is_fresh=false
    if [[ -n "$recency_boost" ]] && command -v awk >/dev/null 2>&1; then
        is_fresh=$(awk "BEGIN {print ($recency_boost > 0.01) ? 1 : 0}")
    fi

    # Render with colors if TDS available
    if [[ "$TDS_LOADED" == "true" ]]; then
        # Path using TDS token (left-aligned, fixed width)
        tds_text_color "tdocs.list.path"
        printf "%-${path_max_width}s" "$display_path"
        reset_color
        printf "  "

        # Category badge using TDS token (fixed width)
        if [[ "$category" == "core" ]]; then
            tds_text_color "tdocs.category.core"
        else
            tds_text_color "tdocs.category.other"
        fi
        printf "%-${category_width}s" "$(echo "$category" | tr '[:lower:]' '[:upper:]')"
        reset_color
        printf "  "

        # Type using TDS token (left-aligned, fixed width)
        local type_token="tdocs.type.${type}"
        # Fallback to default if specific type token doesn't exist
        if [[ -z "${TDS_COLOR_TOKENS[$type_token]:-}" ]]; then
            type_token="text.secondary"
        fi
        tds_text_color "$type_token"
        printf "%-${type_width}s" "$type"
        reset_color
        printf "  "

        # Module using TDS token (left-aligned, fixed width)
        tds_text_color "tdocs.module"
        printf "%-${module_width}s" "${module}"
        reset_color

        # Rank (dim grey, right-aligned)
        if [[ -n "$rank" ]]; then
            printf "  \033[2;37m%5s\033[0m" "$rank"
            # Add "fresh" hint for recent notes
            if [[ "$is_fresh" == "1" ]]; then
                printf " \033[2;37mfresh\033[0m"
            fi
        fi
    else
        # Fallback without colors (fixed widths)
        printf "%-${path_max_width}s  %-${category_width}s  %-${type_width}s  %-${module_width}s" \
            "$display_path" \
            "$(echo "$category" | tr '[:lower:]' '[:upper:]')" \
            "$type" \
            "${module}"
        # Rank in plaintext
        if [[ -n "$rank" ]]; then
            printf "  %5s" "$rank"
            [[ "$is_fresh" == "1" ]] && printf " fresh"
        fi
    fi
}

# Render detailed view: front matter on line 1 (gray), file on line 2, then first 5 lines
tdoc_render_detailed() {
    local meta_json="$1"
    local doc_path="$2"

    # Extract metadata
    local category=$(echo "$meta_json" | grep -o '"category": "[^"]*"' | cut -d'"' -f4)
    local type=$(echo "$meta_json" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local module=$(echo "$meta_json" | grep -o '"module": "[^"]*"' | cut -d'"' -f4)
    local title=$(echo "$meta_json" | grep -o '"title": "[^"]*"' | cut -d'"' -f4)

    # Get display path
    local display_path="$doc_path"
    if [[ -n "$TETRA_SRC" ]] && [[ "$doc_path" == "$TETRA_SRC"* ]]; then
        display_path="${doc_path#$TETRA_SRC/}"
    elif [[ -n "$TETRA_DIR" ]] && [[ "$doc_path" == "$TETRA_DIR"* ]]; then
        display_path="~/.tetra/${doc_path#$TETRA_DIR/}"
    fi

    # Calculate available width (account for 2-space indent and terminal width)
    local cols="${COLUMNS:-120}"
    local indent=2
    local max_line_width=$((cols - indent))

    # Line 1: Front matter in gray (compact)
    local front_matter="${category} | ${type}"
    [[ -n "$module" ]] && front_matter="${front_matter} | ${module}"
    [[ -n "$title" ]] && front_matter="${front_matter} | ${title}"

    # Truncate front matter if too long
    if [[ ${#front_matter} -gt $max_line_width ]]; then
        front_matter="${front_matter:0:$((max_line_width - 3))}..."
    fi

    printf "\033[38;5;246m%s\033[0m\n" "$front_matter"

    # Line 2: File path (colored based on category, truncated if needed)
    # Truncate display path to fit
    if [[ ${#display_path} -gt $max_line_width ]]; then
        display_path=$(_tdoc_truncate_path "$display_path" "$max_line_width")
    fi

    printf "  "
    if [[ "$category" == "core" ]]; then
        tds_text_color "tdocs.category.core" 2>/dev/null || printf "\033[38;5;33m"
    else
        tds_text_color "tdocs.category.other" 2>/dev/null || printf "\033[38;5;214m"
    fi
    printf "%s" "$display_path"
    reset_color 2>/dev/null || printf "\033[0m"
    printf "\n"

    # First 5 lines of document content (indented, gray, wrapped at terminal width)
    if [[ -f "$doc_path" ]]; then
        printf "\033[38;5;246m"  # Gray
        local content_width=$((cols - 4))  # 4-space indent
        head -n 5 "$doc_path" | fold -w "$content_width" -s | sed 's/^/    /'
        printf "\033[0m"
    fi
}
