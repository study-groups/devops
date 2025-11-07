#!/usr/bin/env bash
# clean.sh: Self-cleaning functions

_tetra_self_clean() {
    local dry_run=false
    local purge=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) dry_run=true; shift ;;
            --purge) purge=true; shift ;;
            *) shift ;;
        esac
    done

    # Log start
    self_log_try "clean" "system"

    echo "Tetra Self Clean"
    echo "Target: $TETRA_DIR"
    if [[ "$dry_run" == true ]]; then
        echo "Mode: DRY RUN (preview only)"
    elif [[ "$purge" == true ]]; then
        echo "Mode: PURGE (permanent deletion)"
    else
        echo "Mode: MOVE TO /tmp/tetra-old/"
    fi
    echo ""

    # Define garbage patterns
    local garbage_files=(
        "debug_*.sh"
        "test_*.sh"
        "capture_terminal_state.sh"
        "find_exit_status.sh"
        "preflight_check.sh"
        "safe_source_tetra.sh"
        "source_with_trace.sh"
        "tetra_safe.sh"
        "README_test.md"
    )

    # Create archive location
    local archive_dir="/tmp/tetra-old"
    if [[ "$purge" == false && "$dry_run" == false ]]; then
        mkdir -p "$archive_dir"
    fi

    # Process each pattern
    local count=0
    for pattern in "${garbage_files[@]}"; do
        for file in "$TETRA_DIR"/$pattern; do
            if [[ -e "$file" ]]; then
                local basename=$(basename "$file")
                if [[ "$dry_run" == true ]]; then
                    echo "[DRY RUN] Would move: $basename"
                elif [[ "$purge" == true ]]; then
                    rm -rf "$file"
                    echo "Deleted: $basename"
                else
                    mv "$file" "$archive_dir/"
                    echo "Moved: $basename → $archive_dir/"
                fi
                ((count++))
            fi
        done
    done

    echo ""
    echo "Cleanup complete: $count file(s) processed"
    if [[ "$purge" == false && "$dry_run" == false && $count -gt 0 ]]; then
        echo "Archive location: $archive_dir"
    fi

    # Log result
    local metadata="{\"count\":$count,\"dry_run\":$dry_run,\"purge\":$purge}"
    if [[ $count -gt 0 || "$dry_run" == true ]]; then
        self_log_success "clean" "system" "$metadata"
    else
        self_log_info "clean" "system" "$metadata"
    fi

    return 0
}

# Export function
export -f _tetra_self_clean
