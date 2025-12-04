#!/usr/bin/env bash
# evidence_manager.sh - Enhanced evidence management with toggle and feedback
#
# Provides interactive evidence management: list, toggle, status, budget

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Source dependencies
source "$RAG_SRC/core/flow_manager_ttm.sh"

# Estimate tokens from bytes (rough: 1 token ≈ 4 bytes)
estimate_tokens() {
    local bytes="$1"
    echo $((bytes / 4))
}

# Get evidence status (active/skipped)
get_evidence_status() {
    local file="$1"
    if [[ "$file" =~ \.skip$ ]]; then
        echo "skipped"
    elif [[ -L "$file" ]]; then
        echo "linked"
    else
        echo "active"
    fi
}

# List evidence with detailed information
evidence_list() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"

    if [[ ! -d "$evidence_dir" ]]; then
        echo "No evidence directory found"
        return 0
    fi

    # Find all evidence files (including .skip)
    local files=()
    while IFS= read -r -d '' file; do
        files+=("$file")
    done < <(find "$evidence_dir" -type f \( -name "*.evidence.md" -o -name "*.evidence.md.skip" \) -print0 | sort -z)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No evidence files found"
        return 0
    fi

    # Color support
    local COLOR_ENABLED=0
    if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
        source "$TETRA_SRC/bash/color/color_core.sh" 2>/dev/null
        COLOR_ENABLED=1
    fi

    if [[ $COLOR_ENABLED -eq 1 ]]; then
        echo "$(text_color "565F89")═══════════$(reset_color) $(text_color "BB9AF7")Evidence Files and Spans$(reset_color) $(text_color "565F89")═══════════$(reset_color)"
    else
        echo "═══════════ Evidence Files and Spans ═══════════"
    fi
    echo ""

    local total_bytes=0
    local active_bytes=0
    local index=1
    local active_count=0
    local skipped_count=0

    for file in "${files[@]}"; do
        local basename=$(basename "$file")
        local rank=$(echo "$basename" | cut -d'_' -f1)
        local status=$(get_evidence_status "$file")
        local bytes=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
        local tokens=$(estimate_tokens "$bytes")

        total_bytes=$((total_bytes + bytes))

        if [[ "$status" == "active" ]]; then
            active_bytes=$((active_bytes + bytes))
            active_count=$((active_count + 1))

            if [[ $COLOR_ENABLED -eq 1 ]]; then
                printf "  $(text_color "9ECE6A")✓$(reset_color) $(text_color "7AA2F7")\$e%-2d$(reset_color) [%3s] %s $(text_color "565F89")(%d bytes, ~%d tokens)$(reset_color)\n" \
                    "$index" "$rank" "${basename%.evidence.md}" "$bytes" "$tokens"
            else
                printf "  ✓ \$e%-2d [%3s] %s (%d bytes, ~%d tokens)\n" \
                    "$index" "$rank" "${basename%.evidence.md}" "$bytes" "$tokens"
            fi
            index=$((index + 1))
        elif [[ "$status" == "skipped" ]]; then
            skipped_count=$((skipped_count + 1))
            local display_name="${basename%.evidence.md.skip}"

            if [[ $COLOR_ENABLED -eq 1 ]]; then
                printf "  $(text_color "565F89")○     [%3s] %s (%d bytes, skipped)$(reset_color)\n" \
                    "$rank" "$display_name" "$bytes"
            else
                printf "  ○     [%3s] %s (%d bytes, skipped)\n" \
                    "$rank" "$display_name" "$bytes"
            fi
            # Don't increment index for skipped files - they don't get $e variables
        fi
    done

    echo ""

    if [[ $COLOR_ENABLED -eq 1 ]]; then
        printf "  $(text_color "9ECE6A")Active$(reset_color)  : %d files, %d bytes (~%d tokens)\n" \
            "$active_count" "$active_bytes" "$(estimate_tokens "$active_bytes")"

        if [[ $skipped_count -gt 0 ]]; then
            local skipped_bytes=$((total_bytes - active_bytes))
            printf "  $(text_color "565F89")Skipped$(reset_color) : %d files, %d bytes (~%d tokens)\n" \
                "$skipped_count" "$skipped_bytes" "$(estimate_tokens "$skipped_bytes")"
        fi

        printf "  $(text_color "BB9AF7")Total$(reset_color)   : %d files, %d bytes (~%d tokens)\n" \
            "$((active_count + skipped_count))" "$total_bytes" "$(estimate_tokens "$total_bytes")"
    else
        printf "  Active  : %d files, %d bytes (~%d tokens)\n" \
            "$active_count" "$active_bytes" "$(estimate_tokens "$active_bytes")"

        if [[ $skipped_count -gt 0 ]]; then
            local skipped_bytes=$((total_bytes - active_bytes))
            printf "  Skipped : %d files, %d bytes (~%d tokens)\n" \
                "$skipped_count" "$skipped_bytes" "$(estimate_tokens "$skipped_bytes")"
        fi

        printf "  Total   : %d files, %d bytes (~%d tokens)\n" \
            "$((active_count + skipped_count))" "$total_bytes" "$(estimate_tokens "$total_bytes")"
    fi

    # Show usage tip
    if [[ $active_count -gt 0 ]]; then
        echo ""
        if [[ $COLOR_ENABLED -eq 1 ]]; then
            echo "$(text_color "9D7CD8")Use evidence variables: cat \$e1, grep pattern \$e2, diff \$e1 \$e3$(reset_color)"
        else
            echo "Use evidence variables: cat \$e1, grep pattern \$e2, diff \$e1 \$e3"
        fi
    fi
}

