# Python module configuration
# PYTHON_DIR is set by includes.sh following tetra convention
# PYENV_ROOT stays at TETRA_DIR level (not nested in PYTHON_DIR)
export PYENV_ROOT="${TETRA_DIR}/pyenv"

# =============================================================================
# STATE DETECTION (shared by TPS, doctor, etc.)
# =============================================================================

# Returns one of: vp pp sp
# Used by TPS prompt and tetra_python_doctor
_tetra_python_state() {
    if [[ -n "$VIRTUAL_ENV" && "$VIRTUAL_ENV" == *"tetra"* ]]; then
        echo "vp"    # system python + venv
    elif [[ "$(command -v python 2>/dev/null)" == *"pyenv"* ]]; then
        echo "pp"    # pyenv manages isolation
    elif command -v python >/dev/null 2>&1; then
        echo "sp"    # system python, no isolation
    fi
}

# Human-readable label for a state code
_tetra_python_state_label() {
    case "${1:-}" in
        vp) echo "venv (system python)" ;;
        pp) echo "pyenv" ;;
        sp) echo "system python (no isolation)" ;;
        *)  echo "no python" ;;
    esac
}

# =============================================================================
# COMMANDS
# =============================================================================

tetra_python_install() {
    local python_version="${1:-3.11.11}"

    mkdir -p "$PYTHON_DIR"

    if [[ ! -d "$PYENV_ROOT" ]]; then
        echo "Installing pyenv in $PYENV_ROOT..."
        curl https://pyenv.run | bash
    fi

    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$("$PYENV_ROOT/bin/pyenv" init --path)"
    eval "$("$PYENV_ROOT/bin/pyenv" virtualenv-init -)"

    if ! "$PYENV_ROOT/bin/pyenv" versions --bare | grep -q "^$python_version\$"; then
        echo "Installing Python $python_version..."
        "$PYENV_ROOT/bin/pyenv" install "$python_version"
    else
        echo "Python $python_version is already installed."
    fi

    "$PYENV_ROOT/bin/pyenv" global "$python_version"
    echo "Python $python_version is now set as the global version."
}

tetra_python_activate() {
    if [[ -d "$PYENV_ROOT" ]]; then
        case ":$PATH:" in
            *":$PYENV_ROOT/bin:"*) ;;
            *) export PATH="$PYENV_ROOT/bin:$PATH" ;;
        esac
        case ":$PATH:" in
            *":$PYENV_ROOT/shims:"*) ;;
            *) export PATH="$PYENV_ROOT/shims:$PATH" ;;
        esac
        eval "$("$PYENV_ROOT/bin/pyenv" init --path)"
        eval "$("$PYENV_ROOT/bin/pyenv" virtualenv-init -)"
        echo "pyenv activated: $("$PYENV_ROOT/bin/pyenv" global)" >&2
    else
        echo "pyenv not installed. Run tetra_python_install first." >&2
        return 1
    fi
}

tetra_python_list() {
    if [[ -d "$PYENV_ROOT" ]]; then
        echo "Installed Python versions:"
        "$PYENV_ROOT/bin/pyenv" versions
    else
        echo "pyenv is not installed. Run tetra_python_install first."
    fi
}

tetra_python_doctor() {
    local state
    state=$(_tetra_python_state)
    local label
    label=$(_tetra_python_state_label "$state")

    # Runtime from install.conf
    local conf="$TETRA_SRC/bash/tetra/init/install.conf"
    local runtime="" conf_version=""
    if [[ -f "$conf" ]]; then
        runtime=$(. "$conf" && echo "$PYTHON_RUNTIME")
        conf_version=$(. "$conf" && echo "$PYTHON_VERSION")
    fi

    # Base python binary
    local base_python base_ver
    if [[ "$runtime" == "pyenv" && -x "$PYENV_ROOT/versions/$conf_version/bin/python3" ]]; then
        base_python="$PYENV_ROOT/versions/$conf_version/bin/python3"
    else
        base_python=$(command -v python3 2>/dev/null || true)
    fi
    base_ver=$("${base_python:-false}" --version 2>&1 | awk '{print $2}' 2>/dev/null || echo "?")

    # venv status
    local venv_dir="$TETRA_DIR/venv"
    local venv_status="missing" venv_ver=""
    if [[ -f "$venv_dir/bin/activate" ]]; then
        venv_ver=$("$venv_dir/bin/python" --version 2>&1 | awk '{print $2}')
        if [[ "$VIRTUAL_ENV" == "$venv_dir" ]]; then
            venv_status="active"
        else
            venv_status="inactive"
        fi
    fi

    # pip
    local pip_ver="" pkg_count=""
    if [[ -x "$venv_dir/bin/pip" ]]; then
        pip_ver=$("$venv_dir/bin/pip" --version 2>&1 | awk '{print $2}')
        pkg_count=$("$venv_dir/bin/pip" list --format=columns 2>/dev/null | tail -n +3 | wc -l | tr -d ' ')
    fi

    printf "  State:        %s  (%s)\n" "$state" "$label"
    printf "  Config:       PYTHON_RUNTIME=%s  PYTHON_VERSION=%s\n" "${runtime:-?}" "${conf_version:-?}"
    printf "  Python:       %s (%s)\n" "$base_ver" "${base_python:-none}"
    printf "  venv:         %s/ (%s)\n" "~/tetra/venv" "$venv_status"
    [[ -n "$venv_ver" ]] && printf "  venv python:  %s\n" "$venv_ver"
    [[ -n "$pip_ver" ]] && printf "  pip:          %s (%s packages)\n" "$pip_ver" "$pkg_count"

    if [[ -x "$venv_dir/bin/pip" ]]; then
        echo ""
        "$venv_dir/bin/pip" list --format=columns 2>/dev/null | head -20
    fi
}

tetra_python_help() {
    cat <<'EOF'
tetra python - Python environment management

STATES (shown in prompt)
  vp     venv active (system python + ~/tetra/venv/)
  pp     pyenv active (pyenv manages version + isolation)
  sp     system python, no isolation

COMMANDS
  tetra python doctor     Show current state, versions, packages
  tetra python state      One-line state code + label
  tetra python install    Install pyenv + python version
  tetra python activate   Add pyenv to PATH
  tetra python list       List pyenv-installed versions
  tetra python help       This help

MODEL
  PYTHON_RUNTIME=system   system python3 + ~/tetra/venv/ for isolation
  PYTHON_RUNTIME=pyenv    pyenv manages version + packages, no venv needed
EOF
}

export -f _tetra_python_state _tetra_python_state_label
export -f tetra_python_install tetra_python_activate tetra_python_list
export -f tetra_python_doctor tetra_python_help
