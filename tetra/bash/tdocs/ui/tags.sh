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

# Get color for a tag using round-robin through palette slots [1-7]
# Uses simple hash of tag name to pick palette and index
_tdoc_get_tag_color() {
    local tag="$1"

    # Hash tag name to number (sum of character codes)
    local hash=0
    local len=${#tag}
    for ((i=0; i<len; i++)); do
        local char="${tag:$i:1}"
        local code=$(printf '%d' "'$char")
        hash=$((hash + code))
    done

    # Pick palette (0-3) using modulo
    local palettes=("env" "mode" "verbs" "nouns")
    local palette_idx=$((hash % 4))
    local palette="${palettes[$palette_idx]}"

    # Pick slot [1-7] using modulo (skip [0] which is used by categories)
    local color_idx=$(( (hash / 4) % 7 + 1 ))

    echo "${palette}:${color_idx}"
}

# Render a tag with color coding
tdoc_render_tag() {
    local tag="$1"
    local show_symbol="${2:-true}"

    # Skip empty tags
    [[ -z "$tag" ]] && return 0

    # Get color for this tag
    local palette_ref
    if [[ -n "${TDOC_TAG_COLORS[$tag]}" ]]; then
        # Use predefined color if available
        palette_ref="${TDOC_TAG_COLORS[$tag]}"
    else
        # Use round-robin palette selection
        palette_ref=$(_tdoc_get_tag_color "$tag")
    fi

    # Render with color
    if [[ "$TDS_LOADED" == "true" ]]; then
        tds_text_color "$palette_ref"
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
    local detailed="${4:-false}"  # Optional: show detailed metadata on additional lines

    # If doc_path not provided, try to extract from metadata
    if [[ -z "$doc_path" ]]; then
        doc_path=$(echo "$meta_json" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
    fi

    # Extract new schema fields - simple grep is faster for bash
    local type=$(echo "$meta_json" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local intent=$(echo "$meta_json" | grep -o '"intent": "[^"]*"' | cut -d'"' -f4)
    local lifecycle=$(echo "$meta_json" | grep -o '"lifecycle": "[^"]*"' | cut -d'"' -f4)
    local module=$(echo "$meta_json" | grep -o '"module": "[^"]*"' | cut -d'"' -f4)
    local rank=$(echo "$meta_json" | grep -o '"rank": [0-9.]*' | cut -d' ' -f2)
    local recency_boost=$(echo "$meta_json" | grep -o '"recency_boost": [0-9.]*' | cut -d' ' -f2)
    local tags_json=$(echo "$meta_json" | tr -d '\n' | grep -o '"tags": *\[[^]]*\]' | sed 's/"tags": *//')
    local created=$(echo "$meta_json" | grep -o '"created": "[^"]*"' | cut -d'"' -f4)
    local updated=$(echo "$meta_json" | grep -o '"updated": "[^"]*"' | cut -d'"' -f4)
    local has_frontmatter=$(echo "$meta_json" | grep -o '"has_frontmatter": [^,}]*' | cut -d' ' -f2)
    local title=$(echo "$meta_json" | grep -o '"title": "[^"]*"' | cut -d'"' -f4)

    # Format tags for inline display (first 3 tags, comma-separated)
    local tags_display=""
    if [[ -n "$tags_json" ]]; then
        local tag_array=()
        while IFS= read -r tag; do
            [[ -z "$tag" ]] && continue
            tag_array+=("$tag")
        done < <(echo "$tags_json" | grep -o '"[^"]*"' | tr -d '"')

        # Take first 3 tags
        local tag_count=${#tag_array[@]}
        if [[ $tag_count -gt 0 ]]; then
            tags_display="${tag_array[0]}"
            [[ $tag_count -gt 1 ]] && tags_display+=",${tag_array[1]}"
            [[ $tag_count -gt 2 ]] && tags_display+=",${tag_array[2]}"
        fi
    fi

    # Get display path and filename
    local filename=$(basename "$doc_path" 2>/dev/null)
    local display_name="${filename:-[no path]}"

    # Fallback: if doc_path is empty, use a placeholder
    if [[ -z "$doc_path" ]]; then
        display_name="[missing doc_path]"
    fi

    local display_path="$doc_path"
    if [[ -n "$TETRA_SRC" ]] && [[ "$doc_path" == "$TETRA_SRC"* ]]; then
        display_path="${doc_path#$TETRA_SRC/}"
    elif [[ -n "$TETRA_DIR" ]] && [[ "$doc_path" == "$TETRA_DIR"* ]]; then
        display_path="~/.tetra/${doc_path#$TETRA_DIR/}"
    fi

    # Fixed column widths for consistent alignment (tight one-liner)
    # Optimized for 80-column terminals to prevent wrapping
    local name_width=32          # Name/title
    local type_width=18          # Type name (spec, guide, etc)
    local module_width=12        # Module name (or empty)

    # Truncate display name if needed
    if [[ ${#display_name} -gt $name_width ]]; then
        display_name="${display_name:0:$((name_width - 3))}..."
    fi

    # Determine if this is a fresh doc (recency boost > 0.01 means < 7 days old for notes)
    local is_fresh=false
    if [[ -n "$recency_boost" ]] && command -v awk >/dev/null 2>&1; then
        is_fresh=$(awk "BEGIN {print ($recency_boost > 0.01) ? 1 : 0}")
    fi

    # Build colored tags array for display
    local -a colored_tags_array=()
    if [[ -n "$tags_json" ]]; then
        # Use simple cycling color scheme for tags
        local tag_colors=(33 39 45 51 87 117 123 159)  # Blue/cyan spectrum

        local tag_index=0
        while IFS= read -r tag; do
            [[ -z "$tag" ]] && continue

            # Cycle through colors
            local color_num="${tag_colors[$((tag_index % 8))]}"
            colored_tags_array+=("$(printf '\033[38;5;%dm%s\033[0m' "$color_num" "$tag")")
            ((tag_index++))
        done < <(echo "$tags_json" | grep -o '"[^"]*"' | tr -d '"')
    fi

    # Join colored tags with commas
    local colored_tags_display=""
    if [[ ${#colored_tags_array[@]} -gt 0 ]]; then
        colored_tags_display="${colored_tags_array[0]}"
        for ((i=1; i<${#colored_tags_array[@]}; i++)); do
            colored_tags_display+=",${colored_tags_array[$i]}"
        done
    fi

    # Render single line
    if [[ "$detailed" == "true" ]]; then
        # Detailed mode: just show filename/title (with newline)
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "tdocs.list.path"
            printf "%s\033[0m\n" "$display_name"
        else
            printf "%s\n" "$display_name"
        fi
    else
        # Normal mode: clean compact format
        if [[ "$TDS_LOADED" == "true" ]]; then
            # Filename (left-aligned, padded to match name_width)
            tds_text_color "tdocs.list.path"
            printf "%-${name_width}s" "$display_name"
            printf "\033[0m"

            # Type (using type_width)
            local type_token="tdocs.type.${type}"
            [[ -z "${TDS_COLOR_TOKENS[$type_token]:-}" ]] && type_token="text.secondary"
            tds_text_color "$type_token"
            printf "%-${type_width}s" "${type:-scratch}"
            printf "\033[0m"

            # Module (using module_width)
            if [[ -n "$module" ]]; then
                tds_text_color "tdocs.module"
                printf "%-${module_width}s" "$module"
                printf "\033[0m"
            else
                printf "%-${module_width}s" ""
            fi

            # Tags (colorized)
            if [[ -n "$colored_tags_display" ]]; then
                printf "%s" "$colored_tags_display"
            fi

            # Explicit newline in normal mode
            printf "\n"
        else
            # Fallback without colors - clean compact format
            printf "%-${name_width}s" "$display_name"

            # Type
            printf "%-${type_width}s" "${type:-scratch}"

            # Module
            [[ -n "$module" ]] && printf "%-${module_width}s" "$module" || printf "%-${module_width}s" ""

            # Tags (plain text)
            [[ -n "$tags_display" ]] && printf "%s" "$tags_display"

            # Explicit newline in normal mode (fallback)
            printf "\n"
        fi
    fi

    # If detailed mode, add metadata on indented lines
    if [[ "$detailed" == "true" ]]; then
        # Format dates (remove time, just show date)
        local created_date="${created%%T*}"
        local updated_date="${updated%%T*}"

        # Determine date display: created, or "modified" if different
        local date_display=""
        if [[ -n "$created_date" ]]; then
            if [[ -n "$updated_date" ]] && [[ "$updated_date" != "$created_date" ]]; then
                date_display="$created_date (modified)"
            else
                date_display="$created_date"
            fi
        fi

        # Build metadata line with colored tags using TDS MODE 8 colors
        local tag_palette=()
        if [[ -n "${MODE_PRIMARY[0]}" ]]; then
            tag_palette=("${MODE_PRIMARY[@]}")
        else
            tag_palette=(9 10 11 12 13 14 15 208)
        fi

        # Parse individual tags and color them - each tag gets next color in cycle
        local colored_tags=""
        if [[ -n "$tags_json" ]]; then
            local tag_index=0
            while IFS= read -r tag; do
                [[ -z "$tag" ]] && continue

                # Cycle through 8 colors
                local color_value="${tag_palette[$((tag_index % 8))]}"

                if [[ -n "$colored_tags" ]]; then
                    colored_tags+=","
                fi

                # Check if hex (TDS) or numeric (ANSI)
                if [[ "$color_value" =~ ^[0-9A-Fa-f]{6}$ ]]; then
                    # TDS hex - convert to RGB with dimming
                    local r=$((16#${color_value:0:2}))
                    local g=$((16#${color_value:2:2}))
                    local b=$((16#${color_value:4:2}))
                    colored_tags+="\033[2;38;2;${r};${g};${b}m${tag}\033[0m"
                else
                    # ANSI 256 foreground color with dimming
                    colored_tags+="\033[2;38;5;${color_value}m${tag}\033[0m"
                fi
                ((tag_index++))
            done < <(echo "$tags_json" | grep -o '"[^"]*"' | tr -d '"')
        fi

        # Colorize type and kind using palette colors (dimmed)
        local type_color=""
        local kind_color=""

        # Type uses NOUNS palette (first color)
        if [[ -n "${tag_palette[0]}" ]]; then
            local color_value="${tag_palette[0]}"
            if [[ "$color_value" =~ ^[0-9A-Fa-f]{6}$ ]]; then
                # TDS hex color (6-digit hex) - convert to RGB
                local r=$((16#${color_value:0:2}))
                local g=$((16#${color_value:2:2}))
                local b=$((16#${color_value:4:2}))
                type_color="\033[2;38;2;${r};${g};${b}m${type}\033[0m"
            else
                type_color="\033[2;38;5;${color_value}m${type}\033[0m"
            fi
        else
            type_color="${type}"
        fi

        # Kind uses VERBS palette (second color)
        if [[ -n "$kind" ]] && [[ -n "${tag_palette[1]}" ]]; then
            local color_value="${tag_palette[1]}"
            if [[ "$color_value" =~ ^[0-9A-Fa-f]{6}$ ]]; then
                # TDS hex color (6-digit hex) - convert to RGB
                local r=$((16#${color_value:0:2}))
                local g=$((16#${color_value:2:2}))
                local b=$((16#${color_value:4:2}))
                kind_color="\033[2;38;2;${r};${g};${b}m${kind}\033[0m"
            else
                kind_color="\033[2;38;5;${color_value}m${kind}\033[0m"
            fi
        fi

        # Print path on first indented line (dimmed)
        printf "     \033[2m%s\033[0m\n" "$display_path"

        # Print metadata line in a readable format with labels
        # Format: type kind module:value authority:value date tags:[...]
        printf "     "

        # Type (use plain text, dimmed)
        if [[ -n "$type" ]]; then
            printf "\033[2m%s\033[0m " "$type"
        fi

        # Kind (dimmed)
        if [[ -n "$kind" ]]; then
            printf "\033[2m%s\033[0m " "$kind"
        fi

        # Module (if present)
        [[ -n "$module" ]] && printf "module:\033[36m%s\033[0m " "$module"

        # Authority
        [[ -n "$authority" ]] && printf "auth:\033[33m%s\033[0m " "$authority"

        # Date
        [[ -n "$date_display" ]] && printf "%s " "$date_display"

        # Tags (colored)
        if [[ -n "$colored_tags" ]]; then
            printf "tags:%b " "$colored_tags"
        fi

        # Frontmatter indicator (if missing)
        if [[ "$has_frontmatter" != "true" ]]; then
            printf " \033[2;31m[no-fm]\033[0m"
        fi

        printf "\n"
    fi

    return 0
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
