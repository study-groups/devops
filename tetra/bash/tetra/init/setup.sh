#!/usr/bin/env bash
# setup.sh - Tetra installation
# Detects TETRA_SRC from repo location, creates ~/tetra, wires shell rc.
# Idempotent: safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC_DETECTED="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# --- Install config ---
source "$SCRIPT_DIR/install.conf"

# --- Uninstall help ---
if [[ "${1:-}" == "--remove" ]]; then
    cat <<'UNINSTALL'
Tetra Uninstall Steps:
  1. Remove "source ~/start-tetra.sh" from ~/.bashrc or ~/.bash_profile
  2. rm ~/start-tetra.sh
  3. rm -rf ~/tetra          (runtime data, nvm, venv, orgs)
  4. Optionally remove source repo (TETRA_SRC)
  5. Restart your shell
UNINSTALL
    exit 0
fi

# --- Terminal setup ---
COLS=$(tput cols 2>/dev/null || echo 60)
RST=$'\e[0m'
BOLD=$'\e[1m'
DIM=$'\e[2m'
GREEN=$'\e[32m'
RED=$'\e[31m'
YELLOW=$'\e[33m'
CYAN=$'\e[36m'
BLUE=$'\e[34m'

_ok()   { printf "  ${GREEN}✓${RST} %-$(( COLS - 6 ))s\n" "$1"; }
_fail() { printf "  ${RED}✗${RST} %-$(( COLS - 6 ))s\n" "$1"; }
_warn() { printf "  ${YELLOW}⚠${RST} %-$(( COLS - 6 ))s\n" "$1"; }
_info() { printf "  ${DIM}%-$(( COLS - 4 ))s${RST}\n" "$1"; }
_step() { printf "\n${BOLD}${CYAN}▸ %s${RST}\n" "$1"; }
_hr()   { printf "${DIM}%*s${RST}\n" "$COLS" "" | tr ' ' '─'; }

_banner() {
    _hr
    printf "${BOLD}  %s${RST}\n" "$1"
    [[ -n "${2:-}" ]] && printf "  ${DIM}%s${RST}\n" "$2"
    _hr
}

