#!/usr/bin/env bash
# TSM Logging - log rotation, archival, and export
#
# Commands:
#   tsm logs rotate <name|all>     Rotate current logs to timestamped archive
#   tsm logs archive <name|all>    Compress rotated logs
#   tsm logs export <name|all>     Upload archives to S3/Spaces
#   tsm logs clean <name|all>      Remove old archives per retention policy
#   tsm logs list <name>           List archived logs for a service
#
# Configuration (env vars or future env.toml):
#   TSM_LOG_ROTATION_SIZE_MB=10    Rotate when log exceeds this size
#   TSM_LOG_RETENTION_DAYS=7       Keep archives for this many days
#   TSM_LOG_COMPRESS=true          Compress archives with gzip
#   TSM_LOG_ARCHIVE_DIR            Where to store archives (default: $TSM_DIR/runtime/logs)

# === CONFIGURATION ===

TSM_LOG_ROTATION_SIZE_MB="${TSM_LOG_ROTATION_SIZE_MB:-10}"
TSM_LOG_RETENTION_DAYS="${TSM_LOG_RETENTION_DAYS:-7}"
TSM_LOG_COMPRESS="${TSM_LOG_COMPRESS:-true}"
TSM_LOG_ARCHIVE_DIR="${TSM_LOG_ARCHIVE_DIR:-$TSM_DIR/runtime/logs}"

# === HELPERS ===

# Get file size in bytes (cross-platform)
_tsm_file_size() {
    local file="$1"
    if [[ "$TSM_PLATFORM" == "macos" ]]; then
        stat -f%z "$file" 2>/dev/null || echo 0
    else
        stat -c%s "$file" 2>/dev/null || echo 0
    fi
}

# Check if file exceeds rotation threshold
_tsm_should_rotate() {
    local file="$1"
    local threshold_bytes=$((TSM_LOG_ROTATION_SIZE_MB * 1024 * 1024))
    local size=$(_tsm_file_size "$file")
    [[ $size -ge $threshold_bytes ]]
}

# Generate archive filename
# Format: {name}.{YYYYMMDDTHHMMSS}.{out|err}[.gz]
_tsm_archive_name() {
    local name="$1"
    local stream="$2"  # out or err
    local ts
    ts=$(tsm_timestamp)

    local ext=""
    [[ "$TSM_LOG_COMPRESS" == "true" ]] && ext=".gz"

    echo "${name}.${ts}.${stream}${ext}"
}

# === ROTATION ===

# Rotate logs for a single service
# Moves current.out/err to timestamped archive, optionally compresses
tsm_logs_rotate_one() {
    local name="$1"
    local force="${2:-false}"

    local proc_dir=$(tsm_process_dir "$name")
    local log_out="$proc_dir/current.out"
    local log_err="$proc_dir/current.err"

    if [[ ! -d "$proc_dir" ]]; then
        tsm_error "process directory not found: $name"
        return 1
    fi

    mkdir -p "$TSM_LOG_ARCHIVE_DIR/$name"

    local rotated=false

    # Rotate stdout
    if [[ -f "$log_out" && -s "$log_out" ]]; then
        if [[ "$force" == "true" ]] || _tsm_should_rotate "$log_out"; then
            local archive="$TSM_LOG_ARCHIVE_DIR/$name/$(_tsm_archive_name "$name" "out")"
            if [[ "$TSM_LOG_COMPRESS" == "true" ]]; then
                gzip -c "$log_out" > "$archive"
            else
                cp "$log_out" "$archive"
            fi
            : > "$log_out"  # Truncate without breaking file handles
            echo "Rotated: $archive"
            rotated=true
        fi
    fi

    # Rotate stderr
    if [[ -f "$log_err" && -s "$log_err" ]]; then
        if [[ "$force" == "true" ]] || _tsm_should_rotate "$log_err"; then
            local archive="$TSM_LOG_ARCHIVE_DIR/$name/$(_tsm_archive_name "$name" "err")"
            if [[ "$TSM_LOG_COMPRESS" == "true" ]]; then
                gzip -c "$log_err" > "$archive"
            else
                cp "$log_err" "$archive"
            fi
            : > "$log_err"
            echo "Rotated: $archive"
            rotated=true
        fi
    fi

    [[ "$rotated" == "false" ]] && echo "No rotation needed for $name"
    return 0
}

# Rotate logs for all running services
tsm_logs_rotate_all() {
    local force="${1:-false}"

    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue

        # Only rotate running services
        if tsm_is_running "$name"; then
            tsm_logs_rotate_one "$name" "$force"
        fi
    done
}

# Main rotate command
tsm_logs_rotate() {
    local target="${1:-}"
    local force=false

    # Parse flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f|--force) force=true; shift ;;
            all) target="all"; shift ;;
            *) [[ -z "$target" ]] && target="$1"; shift ;;
        esac
    done

    if [[ -z "$target" ]]; then
        tsm_error "usage: tsm logs rotate <name|all> [-f|--force]"
        return 64
    fi

    if [[ "$target" == "all" ]]; then
        tsm_logs_rotate_all "$force"
    else
        local name
        name=$(tsm_resolve_name "$target" "true")
        if [[ $? -ne 0 ]]; then
            tsm_error "service not found: $target"
            return 1
        fi
        tsm_logs_rotate_one "$name" "$force"
    fi
}

# === ARCHIVAL (COMPRESS) ===

