#!/usr/bin/env bash
# bash/lib/treesitter.sh - Tree-sitter wrapper for tetra
#
# Provides AST parsing capabilities using tree-sitter CLI.
# Falls back gracefully when tree-sitter or language grammars unavailable.
#
# Usage:
#   source "$TETRA_SRC/bash/lib/treesitter.sh"
#   ts_available bash && ts_list_functions file.sh
#
# Supported languages: bash, go, python, javascript, typescript, c, json, toml, markdown

# Cache for availability checks
declare -gA _TS_LANG_AVAILABLE

# Check if tree-sitter CLI is installed
ts_installed() {
    command -v tree-sitter &>/dev/null
}

# Check if a specific language grammar is available
# Usage: ts_available <language>
ts_available() {
    local lang="$1"

    # Return cached result if available
    if [[ -v "_TS_LANG_AVAILABLE[$lang]" ]]; then
        return "${_TS_LANG_AVAILABLE[$lang]}"
    fi

    if ! ts_installed; then
        _TS_LANG_AVAILABLE[$lang]=1
        return 1
    fi

    # Tree-sitter requires files to be in configured parser directories
    # Test by creating file in TETRA_SRC which should be in a search path
    local test_dir="${TETRA_SRC:-/tmp}"
    local test_file="$test_dir/.ts_test_$$"
    local ext
    case "$lang" in
        bash|sh)   ext=".sh"; echo ':' > "$test_file$ext" ;;
        go)        ext=".go"; echo 'package main' > "$test_file$ext" ;;
        python|py) ext=".py"; echo 'pass' > "$test_file$ext" ;;
        javascript|js) ext=".js"; echo ';' > "$test_file$ext" ;;
        typescript|ts) ext=".ts"; echo ';' > "$test_file$ext" ;;
        c)         ext=".c"; echo ';' > "$test_file$ext" ;;
        json)      ext=".json"; echo '{}' > "$test_file$ext" ;;
        toml)      ext=".toml"; echo 'key = "value"' > "$test_file$ext" ;;
        markdown|md) ext=".md"; echo '# Test' > "$test_file$ext" ;;
        *)
            _TS_LANG_AVAILABLE[$lang]=1
            return 1
            ;;
    esac

    # Check if parse produces valid output (not just exit code)
    local parse_output
    parse_output=$(tree-sitter parse "$test_file$ext" 2>&1)
    rm -f "$test_file$ext"

    # If output contains "No language found" or is empty, grammar not available
    if [[ -z "$parse_output" || "$parse_output" == *"No language"* ]]; then
        _TS_LANG_AVAILABLE[$lang]=1
        return 1
    fi

    _TS_LANG_AVAILABLE[$lang]=0
    return 0
}

# Parse a file and return S-expression AST
# Usage: ts_parse <file>
ts_parse() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    tree-sitter parse "$file" 2>/dev/null
}

# Run a tree-sitter query on a file
# Usage: ts_query <query_file> <source_file>
# Or:    echo "(query)" | ts_query - <source_file>
ts_query() {
    local query="$1"
    local file="$2"

    if [[ "$query" == "-" ]]; then
        # Read query from stdin
        local tmp_query="/tmp/.ts_query_$$.scm"
        cat > "$tmp_query"
        tree-sitter query "$tmp_query" "$file" 2>/dev/null
        local status=$?
        rm -f "$tmp_query"
        return $status
    else
        tree-sitter query "$query" "$file" 2>/dev/null
    fi
}

# Highlight a file (syntax coloring)
# Usage: ts_highlight <file>
ts_highlight() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    tree-sitter highlight "$file" 2>/dev/null
}

# List function names in a file (language-specific)
# Usage: ts_list_functions <file>
ts_list_functions() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    local lang
    case "${file##*.}" in
        sh|bash) lang="bash" ;;
        go) lang="go" ;;
        py) lang="python" ;;
        js) lang="javascript" ;;
        ts) lang="typescript" ;;
        c|h) lang="c" ;;
        *) lang="unknown" ;;
    esac

    if ! ts_available "$lang"; then
        echo "Error: No tree-sitter grammar for $lang" >&2
        return 1
    fi

    # Language-specific queries
    local query
    case "$lang" in
        bash)
            query='(function_definition name: (word) @name)'
            ;;
        go)
            query='(function_declaration name: (identifier) @name)'
            ;;
        python)
            query='(function_definition name: (identifier) @name)'
            ;;
        javascript|typescript)
            query='[(function_declaration name: (identifier) @name)
                    (method_definition name: (property_identifier) @name)]'
            ;;
        c)
            query='(function_definition declarator: (function_declarator declarator: (identifier) @name))'
            ;;
        *)
            echo "Error: Unsupported language: $lang" >&2
            return 1
            ;;
    esac

    echo "$query" | ts_query - "$file" | grep '@name' | sed 's/.*@name: //' | tr -d '"'
}

# Extract a function by name from a file
# Usage: ts_extract_function <file> <func_name>
ts_extract_function() {
    local file="$1"
    local func_name="$2"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    local lang
    case "${file##*.}" in
        sh|bash) lang="bash" ;;
        go) lang="go" ;;
        py) lang="python" ;;
        js) lang="javascript" ;;
        ts) lang="typescript" ;;
        *) lang="unknown" ;;
    esac

    if ! ts_available "$lang"; then
        echo "Error: No tree-sitter grammar for $lang" >&2
        return 1
    fi

    # Parse file to get AST with byte positions
    local ast
    ast=$(ts_parse "$file")
    if [[ -z "$ast" ]]; then
        return 1
    fi

    # TODO: Parse S-expression to find function node, extract byte range
    # For now, return failure to signal fallback
    return 1
}

# Get tree-sitter status
ts_status() {
    echo "Tree-sitter status:"
    if ts_installed; then
        echo "  CLI: $(tree-sitter --version)"
    else
        echo "  CLI: not installed"
        return 1
    fi

    echo "  Languages:"
    local langs=(bash go python javascript typescript c json toml markdown)
    for lang in "${langs[@]}"; do
        if ts_available "$lang"; then
            echo "    $lang: available"
        else
            echo "    $lang: not available"
        fi
    done
}

# Install tree-sitter bash grammar (helper)
ts_install_bash() {
    echo "To install tree-sitter bash grammar:"
    echo ""
    echo "  # Clone the grammar"
    echo "  git clone https://github.com/tree-sitter/tree-sitter-bash.git"
    echo "  cd tree-sitter-bash"
    echo ""
    echo "  # Build and register"
    echo "  tree-sitter generate"
    echo "  tree-sitter build"
    echo ""
    echo "  # Or use npm"
    echo "  npm install tree-sitter-bash"
    echo ""
    echo "Then ensure the parser directory is in your tree-sitter config."
}
