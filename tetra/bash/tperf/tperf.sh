#!/usr/bin/env bash
# tperf.sh - Tetra Performance Profiling Utilities
# Provides performance analysis tools for Tetra bootloader and modules

# Module initialization
TPERF_DIR="${TETRA_DIR:-$HOME/tetra}/tperf"
TPERF_SRC="${TETRA_SRC:-}/bash/tperf"

# Create data directory (only if TETRA_DIR is set)
[[ -n "${TETRA_DIR}" && ! -d "$TPERF_DIR" ]] && mkdir -p "$TPERF_DIR"

# Default trace log location
TPERF_TRACE_LOG="${TPERF_DIR}/boot_trace.log"

#----------------------------------------------------------
# Boot Profiling Functions
#----------------------------------------------------------

# Profile a fresh boot with set -x tracing
tperf::trace_boot() {
    local output_file="${1:-$TPERF_TRACE_LOG}"

    echo "Tracing Tetra boot sequence..."
    echo "Output: $output_file"

    # Write trace script to temp file to avoid BASH_SOURCE pollution
    local trace_script="/tmp/tperf_trace_$$.sh"
    cat > "$trace_script" <<'TRACE_SCRIPT'
#!/usr/bin/env bash
export PS4='+(${BASH_SOURCE}:${LINENO}): '
set -x
source ~/tetra/tetra.sh
TRACE_SCRIPT

    # Run trace script in fresh bash
    bash --norc --noprofile "$trace_script" 2>"$output_file" >/dev/null
    rm -f "$trace_script"

    local line_count=$(wc -l < "$output_file" | tr -d ' ')
    echo "Trace complete: $line_count lines executed"
    echo ""
}

