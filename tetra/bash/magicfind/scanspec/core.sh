#!/usr/bin/env bash
# =============================================================================
# SCANSPEC CORE - Parser and executor
# =============================================================================

# Parsed scanspec state (global)
declare -gA SCAN_PATTERNS=()
declare -gA SCAN_REPLACE=()
declare -g SCAN_NAME=""
declare -g SCAN_ALIAS=""
declare -g SCAN_PATH=""
declare -g SCAN_TYPE=""
declare -g SCAN_EXCLUDE=""
declare -g SCAN_MODE=""

# Specs directory
SCANSPEC_DIR="${MAGICFIND_SRC:-$TETRA_SRC/bash/magicfind}/specs"

# =============================================================================
# PARSER
# =============================================================================

# Parse a .scanspec file into global variables
# Usage: scanspec_parse <file>
scanspec_parse() {
    local file="$1"
    local section=""

    # Reset state
    SCAN_PATTERNS=()
    SCAN_REPLACE=()
    SCAN_NAME=""
    SCAN_ALIAS=""
    SCAN_PATH="."
    SCAN_TYPE="sh"
    SCAN_EXCLUDE=""
    SCAN_MODE="detail"

    [[ ! -f "$file" ]] && { echo "File not found: $file" >&2; return 1; }

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue

        # Expand variables
        line="${line//\$TETRA_SRC/${TETRA_SRC:-}}"
        line="${line//\$TETRA_DIR/${TETRA_DIR:-}}"
        line="${line//\$MAGICFIND_DIR/${MAGICFIND_DIR:-}}"
        line="${line//\$PWD/$PWD}"
        line="${line//\$HOME/$HOME}"

        # Section headers
        if [[ "$line" =~ ^\[([a-z]+)\] ]]; then
            section="${BASH_REMATCH[1]}"
            continue
        fi

        # Key: value parsing
        if [[ "$line" =~ ^([^:]+):[[:space:]]*(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"

            # Trim whitespace
            key="${key#"${key%%[![:space:]]*}"}"
            key="${key%"${key##*[![:space:]]}"}"
            val="${val#"${val%%[![:space:]]*}"}"
            val="${val%"${val##*[![:space:]]}"}"

            case "$section" in
                patterns)
                    SCAN_PATTERNS["$key"]="$val"
                    ;;
                replace)
                    SCAN_REPLACE["$key"]="$val"
                    ;;
                *)
                    # Header section
                    case "$key" in
                        name)    SCAN_NAME="$val" ;;
                        alias)   SCAN_ALIAS="$val" ;;
                        path)    SCAN_PATH="$val" ;;
                        type)    SCAN_TYPE="$val" ;;
                        exclude) SCAN_EXCLUDE="$val" ;;
                        mode)    SCAN_MODE="$val" ;;
                    esac
                    ;;
            esac
        fi
    done < "$file"
}

# =============================================================================
# EXECUTOR
# =============================================================================

# Execute a parsed or specified scanspec
# Usage: scanspec_run [file]
scanspec_run() {
    [[ -n "$1" ]] && scanspec_parse "$1"

    # Validate we have patterns
    if [[ ${#SCAN_PATTERNS[@]} -eq 0 ]]; then
        echo "No patterns defined" >&2
        return 1
    fi

    # Build combined pattern regex
    local patterns=()
    for key in "${!SCAN_PATTERNS[@]}"; do
        patterns+=("${SCAN_PATTERNS[$key]}")
    done
    local pattern_regex
    pattern_regex=$(IFS='|'; echo "${patterns[*]}")

    # Build file type args
    local -a type_args=()
    IFS=',' read -ra types <<< "$SCAN_TYPE"
    for t in "${types[@]}"; do
        t="${t// /}"
        type_args+=(--include="*.$t")
    done

    # Build exclude regex
    local exclude_regex=""
    if [[ -n "$SCAN_EXCLUDE" ]]; then
        exclude_regex="${SCAN_EXCLUDE//,/|}"
        exclude_regex="${exclude_regex// /}"
    fi

    # Header
    echo "=== ${SCAN_NAME:-Scan} ==="
    echo "path: $SCAN_PATH"
    echo "type: $SCAN_TYPE"
    [[ -n "$SCAN_EXCLUDE" ]] && echo "exclude: $SCAN_EXCLUDE"
    echo "mode: $SCAN_MODE"
    echo ""

    # Execute grep
    local results
    results=$(grep -rn "${type_args[@]}" -E "$pattern_regex" "$SCAN_PATH" 2>/dev/null)

    # Apply exclusions
    if [[ -n "$exclude_regex" ]]; then
        results=$(echo "$results" | grep -Ev "/($exclude_regex)/")
    fi

    # Output based on mode
    case "$SCAN_MODE" in
        count)
            echo "$results" | grep -c . || echo 0
            ;;
        files)
            echo "$results" | cut -d: -f1 | sort -u
            ;;
        summary)
            echo "-- Files & Matches --"
            local file_count match_count
            file_count=$(echo "$results" | cut -d: -f1 | sort -u | wc -l | tr -d ' ')
            match_count=$(echo "$results" | wc -l | tr -d ' ')
            [[ -z "$results" ]] && { file_count=0; match_count=0; }
            echo "files: $file_count"
            echo "matches: $match_count"
            echo ""
            echo "-- By Category --"
            for key in "${!SCAN_PATTERNS[@]}"; do
                local p="${SCAN_PATTERNS[$key]}"
                local c
                c=$(echo "$results" | grep -E "$p" 2>/dev/null | wc -l | tr -d ' ')
                [[ -z "$c" ]] && c=0
                printf "  %-20s %d\n" "$key" "$c"
            done
            ;;
        detail|*)
            if [[ -n "$results" ]]; then
                echo "-- Matches --"
                echo "$results"
            else
                echo "(no matches)"
            fi
            ;;
    esac
}

export -f scanspec_parse scanspec_run
