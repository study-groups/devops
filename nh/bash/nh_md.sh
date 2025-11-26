#!/usr/bin/env bash
# nh_md.sh - Markdown Section Parser and Navigator
#
# Parses markdown files into navigable sections with tab completion.
# Uses associative arrays to track section boundaries.
#
# Usage:
#   nh_md_parse "/path/to/file.md"   # Parse and populate arrays
#   nh_md_list                        # List all sections
#   nh_md_show "1.1"                  # Show section content
#   nh_md_keys                        # List just the keys (for completion)

# Section data - populated by nh_md_parse
declare -gA NH_MD_START=()    # key -> start line
declare -gA NH_MD_END=()      # key -> end line
declare -gA NH_MD_TITLE=()    # key -> title text
declare -gA NH_MD_LEVEL=()    # key -> header level (1-6) or 99 for steps
declare -gA NH_MD_TYPE=()     # key -> "header" or "step"
declare -ga NH_MD_ORDER=()    # ordered list of keys
declare -ga NH_MD_STEPS=()    # ordered list of step keys only (01, 02, ...)
declare -g  NH_MD_FILE=""     # current parsed file

# =============================================================================
# KEY EXTRACTION
# =============================================================================

# Extract a completion-friendly key from a header or step line
# "## Phase 1: DigitalOcean Setup" -> "phase1"
# "### 1.1 Create Account" -> "1.1"
# "## Quick Reference" -> "quick"
# "- [ ] **01** Create Account" -> "01"
nh_md_extract_key() {
    local title="$1"

    # Pattern 0: Checkbox step format "- [ ] **01** Title" or "- [x] **01** Title"
    if [[ "$title" =~ ^\-[[:space:]]*\[[[:space:]]?[xX]?\][[:space:]]*\*\*([0-9]+)\*\* ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    # Remove leading # symbols and whitespace (for header lines)
    title="${title#"${title%%[!#]*}"}"
    title="${title#"${title%%[![:space:]]*}"}"

    # Pattern 1: Numbered prefix like "1.1", "2.3.4"
    if [[ "$title" =~ ^([0-9]+(\.[0-9]+)*) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    # Pattern 2: "Phase N:" style
    if [[ "$title" =~ ^[Pp]hase[[:space:]]+([0-9]+) ]]; then
        echo "phase${BASH_REMATCH[1]}"
        return
    fi

    # Pattern 3: First word, lowercased
    local first_word="${title%% *}"
    first_word="${first_word,,}"  # lowercase
    first_word="${first_word//[^a-z0-9]/_}"  # sanitize
    echo "$first_word"
}

# Extract title from a step line "- [ ] **01** Create Account" -> "Create Account"
nh_md_extract_step_title() {
    local line="$1"
    if [[ "$line" =~ ^\-[[:space:]]*\[[[:space:]]?[xX]?\][[:space:]]*\*\*[0-9]+\*\*[[:space:]]*(.+)$ ]]; then
        echo "${BASH_REMATCH[1]}"
    fi
}

# Check if line is a step (checkbox with number)
nh_md_is_step() {
    local line="$1"
    [[ "$line" =~ ^\-[[:space:]]*\[[[:space:]]?[xX]?\][[:space:]]*\*\*[0-9]+\*\* ]]
}

# Get header level from line (count # symbols)
nh_md_header_level() {
    local line="$1"
    local hashes="${line%%[^#]*}"
    echo "${#hashes}"
}

# =============================================================================
# PARSER
# =============================================================================

# Parse a markdown file into section arrays
nh_md_parse() {
    local file="$1"

    [[ -z "$file" ]] && { echo "Usage: nh_md_parse <file>"; return 1; }
    [[ ! -f "$file" ]] && { echo "File not found: $file"; return 1; }

    # Clear previous data
    NH_MD_START=()
    NH_MD_END=()
    NH_MD_TITLE=()
    NH_MD_LEVEL=()
    NH_MD_TYPE=()
    NH_MD_ORDER=()
    NH_MD_STEPS=()
    NH_MD_FILE="$file"

    local line_num=0
    local prev_key=""
    local in_code_block=false
    local key title level item_type

    # First pass: collect all headers and steps
    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))

        # Track code block state (``` toggles)
        if [[ "$line" =~ ^\`\`\` ]]; then
            if $in_code_block; then
                in_code_block=false
            else
                in_code_block=true
            fi
            continue
        fi

        # Skip if inside code block
        $in_code_block && continue

        key=""
        title=""
        level=0
        item_type=""

        # Match step lines (- [ ] **01** Title)
        if nh_md_is_step "$line"; then
            key=$(nh_md_extract_key "$line")
            title=$(nh_md_extract_step_title "$line")
            level=99  # Steps are "deeper" than headers for display
            item_type="step"
        # Match header lines (# through ######)
        elif [[ "$line" =~ ^#{1,6}[[:space:]] ]]; then
            level=$(nh_md_header_level "$line")
            key=$(nh_md_extract_key "$line")
            item_type="header"

            # Extract title (remove # prefix)
            title="${line#"${line%%[^#]*}"}"
            title="${title#"${title%%[![:space:]]*}"}"
        fi

        # Process if we found a key
        if [[ -n "$key" ]]; then
            # Handle duplicate keys by appending suffix
            if [[ -v NH_MD_START["$key"] ]]; then
                local suffix=2
                while [[ -v NH_MD_START["${key}_${suffix}"] ]]; do
                    ((suffix++))
                done
                key="${key}_${suffix}"
            fi

            # Close previous section
            if [[ -n "$prev_key" ]]; then
                NH_MD_END["$prev_key"]=$((line_num - 1))
            fi

            # Record this section
            NH_MD_START["$key"]=$line_num
            NH_MD_TITLE["$key"]="$title"
            NH_MD_LEVEL["$key"]=$level
            NH_MD_TYPE["$key"]=$item_type
            NH_MD_ORDER+=("$key")

            # Track steps separately
            if [[ "$item_type" == "step" ]]; then
                NH_MD_STEPS+=("$key")
            fi

            prev_key="$key"
        fi
    done < "$file"

    # Close final section
    if [[ -n "$prev_key" ]]; then
        NH_MD_END["$prev_key"]=$line_num
    fi

    echo "Parsed ${#NH_MD_ORDER[@]} sections (${#NH_MD_STEPS[@]} steps) from $file"
}

# =============================================================================
# DISPLAY
# =============================================================================

# List all sections with line numbers
nh_md_list() {
    [[ ${#NH_MD_ORDER[@]} -eq 0 ]] && { echo "No sections. Run nh_md_parse first"; return 1; }

    printf "%-6s %6s %6s  %s\n" "KEY" "START" "END" "TITLE"
    printf "%s\n" "$(printf '%.0s-' {1..70})"

    for key in "${NH_MD_ORDER[@]}"; do
        local indent=""
        local level=${NH_MD_LEVEL[$key]}
        local item_type=${NH_MD_TYPE[$key]}

        if [[ "$item_type" == "step" ]]; then
            # Steps get checkbox display with indent
            printf "%-6s %6d %6d    [ ] %s\n" \
                "$key" \
                "${NH_MD_START[$key]}" \
                "${NH_MD_END[$key]}" \
                "${NH_MD_TITLE[$key]}"
        else
            # Headers - indent based on level
            local indent_size=$(( (level - 1) * 2 ))
            ((indent_size > 0)) && indent=$(printf '%*s' "$indent_size" '')

            printf "%-6s %6d %6d  %s%s\n" \
                "$key" \
                "${NH_MD_START[$key]}" \
                "${NH_MD_END[$key]}" \
                "$indent" \
                "${NH_MD_TITLE[$key]}"
        fi
    done
}

# List only step keys (01, 02, ...)
nh_md_step_keys() {
    printf '%s\n' "${NH_MD_STEPS[@]}"
}

# List just keys (for completion)
nh_md_keys() {
    printf '%s\n' "${NH_MD_ORDER[@]}"
}

# Show content of a section
nh_md_show() {
    local key="$1"
    local lines="${2:-20}"  # default to 20 lines

    [[ -z "$key" ]] && { echo "Usage: nh_md_show <key> [lines]"; return 1; }
    [[ ! -v NH_MD_START["$key"] ]] && { echo "Unknown section: $key"; return 1; }

    local start=${NH_MD_START[$key]}
    local end=${NH_MD_END[$key]}
    local count=$((end - start + 1))

    # Limit output
    ((count > lines)) && count=$lines

    echo "─── ${NH_MD_TITLE[$key]} (lines $start-$end) ───"
    sed -n "${start},$((start + count - 1))p" "$NH_MD_FILE"

    if ((end - start + 1 > lines)); then
        echo "..."
        echo "[$(( end - start + 1 - lines )) more lines]"
    fi
}

# Show section with context highlighting
nh_md_preview() {
    local key="$1"

    [[ -z "$key" ]] && { echo "Usage: nh_md_preview <key>"; return 1; }
    [[ ! -v NH_MD_START["$key"] ]] && { echo "Unknown section: $key"; return 1; }

    local start=${NH_MD_START[$key]}
    local end=${NH_MD_END[$key]}

    # Use bat if available for syntax highlighting
    if command -v bat &>/dev/null; then
        sed -n "${start},${end}p" "$NH_MD_FILE" | bat -l md --style=plain
    else
        nh_md_show "$key" 50
    fi
}

# =============================================================================
# COMPLETION HELPERS
# =============================================================================

# Get children of a section (sections that start with key prefix)
nh_md_children() {
    local parent="$1"
    local pattern=""

    # Determine the child pattern based on parent type
    # phase1 -> children match "1.*"
    # 1 -> children match "1.*"
    if [[ "$parent" =~ ^phase([0-9]+)$ ]]; then
        pattern="^${BASH_REMATCH[1]}\."
    elif [[ "$parent" =~ ^([0-9]+)$ ]]; then
        pattern="^${BASH_REMATCH[1]}\."
    else
        pattern="^${parent}"
    fi

    for key in "${NH_MD_ORDER[@]}"; do
        [[ "$key" == "$parent" ]] && continue
        [[ "$key" =~ $pattern ]] && echo "$key"
    done
}

# Get top-level sections (for initial completion)
nh_md_toplevel() {
    for key in "${NH_MD_ORDER[@]}"; do
        local level=${NH_MD_LEVEL[$key]}
        ((level <= 2)) && echo "$key"
    done
}

# =============================================================================
# DEBUG
# =============================================================================

nh_md_debug() {
    echo "File: $NH_MD_FILE"
    echo "Sections: ${#NH_MD_ORDER[@]}"
    echo ""
    echo "NH_MD_ORDER: ${NH_MD_ORDER[*]}"
    echo ""
    echo "Arrays:"
    for key in "${NH_MD_ORDER[@]}"; do
        printf "  %s: start=%d end=%d level=%d title='%s'\n" \
            "$key" \
            "${NH_MD_START[$key]}" \
            "${NH_MD_END[$key]}" \
            "${NH_MD_LEVEL[$key]}" \
            "${NH_MD_TITLE[$key]}"
    done
}

# Export functions
export -f nh_md_parse nh_md_list nh_md_keys nh_md_step_keys nh_md_show nh_md_preview
export -f nh_md_extract_key nh_md_extract_step_title nh_md_is_step nh_md_header_level
export -f nh_md_children nh_md_toplevel nh_md_debug
