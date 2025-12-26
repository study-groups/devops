#!/usr/bin/env bash
# libmulticat.sh - Shared library for MULTICAT format parsing and emission
#
# This library provides consistent constants, parsers, and emitters for
# all MULTICAT tools (mc, ms, mi, multimerge).

# Prevent multiple sourcing
[[ -n "${_LIBMULTICAT_LOADED:-}" ]] && return 0
_LIBMULTICAT_LOADED=1

# --- Constants ---
MC_START="#MULTICAT_START"
MC_END="#MULTICAT_END"

# Default exclude patterns for common non-content directories/files
MC_DEFAULT_EXCLUDES=(
    '.git'
    'node_modules'
    '__pycache__'
    '.DS_Store'
    '*.pyc'
    '*.pyo'
    '.env'
    '.venv'
    'venv'
    '.idea'
    '.vscode'
    '*.swp'
    '*.swo'
    '*~'
)

# --- Emitters ---

# Emit a single MULTICAT block to stdout
# Usage: mc_emit_block <dir> <file> [note] < content
#    or: mc_emit_block <dir> <file> [note] [content]
mc_emit_block() {
    local dir="$1"
    local file="$2"
    local note="${3:-}"
    local content="${4:-}"

    echo "$MC_START"
    echo "# dir: $dir"
    echo "# file: $file"
    [[ -n "$note" ]] && echo "# note: $note"
    echo "$MC_END"

    if [[ -n "$content" ]]; then
        printf '%s\n' "$content"
    else
        cat
    fi
    echo
}

# Emit a file as a MULTICAT block
# Usage: mc_emit_file <filepath> [note]
mc_emit_file() {
    local filepath="$1"
    local note="${2:-}"
    local dir file

    dir=$(dirname "$filepath")
    file=$(basename "$filepath")

    echo "$MC_START"
    echo "# dir: $dir"
    echo "# file: $file"
    [[ -n "$note" ]] && echo "# note: $note"
    echo "$MC_END"
    cat "$filepath"
    echo
}

# --- Parsers ---

# AWK script for parsing MULTICAT streams
# Outputs NUL-delimited: dir\0file\0note\0mode\0selector\0content\0 per block
_MC_AWK_PARSER='
BEGIN { state="scan" }

function flush_block() {
    if (file != "") {
        # Strip leading newline from content
        sub(/^\n/, "", content)
        # Output NUL-delimited fields
        printf "%s%c%s%c%s%c%s%c%s%c%s%c", dir, 0, file, 0, note, 0, mode, 0, selector, 0, content, 0
    }
}

# Normalize CRLF
{ sub(/\r$/, "") }

# Block start
/^[[:space:]]*#MULTICAT_START[[:space:]]*$/ {
    flush_block()
    state="header"
    dir=""; file=""; note=""; mode="full"; selector=""; content=""
    next
}

# Block header end
/^[[:space:]]*#MULTICAT_END[[:space:]]*$/ {
    if (file != "") {
        state="content"
    } else {
        state="scan"
    }
    next
}

