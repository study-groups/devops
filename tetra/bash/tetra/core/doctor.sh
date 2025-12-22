#!/usr/bin/env bash

# Tetra Doctor - Installation and Configuration Health Check
# Single source of truth for diagnosing tetra issues
# References bash/org for organization/environment configuration

# Doctor check result tracking
declare -g DOCTOR_ERRORS=0
declare -g DOCTOR_WARNINGS=0
declare -g DOCTOR_FIXES=0

# Load TDS for proper border rendering
if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
    source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
fi

# Colors for output
_doctor_color() {
    local color="$1"
    shift
    case "$color" in
        green)  printf "\033[32m%s\033[0m" "$*" ;;
        red)    printf "\033[31m%s\033[0m" "$*" ;;
        yellow) printf "\033[33m%s\033[0m" "$*" ;;
        blue)   printf "\033[34m%s\033[0m" "$*" ;;
        *)      printf "%s" "$*" ;;
    esac
}

# Check result helpers
_doctor_ok() {
    echo "$(_doctor_color green "✓") $*"
}

_doctor_error() {
    echo "$(_doctor_color red "✗") $*"
    ((DOCTOR_ERRORS++))
}

_doctor_warn() {
    echo "$(_doctor_color yellow "⚠") $*"
    ((DOCTOR_WARNINGS++))
}

_doctor_info() {
    echo "$(_doctor_color blue "ℹ") $*"
}

_doctor_fixed() {
    echo "$(_doctor_color green "✓ FIXED:") $*"
    ((DOCTOR_FIXES++))
}

# Check 1: Environment Variables
_doctor_check_env_vars() {
    echo ""
    echo "$(_doctor_color blue "=== Environment Variables ===")"

    # TETRA_SRC is the strong global
    if [[ -z "$TETRA_SRC" ]]; then
        _doctor_error "TETRA_SRC not set (required)"
        _doctor_info "  Set in ~/tetra/tetra.sh before sourcing bootloader"
        return 1
    else
        _doctor_ok "TETRA_SRC set: $TETRA_SRC"
    fi

    # Check if TETRA_SRC directory exists
    if [[ ! -d "$TETRA_SRC" ]]; then
        _doctor_error "TETRA_SRC directory does not exist: $TETRA_SRC"
        return 1
    else
        _doctor_ok "TETRA_SRC directory exists"
    fi

    # TETRA_DIR
    if [[ -z "$TETRA_DIR" ]]; then
        _doctor_error "TETRA_DIR not set"
    else
        _doctor_ok "TETRA_DIR set: $TETRA_DIR"
    fi

    # Check if both are exported
    if declare -p TETRA_SRC 2>/dev/null | grep -q 'declare -x'; then
        _doctor_ok "TETRA_SRC is exported"
    else
        _doctor_error "TETRA_SRC not exported (modules may fail)"
    fi

    if declare -p TETRA_DIR 2>/dev/null | grep -q 'declare -x'; then
        _doctor_ok "TETRA_DIR is exported"
    else
        _doctor_error "TETRA_DIR not exported (modules may fail)"
    fi
}

# Check 2: Conflicting Old Module Variables
_doctor_check_old_vars() {
    echo ""
    echo "$(_doctor_color blue "=== Checking for Old Module Conflicts ===")"

    local conflicts=0
    local old_vars=(
        "QA_SRC"
        "TSM_SRC"
        "RAG_SRC"
        "TKM_SRC"
        "TMOD_SRC"
    )

    for var in "${old_vars[@]}"; do
        if [[ -n "${!var}" ]]; then
            local var_value="${!var}"
            # Check if it points to old location (not under TETRA_SRC)
            if [[ ! "$var_value" =~ $TETRA_SRC ]]; then
                _doctor_warn "$var is set to old location: $var_value"
                _doctor_info "  This may conflict with tetra modules"
                _doctor_info "  Check ~/.bashrc, ~/mricos.sh, etc."
                ((conflicts++))
            else
                _doctor_ok "$var points to tetra: $var_value"
            fi
        fi
    done

    if [[ $conflicts -eq 0 ]]; then
        _doctor_ok "No conflicting old module variables found"
    fi
}

