#!/usr/bin/env bash

# Simple TOML Navigator
# Clean, focused implementation for navigating TOML files

toml_navigate() {
    local toml_file="${1:-$ACTIVE_TOML}"

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: TOML file not found: $toml_file"
        return 1
    fi

    # Parse sections from TOML file
    local sections=()
    while IFS= read -r line; do
        if [[ $line =~ ^\[([^\]]+)\] ]]; then
            sections+=("${BASH_REMATCH[1]}")
        fi
    done < "$toml_file"

    if [[ ${#sections[@]} -eq 0 ]]; then
        echo "No sections found in $toml_file"
        return 1
    fi

    local current_index=0
    local max_index=$((${#sections[@]} - 1))

    # Main navigation loop
    while true; do
        # Clear screen and show header
        clear
        echo "🔧 TOML Navigator - $(basename "$toml_file")"
        echo "═══════════════════════════════════════════"
        echo ""

        # Show sections with current highlighted
        for i in "${!sections[@]}"; do
            if [[ $i -eq $current_index ]]; then
                echo "→ [${sections[$i]}]"
            else
                echo "  [${sections[$i]}]"
            fi
        done

        echo ""
        echo "Keys: i=up, k=down, l=expand, j=exit, ESC=back"
        echo ""

        # Read single key
        read -n1 -s key

        case "$key" in
            'i'|'I')
                # Move up
                if [[ $current_index -gt 0 ]]; then
                    ((current_index--))
                fi
                ;;
            'k'|'K')
                # Move down
                if [[ $current_index -lt $max_index ]]; then
                    ((current_index++))
                fi
                ;;
            'l'|'L')
                # Expand section - show variables
                show_section_content "$toml_file" "${sections[$current_index]}"
                ;;
            'j'|'J')
                # Exit
                echo "Exiting TOML navigator"
                break
                ;;
            $'\e'|$'\033')
                # ESC - back/exit
                echo "Exiting TOML navigator"
                break
                ;;
            *)
                # Ignore other keys
                ;;
        esac
    done
}

# Show content of a specific section
show_section_content() {
    local toml_file="$1"
    local section_name="$2"

    clear
    echo "📄 Section: [$section_name]"
    echo "═══════════════════════════════════════════"
    echo ""

    local in_section=false
    local content_shown=false

    while IFS= read -r line; do
        # Check if we've entered our target section
        if [[ $line =~ ^\[([^\]]+)\] ]]; then
            if [[ "${BASH_REMATCH[1]}" == "$section_name" ]]; then
                in_section=true
                continue
            else
                # Entered a different section, stop
                if [[ $in_section == true ]]; then
                    break
                fi
            fi
        fi

        # Show content if we're in the target section
        if [[ $in_section == true ]]; then
            if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
                echo "  $line"
                content_shown=true
            fi
        fi
    done < "$toml_file"

    if [[ $content_shown == false ]]; then
        echo "  (empty section)"
    fi

    echo ""
    echo "Press any key to return..."
    read -n1 -s
}

# Export the main function
export -f toml_navigate