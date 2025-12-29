#!/usr/bin/env bash
# =============================================================================
# SCANSPEC COMMANDS - List, show, match, compare, subcommand handler
# =============================================================================

# =============================================================================
# MATCHER
# =============================================================================

# Find matching scanspec for a query
# Usage: scanspec_match <query>
# Returns: path to matching .scanspec file or empty
scanspec_match() {
    local query="$1"
    local query_lower="${query,,}"

    [[ ! -d "$SCANSPEC_DIR" ]] && return 1

    for spec in "$SCANSPEC_DIR"/*.scanspec; do
        [[ ! -f "$spec" ]] && continue

        # Quick parse for name and alias
        local name="" alias=""
        while IFS= read -r line; do
            [[ "$line" =~ ^name:[[:space:]]*(.*)$ ]] && name="${BASH_REMATCH[1]}"
            [[ "$line" =~ ^alias:[[:space:]]*(.*)$ ]] && alias="${BASH_REMATCH[1]}"
            # Stop at first section
            [[ "$line" =~ ^\[ ]] && break
        done < "$spec"

        local name_lower="${name,,}"

        # Exact name match
        if [[ "$query_lower" == "$name_lower" ]]; then
            echo "$spec"
            return 0
        fi

        # Check aliases
        if [[ -n "$alias" ]]; then
            IFS=',' read -ra aliases <<< "$alias"
            for a in "${aliases[@]}"; do
                a="${a#"${a%%[![:space:]]*}"}"
                a="${a%"${a##*[![:space:]]}"}"
                a="${a,,}"
                # Query contains alias
                if [[ "$query_lower" == *"$a"* ]]; then
                    echo "$spec"
                    return 0
                fi
            done
        fi

        # Basename match (without extension)
        local basename="${spec##*/}"
        basename="${basename%.scanspec}"
        if [[ "$query_lower" == *"$basename"* ]]; then
            echo "$spec"
            return 0
        fi
    done

    return 1
}

# =============================================================================
# LIST / SHOW
# =============================================================================

# List available scanspecs
scanspec_list() {
    [[ ! -d "$SCANSPEC_DIR" ]] && { echo "No specs directory: $SCANSPEC_DIR" >&2; return 1; }

    echo "Available scanspecs:"
    echo ""

    for spec in "$SCANSPEC_DIR"/*.scanspec; do
        [[ ! -f "$spec" ]] && continue

        local name="" alias=""
        while IFS= read -r line; do
            [[ "$line" =~ ^name:[[:space:]]*(.*)$ ]] && name="${BASH_REMATCH[1]}"
            [[ "$line" =~ ^alias:[[:space:]]*(.*)$ ]] && alias="${BASH_REMATCH[1]}"
            [[ "$line" =~ ^\[ ]] && break
        done < "$spec"

        local basename="${spec##*/}"
        basename="${basename%.scanspec}"

        printf "  %-15s  %s" "$basename" "${name:-$basename}"
        [[ -n "$alias" ]] && printf "  [%s]" "$alias"
        echo ""
    done
}

