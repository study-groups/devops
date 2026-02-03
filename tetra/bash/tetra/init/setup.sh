#!/usr/bin/env bash
# setup.sh - Tetra installation (one-shot for new users)
# Delegates to init.sh (skeleton) + install_runtime.sh (runtimes).
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

# Detect bash 5.2+ binary path
_detected_bash="$BASH"
_detected_bash_ver="${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
if [[ "$OSTYPE" == "darwin"* && "$BASH" == "/bin/bash" ]]; then
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

# --- Delegate to init.sh and install_runtime.sh ---
TETRA_RUNTIME="$HOME/tetra"

source "$SCRIPT_DIR/init.sh"
source "$SCRIPT_DIR/install_runtime.sh"

# Set TETRA_DIR for install functions
export TETRA_DIR="$TETRA_RUNTIME"

tetra_init
tetra_install all

# --- Summary ---
echo ""
_hr
printf "  ${BOLD}${GREEN}Tetra installed${RST}\n"
echo ""
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_SRC" "$TETRA_SRC_DETECTED"
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_DIR" "$TETRA_RUNTIME"
printf "  ${DIM}%-12s${RST} %s\n" "TETRA_SHELL" "$_detected_bash ($_detected_bash_ver)"
printf "  ${DIM}%-12s${RST} %s\n" "Org" "tetra"
printf "  ${DIM}%-12s${RST} %s\n" "Node" "${NODE_VERSION}"
printf "  ${DIM}%-12s${RST} %s\n" "Bun" "$(bun --version 2>/dev/null || echo 'not installed')"
printf "  ${DIM}%-12s${RST} %s\n" "Python" "${PYTHON_RUNTIME} ($(python3 --version 2>&1 | awk '{print $2}'))"
echo ""
printf "  ${BOLD}Next:${RST} source ~/start-tetra.sh\n"
printf "  ${BOLD}Then:${RST} tetra doctor\n"
_hr
