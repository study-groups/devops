#!/usr/bin/env bash

# TSM Runtime Information Commands
# Query and inspect runtime environment configuration

# Color helper - fallback to simple ANSI codes if color function not available
_tsm_color() {
    local color_name="$1"
    local modifier="${2:-}"

    if declare -f color >/dev/null 2>&1; then
        color "$color_name" "$modifier"
        return
    fi

    # Fallback to ANSI codes
    case "$color_name" in
        cyan)
            [[ "$modifier" == "bold" ]] && echo -ne '\033[1;36m' || echo -ne '\033[0;36m'
            ;;
        green)
            echo -ne '\033[0;32m'
            ;;
        yellow)
            echo -ne '\033[1;33m'
            ;;
        red)
            echo -ne '\033[0;31m'
            ;;
        blue)
            [[ "$modifier" == "bold" ]] && echo -ne '\033[1;34m' || echo -ne '\033[0;34m'
            ;;
        gray)
            echo -ne '\033[0;90m'
            ;;
        reset)
            echo -ne '\033[0m'
            ;;
    esac
}

# Get runtime information for a specific type
tsm_runtime_info() {
    local runtime_type="$1"

    # If no type specified, show all
    if [[ -z "$runtime_type" ]]; then
        tsm_runtime_info_all
        return $?
    fi

    # Normalize type name
    runtime_type="${runtime_type,,}"  # lowercase

    case "$runtime_type" in
        node|nodejs)
            _tsm_runtime_info_node
            ;;
        python|py)
            _tsm_runtime_info_python
            ;;
        bash)
            _tsm_runtime_info_bash
            ;;
        lua)
            _tsm_runtime_info_lua
            ;;
        go|golang)
            _tsm_runtime_info_go
            ;;
        *)
            echo "Unknown runtime type: $runtime_type" >&2
            echo "Supported: node, python, bash, lua, go" >&2
            return 1
            ;;
    esac
}

# Show info for all runtimes
tsm_runtime_info_all() {
    echo "Runtime Environment Information:"
    echo ""

    _tsm_runtime_info_node
    echo ""

    _tsm_runtime_info_python
    echo ""

    _tsm_runtime_info_bash
}

# Node.js runtime info
_tsm_runtime_info_node() {
    echo "$(_tsm_color cyan bold)Node.js Runtime:$(_tsm_color reset)"

    # Resolve interpreter
    local interpreter
    interpreter=$(tsm_resolve_interpreter "node")

    # Check if it exists
    if [[ ! -x "$interpreter" ]] && ! command -v "$interpreter" >/dev/null 2>&1; then
        echo "  $(_tsm_color red)✗$(_tsm_color reset) Interpreter not found: $interpreter"
        return 1
    fi

    # Get version
    local version
    if [[ -x "$interpreter" ]]; then
        version=$("$interpreter" --version 2>/dev/null || echo "unknown")
    else
        version=$(node --version 2>/dev/null || echo "unknown")
    fi

    echo "  Interpreter: $(_tsm_color green)$interpreter$(_tsm_color reset)"
    echo "  Version: $version"

    # Check NVM_DIR status
    if [[ -n "$NVM_DIR" ]]; then
        echo "  NVM_DIR: $(_tsm_color yellow)$NVM_DIR$(_tsm_color reset) (inherited from shell)"
        echo "  Source: $(_tsm_color cyan)Inherited from parent shell$(_tsm_color reset)"
        echo "  Pre-hook: $(_tsm_color gray)SKIPPED (NVM_DIR already set)$(_tsm_color reset)"

        # Show current nvm version if available
        if command -v nvm >/dev/null 2>&1; then
            local nvm_current
            nvm_current=$(nvm current 2>/dev/null || echo "none")
            echo "  Active nvm version: $nvm_current"
        fi
    else
        local tsm_nvm="$TETRA_DIR/nvm"
        if [[ -d "$tsm_nvm" ]]; then
            echo "  NVM_DIR: $(_tsm_color gray)Not set$(_tsm_color reset)"
            echo "  TSM nvm: $(_tsm_color green)$tsm_nvm$(_tsm_color reset)"
            echo "  Source: $(_tsm_color cyan)TSM will activate nvm$(_tsm_color reset)"
            echo "  Pre-hook: $(_tsm_color green)WILL RUN$(_tsm_color reset) (activate TSM nvm)"
        else
            echo "  NVM_DIR: $(_tsm_color gray)Not set$(_tsm_color reset)"
            echo "  TSM nvm: $(_tsm_color red)Not found at $tsm_nvm$(_tsm_color reset)"
            echo "  Source: $(_tsm_color yellow)System fallback$(_tsm_color reset)"
            echo "  Pre-hook: None"
        fi
    fi

    # Show pre-hook command
    echo ""
    echo "  Pre-hook command:"
    if declare -f tsm_get_prehook >/dev/null 2>&1; then
        local prehook
        prehook=$(tsm_get_prehook "node")
        if [[ -n "$prehook" ]]; then
            echo "$prehook" | sed 's/^/    /'
        else
            echo "    (none)"
        fi
    else
        echo "    (hooks.sh not loaded)"
    fi

    # Show override suggestions
    echo ""
    echo "  $(_tsm_color cyan)To use a different version:$(_tsm_color reset)"
    echo "    nvm use v18 && tsm start node test.js"
    echo "    tsm start --pre-hook \"nvm use v18\" node test.js"
}

