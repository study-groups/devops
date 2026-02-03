#!/usr/bin/env bash
# init.sh - Create ~/tetra/ skeleton and ~/start-tetra.sh
# Extracted from setup.sh. Idempotent: safe to re-run.
#
# Usage (standalone):  bash init.sh
# Usage (from tetra):  tetra init

# Resolve paths when sourced or executed
_INIT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_INIT_TETRA_SRC="$(cd "$_INIT_SCRIPT_DIR/../../.." && pwd)"

# --- Terminal helpers (reused from setup.sh when run standalone) ---
_init_setup_terminal() {
    COLS=$(tput cols 2>/dev/null || echo 60)
    RST=$'\e[0m'; BOLD=$'\e[1m'; DIM=$'\e[2m'
    GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; CYAN=$'\e[36m'
    _ok()   { printf "  ${GREEN}✓${RST} %-$(( COLS - 6 ))s\n" "$1"; }
    _fail() { printf "  ${RED}✗${RST} %-$(( COLS - 6 ))s\n" "$1"; }
    _warn() { printf "  ${YELLOW}⚠${RST} %-$(( COLS - 6 ))s\n" "$1"; }
    _info() { printf "  ${DIM}%-$(( COLS - 4 ))s${RST}\n" "$1"; }
    _step() { printf "\n${BOLD}${CYAN}▸ %s${RST}\n" "$1"; }
    _hr()   { printf "${DIM}%*s${RST}\n" "$COLS" "" | tr ' ' '─'; }
}

# Ensure terminal helpers exist (setup.sh defines them, standalone needs them)
declare -f _ok &>/dev/null || _init_setup_terminal

# --- Detect bash 5.2+ binary ---
_init_detect_bash() {
    _detected_bash="$BASH"
    _detected_bash_ver="${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
    if [[ "$OSTYPE" == "darwin"* && "$BASH" == "/bin/bash" ]]; then
        for _candidate in /opt/homebrew/bin/bash /usr/local/bin/bash; do
            if [[ -x "$_candidate" ]]; then
                local _cver
                _cver=$("$_candidate" -c 'echo "${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"' 2>/dev/null)
                local _cmajor="${_cver%%.*}"
                if [[ "${_cmajor:-0}" -ge 5 ]]; then
                    _detected_bash="$_candidate"
                    _detected_bash_ver="$_cver"
                    break
                fi
            fi
        done
    fi
}

# --- Create ~/tetra/ skeleton from tetra-dir template ---
_tetra_init_runtime_dir() {
    local tetra_runtime="${1:-$HOME/tetra}"
    local tetra_src="${2:-$_INIT_TETRA_SRC}"

    _step "Runtime directory"
    if [[ -d "$tetra_runtime" ]]; then
        _info "Updating $tetra_runtime/tetra.sh"
    else
        _info "Creating $tetra_runtime/"
        cp -r "$_INIT_SCRIPT_DIR/tetra-dir" "$tetra_runtime"
    fi

    cat > "$tetra_runtime/tetra.sh" <<ENTRY
#!/usr/bin/env bash
TETRA_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="\${TETRA_SRC:-$tetra_src}"
export TETRA_DIR TETRA_SRC
source "\$TETRA_SRC/bash/bootloader.sh"
ENTRY

    _ok "tetra.sh  ${DIM}TETRA_SRC=$tetra_src${RST}"
}

