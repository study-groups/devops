#!/usr/bin/env bash
# setup.sh - Tetra installation
# Detects TETRA_SRC from repo location, creates ~/tetra, wires shell rc.
# Idempotent: safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC_DETECTED="$(cd "$SCRIPT_DIR/../../.." && pwd)"

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
cat > "$START_SCRIPT" <<'STARTER'
# start-tetra.sh - Source this to load tetra into your shell
# Usage: source ~/start-tetra.sh
# NOTE: This file is sourced, not executed. Do not chmod +x.

# Boot tetra (sets TETRA_SRC, TETRA_DIR, loads bootloader)
source "$HOME/tetra/tetra.sh"

# Load core modules
tmod load tetra tsm >/dev/null 2>&1

# Activate managed runtimes (only if installed for this user)
[[ -s "$TETRA_DIR/nvm/nvm.sh" ]] && tetra_nvm_activate 2>/dev/null
[[ -d "$TETRA_DIR/venv/bin/activate" ]] && source "$TETRA_DIR/venv/bin/activate"
[[ -d "${PYENV_ROOT:-$HOME/.pyenv}" ]] && tetra_python_activate 2>/dev/null
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

_step "Node runtime"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    _info "Installing nvm..."
    mkdir -p "$NVM_DIR"
    export NVM_DIR
    curl -so- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash >/dev/null 2>&1
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
        _ok "nvm  ${DIM}$NVM_DIR${RST}"
        source "$NVM_DIR/nvm.sh"
        _info "Installing node LTS..."
        nvm install 'lts/*' >/dev/null 2>&1
        _ok "node $(node --version)"
    else
        _warn "nvm install failed (install later: tetra_nvm_install)"
    fi
else
    source "$NVM_DIR/nvm.sh"
    _ok "nvm  ${DIM}already installed${RST}"
    _ok "node $(node --version 2>/dev/null || echo 'not installed')"
fi

# --- Python venv ---
VENV_DIR="$TETRA_RUNTIME/venv"

_step "Python runtime"
if [[ ! -d "$VENV_DIR/bin" ]]; then
    py_bin=$(command -v python3 || command -v python)
    if [[ -n "$py_bin" ]]; then
        _info "Creating venv..."
        "$py_bin" -m venv "$VENV_DIR" 2>/dev/null
        if [[ -f "$VENV_DIR/bin/activate" ]]; then
            py_ver=$("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}')
            _ok "venv  ${DIM}python $py_ver → ~/tetra/venv/${RST}"
        else
            _warn "venv creation failed"
        fi
    else
        _warn "python3 not found (venv skipped)"
    fi
else
    py_ver=$("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}')
    _ok "venv  ${DIM}python $py_ver (exists)${RST}"
fi

# --- Summary ---
echo ""
_hr
printf "  ${BOLD}${GREEN}Tetra installed${RST}\n"
echo ""
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_SRC" "$TETRA_SRC_DETECTED"
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_DIR" "$TETRA_RUNTIME"
printf "  ${DIM}%-12s${RST} %s\n" "Org" "tetra"
echo ""
printf "  ${BOLD}Next:${RST} source ~/start-tetra.sh\n"
printf "  ${BOLD}Then:${RST} tetra doctor\n"
_hr