# Python runtime info
_tsm_runtime_info_python() {
    echo "$(_tsm_color cyan bold)Python Runtime:$(_tsm_color reset)"

    # Resolve interpreter
    local interpreter
    interpreter=$(tsm_resolve_interpreter "python")

    # Check if it exists
    if [[ ! -x "$interpreter" ]] && ! command -v "$interpreter" >/dev/null 2>&1; then
        echo "  $(_tsm_color red)✗$(_tsm_color reset) Interpreter not found: $interpreter"
        return 1
    fi

    # Get version
    local version
    if [[ -x "$interpreter" ]]; then
        version=$("$interpreter" --version 2>&1 | head -1 || echo "unknown")
    else
        version=$(python3 --version 2>&1 || echo "unknown")
    fi

    echo "  Interpreter: $(_tsm_color green)$interpreter$(_tsm_color reset)"
    echo "  Version: $version"

    # Check PYENV_ROOT status
    if [[ -n "$PYENV_ROOT" && -d "$PYENV_ROOT" ]]; then
        echo "  PYENV_ROOT: $(_tsm_color green)$PYENV_ROOT$(_tsm_color reset)"
        echo "  Source: pyenv available"

        if command -v pyenv >/dev/null 2>&1; then
            local pyenv_version
            pyenv_version=$(pyenv version-name 2>/dev/null || echo "unknown")
            echo "  Active pyenv version: $pyenv_version"
        fi
    else
        echo "  PYENV_ROOT: $(_tsm_color gray)Not set or not found$(_tsm_color reset)"
        echo "  Source: System Python"
    fi

    # Show pre-hook command
    echo ""
    echo "  Pre-hook command:"
    if declare -f tsm_get_prehook >/dev/null 2>&1; then
        local prehook
        prehook=$(tsm_get_prehook "python")
        if [[ -n "$prehook" ]]; then
            echo "$prehook" | sed 's/^/    /'
        else
            echo "    (none)"
        fi
    else
        echo "    (hooks.sh not loaded)"
    fi

    # Show override suggestions
    echo ""
    echo "  $(_tsm_color cyan)To use a different version:$(_tsm_color reset)"
    echo "    pyenv local 3.11 && tsm start python app.py"
    echo "    tsm start --pre-hook \"pyenv local 3.11\" python app.py"
}

# Bash runtime info
_tsm_runtime_info_bash() {
    echo "$(_tsm_color cyan bold)Bash Runtime:$(_tsm_color reset)"

    # Resolve interpreter
    local interpreter
    interpreter=$(tsm_resolve_interpreter "bash")

    # Check if it exists
    if [[ ! -x "$interpreter" ]]; then
        echo "  $(_tsm_color red)✗$(_tsm_color reset) Interpreter not found: $interpreter"
        return 1
    fi

    # Get version
    local version
    version=$("$interpreter" --version 2>&1 | head -1 || echo "unknown")

    echo "  Interpreter: $(_tsm_color green)$interpreter$(_tsm_color reset)"
    echo "  Version: $version"
    echo "  Source: Platform default"
}

