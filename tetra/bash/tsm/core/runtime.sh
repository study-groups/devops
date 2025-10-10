#!/usr/bin/env bash

# TSM Runtime Environment Resolution
# Detects process type and resolves correct interpreter from TETRA_DIR

# Detect process type from command string
tsm_detect_type() {
    local command="$1"

    # Extract first word (command/interpreter)
    local first_word="${command%% *}"
    local basename="${first_word##*/}"

    # Detect by interpreter or extension
    case "$basename" in
        python*|*.py)
            echo "python"
            ;;
        node*|*.js)
            echo "node"
            ;;
        bash*|*.sh)
            echo "bash"
            ;;
        lua*|*.lua)
            echo "lua"
            ;;
        go*)
            echo "go"
            ;;
        *)
            # Check if file has extension
            if [[ "$command" =~ \.(py|js|sh|lua|go)([[:space:]]|$) ]]; then
                local ext="${BASH_REMATCH[1]}"
                case "$ext" in
                    py) echo "python" ;;
                    js) echo "node" ;;
                    sh) echo "bash" ;;
                    lua) echo "lua" ;;
                    go) echo "go" ;;
                esac
            else
                echo "command"
            fi
            ;;
    esac
}

# Resolve interpreter path based on type
tsm_resolve_interpreter() {
    local type="$1"

    case "$type" in
        python)
            # Use pyenv python if available
            if [[ -d "$PYENV_ROOT/shims" && -x "$PYENV_ROOT/shims/python" ]]; then
                echo "$PYENV_ROOT/shims/python"
            elif command -v python3 >/dev/null 2>&1; then
                command -v python3
            else
                echo "python"
            fi
            ;;
        node)
            # Use nvm node if available
            if [[ -d "$TETRA_DIR/nvm" ]]; then
                # Source nvm and get current node
                if [[ -s "$TETRA_DIR/nvm/nvm.sh" ]]; then
                    source "$TETRA_DIR/nvm/nvm.sh" 2>/dev/null
                    nvm which current 2>/dev/null || echo "node"
                else
                    echo "node"
                fi
            elif command -v node >/dev/null 2>&1; then
                command -v node
            else
                echo "node"
            fi
            ;;
        bash)
            # Platform-specific bash location
            if [[ "$OSTYPE" == "darwin"* ]]; then
                if [[ -x "/opt/homebrew/bin/bash" ]]; then
                    echo "/opt/homebrew/bin/bash"
                elif [[ -x "/usr/local/bin/bash" ]]; then
                    echo "/usr/local/bin/bash"
                else
                    echo "/bin/bash"
                fi
            else
                # Linux
                if [[ -x "/usr/bin/bash" ]]; then
                    echo "/usr/bin/bash"
                else
                    echo "/bin/bash"
                fi
            fi
            ;;
        lua)
            # Future: lua in TETRA_DIR
            if [[ -x "$TETRA_DIR/lua/bin/lua" ]]; then
                echo "$TETRA_DIR/lua/bin/lua"
            elif command -v lua >/dev/null 2>&1; then
                command -v lua
            else
                echo "lua"
            fi
            ;;
        go)
            # Future: go in TETRA_DIR
            if [[ -x "$TETRA_DIR/go/bin/go" ]]; then
                echo "$TETRA_DIR/go/bin/go"
            elif command -v go >/dev/null 2>&1; then
                command -v go
            else
                echo "go"
            fi
            ;;
        *)
            # For 'command' type, return empty (use command as-is)
            echo ""
            ;;
    esac
}

# Build environment activation commands based on type
tsm_build_env_activation() {
    local type="$1"

    case "$type" in
        python)
            # Activate pyenv
            if [[ -d "$PYENV_ROOT" ]]; then
                cat <<'EOF'
export PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"
eval "$(pyenv init --path 2>/dev/null || true)"
eval "$(pyenv virtualenv-init - 2>/dev/null || true)"
EOF
            fi
            ;;
        node)
            # Activate nvm
            if [[ -d "$TETRA_DIR/nvm" ]]; then
                cat <<EOF
export TETRA_NVM="$TETRA_DIR/nvm"
[ -s "\$TETRA_NVM/nvm.sh" ] && source "\$TETRA_NVM/nvm.sh"
nvm use node >/dev/null 2>&1 || true
EOF
            fi
            ;;
        *)
            # No special activation needed
            echo ""
            ;;
    esac
}

# Rewrite command to use resolved interpreter
tsm_rewrite_command_with_interpreter() {
    local command="$1"
    local type="$2"
    local interpreter="$3"

    # If no interpreter resolved or type is 'command', return as-is
    if [[ -z "$interpreter" || "$type" == "command" ]]; then
        echo "$command"
        return 0
    fi

    # Extract first word from command
    local first_word="${command%% *}"
    local rest="${command#* }"

    # If command is just the interpreter, return as-is
    if [[ "$command" == "$first_word" ]]; then
        echo "$interpreter"
        return 0
    fi

    # Check if first word is already the interpreter or a path to it
    case "$first_word" in
        python*|node*|bash*|lua*|go*)
            # Replace with resolved interpreter
            echo "$interpreter $rest"
            ;;
        *.py|*.js|*.sh|*.lua|*.go)
            # Script file - prepend interpreter
            echo "$interpreter $command"
            ;;
        *)
            # Unknown - return as-is
            echo "$command"
            ;;
    esac
}

export -f tsm_detect_type
export -f tsm_resolve_interpreter
export -f tsm_build_env_activation
export -f tsm_rewrite_command_with_interpreter