# Compress any uncompressed archives
tsm_logs_archive_one() {
    local name="$1"
    local archive_dir="$TSM_LOG_ARCHIVE_DIR/$name"

    [[ -d "$archive_dir" ]] || return 0

    local count=0
    for file in "$archive_dir"/*.out "$archive_dir"/*.err; do
        [[ -f "$file" ]] || continue
        [[ "$file" == *.gz ]] && continue

        gzip "$file"
        ((count++))
    done

    echo "Compressed $count files for $name"
}

tsm_logs_archive() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        tsm_error "usage: tsm logs archive <name|all>"
        return 64
    fi

    if [[ "$target" == "all" ]]; then
        for dir in "$TSM_LOG_ARCHIVE_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            tsm_logs_archive_one "$name"
        done
    else
        tsm_logs_archive_one "$target"
    fi
}

# === CLEANUP ===

# Remove archives older than retention period
tsm_logs_clean_one() {
    local name="$1"
    local archive_dir="$TSM_LOG_ARCHIVE_DIR/$name"

    [[ -d "$archive_dir" ]] || return 0

    local cutoff_days="$TSM_LOG_RETENTION_DAYS"
    local count=0

    # Find and remove old files
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((count++))
    done < <(find "$archive_dir" -type f -mtime +"$cutoff_days" -print0 2>/dev/null)

    echo "Removed $count old archives for $name (>${cutoff_days} days)"
}

tsm_logs_clean() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        tsm_error "usage: tsm logs clean <name|all>"
        return 64
    fi

    if [[ "$target" == "all" ]]; then
        for dir in "$TSM_LOG_ARCHIVE_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            tsm_logs_clean_one "$name"
        done
    else
        tsm_logs_clean_one "$target"
    fi
}

# === EXPORT TO S3/SPACES ===

# Export archives to remote storage
# Requires: aws cli or s3cmd configured
tsm_logs_export() {
    local target="${1:-}"
    local destination="${2:-}"

    if [[ -z "$target" ]]; then
        tsm_error "usage: tsm logs export <name|all> [--destination <local|spaces|s3>]"
        return 64
    fi

    # Parse destination from args
    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --destination|-d) destination="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    destination="${destination:-local}"

    case "$destination" in
        local)
            echo "Archives already stored locally at: $TSM_LOG_ARCHIVE_DIR"
            ;;
        spaces|s3)
            _tsm_logs_export_s3 "$target" "$destination"
            ;;
        *)
            tsm_error "unknown destination: $destination (use: local, spaces, s3)"
            return 1
            ;;
    esac
}

_tsm_logs_export_s3() {
    local target="$1"
    local provider="$2"

    # Check for required tools
    if ! command -v aws &>/dev/null; then
        tsm_error "aws cli not found - install with: brew install awscli"
        return 1
    fi

    # Load storage config from org tetra.toml if available
    local bucket="${TSM_LOG_S3_BUCKET:-}"
    local prefix="${TSM_LOG_S3_PREFIX:-tsm/logs/}"
    local endpoint="${TSM_LOG_S3_ENDPOINT:-}"

    if [[ -z "$bucket" ]]; then
        tsm_error "TSM_LOG_S3_BUCKET not configured"
        echo "Set via environment or configure [logging.archive] in env.toml" >&2
        return 1
    fi

    local aws_args=()
    [[ -n "$endpoint" ]] && aws_args+=(--endpoint-url "$endpoint")

    local archive_dir="$TSM_LOG_ARCHIVE_DIR"

    if [[ "$target" == "all" ]]; then
        echo "Uploading all archives to s3://$bucket/$prefix..."
        aws "${aws_args[@]}" s3 sync "$archive_dir" "s3://$bucket/$prefix" --exclude "*.tmp"
    else
        local name
        name=$(tsm_resolve_name "$target" "true") || { tsm_error "service not found: $target"; return 1; }

        local src="$archive_dir/$name"
        [[ -d "$src" ]] || { tsm_error "no archives for: $name"; return 1; }

        echo "Uploading $name archives to s3://$bucket/$prefix$name/..."
        aws "${aws_args[@]}" s3 sync "$src" "s3://$bucket/$prefix$name/"
    fi

    echo "Export complete"
}

# === LIST ARCHIVES ===

tsm_logs_list() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        # List all services with archives
        echo "Services with archives:"
        for dir in "$TSM_LOG_ARCHIVE_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            local count=$(find "$dir" -type f | wc -l | tr -d ' ')
            printf "  %-30s %s files\n" "$name" "$count"
        done
        return 0
    fi

    local archive_dir="$TSM_LOG_ARCHIVE_DIR/$target"

    if [[ ! -d "$archive_dir" ]]; then
        echo "No archives for: $target"
        return 0
    fi

    echo "Archives for $target:"
    ls -lh "$archive_dir" | tail -n +2
}

# === SUBCOMMAND ROUTER ===

# Extended logs command that handles subcommands
# Called from main tsm_logs when first arg is a subcommand
tsm_logs_subcommand() {
    local subcmd="$1"
    shift

    case "$subcmd" in
        rotate)   tsm_logs_rotate "$@" ;;
        archive)  tsm_logs_archive "$@" ;;
        clean)    tsm_logs_clean "$@" ;;
        export)   tsm_logs_export "$@" ;;
        list)     tsm_logs_list "$@" ;;
        *)        return 1 ;;  # Not a subcommand
    esac
}

# === EXPORTS ===

export TSM_LOG_ROTATION_SIZE_MB TSM_LOG_RETENTION_DAYS TSM_LOG_COMPRESS TSM_LOG_ARCHIVE_DIR
export -f tsm_logs_rotate tsm_logs_rotate_one tsm_logs_rotate_all
export -f tsm_logs_archive tsm_logs_archive_one
export -f tsm_logs_clean tsm_logs_clean_one
export -f tsm_logs_export
export -f tsm_logs_list
export -f tsm_logs_subcommand
export -f _tsm_file_size _tsm_should_rotate _tsm_archive_name _tsm_logs_export_s3
