#!/usr/bin/env bash
# tbash.sh - Tetra Bash Directory Janitor
# Emergency CLI tool for maintaining /bash directory structure
# Usage: source tbash.sh (do not run directly)

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
tbash - Tetra Bash Directory Janitor
====================================

COMMANDS:
  check          Scan bash directory for structural violations
  orphans        List all .sh files in root (except tbash.sh)
  dead           Detect unused modules (not sourced anywhere)
  deps           Validate TETRA_SRC usage across modules
  git            Show untracked/modified files in bash directory
  clean          Run all checks (check + orphans + dead + deps + git)
  status         Show current directory health summary
  perf           Run boot performance profiling (requires tperf module)
  help           Show this help message
  exit           Exit tbash

RULES:
  * All .sh files must live inside module directories
  * Exceptions: tbash.sh (emergency tool), bootloader.sh (bootstrap)
  * Modules must properly use TETRA_SRC global
  * No naming conventions enforced on directories

EXAMPLES:
  tbash> check       # Check directory structure
  tbash> orphans     # Find misplaced .sh files
  tbash> clean       # Run comprehensive health check
  tbash> perf        # Profile boot performance

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
# Command: dead
#----------------------------------------------------------

tbash::dead() {
    tbash::print_header "Dead Code Detection"
    tbash::reset_counters

    # Find all module directories
    local modules=()
    while IFS= read -r dir; do
        local basename="${dir##*/}"
        modules+=("$basename")
    done < <(find "${TBASH_DIR}" -maxdepth 1 -type d ! -name "bash" ! -name ".*" 2>/dev/null)

    if [[ ${#modules[@]} -eq 0 ]]; then
        tbash::warn "No modules found"
        return
    fi

    # For each module, check if it's sourced anywhere
    local dead_count=0
    for module in "${modules[@]}"; do
        # Search for references in .sh files
        local refs
        refs=$(grep -r "source.*${module}" "${TBASH_DIR}" 2>/dev/null | wc -l | tr -d ' ')

        # Also check for direct path references
        local path_refs
        path_refs=$(grep -r "${module}/" "${TBASH_DIR}" 2>/dev/null | grep -v "Binary" | wc -l | tr -d ' ')

        if [[ $refs -eq 0 && $path_refs -eq 0 ]]; then
            tbash::warn "Potentially unused module: ${module}"
            ((dead_count++))
        fi
    done

    echo ""
    if [[ $dead_count -eq 0 ]]; then
        tbash::ok "No dead modules detected"
    else
        tbash::info "Found $dead_count potentially unused module(s)"
        tbash::info "Manual verification recommended"
    fi
}

#----------------------------------------------------------
# Command: deps
#----------------------------------------------------------

tbash::deps() {
    tbash::print_header "Dependency Validation (TETRA_SRC)"
    tbash::reset_counters

    # Find all .sh files in modules
    local total=0
    local using_tetra_src=0
    local not_using=0

    while IFS= read -r file; do
        ((total++))

        # Check if file uses TETRA_SRC
        if grep -q "TETRA_SRC" "$file" 2>/dev/null; then
            ((using_tetra_src++))
        else
            # Check if file has hardcoded paths
            if grep -q "/bash/" "$file" 2>/dev/null; then
                tbash::error "Hardcoded path in: ${file}"
                ((not_using++))
            fi
        fi
    done < <(find "${TBASH_DIR}" -type f -name "*.sh" ! -path "*/.*" 2>/dev/null)

    echo ""
    tbash::info "Total .sh files: $total"
    tbash::info "Files using TETRA_SRC: $using_tetra_src"

    if [[ $not_using -eq 0 ]]; then
        tbash::ok "No hardcoded paths detected"
    else
        tbash::error "Found $not_using file(s) with hardcoded paths"
    fi
}

#----------------------------------------------------------
# Command: git
#----------------------------------------------------------

tbash::git() {
    tbash::print_header "Git Status Check"
    tbash::reset_counters

    cd "${TBASH_DIR}" || return 1

    # Check untracked files
    local untracked
    untracked=$(git ls-files --others --exclude-standard 2>/dev/null)

    if [[ -n "$untracked" ]]; then
        tbash::warn "Untracked files found:"
        while IFS= read -r file; do
            echo "  ${file}"
        done <<< "$untracked"
    else
        tbash::ok "No untracked files"
    fi

    # Check modified files
    local modified
    modified=$(git ls-files -m 2>/dev/null)

    echo ""
    if [[ -n "$modified" ]]; then
        tbash::warn "Modified files found:"
        while IFS= read -r file; do
            echo "  ${file}"
        done <<< "$modified"
    else
        tbash::ok "No modified files"
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
        tbash::info "Run 'clean' for detailed report"
    fi
}

#----------------------------------------------------------
# Command: clean
#----------------------------------------------------------

tbash::clean() {
    echo "Running Comprehensive Health Check"
    echo ""

    tbash::check
    echo ""
    tbash::orphans
    echo ""
    tbash::dead
    echo ""
    tbash::deps
    echo ""
    tbash::git
    echo ""

    tbash::print_header "Summary"
    if [[ $TBASH_VIOLATIONS -eq 0 && $TBASH_WARNINGS -eq 0 ]]; then
        tbash::ok "All checks passed! Directory is healthy."
    else
        echo "Violations: $TBASH_VIOLATIONS"
        echo "Warnings:   $TBASH_WARNINGS"
        echo ""
        tbash::info "Review issues above and take appropriate action"
    fi
}

#----------------------------------------------------------
# Command: perf
#----------------------------------------------------------

tbash::perf() {
    tbash::print_header "Boot Performance Profiling"

    # Check if tperf is available
    if ! command -v tperf &>/dev/null; then
        tbash::info "Loading tperf module..."
        if command -v tetra_load_module &>/dev/null; then
            tetra_load_module tperf || {
                tbash::error "Failed to load tperf module"
                return 1
            }
        else
            tbash::error "tperf module not available"
            tbash::info "Make sure TETRA_SRC is set and tetra is loaded"
            return 1
        fi
    fi

    # Run full profile
    tperf profile
}

#----------------------------------------------------------
# REPL
#----------------------------------------------------------

tbash::repl() {
    echo "tbash - Tetra Bash Directory Janitor"
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
            dead|d)
                tbash::dead
                ;;
            deps)
                tbash::deps
                ;;
            git|g)
                tbash::git
                ;;
            status|s)
                tbash::status
                ;;
            clean|c)
                tbash::clean
                ;;
            perf|p)
                tbash::perf
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
                ;;
        esac

        [[ -n "$cmd" ]] && echo ""
    done
}

# Auto-start REPL when sourced
tbash::repl