# Show parsed scanspec (debug)
scanspec_show() {
    local file="$1"

    # Resolve basename to full path
    if [[ ! -f "$file" ]] && [[ -f "$SCANSPEC_DIR/$file.scanspec" ]]; then
        file="$SCANSPEC_DIR/$file.scanspec"
    fi

    scanspec_parse "$file" || return 1

    echo "name: $SCAN_NAME"
    [[ -n "$SCAN_ALIAS" ]] && echo "alias: $SCAN_ALIAS"
    echo "path: $SCAN_PATH"
    echo "type: $SCAN_TYPE"
    echo "exclude: $SCAN_EXCLUDE"
    echo "mode: $SCAN_MODE"
    echo ""
    echo "[patterns]"
    for key in "${!SCAN_PATTERNS[@]}"; do
        echo "  $key: ${SCAN_PATTERNS[$key]}"
    done
    if [[ ${#SCAN_REPLACE[@]} -gt 0 ]]; then
        echo ""
        echo "[replace]"
        for key in "${!SCAN_REPLACE[@]}"; do
            echo "  $key: ${SCAN_REPLACE[$key]}"
        done
    fi
}

# =============================================================================
# SIMILARITY DETECTION
# =============================================================================

# Compare two scanspec outputs for similarity
scanspec_compare() {
    local spec1="$1"
    local spec2="$2"

    # Resolve basenames to full paths
    [[ ! -f "$spec1" ]] && [[ -f "$SCANSPEC_DIR/$spec1.scanspec" ]] && spec1="$SCANSPEC_DIR/$spec1.scanspec"
    [[ ! -f "$spec2" ]] && [[ -f "$SCANSPEC_DIR/$spec2.scanspec" ]] && spec2="$SCANSPEC_DIR/$spec2.scanspec"

    [[ ! -f "$spec1" ]] && { echo "Spec not found: $spec1" >&2; return 1; }
    [[ ! -f "$spec2" ]] && { echo "Spec not found: $spec2" >&2; return 1; }

    # Run both specs in detail mode and extract unique file paths
    local out1 out2
    scanspec_parse "$spec1"
    SCAN_MODE="detail"
    out1=$(scanspec_run 2>/dev/null | grep -E '^/' | cut -d: -f1 | sort -u)
    scanspec_parse "$spec2"
    SCAN_MODE="detail"
    out2=$(scanspec_run 2>/dev/null | grep -E '^/' | cut -d: -f1 | sort -u)

    # Count lines
    local count1 count2 common
    count1=$(echo "$out1" | wc -l | tr -d ' ')
    count2=$(echo "$out2" | wc -l | tr -d ' ')
    common=$(comm -12 <(echo "$out1") <(echo "$out2") 2>/dev/null | wc -l | tr -d ' ')
    [[ -z "${out1// }" ]] && count1=0
    [[ -z "${out2// }" ]] && count2=0

    # Calculate Jaccard similarity
    local union=$((count1 + count2 - common))
    local similarity=0
    ((union > 0)) && similarity=$((common * 100 / union))

    # Output
    local name1="${spec1##*/}" name2="${spec2##*/}"
    name1="${name1%.scanspec}"
    name2="${name2%.scanspec}"

    echo "Comparing: $name1 vs $name2"
    echo "  $name1: $count1 files"
    echo "  $name2: $count2 files"
    echo "  common: $common files"
    echo "  similarity: ${similarity}%"

    if ((similarity == 100 && count1 == count2)); then
        echo "  STATUS: IDENTICAL"
    elif ((similarity >= 90)); then
        echo "  STATUS: NEAR-DUPLICATE"
    elif ((similarity >= 50)); then
        echo "  STATUS: OVERLAPPING"
    else
        echo "  STATUS: DISTINCT"
    fi
}

# Check all specs for duplicates
scanspec_duplicates() {
    [[ ! -d "$SCANSPEC_DIR" ]] && { echo "No specs directory" >&2; return 1; }

    local specs=("$SCANSPEC_DIR"/*.scanspec)
    local count=${#specs[@]}

    echo "Checking $count specs for duplicates..."
    echo ""

    local i j
    for ((i=0; i<count; i++)); do
        for ((j=i+1; j<count; j++)); do
            local out1 out2
            scanspec_parse "${specs[$i]}"
            SCAN_MODE="detail"
            out1=$(scanspec_run 2>/dev/null | grep -E '^/' | cut -d: -f1 | sort -u)
            scanspec_parse "${specs[$j]}"
            SCAN_MODE="detail"
            out2=$(scanspec_run 2>/dev/null | grep -E '^/' | cut -d: -f1 | sort -u)

            local count1 count2 common
            count1=$(echo "$out1" | wc -l | tr -d ' ')
            count2=$(echo "$out2" | wc -l | tr -d ' ')
            common=$(comm -12 <(echo "$out1") <(echo "$out2") 2>/dev/null | wc -l | tr -d ' ')
            [[ -z "${out1// }" ]] && count1=0
            [[ -z "${out2// }" ]] && count2=0

            local union=$((count1 + count2 - common))
            local similarity=0
            ((union > 0)) && similarity=$((common * 100 / union))

            if ((similarity >= 50)); then
                local name1="${specs[$i]##*/}" name2="${specs[$j]##*/}"
                name1="${name1%.scanspec}"
                name2="${name2%.scanspec}"
                printf "  %-15s <-> %-15s  %3d%%\n" "$name1" "$name2" "$similarity"
            fi
        done
    done
}

# =============================================================================
# SUBCOMMAND HANDLER
# =============================================================================

# Handle magicfind spec subcommand
_magicfind_spec() {
    local action="${1:-list}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)
            scanspec_list
            ;;
        show)
            scanspec_show "$@"
            ;;
        run)
            local spec="$1"
            if [[ -f "$spec" ]]; then
                scanspec_run "$spec"
            elif [[ -f "$SCANSPEC_DIR/$spec.scanspec" ]]; then
                scanspec_run "$SCANSPEC_DIR/$spec.scanspec"
            else
                echo "Spec not found: $spec" >&2
                return 1
            fi
            ;;
        match)
            local result
            result=$(scanspec_match "$*")
            if [[ -n "$result" ]]; then
                echo "Match: $result"
            else
                echo "No match"
                return 1
            fi
            ;;
        compare|cmp)
            scanspec_compare "$@"
            ;;
        duplicates|dups)
            scanspec_duplicates
            ;;
        help|-h|--help)
            _magicfind_spec_help
            ;;
        *)
            # Default: treat as spec name to run
            if [[ -f "$SCANSPEC_DIR/$action.scanspec" ]]; then
                scanspec_run "$SCANSPEC_DIR/$action.scanspec"
            else
                echo "Unknown action: $action" >&2
                _magicfind_spec_help
                return 1
            fi
            ;;
    esac
}

_magicfind_spec_help() {
    cat << 'EOF'
magicfind spec - Manage scanspec patterns

USAGE:
    magicfind spec                     List available specs
    magicfind spec <name>              Run a spec by name
    magicfind spec run <name>          Run a spec by name
    magicfind spec show <name>         Show spec details
    magicfind spec match <query>       Find matching spec for query
    magicfind spec compare <a> <b>     Compare two specs for similarity
    magicfind spec duplicates          Check all specs for duplicates
    magicfind spec help                Show this help

EXAMPLES:
    magicfind spec tds-old             Run tds-old.scanspec
    magicfind spec show todos          Show todos spec structure
    magicfind spec match "tds"         Find spec matching "tds"
    magicfind spec compare tds-old color-usage
    magicfind spec duplicates          Find overlapping specs
EOF
}

export -f scanspec_match scanspec_list scanspec_show
export -f scanspec_compare scanspec_duplicates
export -f _magicfind_spec _magicfind_spec_help
