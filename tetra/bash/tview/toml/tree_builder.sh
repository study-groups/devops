#!/usr/bin/env bash

# TOML Tree Builder Micro-Module
# Builds hierarchical tree structures from TOML files

# Build expandable TOML tree structure
build_toml_tree() {
    local selected_index="${1:-$CURRENT_ITEM}"

    if [[ ! -f "$ACTIVE_TOML" ]]; then
        echo "   No TOML file loaded"
        return 1
    fi

    # Ensure multispan tracking is available
    if [[ ${#ACTIVE_MULTISPANS[@]} -eq 0 ]]; then
        refresh_multispan_tracking
    fi

    local tree_output=""
    local section_count=0

    for span in "${ACTIVE_MULTISPANS[@]}"; do
        local location="${MULTISPAN_LOCATIONS[$span]}"
        local line_range=$(echo "$location" | cut -d: -f2)

        if [[ $section_count -eq $selected_index ]]; then
            # Expanded section
            tree_output+="   $(highlight_line "▼ [$span] (lines $line_range)" "true" "$MODE_TOML_COLOR")\n"
            tree_output+="$(expand_toml_section "$span")\n"
        else
            # Collapsed section
            tree_output+="   $(highlight_line "▶ [$span] (lines $line_range)" "false" "$UI_MUTED_COLOR")\n"
        fi

        ((section_count++))
    done

    echo -e "$tree_output"
}

# Expand a specific TOML section
expand_toml_section() {
    local section_name="$1"
    local location="${MULTISPAN_LOCATIONS[$section_name]}"

    if [[ -z "$location" ]]; then
        echo "       ${UI_MUTED_COLOR}Section not found${COLOR_RESET}"
        return 1
    fi

    local file_path=$(echo "$location" | cut -d: -f1)
    local line_range=$(echo "$location" | cut -d: -f2)
    local start_line=$(echo "$line_range" | cut -d- -f1)
    local end_line=$(echo "$line_range" | cut -d- -f2)

    # Extract section content (skip the [section] line itself)
    local section_content=$(sed -n "$((start_line + 1)),${end_line}p" "$file_path")

    local output=""
    local line_num=$((start_line + 1))

    while IFS= read -r line; do
        [[ -z "$line" ]] && { ((line_num++)); continue; }

        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"

            # Format variable with source tracking
            output+="       ${UI_ACCENT_COLOR}├─${COLOR_RESET} ${ACTION_CONFIG_COLOR}$var_name${COLOR_RESET} = $var_value"

            # Add variable source indicator
            if [[ -n "${VARIABLE_SOURCE_MAP[$var_name]}" ]]; then
                output+=" ${UI_MUTED_COLOR}→ tracked${COLOR_RESET}"
            fi
            output+=" ${UI_MUTED_COLOR}(line $line_num)${COLOR_RESET}\n"
        else
            # Regular content or subsections
            if [[ "$line" =~ ^\[[^\]]+\]$ ]]; then
                # Nested subsection
                output+="       ${UI_ACCENT_COLOR}├─${COLOR_RESET} ${MODE_TOML_COLOR}$line${COLOR_RESET} ${UI_MUTED_COLOR}(line $line_num)${COLOR_RESET}\n"
            else
                # Comment or other content
                output+="       ${UI_MUTED_COLOR}│  $line${COLOR_RESET}\n"
            fi
        fi
        ((line_num++))
    done <<< "$section_content"

    echo -e "$output"
}

# Get section summary info
get_section_info() {
    local section_name="$1"
    local location="${MULTISPAN_LOCATIONS[$section_name]}"

    if [[ -z "$location" ]]; then
        echo "unknown"
        return 1
    fi

    local file_path=$(echo "$location" | cut -d: -f1)
    local line_range=$(echo "$location" | cut -d: -f2)
    local start_line=$(echo "$line_range" | cut -d- -f1)
    local end_line=$(echo "$line_range" | cut -d- -f2)

    # Count variables in section
    local var_count=$(sed -n "${start_line},${end_line}p" "$file_path" | grep -c "^[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=" 2>/dev/null || echo "0")
    local line_count=$((end_line - start_line))

    echo "$var_count vars, $line_count lines"
}

# Navigate to next/previous section
navigate_section() {
    local direction="$1"  # "next" or "prev"
    local current_index="${2:-$CURRENT_ITEM}"

    local section_count=${#ACTIVE_MULTISPANS[@]}

    case "$direction" in
        "next")
            echo $(( (current_index + 1) % section_count ))
            ;;
        "prev")
            echo $(( (current_index - 1 + section_count) % section_count ))
            ;;
        *)
            echo "$current_index"
            ;;
    esac
}