# Check 3: Shell Configuration Files
_doctor_check_shell_config() {
    echo ""
    echo "$(_doctor_color blue "=== Shell Configuration ===")"

    local shell_name=$(basename "$SHELL")
    _doctor_info "Current shell: $shell_name"

    # Check for ~/tetra/tetra.sh
    if [[ -f "$HOME/tetra/tetra.sh" ]]; then
        _doctor_ok "~/tetra/tetra.sh exists"

        # Check if it has proper exports
        if grep -q 'export TETRA_SRC' "$HOME/tetra/tetra.sh" && \
           grep -q 'export TETRA_DIR' "$HOME/tetra/tetra.sh"; then
            _doctor_ok "~/tetra/tetra.sh exports variables"
        else
            _doctor_error "~/tetra/tetra.sh missing exports"
            _doctor_info "  Should contain: export TETRA_SRC and export TETRA_DIR"
        fi
    else
        _doctor_warn "~/tetra/tetra.sh not found"
        _doctor_info "  Create with: cat > ~/tetra/tetra.sh"
    fi

    # Check for old module sourcing in config files
    local config_files=(
        "$HOME/.bashrc"
        "$HOME/.bash_profile"
        "$HOME/.zshrc"
        "$HOME/mricos.sh"
    )

    for config in "${config_files[@]}"; do
        if [[ -f "$config" ]]; then
            # Check for old qa/rag/tsm sourcing
            if grep -q "source.*src/bash/qa" "$config" 2>/dev/null; then
                _doctor_warn "$(basename "$config") sources old qa module"
                _doctor_info "  File: $config"
                _doctor_info "  Comment out: source \$HOME/src/bash/qa/qa.sh"
            fi
            if grep -q "source.*src/bash/rag" "$config" 2>/dev/null; then
                _doctor_warn "$(basename "$config") sources old rag module"
                _doctor_info "  File: $config"
            fi
        fi
    done
}

# Check 4: Bootstrap Chain
_doctor_check_bootstrap() {
    echo ""
    echo "$(_doctor_color blue "=== Bootstrap Chain ===")"

    local bootloader="$TETRA_SRC/bash/bootloader.sh"
    local boot_core="$TETRA_SRC/bash/boot/boot_core.sh"

    if [[ -f "$bootloader" ]]; then
        _doctor_ok "bootloader.sh exists"
        bash -n "$bootloader" && _doctor_ok "bootloader.sh syntax OK" || \
            _doctor_error "bootloader.sh has syntax errors"
    else
        _doctor_error "bootloader.sh not found: $bootloader"
    fi

    if [[ -f "$boot_core" ]]; then
        _doctor_ok "boot_core.sh exists"
        bash -n "$boot_core" && _doctor_ok "boot_core.sh syntax OK" || \
            _doctor_error "boot_core.sh has syntax errors"
    else
        _doctor_error "boot_core.sh not found: $boot_core"
    fi

    # Check if bootloader is currently loaded
    if [[ -n "$TETRA_BOOTLOADER_LOADED" ]]; then
        _doctor_ok "Bootloader is loaded (PID: $TETRA_BOOTLOADER_LOADED)"
    else
        _doctor_warn "Bootloader not loaded in current shell"
    fi
}

# Check 5: Module Health
_doctor_check_modules() {
    echo ""
    echo "$(_doctor_color blue "=== Module Health Checks ===")"

    local modules=(qa rag tsm org tmod)

    for module in "${modules[@]}"; do
        local module_path="$TETRA_SRC/bash/$module"
        local includes_path="$module_path/includes.sh"

        if [[ ! -d "$module_path" ]]; then
            _doctor_warn "Module '$module' directory not found"
            continue
        fi

        if [[ -f "$includes_path" ]]; then
            # Test in subshell like bootloader does
            # CRITICAL: Unset MOD_SRC to prevent cross-module contamination
            if ( unset MOD_SRC MOD_DIR; export TETRA_SRC TETRA_DIR; source "$includes_path" ) >/dev/null 2>&1; then
                _doctor_ok "Module '$module' loads successfully"
            else
                _doctor_error "Module '$module' fails to load"
                _doctor_info "  Test with: source $includes_path"
                # Show actual error
                local error_output
                error_output=$( ( unset MOD_SRC MOD_DIR; export TETRA_SRC TETRA_DIR; source "$includes_path" ) 2>&1 | head -3 )
                _doctor_info "  Error: $error_output"
            fi

            # Check syntax
            bash -n "$includes_path" || _doctor_error "Module '$module' has syntax errors"
        else
            _doctor_info "Module '$module' has no includes.sh"
        fi
    done
}