# --- Write ~/start-tetra.sh ---
_tetra_init_start_script() {
    local tetra_runtime="${1:-$HOME/tetra}"
    local tetra_src="${2:-$_INIT_TETRA_SRC}"
    local start_script="$HOME/start-tetra.sh"

    # Load install.conf for toggle defaults
    local conf="$_INIT_SCRIPT_DIR/install.conf"
    local _bun_toggle="false" _python_toggle="off"
    if [[ -f "$conf" ]]; then
        source "$conf"
        [[ "${BUN_INSTALL:-}" == "true" ]] && _bun_toggle="true"
        _python_toggle="${PYTHON_RUNTIME:-off}"
    fi

    # Detect bash for shell hint
    _init_detect_bash

    _step "Shell integration"

    cat > "$start_script" <<STARTER
# start-tetra.sh - Tetra shell bootstrap
# Source this to load tetra: source ~/start-tetra.sh
# NOTE: This file is sourced, not executed. Do not chmod +x.
#
# INSTALL:  Add to ~/.bashrc or ~/.bash_profile:
#             source ~/start-tetra.sh
# MODIFY:   Edit any variable below, or set before sourcing.
# REMOVE:   Delete this file and remove the source line from your rc file.
#
# CONFIGURATION
# Override any of these before sourcing, or edit in-place:
#
#   TETRA_SRC          Source repo        $tetra_src
#   TETRA_DIR          Runtime data       $tetra_runtime
#   TETRA_NVM          Enable nvm         true
#   TETRA_BUN          Enable bun         $_bun_toggle
#   TETRA_PYTHON       Python runtime     $_python_toggle  (system|pyenv|off)
#   TETRA_LOCAL        Load local.sh      false
#   TETRA_SHELL        Bash 5.2+ binary   (auto-detected)
#   TETRA_INVOKE_MODE  Force invoke mode  (auto: interactive|ssh|agent|cron|script)
#   TPS_STYLE          Prompt style       (auto per mode, or: tiny|compact|default|verbose)
#
# SHELL REQUIREMENT
# Tetra requires bash 5.2+. On macOS, /bin/bash is 3.x.
# The bootloader auto-detects the running interpreter, but if you need
# to force a specific binary (e.g. Homebrew bash):
#   export TETRA_SHELL="$_detected_bash"

# --- Core paths ---
export TETRA_DIR="\${TETRA_DIR:-$tetra_runtime}"
export TETRA_SRC="\${TETRA_SRC:-$tetra_src}"

# --- Shell override (uncomment to force a specific bash 5.2+ binary) ---
# export TETRA_SHELL="$_detected_bash"

# --- Invoke mode override (uncomment to force a mode) ---
# export TETRA_INVOKE_MODE="interactive"

# --- TPS style override per mode (uncomment to customize) ---
# export TPS_STYLE="default"

# --- Toggles (set before sourcing to override) ---
: "\${TETRA_NVM:=true}"
: "\${TETRA_BUN:=$_bun_toggle}"
: "\${TETRA_PYTHON:=$_python_toggle}"
: "\${TETRA_LOCAL:=false}"

# --- Node (nvm) ---
if [[ "\$TETRA_NVM" == "true" && -s "\$TETRA_DIR/nvm/nvm.sh" ]]; then
    export NVM_DIR="\$TETRA_DIR/nvm"
    source "\$NVM_DIR/nvm.sh"
fi

# --- Bun ---
if [[ "\$TETRA_BUN" == "true" && -x "\$TETRA_DIR/bun/bin/bun" ]]; then
    export BUN_INSTALL="\$TETRA_DIR/bun"
    export PATH="\$BUN_INSTALL/bin:\$PATH"
fi

# --- Bootloader (loads all modules) ---
source "\$TETRA_SRC/bash/bootloader.sh"

# --- Python ---
case "\$TETRA_PYTHON" in
    pyenv)
        [[ -x "\${PYENV_ROOT:-\$TETRA_DIR/pyenv}/bin/pyenv" ]] && tetra_python_activate 2>/dev/null
        ;;
    system)
        [[ -f "\$TETRA_DIR/venv/bin/activate" ]] && source "\$TETRA_DIR/venv/bin/activate"
        ;;
    off) ;;
esac

# --- Local overrides ---
if [[ "\$TETRA_LOCAL" == "true" && -f "\$TETRA_DIR/local.sh" ]]; then
    source "\$TETRA_DIR/local.sh"
fi

true
STARTER
    chmod 644 "$start_script"
    _ok "start-tetra.sh  ${DIM}(source only, 644)${RST}"
}

# --- Create default org ---
_tetra_init_org() {
    local tetra_runtime="${1:-$HOME/tetra}"
    local orgs_dir="$tetra_runtime/orgs"

    _step "Default org"
    if [[ ! -d "$orgs_dir/tetra" ]]; then
        mkdir -p "$orgs_dir/tetra/sections"
        mkdir -p "$orgs_dir/tetra/pd/data/projects"
        mkdir -p "$orgs_dir/tetra/pd/config"
        mkdir -p "$orgs_dir/tetra/pd/cache"
        mkdir -p "$orgs_dir/tetra/tut/src"
        mkdir -p "$orgs_dir/tetra/tut/compiled"
        mkdir -p "$orgs_dir/tetra/workspace"
        mkdir -p "$orgs_dir/tetra/backups"
        _ok "Created orgs/tetra/"
    else
        _info "orgs/tetra/ exists"
    fi

    # Symlink active config
    mkdir -p "$tetra_runtime/config"
    if [[ ! -L "$tetra_runtime/config/tetra.toml" && -d "$orgs_dir/tetra" ]]; then
        [[ ! -f "$orgs_dir/tetra/tetra.toml" ]] && echo "# tetra org config" > "$orgs_dir/tetra/tetra.toml"
        ln -sf "$orgs_dir/tetra/tetra.toml" "$tetra_runtime/config/tetra.toml"
        _ok "config/tetra.toml → orgs/tetra/tetra.toml"
    fi
}

# --- Orchestrator ---
tetra_init() {
    local tetra_runtime="${TETRA_DIR:-$HOME/tetra}"
    local tetra_src="${TETRA_SRC:-$_INIT_TETRA_SRC}"

    _tetra_init_runtime_dir "$tetra_runtime" "$tetra_src"
    _tetra_init_start_script "$tetra_runtime" "$tetra_src"
    _tetra_init_org "$tetra_runtime"

    echo ""
    _ok "tetra init complete"
    _info "Next: tetra install all  (or: tetra install nvm, tetra install bun)"
}

# --- Run standalone ---
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    set -euo pipefail
    tetra_init "$@"
fi
