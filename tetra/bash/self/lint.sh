#!/usr/bin/env bash
# lint.sh - Tetra code quality and structural validation
# Migrated from tbash.sh for integration into self module

# State tracking
declare -g LINT_VIOLATIONS=0
declare -g LINT_WARNINGS=0

#----------------------------------------------------------
# Helper Functions
#----------------------------------------------------------

_lint_reset_counters() {
    LINT_VIOLATIONS=0
    LINT_WARNINGS=0
}

_lint_print_header() {
    echo "========================================"
    echo "$1"
    echo "========================================"
}

_lint_error() {
    echo "[ERROR] $1"
    ((LINT_VIOLATIONS++))
}

_lint_warn() {
    echo "[WARN]  $1"
    ((LINT_WARNINGS++))
}

_lint_ok() {
    echo "[OK]    $1"
}

_lint_info() {
    echo "[INFO]  $1"
}

#----------------------------------------------------------
# Command: orphans
#----------------------------------------------------------

_tetra_self_lint_orphans() {
    _lint_print_header "Orphaned .sh Files in Root"
    _lint_reset_counters

    local bash_dir="${TETRA_SRC}/bash"
    local found=0

    while IFS= read -r file; do
        local basename="${file##*/}"
        # Skip allowed root files
        if [[ "$basename" == "tbash.sh" || "$basename" == "bootloader.sh" ]]; then
            continue
        fi

        _lint_error "Orphan file: ${file}"
        ((found++))
    done < <(find "${bash_dir}" -maxdepth 1 -type f -name "*.sh" 2>/dev/null)

    echo ""
    if [[ $found -eq 0 ]]; then
        _lint_ok "No orphaned .sh files found"
    else
        _lint_info "Found $found orphaned .sh file(s)"
        _lint_info "These files should be moved into appropriate module directories"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.orphans" "result" "{\"found\":$found,\"violations\":$LINT_VIOLATIONS}"
    fi
}

#----------------------------------------------------------
# Command: structure
#----------------------------------------------------------

_tetra_self_lint_structure() {
    _lint_print_header "Directory Structure Check"
    _lint_reset_counters

    local bash_dir="${TETRA_SRC}/bash"

    # Check for orphaned .sh files
    local orphan_count=0
    while IFS= read -r file; do
        local basename="${file##*/}"
        # Skip allowed root files
        if [[ "$basename" == "tbash.sh" || "$basename" == "bootloader.sh" ]]; then
            continue
        fi
        _lint_error "File in root: ${file}"
        ((orphan_count++))
    done < <(find "${bash_dir}" -maxdepth 1 -type f -name "*.sh" 2>/dev/null)

    # Check for non-.sh files in root
    local other_count=0
    while IFS= read -r file; do
        local basename="${file##*/}"
        # Skip .gitignore and hidden files
        if [[ "$basename" =~ ^\. ]]; then
            continue
        fi
        _lint_warn "Non-.sh file in root: ${file}"
        ((other_count++))
    done < <(find "${bash_dir}" -maxdepth 1 -type f ! -name "*.sh" 2>/dev/null)

    # Count module directories
    local module_count=0
    module_count=$(find "${bash_dir}" -maxdepth 1 -type d ! -name "bash" ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')

    echo ""
    _lint_info "Module directories: $module_count"

    if [[ $orphan_count -eq 0 ]]; then
        _lint_ok "Directory structure is clean"
    else
        _lint_error "Found $orphan_count orphaned .sh file(s)"
    fi

    if [[ $other_count -gt 0 ]]; then
        _lint_warn "Found $other_count non-.sh file(s) in root"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.structure" "result" "{\"modules\":$module_count,\"orphans\":$orphan_count,\"violations\":$LINT_VIOLATIONS,\"warnings\":$LINT_WARNINGS}"
    fi
}

#----------------------------------------------------------
# Command: dead
#----------------------------------------------------------

_tetra_self_lint_dead() {
    _lint_print_header "Dead Code Detection"
    _lint_reset_counters

    local bash_dir="${TETRA_SRC}/bash"

    # Find all module directories
    local modules=()
    while IFS= read -r dir; do
        local basename="${dir##*/}"
        modules+=("$basename")
    done < <(find "${bash_dir}" -maxdepth 1 -type d ! -name "bash" ! -name ".*" 2>/dev/null)

    if [[ ${#modules[@]} -eq 0 ]]; then
        _lint_warn "No modules found"
        return
    fi

    # For each module, check if it's sourced anywhere
    local dead_count=0
    for module in "${modules[@]}"; do
        # Search for references in .sh files
        local refs
        refs=$(grep -r "source.*${module}" "${bash_dir}" 2>/dev/null | wc -l | tr -d ' ')

        # Also check for direct path references
        local path_refs
        path_refs=$(grep -r "${module}/" "${bash_dir}" 2>/dev/null | grep -v "Binary" | wc -l | tr -d ' ')

        if [[ $refs -eq 0 && $path_refs -eq 0 ]]; then
            _lint_warn "Potentially unused module: ${module}"
            ((dead_count++))
        fi
    done

    echo ""
    if [[ $dead_count -eq 0 ]]; then
        _lint_ok "No dead modules detected"
    else
        _lint_info "Found $dead_count potentially unused module(s)"
        _lint_info "Manual verification recommended"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.dead" "result" "{\"dead\":$dead_count,\"warnings\":$LINT_WARNINGS}"
    fi
}

#----------------------------------------------------------
# Command: deps
#----------------------------------------------------------

_tetra_self_lint_deps() {
    _lint_print_header "Dependency Validation (TETRA_SRC)"
    _lint_reset_counters

    local bash_dir="${TETRA_SRC}/bash"

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
                _lint_error "Hardcoded path in: ${file}"
                ((not_using++))
            fi
        fi
    done < <(find "${bash_dir}" -type f -name "*.sh" ! -path "*/.*" 2>/dev/null)

    echo ""
    _lint_info "Total .sh files: $total"
    _lint_info "Files using TETRA_SRC: $using_tetra_src"

    if [[ $not_using -eq 0 ]]; then
        _lint_ok "No hardcoded paths detected"
    else
        _lint_error "Found $not_using file(s) with hardcoded paths"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.deps" "result" "{\"total\":$total,\"using_tetra_src\":$using_tetra_src,\"violations\":$LINT_VIOLATIONS}"
    fi
}

#----------------------------------------------------------
# Command: git
#----------------------------------------------------------

_tetra_self_lint_git() {
    _lint_print_header "Git Status Check"
    _lint_reset_counters

    local bash_dir="${TETRA_SRC}/bash"
    cd "${bash_dir}" || return 1

    # Check untracked files
    local untracked
    untracked=$(git ls-files --others --exclude-standard 2>/dev/null)

    if [[ -n "$untracked" ]]; then
        _lint_warn "Untracked files found:"
        while IFS= read -r file; do
            echo "  ${file}"
        done <<< "$untracked"
    else
        _lint_ok "No untracked files"
    fi

    # Check modified files
    local modified
    modified=$(git ls-files -m 2>/dev/null)

    echo ""
    if [[ -n "$modified" ]]; then
        _lint_warn "Modified files found:"
        while IFS= read -r file; do
            echo "  ${file}"
        done <<< "$modified"
    else
        _lint_ok "No modified files"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.git" "result" "{\"warnings\":$LINT_WARNINGS}"
    fi
}

#----------------------------------------------------------
# Command: status
#----------------------------------------------------------

_tetra_self_lint_status() {
    _lint_print_header "Directory Health Summary"

    local bash_dir="${TETRA_SRC}/bash"

    # Count files and directories
    local orphans
    orphans=$(find "${bash_dir}" -maxdepth 1 -type f -name "*.sh" ! -name "tbash.sh" ! -name "bootloader.sh" 2>/dev/null | wc -l | tr -d ' ')

    local modules
    modules=$(find "${bash_dir}" -maxdepth 1 -type d ! -name "bash" ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')

    local total_sh
    total_sh=$(find "${bash_dir}" -type f -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')

    echo "Location: ${bash_dir}"
    echo ""
    echo "Modules:          $modules"
    echo "Total .sh files:  $total_sh"
    echo "Orphaned files:   $orphans"
    echo ""

    if [[ $orphans -eq 0 ]]; then
        _lint_ok "Directory structure is healthy"
    else
        _lint_error "Directory needs cleanup"
        _lint_info "Run 'tetra-self lint' for detailed report"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.status" "result" "{\"modules\":$modules,\"files\":$total_sh,\"orphans\":$orphans}"
    fi
}

#----------------------------------------------------------
# Command: all (comprehensive check)
#----------------------------------------------------------

_tetra_self_lint_all() {
    echo "Running Comprehensive Health Check"
    echo ""

    _tetra_self_lint_structure
    echo ""
    _tetra_self_lint_orphans
    echo ""
    _tetra_self_lint_dead
    echo ""
    _tetra_self_lint_deps
    echo ""
    _tetra_self_lint_git
    echo ""

    _lint_print_header "Summary"
    if [[ $LINT_VIOLATIONS -eq 0 && $LINT_WARNINGS -eq 0 ]]; then
        _lint_ok "All checks passed! Directory is healthy."
    else
        echo "Violations: $LINT_VIOLATIONS"
        echo "Warnings:   $LINT_WARNINGS"
        echo ""
        _lint_info "Review issues above and take appropriate action"
    fi

    # Optional TCS 4.0 logging
    if type self_log_success &>/dev/null; then
        self_log_success "lint.all" "result" "{\"violations\":$LINT_VIOLATIONS,\"warnings\":$LINT_WARNINGS}"
    fi
}

# Export functions
export -f _tetra_self_lint_orphans
export -f _tetra_self_lint_structure
export -f _tetra_self_lint_dead
export -f _tetra_self_lint_deps
export -f _tetra_self_lint_git
export -f _tetra_self_lint_status
export -f _tetra_self_lint_all
