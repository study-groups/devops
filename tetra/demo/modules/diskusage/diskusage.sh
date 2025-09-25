#!/usr/bin/env bash

# Diskusage Module - Core Functionality
# Simple disk usage analysis and management

# Get disk usage for a directory
get_disk_usage() {
    local target_path="${1:-.}"
    local format="${2:-human}"

    if [[ ! -d "$target_path" ]]; then
        echo "Error: Directory '$target_path' does not exist"
        return 1
    fi

    case "$format" in
        "human"|"h")
            du -sh "$target_path" 2>/dev/null
            ;;
        "bytes"|"b")
            du -sb "$target_path" 2>/dev/null
            ;;
        "kb"|"k")
            du -sk "$target_path" 2>/dev/null
            ;;
        *)
            du -sh "$target_path" 2>/dev/null
            ;;
    esac
}

# Get top directories by size
get_top_directories() {
    local target_path="${1:-.}"
    local count="${2:-10}"

    if [[ ! -d "$target_path" ]]; then
        echo "Error: Directory '$target_path' does not exist"
        return 1
    fi

    # Use depth limit to avoid long scans
    du -sh "$target_path"/* 2>/dev/null | sort -hr | head -n "$count"
}

# Clean up common temp/cache directories
cleanup_temp_files() {
    local target_path="${1:-.}"
    local dry_run="${2:-true}"

    if [[ ! -d "$target_path" ]]; then
        echo "Error: Directory '$target_path' does not exist"
        return 1
    fi

    local temp_patterns=(
        "*.tmp"
        "*.temp"
        "*~"
        ".DS_Store"
        "Thumbs.db"
        "*.log.*"
        "core.*"
    )

    local files_found=()
    local total_size=0

    # Find files matching temp patterns
    for pattern in "${temp_patterns[@]}"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                files_found+=("$file")
                local size=$(stat -f%z "$file" 2>/dev/null || echo "0")
                total_size=$((total_size + size))
            fi
        done < <(find "$target_path" -name "$pattern" -type f -print0 2>/dev/null)
    done

    if [[ ${#files_found[@]} -eq 0 ]]; then
        echo "No temporary files found matching patterns"
        return 0
    fi

    echo "Found ${#files_found[@]} temporary files ($(numfmt --to=iec "$total_size" 2>/dev/null || echo "${total_size} bytes"))"

    if [[ "$dry_run" == "true" ]]; then
        echo "DRY RUN - Files that would be removed:"
        for file in "${files_found[@]}"; do
            echo "  $file"
        done
        echo "Run with dry_run=false to actually remove files"
    else
        local removed=0
        for file in "${files_found[@]}"; do
            if rm -f "$file" 2>/dev/null; then
                ((removed++))
                echo "Removed: $file"
            else
                echo "Failed to remove: $file"
            fi
        done
        echo "Successfully removed $removed/${#files_found[@]} files"
    fi
}

# Generate disk usage report
generate_disk_report() {
    local target_path="${1:-.}"
    local output_format="${2:-text}"

    if [[ ! -d "$target_path" ]]; then
        echo "Error: Directory '$target_path' does not exist"
        return 1
    fi

    local report_date=$(date '+%Y-%m-%d %H:%M:%S')
    local total_usage=$(get_disk_usage "$target_path" "human")

    case "$output_format" in
        "json")
            cat << EOF
{
    "timestamp": "$report_date",
    "path": "$target_path",
    "total_usage": "$total_usage",
    "top_directories": [
$(get_top_directories "$target_path" 5 | sed 's/^/        /' | sed 's/$/,/' | sed '$s/,$//')
    ]
}
EOF
            ;;
        *)
            cat << EOF
📊 Disk Usage Report
==================
Date: $report_date
Path: $target_path
Total: $total_usage

🔝 Top Directories:
$(get_top_directories "$target_path" 10)

💡 Cleanup suggestions:
- Run cleanup action to remove temporary files
- Check for old log files and archives
- Review large directories for unused files
EOF
            ;;
    esac
}

# Check disk space availability
check_disk_space() {
    local target_path="${1:-.}"

    if [[ ! -d "$target_path" ]]; then
        echo "Error: Directory '$target_path' does not exist"
        return 1
    fi

    df -h "$target_path" 2>/dev/null
}