# Initialize evidence shell variables ($e1, $e2, etc.)
init_evidence_vars() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir 2>/dev/null)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        return 0  # Silent fail if no active flow
    fi

    local evidence_dir="$flow_dir/ctx/evidence"

    if [[ ! -d "$evidence_dir" ]]; then
        return 0
    fi

    # Find all active evidence files (not .skip)
    local files=()
    while IFS= read -r -d '' file; do
        files+=("$file")
    done < <(find "$evidence_dir" -name "*.evidence.md" -type f -print0 | sort -z)

    # Export evidence variables
    local index=1
    export EVIDENCE_COUNT=${#files[@]}

    for file in "${files[@]}"; do
        export "e$index"="$file"
        index=$((index + 1))
    done
}

# Toggle evidence file (active <-> skipped)
evidence_toggle() {
    local target="$1"
    local mode="${2:-toggle}"  # toggle, on, off
    local flow_dir="${3:-}"

    # Handle explicit on/off modes
    if [[ "$target" == "on" ]] || [[ "$target" == "off" ]]; then
        mode="$target"
        target="$mode"
        mode="$1"
        target="$2"
        flow_dir="${3:-}"
    fi

    if [[ -z "$target" ]]; then
        echo "Error: Target required" >&2
        echo "Usage: evidence_toggle <rank|pattern|range> [on|off]" >&2
        echo "Examples:" >&2
        echo "  evidence_toggle 100" >&2
        echo "  evidence_toggle 100 off" >&2
        echo "  evidence_toggle flow_sh on" >&2
        echo "  evidence_toggle 200-299" >&2
        return 1
    fi

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"

    # Handle range (e.g., 200-299)
    if [[ "$target" =~ ^([0-9]+)-([0-9]+)$ ]]; then
        local start="${BASH_REMATCH[1]}"
        local end="${BASH_REMATCH[2]}"

        local count=0
        for file in "$evidence_dir"/*.evidence.md*; do
            [[ -f "$file" ]] || continue
            local rank=$(basename "$file" | cut -d'_' -f1)

            if [[ "$rank" =~ ^[0-9]+$ ]] && [[ $rank -ge $start ]] && [[ $rank -le $end ]]; then
                evidence_toggle_single "$file" "$mode"
                count=$((count + 1))
            fi
        done

        echo "Toggled $count files in range $start-$end"
        # Clear cache after toggling
        clear_stats_cache "$flow_dir"
        return 0
    fi

    # Handle single file (by rank or pattern)
    local found=false
    for file in "$evidence_dir"/*.evidence.md*; do
        [[ -f "$file" ]] || continue
        local basename=$(basename "$file")

        # Match by rank or pattern
        if [[ "$basename" =~ ^${target}_ ]] || [[ "$basename" =~ $target ]]; then
            evidence_toggle_single "$file" "$mode"
            found=true
        fi
    done

    if [[ "$found" == false ]]; then
        echo "Error: No evidence file matching '$target'" >&2
        return 1
    fi

    # Clear cache after toggling
    clear_stats_cache "$flow_dir"
}

# Toggle a single evidence file
evidence_toggle_single() {
    local file="$1"
    local mode="${2:-toggle}"  # toggle, on, off

    local is_skipped=false
    [[ "$file" =~ \.skip$ ]] && is_skipped=true

    if [[ "$mode" == "on" ]]; then
        # Force activate
        if $is_skipped; then
            local new_file="${file%.skip}"
            mv "$file" "$new_file"
            echo "✓ Activated: $(basename "$new_file")"
        fi
    elif [[ "$mode" == "off" ]]; then
        # Force deactivate
        if ! $is_skipped; then
            local new_file="${file}.skip"
            mv "$file" "$new_file"
            echo "○ Skipped: $(basename "${new_file%.skip}")"
        fi
    else
        # Toggle mode
        if $is_skipped; then
            # Reactivate: remove .skip extension
            local new_file="${file%.skip}"
            mv "$file" "$new_file"
            echo "✓ Activated: $(basename "$new_file")"
        else
            # Deactivate: add .skip extension
            local new_file="${file}.skip"
            mv "$file" "$new_file"
            echo "○ Skipped: $(basename "${new_file%.skip}")"
        fi
    fi
}

# Show evidence status with context budget
evidence_status() {
    local flow_dir="${1:-}"
    local token_limit="${2:-10000}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local ctx_dir="$flow_dir/ctx"
    local evidence_dir="$ctx_dir/evidence"

    # Color support
    local COLOR_ENABLED=0
    if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
        source "$TETRA_SRC/bash/color/color_core.sh" 2>/dev/null
        COLOR_ENABLED=1
    fi

    if [[ $COLOR_ENABLED -eq 1 ]]; then
        echo "$(text_color "00D4AA")Context Status$(reset_color)"
        echo "$(text_color "565F89")═══════════════════════════════════════════════════════════════$(reset_color)"
    else
        echo "Context Status"
        echo "═══════════════════════════════════════════════════════════════"
    fi
    echo ""

    # Count system/user context
    local system_bytes=0
    local user_bytes=0
    local evidence_bytes=0
    local skipped_bytes=0

    # System files
    for file in "$ctx_dir"/*.system.md; do
        [[ -f "$file" ]] || continue
        local bytes=$(wc -c < "$file" | tr -d ' ')
        system_bytes=$((system_bytes + bytes))
    done

    # User files
    for file in "$ctx_dir"/*.user.md; do
        [[ -f "$file" ]] || continue
        local bytes=$(wc -c < "$file" | tr -d ' ')
        user_bytes=$((user_bytes + bytes))
    done

    # Evidence files (active)
    for file in "$evidence_dir"/*.evidence.md; do
        [[ -f "$file" ]] || continue
        [[ "$file" =~ \.skip$ ]] && continue
        local bytes=$(wc -c < "$file" | tr -d ' ')
        evidence_bytes=$((evidence_bytes + bytes))
    done

    # Skipped evidence
    for file in "$evidence_dir"/*.evidence.md.skip; do
        [[ -f "$file" ]] || continue
        local bytes=$(wc -c < "$file" | tr -d ' ')
        skipped_bytes=$((skipped_bytes + bytes))
    done

    local total_active=$((system_bytes + user_bytes + evidence_bytes))
    local total_bytes=$((total_active + skipped_bytes))
    local active_tokens=$(estimate_tokens "$total_active")
    local total_tokens=$(estimate_tokens "$total_bytes")

    # Display breakdown
    if [[ $COLOR_ENABLED -eq 1 ]]; then
        printf "$(text_color "9D7CD8")System:$(reset_color)   %6d bytes (~%d tokens)\n" \
            "$system_bytes" "$(estimate_tokens "$system_bytes")"
        printf "$(text_color "7AA2F7")User:$(reset_color)     %6d bytes (~%d tokens)\n" \
            "$user_bytes" "$(estimate_tokens "$user_bytes")"
        printf "$(text_color "9ECE6A")Evidence:$(reset_color) %6d bytes (~%d tokens) - active\n" \
            "$evidence_bytes" "$(estimate_tokens "$evidence_bytes")"

        if [[ $skipped_bytes -gt 0 ]]; then
            printf "$(text_color "565F89")Skipped:$(reset_color)  %6d bytes (~%d tokens)\n" \
                "$skipped_bytes" "$(estimate_tokens "$skipped_bytes")"
        fi

        echo "───────────────────────────────────────────────────────────────"
        printf "$(text_color "BB9AF7")Active:$(reset_color)   %6d bytes (~%d tokens)\n" \
            "$total_active" "$active_tokens"
    else
        printf "System:   %6d bytes (~%d tokens)\n" \
            "$system_bytes" "$(estimate_tokens "$system_bytes")"
        printf "User:     %6d bytes (~%d tokens)\n" \
            "$user_bytes" "$(estimate_tokens "$user_bytes")"
        printf "Evidence: %6d bytes (~%d tokens) - active\n" \
            "$evidence_bytes" "$(estimate_tokens "$evidence_bytes")"

        if [[ $skipped_bytes -gt 0 ]]; then
            printf "Skipped:  %6d bytes (~%d tokens)\n" \
                "$skipped_bytes" "$(estimate_tokens "$skipped_bytes")"
        fi

        echo "───────────────────────────────────────────────────────────────"
        printf "Active:   %6d bytes (~%d tokens)\n" \
            "$total_active" "$active_tokens"
    fi

    # Budget meter
    local percent=$((active_tokens * 100 / token_limit))
    local bar_width=50
    local filled=$((percent * bar_width / 100))

    echo ""
    if [[ $COLOR_ENABLED -eq 1 ]]; then
        echo "$(text_color "BB9AF7")Token Budget:$(reset_color) $active_tokens / $token_limit tokens ($percent%)"
    else
        echo "Token Budget: $active_tokens / $token_limit tokens ($percent%)"
    fi

    printf "["
    for ((i=0; i<bar_width; i++)); do
        if [[ $i -lt $filled ]]; then
            if [[ $COLOR_ENABLED -eq 1 ]]; then
                if [[ $percent -lt 50 ]]; then
                    printf "$(text_color "9ECE6A")█$(reset_color)"
                elif [[ $percent -lt 80 ]]; then
                    printf "$(text_color "E0AF68")█$(reset_color)"
                else
                    printf "$(text_color "F7768E")█$(reset_color)"
                fi
            else
                printf "█"
            fi
        else
            printf "░"
        fi
    done
    printf "]\n"

    # Warnings
    if [[ $percent -gt 90 ]]; then
        echo ""
        if [[ $COLOR_ENABLED -eq 1 ]]; then
            echo "$(text_color "F7768E")⚠ Warning: Context exceeds 90% of budget$(reset_color)"
            echo "$(text_color "565F89")Consider toggling off some evidence files$(reset_color)"
        else
            echo "⚠ Warning: Context exceeds 90% of budget"
            echo "Consider toggling off some evidence files"
        fi
    fi
}

# Remove evidence file
evidence_remove() {
    local target="$1"
    local flow_dir="${2:-}"

    if [[ -z "$target" ]]; then
        echo "Error: Target required" >&2
        echo "Usage: evidence_remove <rank|pattern>" >&2
        return 1
    fi

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    local found=false

    for file in "$evidence_dir"/*.evidence.md*; do
        [[ -f "$file" ]] || continue
        local basename=$(basename "$file")

        # Match by rank or pattern
        if [[ "$basename" =~ ^${target}_ ]] || [[ "$basename" =~ $target ]]; then
            rm "$file"
            echo "✗ Removed: $(basename "$file")"
            found=true
        fi
    done

    if [[ "$found" == false ]]; then
        echo "Error: No evidence file matching '$target'" >&2
        return 1
    fi

    # Refresh variables
    init_evidence_vars "$flow_dir"
}

# Rebase evidence files (renumber sequentially)
evidence_rebase() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"

    if [[ ! -d "$evidence_dir" ]]; then
        echo "No evidence directory found"
        return 0
    fi

    # Color support
    local COLOR_ENABLED=0
    if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
        source "$TETRA_SRC/bash/color/color_core.sh" 2>/dev/null
        COLOR_ENABLED=1
    fi

    if [[ $COLOR_ENABLED -eq 1 ]]; then
        echo "$(text_color "BB9AF7")Rebasing evidence files...$(reset_color)"
    else
        echo "Rebasing evidence files..."
    fi

    # Collect all files
    local files=()
    while IFS= read -r -d '' file; do
        files+=("$file")
    done < <(find "$evidence_dir" -type f \( -name "*.evidence.md" -o -name "*.evidence.md.skip" \) -print0 | sort -z)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No evidence files to rebase"
        return 0
    fi

    # Renumber files starting at 100, incrementing by 10
    local new_rank=100
    local temp_dir=$(mktemp -d)

    for file in "${files[@]}"; do
        local basename=$(basename "$file")
        local old_rank=$(echo "$basename" | cut -d'_' -f1)
        local rest=$(echo "$basename" | cut -d'_' -f2-)
        local new_name="${new_rank}_${rest}"
        local new_path="$temp_dir/$new_name"

        cp "$file" "$new_path"

        if [[ $COLOR_ENABLED -eq 1 ]]; then
            echo "  $(text_color "7AA2F7")$old_rank$(reset_color) $(text_color "565F89")->$(reset_color) $(text_color "9ECE6A")$new_rank$(reset_color): $(text_color "9099A0")$rest$(reset_color)"
        else
            echo "  $old_rank -> $new_rank: $rest"
        fi

        new_rank=$((new_rank + 10))
    done

    # Replace old files with renumbered files
    rm -f "$evidence_dir"/*.evidence.md*
    mv "$temp_dir"/* "$evidence_dir/"
    rmdir "$temp_dir"

    echo ""
    if [[ $COLOR_ENABLED -eq 1 ]]; then
        echo "$(text_color "9ECE6A")✓$(reset_color) Rebase complete! ${#files[@]} files renumbered."
    else
        echo "Rebase complete! ${#files[@]} files renumbered."
    fi

    # Refresh variables and clear cache
    clear_stats_cache "$flow_dir"
    init_evidence_vars "$flow_dir"
}

# Export functions
export -f estimate_tokens
export -f get_evidence_status
export -f evidence_list
export -f init_evidence_vars
export -f evidence_toggle
export -f evidence_toggle_single
export -f evidence_status
export -f evidence_remove
export -f evidence_rebase
