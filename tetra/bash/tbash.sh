#!/usr/bin/env bash
# tbash.sh - Tetra Bash Emergency Janitor
# Minimal emergency tool for when tetra won't boot
# Usage: source tbash.sh (do not run directly)
#
# NOTE: For comprehensive code quality checks, use:
#       tetra-self lint

# Ensure running in bash 5.2+
if [[ "${BASH_VERSINFO[0]}" -lt 5 ]]; then
    echo "Error: tbash requires bash 5.2+" >&2
    return 1 2>/dev/null || exit 1
fi

# Validate TETRA_SRC is set
if [[ -z "${TETRA_SRC}" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1 2>/dev/null || exit 1
fi

TBASH_DIR="${TETRA_SRC}/bash"

# State tracking
declare -g TBASH_VIOLATIONS=0
declare -g TBASH_WARNINGS=0

#----------------------------------------------------------
# Helper Functions
#----------------------------------------------------------

tbash::reset_counters() {
    TBASH_VIOLATIONS=0
    TBASH_WARNINGS=0
}

tbash::print_header() {
    echo "========================================"
    echo "$1"
    echo "========================================"
}

tbash::error() {
    echo "[ERROR] $1"
    ((TBASH_VIOLATIONS++))
}

tbash::warn() {
    echo "[WARN]  $1"
    ((TBASH_WARNINGS++))
}

tbash::ok() {
    echo "[OK]    $1"
}

tbash::info() {
    echo "[INFO]  $1"
}

#----------------------------------------------------------
# Command: help
#----------------------------------------------------------

tbash::help() {
    cat <<'EOF'
tbash - Tetra Bash Emergency Janitor
=====================================

EMERGENCY TOOL - Minimal functionality for when tetra won't boot
For comprehensive checks, use: tetra-self lint

COMMANDS:
  check          Basic directory structure validation
  orphans        List all .sh files in root (except tbash.sh)
  status         Show directory health summary
  help           Show this help message
  exit           Exit tbash

RULES:
  * All .sh files must live inside module directories
  * Exceptions: tbash.sh (emergency tool), bootloader.sh (bootstrap)
  * Modules must properly use TETRA_SRC global

EXAMPLES:
  tbash> check       # Check directory structure
  tbash> orphans     # Find misplaced .sh files
  tbash> status      # Quick health check

ADVANCED FEATURES (when tetra is working):
  tetra-self lint              # Comprehensive code quality checks
  tetra-self lint orphans      # Find orphaned files
  tetra-self lint dead         # Detect unused modules
  tetra-self lint deps         # Validate TETRA_SRC usage
  tetra-self lint git          # Git status check

EOF
}

#----------------------------------------------------------
# Command: orphans
#----------------------------------------------------------

tbash::orphans() {
    tbash::print_header "Orphaned .sh Files in Root"
    tbash::reset_counters

    local found=0
    while IFS= read -r file; do
        local basename="${file##*/}"
        # Skip allowed root files
        if [[ "$basename" == "tbash.sh" || "$basename" == "bootloader.sh" ]]; then
            continue
        fi

        tbash::error "Orphan file: ${TBASH_DIR}/${basename}"
        ((found++))
    done < <(find "${TBASH_DIR}" -maxdepth 1 -type f -name "*.sh" 2>/dev/null)

    echo ""
    if [[ $found -eq 0 ]]; then
        tbash::ok "No orphaned .sh files found"
    else
        tbash::info "Found $found orphaned .sh file(s)"
        tbash::info "These files should be moved into appropriate module directories"
    fi
}

#----------------------------------------------------------
# Command: check
#----------------------------------------------------------

tbash::check() {
    tbash::print_header "Directory Structure Check"
    tbash::reset_counters

    # Check for orphaned .sh files
    local orphan_count=0
    while IFS= read -r file; do
        local basename="${file##*/}"
        # Skip allowed root files
        if [[ "$basename" == "tbash.sh" || "$basename" == "bootloader.sh" ]]; then
            continue
        fi
        tbash::error "File in root: ${file}"
        ((orphan_count++))
    done < <(find "${TBASH_DIR}" -maxdepth 1 -type f -name "*.sh" 2>/dev/null)

    # Check for non-.sh files in root
    local other_count=0
    while IFS= read -r file; do
        local basename="${file##*/}"
        # Skip .gitignore and hidden files
        if [[ "$basename" =~ ^\. ]]; then
            continue
        fi
        tbash::warn "Non-.sh file in root: ${file}"
        ((other_count++))
    done < <(find "${TBASH_DIR}" -maxdepth 1 -type f ! -name "*.sh" 2>/dev/null)

    # Count module directories
    local module_count=0
    module_count=$(find "${TBASH_DIR}" -maxdepth 1 -type d ! -name "bash" ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')

    echo ""
    tbash::info "Module directories: $module_count"

    if [[ $orphan_count -eq 0 ]]; then
        tbash::ok "Directory structure is clean"
    else
        tbash::error "Found $orphan_count orphaned .sh file(s)"
    fi

    if [[ $other_count -gt 0 ]]; then
        tbash::warn "Found $other_count non-.sh file(s) in root"
    fi
}

#----------------------------------------------------------
# Command: status
#----------------------------------------------------------

tbash::status() {
    tbash::print_header "Directory Health Summary"

    # Count files and directories
    local orphans
    orphans=$(find "${TBASH_DIR}" -maxdepth 1 -type f -name "*.sh" ! -name "tbash.sh" ! -name "bootloader.sh" 2>/dev/null | wc -l | tr -d ' ')

    local modules
    modules=$(find "${TBASH_DIR}" -maxdepth 1 -type d ! -name "bash" ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')

    local total_sh
    total_sh=$(find "${TBASH_DIR}" -type f -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')

    echo "Location: ${TBASH_DIR}"
    echo ""
    echo "Modules:          $modules"
    echo "Total .sh files:  $total_sh"
    echo "Orphaned files:   $orphans"
    echo ""

    if [[ $orphans -eq 0 ]]; then
        tbash::ok "Directory structure is healthy"
    else
        tbash::error "Directory needs cleanup"
        tbash::info "Run 'check' for detailed report"
        tbash::info "Or use 'tetra-self lint' for comprehensive checks"
    fi
}

#----------------------------------------------------------
# REPL
#----------------------------------------------------------

tbash::repl() {
    echo "tbash - Tetra Bash Emergency Janitor (Minimal Mode)"
    echo "For comprehensive checks: tetra-self lint"
    echo "Type 'help' for commands, 'exit' to quit"
    echo ""

    while true; do
        # Use read with prompt
        read -e -p "tbash> " cmd args

        case "$cmd" in
            help|h)
                tbash::help
                ;;
            check)
                tbash::check
                ;;
            orphans|o)
                tbash::orphans
                ;;
            status|s)
                tbash::status
                ;;
            exit|quit|q)
                echo "Goodbye!"
                break
                ;;
            "")
                # Empty command, just show prompt again
                ;;
            *)
                echo "Unknown command: $cmd"
                echo "Type 'help' for available commands"
                echo "Or use 'tetra-self lint' for advanced features"
                ;;
        esac

        [[ -n "$cmd" ]] && echo ""
    done
}

# Auto-start REPL when sourced
tbash::repl