state == "header" {
    if (match($0, /^#[[:space:]]*dir:[[:space:]]*/)) {
        dir = substr($0, RSTART + RLENGTH)
    }
    else if (match($0, /^#[[:space:]]*file:[[:space:]]*/)) {
        file = substr($0, RSTART + RLENGTH)
    }
    else if (match($0, /^#[[:space:]]*note:[[:space:]]*/)) {
        note = substr($0, RSTART + RLENGTH)
    }
    else if (match($0, /^#[[:space:]]*mode:[[:space:]]*/)) {
        mode = substr($0, RSTART + RLENGTH)
    }
    else if (match($0, /^#[[:space:]]*selector:[[:space:]]*/)) {
        selector = substr($0, RSTART + RLENGTH)
    }
    next
}

state == "content" {
    content = content $0 ORS
}

END {
    flush_block()
}
'

# Parse a MULTICAT stream and call a callback for each block
# Usage: mc_parse_stream callback < input
#   callback receives: dir file note mode selector content
mc_parse_stream() {
    local callback="$1"
    local dir file note mode selector content

    while IFS= read -r -d '' dir && \
          IFS= read -r -d '' file && \
          IFS= read -r -d '' note && \
          IFS= read -r -d '' mode && \
          IFS= read -r -d '' selector && \
          IFS= read -r -d '' content; do
        "$callback" "$dir" "$file" "$note" "$mode" "$selector" "$content"
    done < <(awk "$_MC_AWK_PARSER")
}

# Parse and iterate with a simple loop (alternative to callback)
# Usage: while mc_read_block; do echo "$MC_DIR $MC_FILE"; done < input.mc
# Sets: MC_DIR, MC_FILE, MC_NOTE, MC_MODE, MC_SELECTOR, MC_CONTENT
mc_read_block() {
    IFS= read -r -d '' MC_DIR && \
    IFS= read -r -d '' MC_FILE && \
    IFS= read -r -d '' MC_NOTE && \
    IFS= read -r -d '' MC_MODE && \
    IFS= read -r -d '' MC_SELECTOR && \
    IFS= read -r -d '' MC_CONTENT
}

# Get the AWK parser script (for tools that need to run awk directly)
mc_get_awk_parser() {
    echo "$_MC_AWK_PARSER"
}

# --- Utilities ---

# Build full path from dir and file
mc_fullpath() {
    local dir="$1" file="$2"
    local path="$dir/$file"
    # Normalize double slashes
    echo "${path//\/\//\/}"
}

# Check if a path matches any exclude pattern
# Usage: mc_is_excluded <path> <pattern1> [pattern2...]
mc_is_excluded() {
    local path="$1"
    shift
    local pattern
    for pattern in "$@"; do
        case "$path" in
            *"$pattern"*) return 0 ;;
        esac
    done
    return 1
}

# Build regex from exclude patterns array
# Usage: mc_build_exclude_regex pattern1 pattern2 ...
mc_build_exclude_regex() {
    local IFS="|"
    if [[ $# -eq 0 ]]; then
        echo '^$'  # Match nothing
    else
        echo ".*($*)$"
    fi
}

# Count blocks in a MULTICAT stream
# Usage: mc_count_blocks < input.mc
mc_count_blocks() {
    grep -c "^${MC_START}\$" || echo 0
}

# List files in a MULTICAT stream (one per line)
# Usage: mc_list_files < input.mc
mc_list_files() {
    awk -v start="$MC_START" -v end_marker="$MC_END" '
    $0 == start { in_header=1; dir=""; file=""; next }
    $0 == end_marker {
        if (dir != "" && file != "") {
            path = dir "/" file
            gsub(/\/\//, "/", path)
            print path
        }
        in_header=0
        next
    }
    in_header && /^#[[:space:]]*dir:[[:space:]]*/ {
        sub(/^#[[:space:]]*dir:[[:space:]]*/, "")
        dir = $0
    }
    in_header && /^#[[:space:]]*file:[[:space:]]*/ {
        sub(/^#[[:space:]]*file:[[:space:]]*/, "")
        file = $0
    }
    '
}

# --- JSON Output ---

# Output block info as JSON object
# Usage: mc_block_to_json <dir> <file> [note] [mode] [selector]
mc_block_to_json() {
    local dir="$1" file="$2" note="${3:-}" mode="${4:-full}" selector="${5:-}"
    printf '{"dir":"%s","file":"%s"' "$dir" "$file"
    [[ -n "$note" ]] && printf ',"note":"%s"' "$note"
    [[ "$mode" != "full" ]] && printf ',"mode":"%s"' "$mode"
    [[ -n "$selector" ]] && printf ',"selector":"%s"' "$selector"
    printf '}'
}

# Parse MULTICAT and output JSON array of file info
# Usage: mc_to_json < input.mc
mc_to_json() {
    local first=1
    local dir file note mode selector content

    printf '{"files":['

    while IFS= read -r -d '' dir && \
          IFS= read -r -d '' file && \
          IFS= read -r -d '' note && \
          IFS= read -r -d '' mode && \
          IFS= read -r -d '' selector && \
          IFS= read -r -d '' content; do
        [[ $first -eq 0 ]] && printf ','
        first=0
        mc_block_to_json "$dir" "$file" "$note" "$mode" "$selector"
    done < <(awk "$_MC_AWK_PARSER")

    printf '],"count":%d}\n' "$(( first == 1 ? 0 : 1 ))"
}
