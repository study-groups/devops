#!/usr/bin/env bash
# Shell check Compliance Report Generator
# Scans tetra bash scripts and generates compliance report
#
# Usage:
#   shellcheck_report.sh [directory] [--fix]
#   shellcheck_report.sh --module <module_name>
#   shellcheck_report.sh --critical-only

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_FILES=0
FILES_WITH_ISSUES=0
TOTAL_ERRORS=0
TOTAL_WARNINGS=0
TOTAL_INFO=0

# Severity levels to check (error, warning, info, style)
SEVERITY_LEVEL="warning"
CRITICAL_ONLY=false

# Report directory
REPORT_DIR="${TETRA_DIR:-$HOME/tetra}/reports"
mkdir -p "$REPORT_DIR"
REPORT_FILE="$REPORT_DIR/shellcheck_$(date +%Y%m%d_%H%M%S).txt"

# Run shellcheck on a file
check_file() {
    local file="$1"
    local output

    # Skip non-executable test/demo files that might have intentional issues
    if [[ "$file" =~ /(archive|\.tdoc|\.git)/ ]]; then
        return 0
    fi

    TOTAL_FILES=$((TOTAL_FILES + 1))

    # Run shellcheck
    if output=$(shellcheck -f gcc -S "$SEVERITY_LEVEL" "$file" 2>&1); then
        return 0
    else
        FILES_WITH_ISSUES=$((FILES_WITH_ISSUES + 1))

        # Count issues by severity
        local errors warnings infos
        errors=$(echo "$output" | grep -c "error:" || true)
        warnings=$(echo "$output" | grep -c "warning:" || true)
        infos=$(echo "$output" | grep -c "note:" || true)

        TOTAL_ERRORS=$((TOTAL_ERRORS + errors))
        TOTAL_WARNINGS=$((TOTAL_WARNINGS + warnings))
        TOTAL_INFO=$((TOTAL_INFO + infos))

        # Print to console
        echo -e "${RED}✗ $file${NC}"
        echo "$output" | head -20
        if [[ $(echo "$output" | wc -l) -gt 20 ]]; then
            echo "  ... ($(echo "$output" | wc -l) total issues, showing first 20)"
        fi
        echo ""

        # Write to report file
        {
            echo "========================================="
            echo "FILE: $file"
            echo "========================================="
            echo "$output"
            echo ""
        } >> "$REPORT_FILE"

        return 1
    fi
}

# Scan directory
scan_directory() {
    local dir="${1:-.}"

    echo "Scanning for shellcheck issues in: $dir"
    echo "Severity level: $SEVERITY_LEVEL"
    echo "Report file: $REPORT_FILE"
    echo "================================================"
    echo ""

    while IFS= read -r -d '' file; do
        check_file "$file"
    done < <(find "$dir" -type f -name "*.sh" -print0)

    # Print summary
    echo ""
    echo "================================================"
    echo "SHELLCHECK COMPLIANCE REPORT"
    echo "================================================"
    echo "Total files scanned: $TOTAL_FILES"
    echo "Files with issues: $FILES_WITH_ISSUES"
    echo ""
    echo -e "${RED}Errors: $TOTAL_ERRORS${NC}"
    echo -e "${YELLOW}Warnings: $TOTAL_WARNINGS${NC}"
    echo -e "${BLUE}Info: $TOTAL_INFO${NC}"
    echo ""

    if [[ $FILES_WITH_ISSUES -eq 0 ]]; then
        echo -e "${GREEN}✓ All files pass shellcheck!${NC}"
    else
        echo -e "${YELLOW}Full report saved to: $REPORT_FILE${NC}"
        echo ""
        echo "Common issues to fix:"
        echo "  - SC2086: Quote variables to prevent word splitting"
        echo "  - SC2155: Declare and assign separately to avoid masking return values"
        echo "  - SC2164: Use 'cd ... || exit' for better error handling"
        echo "  - SC2034: Unused variables"
        echo "  - SC1090: Can't follow non-constant source"
    fi

    # Return non-zero if issues found
    [[ $FILES_WITH_ISSUES -eq 0 ]]
}

# Scan specific module
scan_module() {
    local module_name="$1"
    local module_dir="${TETRA_SRC:-$PWD}/bash/$module_name"

    if [[ ! -d "$module_dir" ]]; then
        echo "ERROR: Module directory not found: $module_dir" >&2
        return 1
    fi

    scan_directory "$module_dir"
}

# Show top issues
show_top_issues() {
    if [[ ! -f "$REPORT_FILE" ]]; then
        echo "No report file found. Run a scan first." >&2
        return 1
    fi

    echo "Top 10 Most Common Issues:"
    echo "================================================"
    grep -oP 'SC\d+' "$REPORT_FILE" | sort | uniq -c | sort -rn | head -10
}

# Main
main() {
    case "${1:-scan}" in
        --module)
            scan_module "${2:?Missing module name}"
            ;;
        --critical-only)
            SEVERITY_LEVEL="error"
            CRITICAL_ONLY=true
            scan_directory "${2:-.}"
            ;;
        --top-issues)
            show_top_issues
            ;;
        --help|-h)
            cat <<EOF
Shellcheck Compliance Report Generator

Usage:
  shellcheck_report.sh [directory]              Scan directory (default: current)
  shellcheck_report.sh --module <name>          Scan specific module
  shellcheck_report.sh --critical-only [dir]    Only show errors, not warnings
  shellcheck_report.sh --top-issues             Show most common issues from last scan
  shellcheck_report.sh --help                   Show this help

Examples:
  shellcheck_report.sh                           # Scan current directory
  shellcheck_report.sh bash/boot                 # Scan boot module
  shellcheck_report.sh --module tdocs            # Scan tdocs module
  shellcheck_report.sh --critical-only bash/     # Only errors

Report files are saved to: \$TETRA_DIR/reports/
EOF
            ;;
        *)
            scan_directory "${1:-.}"
            ;;
    esac
}

main "$@"
