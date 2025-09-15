#!/usr/bin/env bash

# --- Configuration ---
# Default directory to search within if the exact path isn't found.
# Adjust this to be as specific as possible for better performance.
# Using '/root/src' based on your example input.
DEFAULT_SEARCH_DIR="/root/src"
# --- End Configuration ---

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# Usage:
#   ./rankfind [input-file] [search-directory]
#
# - If [input-file] is omitted or '-', reads from stdin.
# - If [search-directory] is omitted, uses DEFAULT_SEARCH_DIR.

INPUT_FILE="${1:-}"
SEARCH_DIR="${2:-$DEFAULT_SEARCH_DIR}" # Use provided search dir or default

# --- Input Handling ---
INPUT_SOURCE_DESCRIPTION="stdin"
if [[ -n "$INPUT_FILE" && "$INPUT_FILE" != "-" ]]; then
    if [[ -f "$INPUT_FILE" ]]; then
        INPUT=$(cat "$INPUT_FILE")
        INPUT_SOURCE_DESCRIPTION="file '$INPUT_FILE'"
    else
        echo "Error: Input file '$INPUT_FILE' not found." >&2
        exit 1
    fi
elif [[ -p /dev/stdin ]]; then
    # Reading from a pipe
    INPUT=$(cat)
else
    # Waiting for interactive stdin or explicit "-"
    echo "Reading from standard input. Press Ctrl+D when done." >&2
    INPUT=$(cat)
fi

# --- Processing ---
REVISED_LIST=()
TOTAL_LINES=0
FOUND_EXACT=0
FOUND_SEARCH=0
FOUND_MULTIPLE=0
NOT_FOUND=0

echo "--- Starting File Verification ---" >&2
echo "Input source: $INPUT_SOURCE_DESCRIPTION" >&2
echo "Fallback search directory: $SEARCH_DIR" >&2
echo "----------------------------------" >&2

# Use process substitution and readarray/mapfile for safer line handling
mapfile -t LINES <<< "$INPUT"

for line in "${LINES[@]}"; do
    # Trim leading/trailing whitespace
    trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    if [[ -z "$trimmed_line" ]]; then
        # Skip empty lines
        continue
    fi

    ((TOTAL_LINES++))
    echo "[Input Path]: $trimmed_line" >&2

    # 1. Check if the exact path exists and is a file
    if [[ -f "$trimmed_line" ]]; then
        echo "  ✅ Found (Exact Match): $trimmed_line" >&2
        REVISED_LIST+=("$trimmed_line")
        ((FOUND_EXACT++))
    else
        # 2. Exact path not found, try searching by filename
        FILE_NAME=$(basename "$trimmed_line")
        if [[ -z "$FILE_NAME" || "$FILE_NAME" == "." || "$FILE_NAME" == "/" ]]; then
             echo "  ❌ Invalid filename extracted from: $trimmed_line" >&2
             ((NOT_FOUND++))
             continue
        fi

        echo "  ℹ️ Exact path not found. Searching for '$FILE_NAME' in '$SEARCH_DIR'..." >&2

        # 3. Use find safely (-print0 and mapfile)
        FOUND_PATHS_ARR=()
        # The `|| true` prevents script exit if find returns non-zero (e.g., permission errors)
        mapfile -d $'\0' FOUND_PATHS_ARR < <(find "$SEARCH_DIR" -name "$FILE_NAME" -type f -print0 2>/dev/null || true)
        MATCH_COUNT=${#FOUND_PATHS_ARR[@]}

        if [[ $MATCH_COUNT -eq 0 ]]; then
            echo "  ❌ Not Found (Search): '$FILE_NAME' in '$SEARCH_DIR'" >&2
            ((NOT_FOUND++))
        elif [[ $MATCH_COUNT -eq 1 ]]; then
            FOUND_PATH="${FOUND_PATHS_ARR[0]}"
            echo "  ✅ Found (Search): $FOUND_PATH" >&2
            REVISED_LIST+=("$FOUND_PATH")
            ((FOUND_SEARCH++))
        else
            echo "  ⚠️ Multiple Matches Found ($MATCH_COUNT) for '$FILE_NAME':" >&2
            for path in "${FOUND_PATHS_ARR[@]}"; do
                echo "      - $path" >&2
            done
            # Decision: Use the first match (same as original script)
            FIRST_MATCH="${FOUND_PATHS_ARR[0]}"
            echo "      -> Using first match: $FIRST_MATCH" >&2
            REVISED_LIST+=("$FIRST_MATCH")
            ((FOUND_MULTIPLE++))
        fi
    fi
    echo "----------------------------------" >&2
done

# --- Summary ---
echo "--- Verification Complete ---" >&2
echo "Summary:" >&2
echo "  Total input lines processed: $TOTAL_LINES" >&2
echo "  Found (Exact Path):        $FOUND_EXACT" >&2
echo "  Found (Fallback Search):   $FOUND_SEARCH" >&2
echo "  Found (Multiple, Used 1st): $FOUND_MULTIPLE" >&2
echo "  Not Found:                 $NOT_FOUND" >&2
echo "-----------------------------" >&2
echo "Outputting verified paths:" >&2

# --- Output ---
# Print the final list of full paths
printf "%s\n" "${REVISED_LIST[@]}"