# Analyze boot trace log
tperf::analyze_boot() {
    local trace_file="${1:-$TPERF_TRACE_LOG}"

    if [[ ! -f "$trace_file" ]]; then
        echo "Error: Trace file not found: $trace_file" >&2
        echo "Run: tperf trace-boot" >&2
        return 1
    fi

    echo "=== Tetra Boot Performance Analysis ==="
    echo ""

    local total_lines=$(wc -l < "$trace_file" | tr -d ' ')
    echo "Total lines executed: $total_lines"
    echo ""

    # Count by file
    echo "Top 20 files by execution count:"
    grep -o '+([^:]*' "$trace_file" | \
        sed 's/+(//' | \
        sed 's/\\//g' | \
        sort | uniq -c | \
        sort -rn | \
        head -20 | \
        awk '{printf "  %6d  %s\n", $1, $2}'

    echo ""

    # Boot stage breakdown (escape backslashes in grep patterns)
    local bootloader_lines=$(grep -c 'bootloader\.sh:' "$trace_file")
    local boot_core_lines=$(grep -c 'boot_core\.sh:' "$trace_file")
    local boot_modules_lines=$(grep -c 'boot_modules\.sh:' "$trace_file")
    local utils_lines=$(grep -c '/utils/' "$trace_file")
    local prompt_lines=$(grep -c '/prompt/' "$trace_file")
    local tmod_lines=$(grep -c '/tmod/' "$trace_file")
    local qa_lines=$(grep -c '/qa/' "$trace_file")
    local unified_log_lines=$(grep -c 'unified_log\.sh:' "$trace_file")

    echo "Boot stage breakdown:"
    printf "  %-30s %6d lines (%3d%%)\n" "bootloader.sh" "$bootloader_lines" "$((bootloader_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "boot_core.sh" "$boot_core_lines" "$((boot_core_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "boot_modules.sh" "$boot_modules_lines" "$((boot_modules_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "unified_log.sh" "$unified_log_lines" "$((unified_log_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "utils module" "$utils_lines" "$((utils_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "prompt module" "$prompt_lines" "$((prompt_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "tmod module" "$tmod_lines" "$((tmod_lines * 100 / total_lines))"
    printf "  %-30s %6d lines (%3d%%)\n" "qa module" "$qa_lines" "$((qa_lines * 100 / total_lines))"

    echo ""

    # Check for metadata initialization
    local metadata_init=$(grep -c "tetra_init_module_metadata" "$trace_file" 2>/dev/null || echo "0")
    local metadata_calls=$(grep -c "tetra_add_module_metadata" "$trace_file" 2>/dev/null || echo "0")

    echo "Module metadata analysis:"
    printf "  %-30s %6d calls\n" "tetra_init_module_metadata" "$metadata_init"
    printf "  %-30s %6d calls\n" "tetra_add_module_metadata" "$metadata_calls"

    if [[ $metadata_init -eq 0 ]]; then
        echo "  ✓ Module metadata is lazy-loaded (optimized)"
    else
        echo "  ⚠ Module metadata initialized at boot (not optimized)"
    fi
}

# Count lines of code executed in a specific file
tperf::count_lines_in_file() {
    local trace_file="${1:-$TPERF_TRACE_LOG}"
    local file_pattern="$2"

    if [[ -z "$file_pattern" ]]; then
        echo "Usage: tperf count-lines <trace_file> <file_pattern>" >&2
        return 1
    fi

    local count=$(grep -c "$file_pattern" "$trace_file" 2>/dev/null || echo "0")
    echo "$count lines executed in files matching: $file_pattern"
}

# Compare two boot traces
tperf::compare_boot() {
    local trace1="$1"
    local trace2="$2"

    if [[ ! -f "$trace1" ]] || [[ ! -f "$trace2" ]]; then
        echo "Usage: tperf compare-boot <trace1> <trace2>" >&2
        return 1
    fi

    local lines1=$(wc -l < "$trace1" | tr -d ' ')
    local lines2=$(wc -l < "$trace2" | tr -d ' ')
    local diff=$((lines2 - lines1))
    local pct_change=$((diff * 100 / lines1))

    echo "=== Boot Trace Comparison ==="
    echo ""
    echo "Before: $lines1 lines ($trace1)"
    echo "After:  $lines2 lines ($trace2)"
    echo ""

    if [[ $diff -lt 0 ]]; then
        echo "Improvement: ${diff#-} fewer lines ($pct_change% faster)"
    elif [[ $diff -gt 0 ]]; then
        echo "Regression: $diff more lines ($pct_change% slower)"
    else
        echo "No change"
    fi
}

#----------------------------------------------------------
# Main tperf command
#----------------------------------------------------------

tperf() {
    local cmd="${1:-help}"
    shift

    # Validate TETRA_SRC for commands that need it
    if [[ "$cmd" != "help" && -z "${TETRA_SRC}" ]]; then
        echo "Error: TETRA_SRC must be set to use tperf" >&2
        return 1
    fi

    case "$cmd" in
        trace-boot|trace)
            tperf::trace_boot "$@"
            ;;
        analyze|analyze-boot)
            tperf::analyze_boot "$@"
            ;;
        count-lines|count)
            tperf::count_lines_in_file "$TPERF_TRACE_LOG" "$@"
            ;;
        compare|compare-boot)
            tperf::compare_boot "$@"
            ;;
        profile|full)
            echo "Running full boot profile..."
            echo ""
            tperf::trace_boot "$@"
            echo ""
            tperf::analyze_boot "$@"
            ;;
        help|--help|-h)
            cat <<'EOF'
tperf - Tetra Performance Profiling

USAGE:
  tperf <command> [args]

COMMANDS:
  trace-boot [file]       Profile a fresh boot with tracing
  analyze [file]          Analyze a boot trace log
  count <pattern>         Count lines for a specific file pattern
  compare <file1> <file2> Compare two boot traces
  profile                 Run full profile (trace + analyze)
  help                    Show this help

EXAMPLES:
  tperf profile                      # Full boot analysis
  tperf trace-boot /tmp/boot.log     # Trace to custom file
  tperf analyze                      # Analyze default trace
  tperf count "module_metadata.sh"   # Count metadata operations
  tperf compare before.log after.log # Compare optimizations

FILES:
  Default trace: $TPERF_DIR/boot_trace.log

EOF
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Run 'tperf help' for usage" >&2
            return 1
            ;;
    esac
}

# Export main function
export -f tperf
