#!/usr/bin/env bash
# tetra.sh - Tetra Orchestrator
# Thin overseer: loads modules, provides discovery, delegates work
#
# Pattern: noun-verb CLI like org, tls, tsm
# Usage: tetra [command] [subcommand] [args]

TETRA_VERSION="2.0.0"

# =============================================================================
# BOOTSTRAP
# =============================================================================

# Require bash 5.2+
if [[ "${BASH_VERSINFO[0]}" -lt 5 || ("${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2) ]]; then
    echo "ERROR: Bash 5.2+ required (found $BASH_VERSION)" >&2
    return 1 2>/dev/null || exit 1
fi

# TETRA_SRC must be set (tetra ALWAYS starts by: source ~/tetra/tetra.sh)
: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_SRC

[[ ! -d "$TETRA_SRC" ]] && { echo "ERROR: TETRA_SRC not found: $TETRA_SRC" >&2; return 1; }

# TETRA_DIR for runtime data
: "${TETRA_DIR:=$HOME/.tetra}"
export TETRA_DIR
mkdir -p "$TETRA_DIR"

# Module registry
declare -gA TETRA_MODULES=()
declare -ga TETRA_MODULE_LIST=()

# =============================================================================
# COLORS (with fallback)
# =============================================================================

[[ -f "$TETRA_SRC/bash/color/color.sh" ]] && source "$TETRA_SRC/bash/color/color.sh" 2>/dev/null
: "${TETRA_CYAN:=\033[0;36m}"
: "${TETRA_YELLOW:=\033[1;33m}"
: "${TETRA_GREEN:=\033[0;32m}"
: "${TETRA_BLUE:=\033[1;34m}"
: "${TETRA_GRAY:=\033[0;90m}"
: "${TETRA_NC:=\033[0m}"

# =============================================================================
# HELP
# =============================================================================

_tetra_help() {
    local C="$TETRA_CYAN" Y="$TETRA_YELLOW" G="$TETRA_GREEN" D="$TETRA_GRAY" N="$TETRA_NC"

    echo -e "${G}tetra${N} v$TETRA_VERSION - Module Orchestrator"
    echo ""
    echo -e "${Y}STATUS${N}"
    echo -e "  ${C}status${N}              Loaded modules + paths"
    echo -e "  ${C}doctor${N}              Health check"
    echo ""
    echo -e "${Y}MODULES${N}"
    echo -e "  ${C}module list${N}         List loaded modules"
    echo -e "  ${C}module info${N} <name>  Show module details"
    echo -e "  ${C}module meta${N} <name>  Show MELVIN-enhanced metadata"
    echo -e "  ${C}module stats${N}        File statistics (via tls)"
    echo ""
    echo -e "${Y}CONTEXT INSPECTOR${N}"
    echo -e "  ${C}ctx${N}                 Show all module contexts"
    echo -e "  ${C}ctx${N} <module>        Show module's context + schema"
    echo -e "  ${C}ctx schema${N}          List all context schemas"
    echo -e "  ${C}ctx colors${N}          Show/reload color config"
    echo ""
    echo -e "${Y}MODULE CONTEXTS${N}"
    echo -e "  ${D}tsm ctx, tdocs ctx, deploy ctx - each module sets its own${N}"
    echo ""
    echo -e "${Y}INTERFACES${N}"
    echo -e "  ${C}repl${N}                Basic readline REPL + ctx"
    echo -e "  ${C}trepl${N}               Terminal control REPL + MIDI"
    echo -e "  ${C}tui${N}                 Full screen TUI + C coprocess"
    echo ""
    echo -e "${Y}LOADED${N}"
    echo -e "  ${D}${TETRA_MODULE_LIST[*]}${N}"
}

# =============================================================================
# MODULE LOADING
# =============================================================================

_tetra_load_module() {
    local dir="$1"
    local name="$(basename "$dir")"

    # Skip orchestrator itself and non-modules
    [[ "$name" == "tetra" ]] && return 1
    [[ ! -f "$dir/actions.sh" ]] && return 1

    # Find entry point
    local entry="$dir/${name}.sh"
    [[ ! -f "$entry" ]] && entry="$dir/includes.sh"
    [[ ! -f "$entry" ]] && return 1

    # Source and register
    if source "$entry" 2>/dev/null; then
        TETRA_MODULES["$name"]="$dir"
        TETRA_MODULE_LIST+=("$name")
        return 0
    fi
    return 1
}

_tetra_load_all() {
    # Load color/tds first (libraries, not modules)
    [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]] && source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null

    # Load modules
    local bash_dir="$TETRA_SRC/bash"
    for dir in "$bash_dir"/*/; do
        [[ -d "$dir" ]] && _tetra_load_module "$dir"
    done
}

# =============================================================================
# COMMANDS
# =============================================================================

_tetra_status() {
    local C="$TETRA_CYAN" D="$TETRA_GRAY" N="$TETRA_NC"

    echo -e "${C}Tetra${N} v$TETRA_VERSION"
    echo ""
    echo "TETRA_SRC: $TETRA_SRC"
    echo "TETRA_DIR: $TETRA_DIR"
    echo ""
    echo "Modules: ${#TETRA_MODULE_LIST[@]}"
    for m in "${TETRA_MODULE_LIST[@]}"; do
        printf "  %s\n" "$m"
    done
}

_tetra_module() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)
            for m in "${TETRA_MODULE_LIST[@]}"; do
                echo "$m"
            done
            ;;

        info)
            local name="$1"
            [[ -z "$name" ]] && { echo "Usage: tetra module info <name>"; return 1; }

            local dir="${TETRA_MODULES[$name]}"
            [[ -z "$dir" ]] && { echo "Module not found: $name"; return 1; }

            echo "Module:  $name"
            echo "Path:    $dir"

            # Count .sh files
            local sh_count=$(find "$dir" -maxdepth 1 -name "*.sh" | wc -l | tr -d ' ')
            echo "Scripts: $sh_count"

            # Show entry point
            if [[ -f "$dir/${name}.sh" ]]; then
                echo "Entry:   ${name}.sh"
            elif [[ -f "$dir/includes.sh" ]]; then
                echo "Entry:   includes.sh"
            fi

            # Show if has completion
            [[ -f "$dir/${name}_complete.sh" ]] && echo "Complete: yes"
            ;;

        meta)
            local name="$1"
            [[ -z "$name" ]] && { echo "Usage: tetra module meta <name>"; return 1; }

            # Check if TETRA_MODULE_META is available
            if [[ -z "${TETRA_MODULE_META[*]+set}" ]] || [[ ${#TETRA_MODULE_META[@]} -eq 0 ]]; then
                echo "No MELVIN metadata available."
                echo "Run: melvin enhance"
                return 1
            fi

            local meta="${TETRA_MODULE_META[$name]}"
            if [[ -z "$meta" ]]; then
                echo "No metadata for module: $name"
                echo "Available: ${!TETRA_MODULE_META[*]}"
                return 1
            fi

            local dir="${TETRA_MODULES[$name]:-unknown}"

            echo "Module: $name"
            [[ "$dir" != "unknown" ]] && echo "Path:   $dir"
            echo ""
            echo "MELVIN Metadata:"
            echo "$meta" | tr '|' '\n' | while IFS=: read -r key val; do
                printf "  %-12s %s\n" "$key:" "$val"
            done
            ;;

        stats)
            # Delegate to tls if available
            if declare -f tls >/dev/null 2>&1; then
                tls "$TETRA_SRC/bash"
            else
                echo "bash/ modules:"
                ls -1 "$TETRA_SRC/bash"
            fi
            ;;

        *)
            echo "Unknown: tetra module $subcmd"
            echo "Try: list, info <name>, meta <name>, stats"
            return 1
            ;;
    esac
}

_tetra_doctor() {
    local ok="${TETRA_GREEN}✓${TETRA_NC}"
    local fail="${TETRA_YELLOW}✗${TETRA_NC}"
    local warn="${TETRA_YELLOW}⚠${TETRA_NC}"

    # Load install.conf for expected values
    local conf="$TETRA_SRC/bash/tetra/init/install.conf"
    local CONF_NODE_VERSION="" CONF_BUN_INSTALL="" CONF_PYTHON_MODE="" CONF_PYTHON_VERSION=""
    if [[ -f "$conf" ]]; then
        CONF_NODE_VERSION=$(. "$conf" && echo "$NODE_VERSION")
        CONF_BUN_INSTALL=$(. "$conf" && echo "$BUN_INSTALL")
        CONF_PYTHON_MODE=$(. "$conf" && echo "$PYTHON_MODE")
        CONF_PYTHON_VERSION=$(. "$conf" && echo "$PYTHON_VERSION")
    fi

    echo "Tetra Doctor"
    echo ""

    # Bash version
    printf "  Bash 5.2+: "
    if [[ "${BASH_VERSINFO[0]}" -ge 5 && "${BASH_VERSINFO[1]}" -ge 2 ]]; then
        echo -e "$ok ($BASH_VERSION)"
    else
        echo -e "$fail ($BASH_VERSION)"
    fi

    # TETRA_SRC
    printf "  TETRA_SRC: "
    if [[ -d "$TETRA_SRC" ]]; then
        echo -e "$ok"
    else
        echo -e "$fail (not found)"
    fi

    # TETRA_DIR
    printf "  TETRA_DIR: "
    if [[ -d "$TETRA_DIR" ]]; then
        echo -e "$ok"
    else
        echo -e "$fail (not found)"
    fi

    # Modules loaded
    printf "  Modules:   "
    echo -e "$ok (${#TETRA_MODULE_LIST[@]} loaded)"

    # Color module
    printf "  Colors:    "
    if [[ -n "$TETRA_GREEN" ]]; then
        echo -e "$ok"
    else
        echo -e "$fail"
    fi

    # NVM_DIR
    printf "  NVM_DIR:   "
    if [[ "$NVM_DIR" == *"tetra"* ]]; then
        echo -e "$ok ($NVM_DIR)"
    elif [[ -n "$NVM_DIR" ]]; then
        echo -e "$fail (not tetra: $NVM_DIR)"
    else
        echo -e "$fail (not set)"
    fi

    # Node available + version check against install.conf
    printf "  Node:      "
    local node_path
    node_path="$(which node 2>/dev/null)"
    if [[ -z "$node_path" ]]; then
        echo -e "$fail (not found)"
    elif [[ "$node_path" == *"tetra"* ]]; then
        local node_ver
        node_ver="$(node --version 2>/dev/null)"
        if [[ -n "$CONF_NODE_VERSION" && "$node_ver" != "$CONF_NODE_VERSION" ]]; then
            echo -e "$warn ($node_ver, expected $CONF_NODE_VERSION)"
        else
            echo -e "$ok ($node_ver from tetra)"
        fi
    else
        local node_ver
        node_ver="$(node --version 2>/dev/null)"
        echo -e "$fail ($node_ver from $node_path)"
        echo "         Expected: \$TETRA_DIR/nvm/versions/node/*/bin/node"
    fi

    # nvm function
    printf "  nvm:       "
    if declare -f nvm >/dev/null 2>&1; then
        echo -e "$ok (loaded)"
    else
        echo -e "$fail (not loaded)"
        echo "         Fix: source \$NVM_DIR/nvm.sh"
    fi

    # Bun
    printf "  Bun:       "
    if [[ "$CONF_BUN_INSTALL" == "true" ]]; then
        local bun_path
        bun_path="$(which bun 2>/dev/null)"
        if [[ -n "$bun_path" && "$bun_path" == *"tetra"* ]]; then
            echo -e "$ok ($(bun --version 2>/dev/null) from tetra)"
        elif [[ -n "$bun_path" ]]; then
            echo -e "$warn ($(bun --version 2>/dev/null) from $bun_path, not tetra)"
        else
            echo -e "$fail (not found, expected BUN_INSTALL=true)"
        fi
    else
        echo -e "$ok (disabled)"
    fi

    # Python runtime check against install.conf
    printf "  Python:    "
    if [[ "$CONF_PYTHON_MODE" == "venv" ]]; then
        if [[ -n "$VIRTUAL_ENV" && "$VIRTUAL_ENV" == *"tetra"* ]]; then
            local py_ver
            py_ver="$(python --version 2>&1 | awk '{print $2}')"
            echo -e "$ok (venv, python $py_ver)"
        elif [[ -d "$TETRA_DIR/venv/bin" ]]; then
            echo -e "$warn (venv exists but not activated)"
            echo "         Fix: source \$TETRA_DIR/venv/bin/activate"
        else
            echo -e "$fail (venv not found, expected mode=venv)"
        fi
    elif [[ "$CONF_PYTHON_MODE" == "pyenv" ]]; then
        local py_path
        py_path="$(which python 2>/dev/null)"
        if [[ "$py_path" == *"pyenv"* ]]; then
            local py_ver
            py_ver="$(python --version 2>&1 | awk '{print $2}')"
            if [[ -n "$CONF_PYTHON_VERSION" && "$py_ver" != "$CONF_PYTHON_VERSION" ]]; then
                echo -e "$warn (pyenv, python $py_ver, expected $CONF_PYTHON_VERSION)"
            else
                echo -e "$ok (pyenv, python $py_ver)"
            fi
        else
            echo -e "$fail (expected pyenv, got ${py_path:-none})"
            echo "         Fix: pyenv install $CONF_PYTHON_VERSION && pyenv global $CONF_PYTHON_VERSION"
        fi
    else
        echo -e "$ok (python disabled)"
    fi

    # install.conf reference
    if [[ -f "$conf" ]]; then
        echo ""
        echo "  Config:    $conf"
        echo "             node=$CONF_NODE_VERSION bun=$CONF_BUN_INSTALL python=$CONF_PYTHON_MODE/$CONF_PYTHON_VERSION"
    fi

    echo ""
}

# =============================================================================
# COMPLETION
# =============================================================================

# Load comprehensive completion
[[ -f "$TETRA_SRC/bash/tetra/complete.sh" ]] && source "$TETRA_SRC/bash/tetra/complete.sh"

# =============================================================================
# MAIN
# =============================================================================

tetra() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        status|s)
            _tetra_status
            ;;

        module|mod|m)
            _tetra_module "$@"
            ;;

        ctx)
            source "$TETRA_SRC/bash/tetra/ctx.sh"
            tetra_ctx "$@"
            ;;

        repl)
            local repl_file="$TETRA_SRC/bash/tetra/interfaces/repl-cli.sh"
            if [[ -f "$repl_file" ]]; then
                source "$repl_file"
                repl_cli "$@"
            else
                echo "repl-cli not found: $repl_file" >&2
                return 1
            fi
            ;;

        trepl|tcurses-repl)
            local trepl_file="$TETRA_SRC/bash/tetra/interfaces/tcurses-repl.sh"
            if [[ -f "$trepl_file" ]]; then
                source "$trepl_file"
                tcurses_repl "$@"
            else
                echo "tcurses-repl not found: $trepl_file" >&2
                return 1
            fi
            ;;

        tui)
            local tui_file="$TETRA_SRC/bash/tetra/interfaces/tui.sh"
            if [[ -x "$tui_file" ]]; then
                "$tui_file" "$@"
            else
                echo "tui.sh not found: $tui_file" >&2
                return 1
            fi
            ;;

        doctor|doc)
            _tetra_doctor "$@"
            ;;

        help|h|--help|-h)
            _tetra_help
            ;;

        version|--version|-v)
            echo "tetra v$TETRA_VERSION"
            ;;

        *)
            echo "Unknown command: $cmd"
            echo ""
            _tetra_help
            return 1
            ;;
    esac
}

# =============================================================================
# INIT
# =============================================================================

_tetra_load_all

export TETRA_VERSION
export -f tetra