# --- Bash version gate ---
if [[ "${BASH_VERSINFO[0]}" -lt 5 ]] || [[ "${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2 ]]; then
    _banner "Tetra Setup" "bash 5.2+ required"
    _fail "bash ${BASH_VERSION} is too old"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        _info "macOS ships bash 3.x. Fix: brew install bash"
        _info "Then: /opt/homebrew/bin/bash $0"
    else
        _info "Install bash 5.2+ from your package manager."
    fi
    exit 1
fi

# --- Prerequisites ---
_banner "Tetra Setup" "$USER @ $(hostname)"

_step "Prerequisites"
prereqs_ok=true

_check() {
    local label="$1" cmd="$2"
    if command -v "$cmd" &>/dev/null; then
        local ver
        ver=$("$cmd" --version 2>&1 | head -1)
        _ok "$label  ${DIM}$ver${RST}"
        return 0
    else
        _fail "$label"
        return 1
    fi
}

# Detect bash 5.2+ binary path for TETRA_SHELL hint
_detected_bash="$BASH"
_detected_bash_ver="${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
if [[ "$OSTYPE" == "darwin"* && "$BASH" == "/bin/bash" ]]; then
    # macOS /bin/bash is 3.x — check for Homebrew bash
    for _candidate in /opt/homebrew/bin/bash /usr/local/bin/bash; do
        if [[ -x "$_candidate" ]]; then
            _cver=$("$_candidate" -c 'echo "${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"' 2>/dev/null)
            _cmajor="${_cver%%.*}"
            if [[ "${_cmajor:-0}" -ge 5 ]]; then
                _detected_bash="$_candidate"
                _detected_bash_ver="$_cver"
                break
            fi
        fi
    done
    unset _candidate _cver _cmajor
fi
_ok "bash 5.2+  ${DIM}${_detected_bash} (${_detected_bash_ver})${RST}"

_check "git" git           || prereqs_ok=false
_check "python3" python3   || prereqs_ok=false
_check "node" node         || { _info "Install via nvm: https://github.com/nvm-sh/nvm"; prereqs_ok=false; }
_check "jq" jq             || _warn "jq missing (optional)"
command -v bun &>/dev/null  && _ok "bun  ${DIM}$(bun --version 2>&1)${RST}" || _info "bun not installed (optional)"

if [[ "$prereqs_ok" != "true" ]]; then
    echo ""
    _fail "Install missing prerequisites and re-run."
    exit 1
fi

# --- Create or update ~/tetra ---
TETRA_RUNTIME="$HOME/tetra"

_step "Runtime directory"
if [[ -d "$TETRA_RUNTIME" ]]; then
    _info "Updating $TETRA_RUNTIME/tetra.sh"
else
    _info "Creating $TETRA_RUNTIME/"
    cp -r "$SCRIPT_DIR/tetra-dir" "$TETRA_RUNTIME"
fi

cat > "$TETRA_RUNTIME/tetra.sh" <<ENTRY
#!/usr/bin/env bash
TETRA_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="\${TETRA_SRC:-$TETRA_SRC_DETECTED}"
export TETRA_DIR TETRA_SRC
source "\$TETRA_SRC/bash/bootloader.sh"
ENTRY

_ok "tetra.sh  ${DIM}TETRA_SRC=$TETRA_SRC_DETECTED${RST}"

# --- Create ~/start-tetra.sh ---
START_SCRIPT="$HOME/start-tetra.sh"

_step "Shell integration"

# Determine toggles from install.conf
_bun_toggle="false"
[[ "$BUN_INSTALL" == "true" ]] && _bun_toggle="true"
_python_toggle="$PYTHON_RUNTIME"

cat > "$START_SCRIPT" <<STARTER
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
#   TETRA_SRC          Source repo        $TETRA_SRC_DETECTED
#   TETRA_DIR          Runtime data       $TETRA_RUNTIME
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
export TETRA_DIR="\${TETRA_DIR:-$TETRA_RUNTIME}"
export TETRA_SRC="\${TETRA_SRC:-$TETRA_SRC_DETECTED}"

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
chmod 644 "$START_SCRIPT"
_ok "start-tetra.sh  ${DIM}(source only, 644)${RST}"

# --- Default org ---
ORGS_DIR="$TETRA_RUNTIME/orgs"

_step "Default org"
if [[ ! -d "$ORGS_DIR/tetra" ]]; then
    mkdir -p "$ORGS_DIR/tetra/sections"
    mkdir -p "$ORGS_DIR/tetra/pd/data/projects"
    mkdir -p "$ORGS_DIR/tetra/pd/config"
    mkdir -p "$ORGS_DIR/tetra/pd/cache"
    mkdir -p "$ORGS_DIR/tetra/tut/src"
    mkdir -p "$ORGS_DIR/tetra/tut/compiled"
    mkdir -p "$ORGS_DIR/tetra/workspace"
    mkdir -p "$ORGS_DIR/tetra/backups"
    _ok "Created orgs/tetra/"
else
    _info "orgs/tetra/ exists"
fi

# --- Symlink active config ---
mkdir -p "$TETRA_RUNTIME/config"
if [[ ! -L "$TETRA_RUNTIME/config/tetra.toml" && -d "$ORGS_DIR/tetra" ]]; then
    [[ ! -f "$ORGS_DIR/tetra/tetra.toml" ]] && echo "# tetra org config" > "$ORGS_DIR/tetra/tetra.toml"
    ln -sf "$ORGS_DIR/tetra/tetra.toml" "$TETRA_RUNTIME/config/tetra.toml"
    _ok "config/tetra.toml → orgs/tetra/tetra.toml"
fi

# --- Install nvm + node ---
NVM_DIR="$TETRA_RUNTIME/nvm"

_step "Node runtime  ${DIM}${NODE_VERSION}${RST}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    _info "Installing nvm ${NVM_VERSION}..."
    mkdir -p "$NVM_DIR"
    export NVM_DIR
    curl -so- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash >/dev/null 2>&1
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
        _ok "nvm  ${DIM}${NVM_VERSION}${RST}"
        source "$NVM_DIR/nvm.sh"
        _info "Installing node ${NODE_VERSION}..."
        nvm install "$NODE_VERSION" >/dev/null 2>&1
        _ok "node $(node --version)"
    else
        _warn "nvm install failed (install later: tetra_nvm_install)"
    fi
else
    source "$NVM_DIR/nvm.sh"
    _ok "nvm  ${DIM}already installed${RST}"
    _ok "node $(node --version 2>/dev/null || echo 'not installed')"
fi

# --- Bun runtime ---
BUN_DIR="$TETRA_RUNTIME/bun"

_step "Bun runtime"
if [[ "$BUN_INSTALL" != "true" ]]; then
    _info "bun disabled in install.conf"
else
    if [[ -x "$BUN_DIR/bin/bun" ]]; then
        export BUN_INSTALL="$BUN_DIR"
        export PATH="$BUN_DIR/bin:$PATH"
        _ok "bun  ${DIM}$(bun --version 2>/dev/null) (exists)${RST}"
    else
        _info "Installing bun..."
        export BUN_INSTALL="$BUN_DIR"
        curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 || true
        if [[ -x "$BUN_DIR/bin/bun" ]]; then
            export PATH="$BUN_DIR/bin:$PATH"
            _ok "bun  ${DIM}$(bun --version 2>/dev/null)${RST}"
        else
            _warn "bun install failed"
        fi
    fi
fi

# --- Python runtime ---
VENV_DIR="$TETRA_RUNTIME/venv"

_step "Python runtime  ${DIM}runtime=${PYTHON_RUNTIME} version=${PYTHON_VERSION}${RST}"

# Step 1: Determine which python3 to use for venv creation
py_bin=""
case "$PYTHON_RUNTIME" in
    system)
        py_bin=$(command -v python3 || command -v python || true)
        if [[ -n "$py_bin" ]]; then
            sys_ver=$("$py_bin" --version 2>&1 | awk '{print $2}')
            _ok "system python  ${DIM}$sys_ver ($py_bin)${RST}"
        else
            _warn "python3 not found"
        fi
        ;;
    pyenv)
        PYENV_ROOT="$HOME/.pyenv"
        if [[ ! -d "$PYENV_ROOT" ]]; then
            _info "Installing pyenv..."
            curl -fsSL https://pyenv.run 2>/dev/null | bash >/dev/null 2>&1
        fi
        if [[ -d "$PYENV_ROOT" ]]; then
            export PYENV_ROOT
            export PATH="$PYENV_ROOT/bin:$PATH"
            eval "$(pyenv init -)" 2>/dev/null
            if ! pyenv versions --bare 2>/dev/null | grep -qF "$PYTHON_VERSION"; then
                _info "Installing python ${PYTHON_VERSION} via pyenv..."
                pyenv install "$PYTHON_VERSION" >/dev/null 2>&1
            fi
            if pyenv versions --bare 2>/dev/null | grep -qF "$PYTHON_VERSION"; then
                pyenv global "$PYTHON_VERSION" 2>/dev/null
                py_bin="$PYENV_ROOT/versions/$PYTHON_VERSION/bin/python3"
                _ok "pyenv  ${DIM}python $PYTHON_VERSION${RST}"
            else
                _warn "pyenv install of $PYTHON_VERSION failed"
            fi
        else
            _warn "pyenv installation failed"
        fi
        ;;
    *)
        _info "Unknown PYTHON_RUNTIME=$PYTHON_RUNTIME (expected system or pyenv)"
        ;;