# Lua runtime info
_tsm_runtime_info_lua() {
    echo "$(_tsm_color cyan bold)Lua Runtime:$(_tsm_color reset)"

    local interpreter
    interpreter=$(tsm_resolve_interpreter "lua")

    if command -v lua >/dev/null 2>&1; then
        local version
        version=$(lua -v 2>&1 | head -1 || echo "unknown")
        echo "  Interpreter: $(_tsm_color green)$interpreter$(_tsm_color reset)"
        echo "  Version: $version"
    else
        echo "  $(_tsm_color gray)✗ Not installed$(_tsm_color reset)"
    fi
}

# Go runtime info
_tsm_runtime_info_go() {
    echo "$(_tsm_color cyan bold)Go Runtime:$(_tsm_color reset)"

    local interpreter
    interpreter=$(tsm_resolve_interpreter "go")

    if command -v go >/dev/null 2>&1; then
        local version
        version=$(go version 2>&1 || echo "unknown")
        echo "  Interpreter: $(_tsm_color green)$interpreter$(_tsm_color reset)"
        echo "  Version: $version"
    else
        echo "  $(_tsm_color gray)✗ Not installed$(_tsm_color reset)"
    fi
}

# List all available runtimes
tsm_runtime_list() {
    echo "Available Runtimes:"
    echo ""

    # Node
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version 2>/dev/null)
        local node_path=$(command -v node)
        echo "  $(_tsm_color green)✓$(_tsm_color reset) node     $node_version  $node_path"
    else
        echo "  $(_tsm_color red)✗$(_tsm_color reset) node     not found"
    fi

    # Python
    if command -v python3 >/dev/null 2>&1; then
        local py_version=$(python3 --version 2>&1 | awk '{print $2}')
        local py_path=$(command -v python3)
        echo "  $(_tsm_color green)✓$(_tsm_color reset) python   $py_version    $py_path"
    else
        echo "  $(_tsm_color red)✗$(_tsm_color reset) python   not found"
    fi

    # Bash
    if [[ -n "$BASH_VERSION" ]]; then
        local bash_path=$(command -v bash)
        echo "  $(_tsm_color green)✓$(_tsm_color reset) bash     $BASH_VERSION    $bash_path"
    else
        echo "  $(_tsm_color red)✗$(_tsm_color reset) bash     not found"
    fi

    # Lua
    if command -v lua >/dev/null 2>&1; then
        local lua_version=$(lua -v 2>&1 | head -1)
        local lua_path=$(command -v lua)
        echo "  $(_tsm_color green)✓$(_tsm_color reset) lua      $lua_version"
    else
        echo "  $(_tsm_color gray)✗$(_tsm_color reset) lua      not found"
    fi

    # Go
    if command -v go >/dev/null 2>&1; then
        local go_version=$(go version 2>&1 | awk '{print $3}')
        local go_path=$(command -v go)
        echo "  $(_tsm_color green)✓$(_tsm_color reset) go       $go_version    $go_path"
    else
        echo "  $(_tsm_color gray)✗$(_tsm_color reset) go       not found"
    fi
}

# Main runtime command dispatcher
tetra_tsm_runtime() {
    local subcommand="${1:-info}"
    shift || true

    case "$subcommand" in
        info)
            tsm_runtime_info "$@"
            ;;
        list)
            tsm_runtime_list
            ;;
        help)
            if declare -f tsm_help_command >/dev/null 2>&1; then
                tsm_help_command "runtime"
            else
                echo "Usage: tsm runtime [info|list] [TYPE]"
                echo ""
                echo "Subcommands:"
                echo "  info [TYPE]  Show runtime information (node, python, bash)"
                echo "  list         List all available runtimes"
            fi
            ;;
        *)
            echo "Unknown runtime subcommand: $subcommand" >&2
            echo "Usage: tsm runtime [info|list|help]" >&2
            return 1
            ;;
    esac
}

export -f tsm_runtime_info
export -f tsm_runtime_info_all
export -f tsm_runtime_list
export -f tetra_tsm_runtime
export -f _tsm_runtime_info_node
export -f _tsm_runtime_info_python
export -f _tsm_runtime_info_bash
export -f _tsm_runtime_info_lua
export -f _tsm_runtime_info_go
