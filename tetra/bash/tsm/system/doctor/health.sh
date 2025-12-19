#!/usr/bin/env bash

# TSM Doctor - Health Check
# Comprehensive TSM environment and state validation

# Health check - validate TSM environment and state
doctor_healthcheck() {
    local errors=0
    local warnings=0
    local fix_suggestions=()

    doctor_log "TSM Health Check"
    echo "==================="
    echo

    # Check TETRA core variables
    doctor_log "Core Environment:"
    if [[ -n "${TETRA_SRC:-}" ]]; then
        doctor_success "  [OK] TETRA_SRC=$TETRA_SRC"
    else
        doctor_error "  [ERROR] TETRA_SRC not set"
        fix_suggestions+=("Run: source ~/tetra/tetra.sh")
        ((errors++))
    fi

    if [[ -n "${TETRA_DIR:-}" ]]; then
        doctor_success "  [OK] TETRA_DIR=$TETRA_DIR"
    else
        doctor_error "  [ERROR] TETRA_DIR not set"
        fix_suggestions+=("Run: source ~/tetra/tetra.sh")
        ((errors++))
    fi

    echo

    # Check TSM runtime variables
    doctor_log "TSM Runtime Variables:"
    local tsm_vars=("TSM_PROCESSES_DIR" "TSM_LOGS_DIR" "TSM_PIDS_DIR" "TSM_PORTS_DIR")
    for var in "${tsm_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            doctor_success "  [OK] $var=${!var}"
        else
            doctor_error "  [ERROR] $var not set"
            fix_suggestions+=("TSM not properly initialized. Run: source \$TETRA_SRC/bash/tsm/tsm.sh")
            ((errors++))
        fi
    done

    echo

    # Check runtime directories exist
    doctor_log "Runtime Directories:"
    for var in "${tsm_vars[@]}"; do
        local dir_path="${!var:-}"
        if [[ -z "$dir_path" ]]; then
            doctor_warn "  [WARN] $var: skipped (not set)"
            ((warnings++))
        elif [[ -d "$dir_path" ]]; then
            doctor_success "  [OK] $var: exists"
        else
            doctor_warn "  [WARN] $var: missing"
            fix_suggestions+=("Create with: mkdir -p $dir_path")
            ((warnings++))
        fi
    done

    echo

    # Check dependencies
    doctor_log "Dependencies:"
    local deps=("lsof" "jq" "ps" "kill")
    for dep in "${deps[@]}"; do
        if command -v "$dep" >/dev/null 2>&1; then
            doctor_success "  [OK] $dep: installed"
        else
            doctor_error "  [ERROR] $dep: not found"
            if [[ "$dep" == "lsof" ]]; then
                fix_suggestions+=("Install: brew install lsof")
            elif [[ "$dep" == "jq" ]]; then
                fix_suggestions+=("Install: brew install jq")
            fi
            ((errors++))
        fi
    done

    # Check optional dependencies (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v flock >/dev/null 2>&1 && command -v setsid >/dev/null 2>&1; then
            doctor_success "  [OK] util-linux: installed (flock, setsid)"
        else
            doctor_warn "  [OPTIONAL] util-linux: not in PATH"
            fix_suggestions+=("Install util-linux: brew install util-linux OR run: bash \$TETRA_SRC/bash/tsm/install.sh")
            ((warnings++))
        fi
    fi

    echo

    # Check for running processes vs tracked processes
    doctor_log "Process Tracking:"
    if [[ -n "${TSM_PROCESSES_DIR:-}" && -d "${TSM_PROCESSES_DIR:-}" ]]; then
        local meta_count=$(find "$TSM_PROCESSES_DIR" -name "*.meta" -o -name "meta.json" 2>/dev/null | wc -l | tr -d ' ')
        doctor_info "  Tracked processes: $meta_count"

        # Check for stale tracking
        local stale=0
        if [[ $meta_count -gt 0 ]]; then
            for process_dir in "$TSM_PROCESSES_DIR"/*/; do
                [[ -d "$process_dir" ]] || continue
                local meta_file="${process_dir}meta.json"
                if [[ -f "$meta_file" ]]; then
                    local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                    if ! tsm_is_pid_alive "$pid"; then
                        ((stale++))
                    fi
                fi
            done

            if [[ $stale -gt 0 ]]; then
                doctor_warn "  [WARN] Stale process files: $stale"
                fix_suggestions+=("Clean stale processes: tsm doctor clean")
                ((warnings++))
            else
                doctor_success "  [OK] No stale process files"
            fi
        fi
    else
        doctor_warn "  [WARN] Cannot check (TSM_PROCESSES_DIR not available)"
        ((warnings++))
    fi

    echo

    # Check for orphaned processes
    doctor_log "Orphaned Processes:"
    if command -v lsof >/dev/null 2>&1; then
        local orphan_count=$(ps -eo pid,args | grep -E "python.*http.server|node.*server" | grep -v grep | wc -l | tr -d ' ')
        if [[ $orphan_count -gt 0 ]]; then
            doctor_warn "  [WARN] Potential orphans: $orphan_count"
            fix_suggestions+=("Check orphans: tsm doctor orphans")
            ((warnings++))
        else
            doctor_success "  [OK] No obvious orphans"
        fi
    fi

    echo

    # Check doctor configuration
    doctor_log "Doctor Configuration:"
    if [[ -f "$TSM_DOCTOR_CONFIG_FILE" ]]; then
        doctor_success "  [OK] Config file exists: $TSM_DOCTOR_CONFIG_FILE"
    else
        doctor_info "  [INFO] No config file (using defaults)"
        doctor_info "  Create with: tsm doctor config init"
    fi

    # Show current effective port range
    doctor_info "  Port scan range: ${TSM_DOCTOR_PORT_MIN:-1024}-${TSM_DOCTOR_PORT_MAX:-10000}"

    echo

    # Summary
    doctor_log "Summary:"
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        doctor_success "  All checks passed"
        return 0
    elif [[ $errors -eq 0 ]]; then
        doctor_warn "  $warnings warning(s) found"
    else
        doctor_error "  $errors error(s), $warnings warning(s) found"
    fi

    echo

    # Show fix suggestions
    if [[ ${#fix_suggestions[@]} -gt 0 ]]; then
        doctor_log "Suggested Fixes:"
        for suggestion in "${fix_suggestions[@]}"; do
            echo "  -> $suggestion"
        done
        echo
    fi

    return $(( errors > 0 ? 1 : 0 ))
}

# Export functions
export -f doctor_healthcheck