esac

# Step 2: Create venv only for system runtime (pyenv handles its own isolation)
if [[ "$PYTHON_RUNTIME" == "system" && -n "$py_bin" ]]; then
    if [[ ! -d "$VENV_DIR/bin" ]]; then
        _info "Creating venv from $py_bin..."
        "$py_bin" -m venv "$VENV_DIR" 2>&1 || true
        if [[ -f "$VENV_DIR/bin/activate" ]]; then
            py_ver=$("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}')
            _ok "venv  ${DIM}python $py_ver → ~/tetra/venv/${RST}"
        else
            _warn "venv creation failed"
        fi
    else
        py_ver=$("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}')
        _ok "venv  ${DIM}python $py_ver (exists)${RST}"
    fi
fi

# --- Summary ---
echo ""
_hr
printf "  ${BOLD}${GREEN}Tetra installed${RST}\n"
echo ""
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_SRC" "$TETRA_SRC_DETECTED"
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_DIR" "$TETRA_RUNTIME"
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_SHELL" "$_detected_bash ($_detected_bash_ver)"
printf "  ${DIM}%-12s${RST} %s\n" "Org" "tetra"
printf "  ${DIM}%-12s${RST} %s\n" "Node" "$NODE_VERSION"
printf "  ${DIM}%-12s${RST} %s\n" "Bun" "$(bun --version 2>/dev/null || echo 'not installed')"
printf "  ${DIM}%-12s${RST} %s\n" "Python" "${PYTHON_RUNTIME} ($(python3 --version 2>&1 | awk '{print $2}'))"
echo ""
printf "  ${BOLD}Next:${RST} source ~/start-tetra.sh\n"
printf "  ${BOLD}Then:${RST} tetra doctor\n"
_hr