# Check 6: Organization Configuration
_doctor_check_org_config() {
    echo ""
    echo "$(_doctor_color blue "=== Organization Configuration ===")"

    # Source org functions if available
    if [[ -f "$TETRA_SRC/bash/org/tetra_org.sh" ]]; then
        source "$TETRA_SRC/bash/org/tetra_org.sh" 2>/dev/null || true
    fi

    # Check for active org
    if command -v org_active >/dev/null 2>&1; then
        local active_org
        active_org=$(org_active 2>/dev/null)

        if [[ "$active_org" != "none" && -n "$active_org" ]]; then
            _doctor_ok "Active organization: $active_org"

            # Check org TOML
            local org_toml
            org_toml=$(tetra_get_active_org_toml 2>/dev/null)
            if [[ -n "$org_toml" && -f "$org_toml" ]]; then
                _doctor_ok "Organization config exists: $org_toml"
            else
                _doctor_warn "Organization config not found"
            fi
        else
            _doctor_info "No active organization (use: tetra org switch <name>)"
        fi
    else
        _doctor_info "Org module not loaded (optional)"
    fi

    # Check for orgs directory
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        local org_count
        org_count=$(find "$TETRA_DIR/orgs" -maxdepth 1 -type d ! -name orgs | wc -l | tr -d ' ')
        _doctor_info "Organizations found: $org_count"
    fi
}

# Check 7: IFS and Array Pattern Safety
_doctor_check_ifs() {
    echo ""
    echo "$(_doctor_color blue "=== IFS and Array Safety ===")"

    # Check current IFS value
    local ifs_display
    if [[ -z "$IFS" ]]; then
        _doctor_error "IFS is empty (will break array parsing)"
        _doctor_info "  IFS should be space-tab-newline: \$' \\t\\n'"
    elif [[ "$IFS" == $' \t\n' ]]; then
        _doctor_ok "IFS is default (space-tab-newline)"
    else
        # Show hex representation for debugging
        ifs_display=$(printf '%s' "$IFS" | xxd -p | sed 's/../\\x&/g')
        _doctor_warn "IFS is non-default: $ifs_display"
        _doctor_info "  Expected: \\x20\\x09\\x0a (space-tab-newline)"
        _doctor_info "  This may cause array parsing issues"
    fi

    # Check if IFS is exported (can propagate to subshells unexpectedly)
    if declare -p IFS 2>/dev/null | grep -q 'declare -x'; then
        _doctor_warn "IFS is exported (may affect subshells)"
        _doctor_info "  Consider: unset -v IFS or declare +x IFS"
    else
        _doctor_ok "IFS is not exported"
    fi
}

