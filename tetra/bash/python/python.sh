# Python module configuration
# PYTHON_DIR is set by includes.sh following tetra convention
# PYENV_ROOT stays at TETRA_DIR level (not nested in PYTHON_DIR)
export PYENV_ROOT="${TETRA_DIR}/pyenv"

# Function to install pyenv and a specific Python version
tetra_python_install() {
    local python_version="${1:-3.11.11}"  # Default Python version

    # Ensure PYTHON_DIR exists
    mkdir -p "$PYTHON_DIR"

    # Install pyenv if not already installed
    if [[ ! -d "$PYENV_ROOT" ]]; then
        echo "Installing pyenv in $PYENV_ROOT..."
        curl https://pyenv.run | bash
    fi

    # Dynamically update the PATH for the current session
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$("$PYENV_ROOT/bin/pyenv" init --path)"
    eval "$("$PYENV_ROOT/bin/pyenv" virtualenv-init -)"

    # Install the specified Python version
    if ! "$PYENV_ROOT/bin/pyenv" versions --bare | grep -q "^$python_version\$"; then
        echo "Installing Python $python_version..."
        "$PYENV_ROOT/bin/pyenv" install "$python_version"
    else
        echo "Python $python_version is already installed."
    fi

    # Set global Python version
    "$PYENV_ROOT/bin/pyenv" global "$python_version"
    echo "Python $python_version is now set as the global version."
}

# Function to activate pyenv and update PATH for the current session without duplicates
tetra_python_activate() {
    if [[ -d "$PYENV_ROOT" ]]; then
        # Add to PATH only if not already included
        case ":$PATH:" in
            *":$PYENV_ROOT/bin:"*) ;;  # Already in PATH, do nothing
            *) export PATH="$PYENV_ROOT/bin:$PATH" ;;
        esac

        case ":$PATH:" in
            *":$PYENV_ROOT/shims:"*) ;;  # Already in PATH, do nothing
            *) export PATH="$PYENV_ROOT/shims:$PATH" ;;
        esac

        eval "$("$PYENV_ROOT/bin/pyenv" init --path)"
        eval "$("$PYENV_ROOT/bin/pyenv" virtualenv-init -)"
        echo "pyenv is activated. Current Python version: $("$PYENV_ROOT/bin/pyenv" global)"
    else
        echo "pyenv is not installed. Run tetra_python_install first."
    fi
}

# Function to list all installed Python versions
tetra_python_list() {
    if [[ -d "$PYENV_ROOT" ]]; then
        echo "Installed Python versions:"
        "$PYENV_ROOT/bin/pyenv" versions
    else
        echo "pyenv is not installed. Run tetra_python_install first."
    fi
}

# Enhanced function to debug pyenv and environment status
tetra_python_status() {
    echo "=== Tetra Python Status ==="

    # Display environment variables
    echo "PYTHON_DIR: $PYTHON_DIR"
    echo "PYTHON_SRC: $PYTHON_SRC"
    echo "PYENV_ROOT: $PYENV_ROOT"
    echo "PATH includes PYENV_ROOT/bin: $([[ ":$PATH:" == *":$PYENV_ROOT/bin:"* ]] && echo "Yes" || echo "No")"
    echo

    # Check pyenv installation
    if [[ -d "$PYENV_ROOT" ]]; then
        echo "pyenv root exists at $PYENV_ROOT"
        echo "pyenv version: $("$PYENV_ROOT/bin/pyenv" --version)"
    else
        echo "pyenv root directory is missing."
    fi

    # Check pyenv initialization
    eval "$("$PYENV_ROOT/bin/pyenv" init --path 2>/dev/null)" && echo "pyenv init: SUCCESS" || echo "pyenv init: FAILED"
    eval "$("$PYENV_ROOT/bin/pyenv" virtualenv-init - 2>/dev/null)" && echo "pyenv virtualenv-init: SUCCESS" || echo "pyenv virtualenv-init: FAILED"
    echo

    # Check Python versions
    if [[ -d "$PYENV_ROOT" ]]; then
        echo "Installed Python versions:"
        "$PYENV_ROOT/bin/pyenv" versions
        echo "Global Python version: $("$PYENV_ROOT/bin/pyenv" global)"
    else
        echo "pyenv installation not found."
    fi
    echo

    # Debug pyenv directories
    echo "pyenv root directory contents:"
    ls -l "$PYENV_ROOT" || echo "$PYENV_ROOT does not exist."
    echo
    echo "pyenv versions directory contents:"
    ls -l "$PYENV_ROOT/versions" || echo "$PYENV_ROOT/versions does not exist."
    echo
    echo "pyenv shims directory contents:"
    ls -l "$PYENV_ROOT/shims" || echo "$PYENV_ROOT/shims does not exist."
    echo

    echo "=== End of Status ==="
}
