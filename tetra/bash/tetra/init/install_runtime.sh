#!/usr/bin/env bash
# install_runtime.sh - Install/enable runtimes into ~/tetra/
# Extracted from setup.sh. Each function is callable standalone.
#
# Usage (from tetra):  tetra install nvm|bun|python|all
# Usage (standalone):  source install_runtime.sh; tetra_install nvm

_INSTALL_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Terminal helpers (reused from setup.sh / init.sh) ---
_install_setup_terminal() {
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

declare -f _ok &>/dev/null || _install_setup_terminal

# --- Load install.conf ---
_install_load_conf() {
    local conf="$_INSTALL_SCRIPT_DIR/install.conf"
    [[ -f "$conf" ]] && source "$conf"
}

# --- Update a toggle in ~/start-tetra.sh ---
_install_update_toggle() {
    local var="$1" val="$2"
    local start_script="$HOME/start-tetra.sh"
    [[ -f "$start_script" ]] || return 0

    # Update the default value in the : "${VAR:=value}" line
    if grep -q "^\: \"\\\${${var}:=" "$start_script"; then
        sed -i'' -e "s|^\: \"\\\${${var}:=.*\"|: \"\${${var}:=${val}}\"|" "$start_script"
    fi
}

# --- Install nvm + node ---
_tetra_install_nvm() {
    local version="${1:-}"
    local tetra_runtime="${TETRA_DIR:-$HOME/tetra}"

    _install_load_conf
    local node_ver="${version:-$NODE_VERSION}"
    local nvm_ver="${NVM_VERSION:-v0.39.1}"
    local nvm_dir="$tetra_runtime/nvm"

    _step "Node runtime  ${DIM}${node_ver}${RST}"

    if [[ ! -s "$nvm_dir/nvm.sh" ]]; then
        _info "Installing nvm ${nvm_ver}..."
        mkdir -p "$nvm_dir"
        export NVM_DIR="$nvm_dir"
        curl -so- "https://raw.githubusercontent.com/nvm-sh/nvm/${nvm_ver}/install.sh" | bash >/dev/null 2>&1
        if [[ -s "$nvm_dir/nvm.sh" ]]; then
            _ok "nvm  ${DIM}${nvm_ver}${RST}"
            source "$nvm_dir/nvm.sh"
            _info "Installing node ${node_ver}..."
            nvm install "$node_ver" >/dev/null 2>&1
            _ok "node $(node --version)"
        else
            _warn "nvm install failed"
            return 1
        fi
    else
        source "$nvm_dir/nvm.sh"
        _ok "nvm  ${DIM}already installed${RST}"
        # If a specific version was requested, install it
        if [[ -n "$version" ]]; then
            local current
            current="$(node --version 2>/dev/null || echo none)"
            if [[ "$current" != "$version" ]]; then
                _info "Installing node ${version}..."
                nvm install "$version" >/dev/null 2>&1
                _ok "node $(node --version)"
            else
                _ok "node ${current}  ${DIM}(already installed)${RST}"
            fi
        else
            _ok "node $(node --version 2>/dev/null || echo 'not installed')"
        fi
    fi
}

# --- Install bun ---
_tetra_install_bun() {
    local tetra_runtime="${TETRA_DIR:-$HOME/tetra}"
    local bun_dir="$tetra_runtime/bun"

    _step "Bun runtime"

    if [[ -x "$bun_dir/bin/bun" ]]; then
        export BUN_INSTALL="$bun_dir"
        export PATH="$bun_dir/bin:$PATH"
        _ok "bun  ${DIM}$(bun --version 2>/dev/null) (exists)${RST}"
    else
        _info "Installing bun..."
        export BUN_INSTALL="$bun_dir"
        curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 || true
        if [[ -x "$bun_dir/bin/bun" ]]; then
            export PATH="$bun_dir/bin:$PATH"
            _ok "bun  ${DIM}$(bun --version 2>/dev/null)${RST}"
        else
            _warn "bun install failed"
            return 1
        fi
    fi

    _install_update_toggle "TETRA_BUN" "true"
}

# --- Install python runtime ---
_tetra_install_python() {
    local version="${1:-}"
    local tetra_runtime="${TETRA_DIR:-$HOME/tetra}"

    _install_load_conf
    local py_runtime="${PYTHON_RUNTIME:-system}"
    local py_version="${version:-${PYTHON_VERSION:-3.11.11}}"
    local venv_dir="$tetra_runtime/venv"

    _step "Python runtime  ${DIM}runtime=${py_runtime} version=${py_version}${RST}"

    local py_bin=""
    case "$py_runtime" in
        system)
            py_bin=$(command -v python3 || command -v python || true)
            if [[ -n "$py_bin" ]]; then
                local sys_ver
                sys_ver=$("$py_bin" --version 2>&1 | awk '{print $2}')
                _ok "system python  ${DIM}$sys_ver ($py_bin)${RST}"
            else
                _warn "python3 not found"
                return 1
            fi
            ;;
        pyenv)
            local pyenv_root="$HOME/.pyenv"
            if [[ ! -d "$pyenv_root" ]]; then
                _info "Installing pyenv..."
                curl -fsSL https://pyenv.run 2>/dev/null | bash >/dev/null 2>&1
            fi
            if [[ -d "$pyenv_root" ]]; then
                export PYENV_ROOT="$pyenv_root"
                export PATH="$pyenv_root/bin:$PATH"
                eval "$(pyenv init -)" 2>/dev/null
                if ! pyenv versions --bare 2>/dev/null | grep -qF "$py_version"; then
                    _info "Installing python ${py_version} via pyenv..."
                    pyenv install "$py_version" >/dev/null 2>&1
                fi
                if pyenv versions --bare 2>/dev/null | grep -qF "$py_version"; then
                    pyenv global "$py_version" 2>/dev/null
                    py_bin="$pyenv_root/versions/$py_version/bin/python3"
                    _ok "pyenv  ${DIM}python $py_version${RST}"
                else
                    _warn "pyenv install of $py_version failed"
                    return 1
                fi
            else
                _warn "pyenv installation failed"
                return 1
            fi
            ;;
        *)
            _info "Unknown PYTHON_RUNTIME=$py_runtime (expected system or pyenv)"
            return 1
            ;;
    esac

    # Create venv only for system runtime
    if [[ "$py_runtime" == "system" && -n "$py_bin" ]]; then
        if [[ ! -d "$venv_dir/bin" ]]; then
            _info "Creating venv from $py_bin..."
            "$py_bin" -m venv "$venv_dir" 2>&1 || true
            if [[ -f "$venv_dir/bin/activate" ]]; then
                local py_ver
                py_ver=$("$venv_dir/bin/python" --version 2>&1 | awk '{print $2}')
                _ok "venv  ${DIM}python $py_ver → ~/tetra/venv/${RST}"
            else
                _warn "venv creation failed"
            fi
        else
            local py_ver
            py_ver=$("$venv_dir/bin/python" --version 2>&1 | awk '{print $2}')
            _ok "venv  ${DIM}python $py_ver (exists)${RST}"
        fi
    fi

    _install_update_toggle "TETRA_PYTHON" "$py_runtime"
}

# --- Dispatcher ---
tetra_install() {
    local what="${1:-}"
    shift 2>/dev/null || true

    case "$what" in
        nvm|node)   _tetra_install_nvm "$@" ;;
        bun)        _tetra_install_bun "$@" ;;
        python|py)  _tetra_install_python "$@" ;;
        all)
            _tetra_install_nvm "$@"
            _tetra_install_bun "$@"
            _tetra_install_python "$@"
            ;;
        "")
            echo "Usage: tetra install <runtime>"
            echo ""
            echo "Runtimes:"
            echo "  nvm [version]     Install nvm + node"
            echo "  bun               Install bun"
            echo "  python [version]  Install python runtime"
            echo "  all               Install all runtimes"
            return 1
            ;;
        *)
            echo "Unknown runtime: $what"
            echo "Available: nvm, bun, python, all"
            return 1
            ;;
    esac
}
