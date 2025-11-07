#!/usr/bin/env bash
# backup.sh: Backup and restore functions

_tetra_self_backup() {
    local exclude_runtime=false
    local include_source=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --exclude-runtime) exclude_runtime=true; shift ;;
            --include-source) include_source=true; shift ;;
            *) shift ;;
        esac
    done

    # Log start
    self_log_try "backup" "system"

    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="/tmp/tetra-backup-$timestamp.tar.gz"

    echo "Creating backup of TETRA_DIR..."
    echo "Source: $TETRA_DIR"
    echo "Target: $backup_file"
    echo ""

    # Build tar command
    local tar_opts="-czf"
    local exclude_opts=""

    if [[ "$exclude_runtime" == true ]]; then
        # Exclude module data directories
        for dir in "$TETRA_DIR"/*/; do
            if [[ -d "$dir" ]]; then
                local dirname=$(basename "$dir")
                if [[ "$dirname" != "node_modules" && \
                      "$dirname" != "nvm" && \
                      "$dirname" != "pyenv" ]]; then
                    exclude_opts="$exclude_opts --exclude=$dirname"
                fi
            fi
        done
    fi

    # Create backup
    tar $tar_opts "$backup_file" -C "$TETRA_DIR" $exclude_opts .

    if [[ $? -eq 0 ]]; then
        echo "✓ Backup created successfully"
        echo "Location: $backup_file"
        local size=$(du -h "$backup_file" | cut -f1)
        echo "Size: $size"

        # Log success
        self_log_success "backup" "system" "{\"file\":\"$backup_file\",\"size\":\"$size\"}"
    else
        echo "Error: Backup failed"
        self_log_fail "backup" "system" '{"error":"tar command failed"}'
        return 1
    fi

    # Optionally backup source
    if [[ "$include_source" == true ]]; then
        local source_backup="/tmp/tetra-src-backup-$timestamp.tar.gz"
        echo ""
        echo "Creating backup of TETRA_SRC..."
        tar -czf "$source_backup" -C "$TETRA_SRC" .

        if [[ $? -eq 0 ]]; then
            echo "✓ Source backup: $source_backup"
            local src_size=$(du -h "$source_backup" | cut -f1)
            echo "Size: $src_size"
        fi
    fi

    return 0
}

_tetra_self_restore() {
    local backup_file="$1"

    # Log start
    self_log_try "restore" "system"

    if [[ -z "$backup_file" ]]; then
        echo "Usage: tetra-self restore <backup-file>"
        self_log_fail "restore" "system" '{"error":"no backup file specified"}'
        return 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        echo "Error: Backup file not found: $backup_file"
        self_log_fail "restore" "system" "{\"error\":\"file not found\",\"file\":\"$backup_file\"}"
        return 1
    fi

    echo "WARNING: This will overwrite files in $TETRA_DIR"
    echo "Backup file: $backup_file"
    read -p "Continue? [y/N] " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Restoring from backup..."
        tar -xzf "$backup_file" -C "$TETRA_DIR"

        if [[ $? -eq 0 ]]; then
            echo "✓ Restore successful"
            echo "You may need to reload tetra: source ~/tetra/tetra.sh"

            # Log success
            self_log_success "restore" "system" "{\"file\":\"$backup_file\"}"
            return 0
        else
            echo "Error: Restore failed"
            self_log_fail "restore" "system" "{\"error\":\"tar extract failed\",\"file\":\"$backup_file\"}"
            return 1
        fi
    else
        echo "Restore cancelled"
        self_log_info "restore" "system" '{"cancelled":true}'
        return 1
    fi
}

# Export functions
export -f _tetra_self_backup
export -f _tetra_self_restore
