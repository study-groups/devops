#!/usr/bin/env bash
# TSM Dependency Graph Generator
# Analyzes source statements and function calls to produce a dependency graph

set -euo pipefail

TSM_SRC="${TETRA_SRC:-$HOME/tetra/src}/bash/tsm"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Generate dependency graph for TSM codebase.

OPTIONS:
    -f, --format FORMAT   Output format: text, dot, mermaid (default: text)
    -t, --type TYPE       Graph type: files, functions, both (default: files)
    -o, --output FILE     Output file (default: stdout)
    -h, --help            Show this help

EXAMPLES:
    $(basename "$0")                    # Text format, file dependencies
    $(basename "$0") -f dot             # Graphviz DOT format
    $(basename "$0") -f mermaid         # Mermaid flowchart
    $(basename "$0") -t functions       # Function call graph
EOF
}

FORMAT="text"
TYPE="files"
OUTPUT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--format) FORMAT="$2"; shift 2 ;;
        -t|--type) TYPE="$2"; shift 2 ;;
        -o|--output) OUTPUT="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
done

# =============================================================================
# FILE DEPENDENCY ANALYSIS
# =============================================================================

declare -A FILE_DEPS
declare -A FILE_FUNCTIONS

analyze_file_deps() {
    local file="$1"
    local relative_path="${file#$TSM_SRC/}"

    # Find source statements
    while IFS= read -r line; do
        # Extract sourced file path
        local sourced=""
        if [[ "$line" =~ source[[:space:]]+[\"\']?([^\"\'[:space:]]+) ]]; then
            sourced="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ \.[[:space:]]+[\"\']?([^\"\'[:space:]]+) ]]; then
            sourced="${BASH_REMATCH[1]}"
        fi

        [[ -z "$sourced" ]] && continue

        # Resolve path
        if [[ "$sourced" == *'$TSM_SRC'* || "$sourced" == *'${TSM_SRC}'* ]]; then
            sourced="${sourced//\$TSM_SRC/}"
            sourced="${sourced//\$\{TSM_SRC\}/}"
            sourced="${sourced#/}"
        elif [[ "$sourced" == *'$TETRA_SRC'* || "$sourced" == *'${TETRA_SRC}'* ]]; then
            sourced="${sourced//\$TETRA_SRC\/bash\/tsm/}"
            sourced="${sourced//\$\{TETRA_SRC\}\/bash\/tsm/}"
            sourced="${sourced#/}"
        fi

        # Skip external dependencies
        [[ "$sourced" == /* ]] && continue
        [[ "$sourced" == *tetra.sh* ]] && continue
        [[ -z "$sourced" ]] && continue

        # Add to dependencies
        if [[ -n "${FILE_DEPS[$relative_path]:-}" ]]; then
            FILE_DEPS[$relative_path]+=" $sourced"
        else
            FILE_DEPS[$relative_path]="$sourced"
        fi
    done < <(grep -E '^\s*(source|\.) ' "$file" 2>/dev/null || true)
}

analyze_file_functions() {
    local file="$1"
    local relative_path="${file#$TSM_SRC/}"

    # Find function definitions
    local funcs=""
    while IFS= read -r func; do
        [[ -z "$func" ]] && continue
        if [[ -n "$funcs" ]]; then
            funcs+=" $func"
        else
            funcs="$func"
        fi
    done < <(grep -E '^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\)' "$file" 2>/dev/null | sed 's/().*//' | tr -d ' ')

    FILE_FUNCTIONS[$relative_path]="$funcs"
}

# =============================================================================
# OUTPUT FORMATTERS
# =============================================================================

output_text() {
    echo "TSM Dependency Graph"
    echo "===================="
    echo ""

    if [[ "$TYPE" == "files" || "$TYPE" == "both" ]]; then
        echo "FILE DEPENDENCIES:"
        echo "------------------"
        for file in $(printf '%s\n' "${!FILE_DEPS[@]}" | sort); do
            echo "$file"
            local deps="${FILE_DEPS[$file]}"
            for dep in $deps; do
                echo "  -> $dep"
            done
        done
        echo ""
    fi

    if [[ "$TYPE" == "functions" || "$TYPE" == "both" ]]; then
        echo "FUNCTIONS BY FILE:"
        echo "------------------"
        for file in $(printf '%s\n' "${!FILE_FUNCTIONS[@]}" | sort); do
            local funcs="${FILE_FUNCTIONS[$file]}"
            [[ -z "$funcs" ]] && continue
            echo "$file:"
            for func in $funcs; do
                echo "  - $func"
            done
        done
    fi
}

output_dot() {
    echo "digraph TSM {"
    echo "  rankdir=LR;"
    echo "  node [shape=box, fontname=\"monospace\"];"
    echo ""

    # Create subgraphs for directories
    declare -A dirs
    for file in "${!FILE_DEPS[@]}"; do
        local dir="${file%/*}"
        [[ "$dir" == "$file" ]] && dir="root"
        dirs[$dir]=1
    done

    local cluster_id=0
    for dir in $(printf '%s\n' "${!dirs[@]}" | sort); do
        echo "  subgraph cluster_$cluster_id {"
        echo "    label=\"$dir\";"
        for file in $(printf '%s\n' "${!FILE_DEPS[@]}" | sort); do
            local file_dir="${file%/*}"
            [[ "$file_dir" == "$file" ]] && file_dir="root"
            if [[ "$file_dir" == "$dir" ]]; then
                local node_name="${file//\//_}"
                node_name="${node_name//./_}"
                echo "    $node_name [label=\"${file##*/}\"];"
            fi
        done
        echo "  }"
        ((cluster_id++))
    done
    echo ""

    # Add edges
    for file in "${!FILE_DEPS[@]}"; do
        local from_node="${file//\//_}"
        from_node="${from_node//./_}"
        local deps="${FILE_DEPS[$file]}"
        for dep in $deps; do
            local to_node="${dep//\//_}"
            to_node="${to_node//./_}"
            echo "  $from_node -> $to_node;"
        done
    done

    echo "}"
}

output_mermaid() {
    echo "flowchart LR"
    echo ""

    # Create subgraphs
    declare -A dirs
    for file in "${!FILE_DEPS[@]}"; do
        local dir="${file%/*}"
        [[ "$dir" == "$file" ]] && dir="root"
        dirs[$dir]=1
    done

    for dir in $(printf '%s\n' "${!dirs[@]}" | sort); do
        echo "  subgraph $dir"
        for file in $(printf '%s\n' "${!FILE_DEPS[@]}" | sort); do
            local file_dir="${file%/*}"
            [[ "$file_dir" == "$file" ]] && file_dir="root"
            if [[ "$file_dir" == "$dir" ]]; then
                local node_id="${file//\//_}"
                node_id="${node_id//./_}"
                echo "    $node_id[\"${file##*/}\"]"
            fi
        done
        echo "  end"
    done
    echo ""

    # Add edges
    for file in "${!FILE_DEPS[@]}"; do
        local from_node="${file//\//_}"
        from_node="${from_node//./_}"
        local deps="${FILE_DEPS[$file]}"
        for dep in $deps; do
            local to_node="${dep//\//_}"
            to_node="${to_node//./_}"
            echo "  $from_node --> $to_node"
        done
    done
}

# =============================================================================
# MAIN
# =============================================================================

# Analyze all shell files
while IFS= read -r -d '' file; do
    analyze_file_deps "$file"
    analyze_file_functions "$file"
done < <(find "$TSM_SRC" -name "*.sh" -type f -print0 2>/dev/null)

# Output results
output_func="output_$FORMAT"
if [[ -n "$OUTPUT" ]]; then
    $output_func > "$OUTPUT"
    echo "Wrote dependency graph to $OUTPUT"
else
    $output_func
fi
