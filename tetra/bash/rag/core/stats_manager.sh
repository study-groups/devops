#!/usr/bin/env bash
# stats_manager.sh - Statistics and brightness meters for RAG REPL

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TETRA_SRC:=$HOME/tetra}"

# Source color system for brightness functions
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
fi

# Get context statistics for current flow
# Returns: pinned evidence selections external total_files total_lines total_chars
get_context_stats() {
    local flow_dir="$1"

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "0 0 0 0 0 0 0"
        return
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    if [[ ! -d "$evidence_dir" ]]; then
        echo "0 0 0 0 0 0 0"
        return
    fi

    # Check cache (5 second TTL for performance)
    local cache="$evidence_dir/.stats.cache"
    if [[ -f "$cache" ]]; then
        # Get cache age (compatible with both BSD and GNU stat)
        local cache_mtime
        if stat -f%m "$cache" >/dev/null 2>&1; then
            cache_mtime=$(stat -f%m "$cache")  # BSD (macOS)
        else
            cache_mtime=$(stat -c%Y "$cache")  # GNU (Linux)
        fi
        local now=$(date +%s)
        local age=$((now - cache_mtime))

        if [[ $age -lt 5 ]]; then
            cat "$cache"
            return
        fi
    fi

    # Initialize counters
    local pinned=0
    local evidence=0
    local selections=0
    local external=0
    local total_files=0
    local total_lines=0
    local total_chars=0

    # Scan evidence directory (skip .skip files)
    for file in "$evidence_dir"/*; do
        [[ -f "$file" ]] || continue

        # Skip files with .skip extension (toggled off)
        [[ "$file" =~ \.skip$ ]] && continue

        ((total_files++))

        # Classify by type
        if [[ "$file" =~ \.link$ ]]; then
            # External link
            ((external++))
            local target=$(readlink "$file" 2>/dev/null)
            if [[ -f "$target" ]]; then
                local lines=$(wc -l < "$target" 2>/dev/null || echo 0)
                local chars=$(wc -c < "$target" 2>/dev/null || echo 0)
                total_lines=$((total_lines + lines))
                total_chars=$((total_chars + chars))
            fi
        elif grep -q "<!-- .*pinned=true" "$file" 2>/dev/null; then
            # Pinned document
            ((pinned++))
            local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
            local chars=$(wc -c < "$file" 2>/dev/null || echo 0)
            total_lines=$((total_lines + lines))
            total_chars=$((total_chars + chars))
        elif grep -q "span=lines=" "$file" 2>/dev/null; then
            # Selection/range
            ((selections++))
            local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
            local chars=$(wc -c < "$file" 2>/dev/null || echo 0)
            total_lines=$((total_lines + lines))
            total_chars=$((total_chars + chars))
        else
            # Regular evidence
            ((evidence++))
            local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
            local chars=$(wc -c < "$file" 2>/dev/null || echo 0)
            total_lines=$((total_lines + lines))
            total_chars=$((total_chars + chars))
        fi
    done

    # Build result
    local result="$pinned $evidence $selections $external $total_files $total_lines $total_chars"

    # Cache for 5 seconds
    echo "$result" > "$cache"

    # Output result
    echo "$result"
}

# Get colored symbol with brightness based on count
# Uses theme_aware_dim from color_core.sh
get_symbol_brightness() {
    local base_color="$1"
    local count="$2"

    # Map count to brightness level (0=bright, 6=very dim, 7=background merge)
    local level=7
    if [[ $count -gt 50 ]]; then
        level=0     # Brightest - lots of content
    elif [[ $count -gt 20 ]]; then
        level=1     # Very bright
    elif [[ $count -gt 10 ]]; then
        level=2     # Bright
    elif [[ $count -gt 5 ]]; then
        level=3     # Medium
    elif [[ $count -gt 2 ]]; then
        level=4     # Dim
    elif [[ $count -gt 0 ]]; then
        level=5     # Very dim
    else
        level=6     # Darkest - no content
    fi

    # Use existing theme-aware dimming function
    if command -v theme_dimmed_fg_only >/dev/null 2>&1; then
        theme_dimmed_fg_only "$base_color" "$level"
    else
        # Fallback if color system not loaded
        text_color "$base_color" 2>/dev/null || printf "\033[38;5;7m"
    fi
}

# Convert number to superscript unicode
to_superscript() {
    local num="$1"

    # Unicode superscript digit mapping
    local -A super=(
        [0]="⁰" [1]="¹" [2]="²" [3]="³" [4]="⁴"
        [5]="⁵" [6]="⁶" [7]="⁷" [8]="⁸" [9]="⁹"
    )

    # Handle zero
    if [[ $num -eq 0 ]]; then
        echo "⁰"
        return
    fi

    # Convert each digit
    local result=""
    local temp=$num
    while [[ $temp -gt 0 ]]; do
        local digit=$((temp % 10))
        result="${super[$digit]}${result}"
        temp=$((temp / 10))
    done

    echo "$result"
}

# Format size with k/M notation
format_size() {
    local num=$1

    if [[ $num -ge 1000000 ]]; then
        # Millions
        echo "$(awk "BEGIN {printf \"%.1f\", $num/1000000}")M"
    elif [[ $num -ge 1000 ]]; then
        # Thousands
        echo "$(awk "BEGIN {printf \"%.1f\", $num/1000}")k"
    else
        # Less than 1000
        echo "$num"
    fi
}

# Clear stats cache for a flow (call when evidence changes)
clear_stats_cache() {
    local flow_dir="$1"
    local cache="$flow_dir/ctx/evidence/.stats.cache"
    [[ -f "$cache" ]] && rm -f "$cache"
}

# Export functions
export -f get_context_stats
export -f get_symbol_brightness
export -f to_superscript
export -f format_size
export -f clear_stats_cache