# Check 8: Array Pattern Scan
_doctor_check_array_patterns() {
    echo ""
    echo "$(_doctor_color blue "=== Array Pattern Scan ===")"

    local scan_dir="${1:-$TETRA_SRC/bash}"
    local bad_patterns=0
    local bad_files=()

    _doctor_info "Scanning: $scan_dir"

    # Find problematic patterns: =($( but NOT COMPREPLY=
    # Pattern: variable assignment from command substitution into array
    while IFS= read -r match; do
        # Skip COMPREPLY (bash completion - works fine)
        if [[ "$match" =~ COMPREPLY ]]; then
            continue
        fi
        # Skip comments
        if [[ "$match" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        # Extract file path
        local file="${match%%:*}"
        # Deduplicate files
        local already_found=false
        for f in "${bad_files[@]}"; do
            [[ "$f" == "$file" ]] && already_found=true && break
        done
        if [[ "$already_found" == false ]]; then
            bad_files+=("$file")
        fi
        ((bad_patterns++))
    done < <(grep -rn --include='*.sh' '=(\$(' "$scan_dir" 2>/dev/null | grep -v 'COMPREPLY' | grep -v '^[[:space:]]*#')

    if [[ $bad_patterns -eq 0 ]]; then
        _doctor_ok "No IFS-dependent array patterns found"
    else
        _doctor_warn "Found $bad_patterns IFS-dependent array pattern(s)"
        _doctor_info "  Files with issues:"
        for file in "${bad_files[@]}"; do
            local rel_path="${file#$TETRA_SRC/}"
            _doctor_info "    - $rel_path"
        done
        _doctor_info ""
        _doctor_info "  Fix: Replace arr=(\$(cmd)) with:"
        _doctor_info "       readarray -t arr < <(cmd)"
        _doctor_info ""
        _doctor_info "  Run 'tetra doctor array-scan --verbose' for details"
    fi
}

# Detailed array pattern scan (verbose mode)
_doctor_array_scan_verbose() {
    local scan_dir="${1:-$TETRA_SRC/bash}"

    echo "$(_doctor_color blue "=== Detailed Array Pattern Scan ===")"
    echo ""

    # Find and display all problematic patterns with context
    grep -rn --include='*.sh' '=(\$(' "$scan_dir" 2>/dev/null | \
        grep -v 'COMPREPLY' | \
        grep -v '^[[:space:]]*#' | \
        while IFS= read -r match; do
            local file="${match%%:*}"
            local rel_path="${file#$TETRA_SRC/}"
            local rest="${match#*:}"
            local line_num="${rest%%:*}"
            local code="${rest#*:}"

            echo "$(_doctor_color yellow "$rel_path:$line_num")"
            echo "  $code"
            echo ""
        done
}

# Check 9: Remote Configuration (from active org)
_doctor_check_remote_config() {
    echo ""
    echo "$(_doctor_color blue "=== Remote Host Configuration ===")"

    # Only check if org is active
    if command -v tetra_get_active_org_toml >/dev/null 2>&1; then
        local org_toml
        org_toml=$(tetra_get_active_org_toml 2>/dev/null)

        if [[ -n "$org_toml" && -f "$org_toml" ]]; then
            # Check for environments section
            if grep -q '^\[environments\.' "$org_toml"; then
                _doctor_ok "Environments defined in org config"

                # List environments
                local envs
                envs=$(grep '^\[environments\.' "$org_toml" | sed 's/\[environments\.//;s/\]//' | tr '\n' ' ')
                _doctor_info "  Environments: $envs"
            else
                _doctor_warn "No environments defined in org config"
            fi

            # Check for SSH keys
            if grep -q 'ssh_key' "$org_toml"; then
                _doctor_ok "SSH configuration found"
            else
                _doctor_info "No SSH configuration in org (optional)"
            fi
        fi
    else
        _doctor_info "No org config to check (optional)"
    fi
}

# Auto-fix: Update ~/tetra/tetra.sh
_doctor_fix_tetra_sh() {
    local tetra_sh="$HOME/tetra/tetra.sh"

    echo ""
    echo "$(_doctor_color blue "Fixing ~/tetra/tetra.sh...")"

    # Create directory if needed
    mkdir -p "$HOME/tetra"

    # Backup existing file
    if [[ -f "$tetra_sh" ]]; then
        cp "$tetra_sh" "${tetra_sh}.backup.$(date +%s)"
        _doctor_info "Backed up existing file"
    fi

    # Create proper tetra.sh
    cat > "$tetra_sh" << 'EOF'
#!/usr/bin/env bash
# Tetra Entry Point - Sources local config then bootloader
# TETRA_DIR: Dynamically set to this file's directory (~/tetra)
# TETRA_SRC: Defaults to ~/src/devops/tetra but allows override
TETRA_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR
export TETRA_SRC
source "$TETRA_SRC/bash/bootloader.sh"
EOF

    chmod +x "$tetra_sh"
    _doctor_fixed "Created/updated ~/tetra/tetra.sh with proper exports"
}

# Main doctor command
tetra_doctor() {
    local fix_mode=false
    local check_filter=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --fix)
                fix_mode=true
                shift
                ;;
            --verbose|-v)
                # Already verbose by default
                shift
                ;;
            env|modules|config|org|remote|ifs|arrays|all)
                check_filter="$1"
                shift
                ;;
            array-scan)
                # Special subcommand for detailed array scanning
                shift
                if [[ "$1" == "--verbose" || "$1" == "-v" ]]; then
                    _doctor_array_scan_verbose "${2:-$TETRA_SRC/bash}"
                else
                    _doctor_check_array_patterns "${1:-$TETRA_SRC/bash}"
                fi
                return 0
                ;;
            *)
                echo "Usage: tetra doctor [--fix] [--verbose] [env|modules|config|org|remote|ifs|arrays|all]"
                echo "       tetra doctor array-scan [--verbose] [path]"
                return 1
                ;;
        esac
    done

    # Reset counters
    DOCTOR_ERRORS=0
    DOCTOR_WARNINGS=0
    DOCTOR_FIXES=0

    # Use TDS for proper ANSI-aware borders if available
    if command -v tds_panel_header &>/dev/null; then
        local title="$(_doctor_color green "Tetra Installation Doctor")"
        tds_panel_header "$title" 43 "double"
    else
        # Fallback to simple borders
        echo "$(_doctor_color green "╔═══════════════════════════════════════╗")"
        printf "%s     Tetra Installation Doctor      %s\n" "$(_doctor_color green "║")" "$(_doctor_color green "║")"
        echo "$(_doctor_color green "╚═══════════════════════════════════════╝")"
    fi

    # Run checks based on filter
    case "$check_filter" in
        env)
            _doctor_check_env_vars
            _doctor_check_old_vars
            ;;
        modules)
            _doctor_check_modules
            ;;
        config)
            _doctor_check_shell_config
            _doctor_check_bootstrap
            ;;
        org)
            _doctor_check_org_config
            ;;
        remote)
            _doctor_check_remote_config
            ;;
        ifs)
            _doctor_check_ifs
            ;;
        arrays)
            _doctor_check_ifs
            _doctor_check_array_patterns
            ;;
        all|"")
            _doctor_check_env_vars
            _doctor_check_old_vars
            _doctor_check_shell_config
            _doctor_check_bootstrap
            _doctor_check_modules
            _doctor_check_org_config
            _doctor_check_remote_config
            _doctor_check_ifs
            _doctor_check_array_patterns
            ;;
    esac

    # Apply fixes if requested
    if [[ "$fix_mode" == true ]]; then
        echo ""
        echo "$(_doctor_color blue "=== Applying Fixes ===")"

        if [[ ! -f "$HOME/tetra/tetra.sh" ]] || \
           ! grep -q 'export TETRA_SRC' "$HOME/tetra/tetra.sh" 2>/dev/null; then
            _doctor_fix_tetra_sh
        fi

        # Add more auto-fixes here
    fi

    # Summary
    echo ""
    echo "$(_doctor_color blue "═══════════════════════════════════════")"
    echo "$(_doctor_color blue "Summary:")"

    if [[ $DOCTOR_ERRORS -eq 0 && $DOCTOR_WARNINGS -eq 0 ]]; then
        echo "$(_doctor_color green "✓ All checks passed!")"
    else
        [[ $DOCTOR_ERRORS -gt 0 ]] && echo "$(_doctor_color red "  Errors: $DOCTOR_ERRORS")"
        [[ $DOCTOR_WARNINGS -gt 0 ]] && echo "$(_doctor_color yellow "  Warnings: $DOCTOR_WARNINGS")"
        [[ $DOCTOR_FIXES -gt 0 ]] && echo "$(_doctor_color green "  Fixed: $DOCTOR_FIXES")"
    fi

    if [[ $DOCTOR_ERRORS -gt 0 && "$fix_mode" != true ]]; then
        echo ""
        _doctor_info "Run 'tetra doctor --fix' to auto-fix common issues"
    fi

    echo "$(_doctor_color blue "═══════════════════════════════════════")"

    return $DOCTOR_ERRORS
}

# Export functions
export -f tetra_doctor
