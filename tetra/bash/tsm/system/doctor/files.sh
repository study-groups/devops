#!/usr/bin/env bash

# TSM Doctor - File Diagnostics
# Comprehensive audit of all TSM-related files

# Diagnose all TSM files - comprehensive file audit
doctor_diagnose_files() {
    local verbose="${1:-false}"
    local errors=0
    local warnings=0

    doctor_log "TSM File Diagnostics"
    echo "===================="
    echo

    # 1. Service Definitions ($TETRA_DIR/tsm/services-available/*.tsm)
    doctor_log "Service Definitions (services-available):"
    local services_dir="$TETRA_DIR/tsm/services-available"
    if [[ -d "$services_dir" ]]; then
        local service_count=0
        for tsm_file in "$services_dir"/*.tsm; do
            [[ -f "$tsm_file" ]] || continue
            ((service_count++))

            local name=$(basename "$tsm_file" .tsm)

            # Source the file to check variables
            (
                source "$tsm_file" 2>/dev/null

                # Check required variables
                if [[ -z "${TSM_NAME:-}" ]]; then
                    echo "  ERROR:$name:TSM_NAME not defined"
                fi
                if [[ -z "${TSM_COMMAND:-}" ]]; then
                    echo "  ERROR:$name:TSM_COMMAND not defined"
                fi
                if [[ -z "${TSM_CWD:-}" ]]; then
                    echo "  WARN:$name:TSM_CWD not defined (will use PWD)"
                fi

                # Check TSM_ENV
                local env="${TSM_ENV:-}"
                if [[ -z "$env" ]]; then
                    echo "  WARN:$name:TSM_ENV not set (will default to 'local')"
                elif [[ "$env" != "none" && "$env" != "local" && "$env" != "dev" && "$env" != "staging" && "$env" != "prod" ]]; then
                    echo "  ERROR:$name:Invalid TSM_ENV='$env' (must be: none, local, dev, staging, prod)"
                fi

                # Check if env file exists when required
                if [[ "$env" != "none" && -n "${TSM_CWD:-}" ]]; then
                    local cwd="${TSM_CWD}"
                    [[ "$cwd" == "." ]] && cwd="(current dir)"
                    local env_name="${env:-local}"
                    echo "  INFO:$name:Requires env file: \$TSM_CWD/env/${env_name}.env"
                fi
            ) | while IFS= read -r line; do
                local type=$(echo "$line" | cut -d: -f2)
                local svc=$(echo "$line" | cut -d: -f3)
                local msg=$(echo "$line" | cut -d: -f4-)
                case "$type" in
                    ERROR)
                        doctor_error "  ✗ $svc: $msg"
                        ;;
                    WARN)
                        doctor_warn "  ⚠ $svc: $msg"
                        ;;
                    INFO)
                        if [[ "$verbose" == "true" ]]; then
                            doctor_info "  ℹ $svc: $msg"
                        fi
                        ;;
                esac
            done

            # Basic validation passed - show as OK in verbose mode
            if [[ "$verbose" == "true" ]]; then
                doctor_success "  ✓ $name: $tsm_file"
            fi
        done

        if [[ $service_count -eq 0 ]]; then
            doctor_info "  No service definitions found"
        else
            doctor_success "  Found $service_count service definition(s)"
        fi
    else
        doctor_warn "  Directory not found: $services_dir"
    fi

    echo

    # 2. Enabled Services ($TETRA_DIR/tsm/services-enabled/*.tsm)
    doctor_log "Enabled Services (services-enabled):"
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"
    if [[ -d "$enabled_dir" ]]; then
        local enabled_count=0
        for link in "$enabled_dir"/*.tsm; do
            [[ -e "$link" ]] || continue
            ((enabled_count++))

            local name=$(basename "$link" .tsm)

            if [[ -L "$link" ]]; then
                local target=$(readlink "$link")
                if [[ -f "$services_dir/${name}.tsm" ]]; then
                    doctor_success "  ✓ $name → $target"
                else
                    doctor_error "  ✗ $name → $target (BROKEN: target missing)"
                    ((errors++))
                fi
            else
                doctor_warn "  ⚠ $name: not a symlink (should be)"
                ((warnings++))
            fi
        done

        if [[ $enabled_count -eq 0 ]]; then
            doctor_info "  No enabled services"
        fi
    else
        doctor_info "  Directory not found (no services enabled)"
    fi

    echo

    # 3. Process Tracking ($TSM_PROCESSES_DIR/*)
    doctor_log "Process Tracking (running/tracked processes):"
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        local process_count=0
        local stale_count=0

        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue
            ((process_count++))

            local name=$(basename "$process_dir")
            local meta_file="${process_dir}meta.json"

            if [[ ! -f "$meta_file" ]]; then
                doctor_error "  ✗ $name: missing meta.json"
                ((errors++))
                continue
            fi

            local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
            local port=$(jq -r '.port // "none"' "$meta_file" 2>/dev/null)
            local command=$(jq -r '.command // "unknown"' "$meta_file" 2>/dev/null | head -c 40)

            if [[ -z "$pid" ]]; then
                doctor_error "  ✗ $name: invalid meta.json (no PID)"
                ((errors++))
                continue
            fi

            if tsm_is_pid_alive "$pid"; then
                doctor_success "  ✓ $name (PID: $pid, Port: $port)"
                if [[ "$verbose" == "true" ]]; then
                    doctor_info "      Command: $command..."
                fi
            else
                doctor_warn "  ⚠ $name: STALE (PID $pid dead)"
                ((stale_count++))
                ((warnings++))
            fi
        done

        if [[ $process_count -eq 0 ]]; then
            doctor_info "  No tracked processes"
        else
            echo "  Summary: $process_count tracked, $stale_count stale"
            if [[ $stale_count -gt 0 ]]; then
                doctor_info "  Run 'tsm doctor clean' to remove stale entries"
            fi
        fi
    else
        doctor_warn "  Directory not found: $TSM_PROCESSES_DIR"
    fi

    echo

    # 4. Log Files ($TSM_LOGS_DIR/*)
    doctor_log "Log Files:"
    if [[ -d "$TSM_LOGS_DIR" ]]; then
        local log_count=$(find "$TSM_LOGS_DIR" -type f -name "*.out" -o -name "*.err" 2>/dev/null | wc -l | tr -d ' ')
        local total_size=$(du -sh "$TSM_LOGS_DIR" 2>/dev/null | cut -f1 || echo "unknown")

        doctor_success "  Found $log_count log file(s)"
        doctor_info "  Total size: $total_size"
        doctor_info "  Location: $TSM_LOGS_DIR"

        # Show largest logs
        if [[ "$verbose" == "true" && $log_count -gt 0 ]]; then
            echo "  Largest logs:"
            find "$TSM_LOGS_DIR" -type f \( -name "*.out" -o -name "*.err" \) -exec du -h {} \; 2>/dev/null | sort -rh | head -5 | while read size file; do
                doctor_info "    $size  $(basename "$file")"
            done
        fi
    else
        doctor_warn "  Directory not found: $TSM_LOGS_DIR"
    fi

    echo

    # 5. PID Files ($TSM_PIDS_DIR/*.pid)
    doctor_log "PID Files:"
    if [[ -d "$TSM_PIDS_DIR" ]]; then
        local pid_count=0
        local orphan_pids=0

        for pid_file in "$TSM_PIDS_DIR"/*.pid; do
            [[ -f "$pid_file" ]] || continue
            ((pid_count++))

            local name=$(basename "$pid_file" .pid)
            local pid=$(cat "$pid_file" 2>/dev/null)

            if [[ -z "$pid" ]]; then
                doctor_error "  ✗ $name.pid: empty file"
                ((errors++))
            elif tsm_is_pid_alive "$pid"; then
                doctor_success "  ✓ $name.pid (PID: $pid alive)"
            else
                doctor_warn "  ⚠ $name.pid (PID: $pid dead)"
                ((orphan_pids++))
                ((warnings++))
            fi
        done

        if [[ $pid_count -eq 0 ]]; then
            doctor_info "  No PID files"
        else
            echo "  Summary: $pid_count files, $orphan_pids orphaned"
        fi
    else
        doctor_info "  Directory not found (legacy PID storage)"
    fi

    echo

    # 6. Port Registry ($TSM_PORTS_DIR/*)
    doctor_log "Port Registry:"
    if [[ -d "$TSM_PORTS_DIR" ]]; then
        local port_file_count=0

        for port_file in "$TSM_PORTS_DIR"/*; do
            [[ -f "$port_file" ]] || continue
            ((port_file_count++))

            local name=$(basename "$port_file")
            if [[ "$verbose" == "true" ]]; then
                doctor_info "  ✓ $name"
            fi
        done

        if [[ $port_file_count -eq 0 ]]; then
            doctor_info "  No port registry files"
        else
            doctor_success "  Found $port_file_count port registry file(s)"
        fi
    else
        doctor_info "  Directory not found: $TSM_PORTS_DIR"
    fi

    echo

    # Summary
    doctor_log "File Diagnostics Summary:"
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        doctor_success "  All file checks passed"
    elif [[ $errors -eq 0 ]]; then
        doctor_warn "  $warnings warning(s) found"
    else
        doctor_error "  $errors error(s), $warnings warning(s) found"
    fi

    echo
    doctor_info "Tip: Use 'tsm doctor files -v' for verbose output"

    return $(( errors > 0 ? 1 : 0 ))
}

# Export functions
export -f doctor_diagnose_files
