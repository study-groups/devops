#!/usr/bin/env bash
# Path Validation Utility
# Detects hardcoded paths that violate TETRA_SRC/TETRA_DIR conventions
#
# Usage:
#   validate_paths.sh [directory]
#   validate_paths.sh --check-file <file>
#   validate_paths.sh --fix-file <file>

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Validation patterns
declare -a HARDCODED_PATTERNS=(
    '/Users/[^/]+/src/devops/tetra'
    '/home/[^/]+/tetra'
    '/home/[^/]+/src/devops/tetra'
)

# Validate a single file
validate_file() {
    local file="$1"
    local violations=0

    # Skip binary files, .git, and documentation
    [[ "$file" =~ \.(md|json|png|jpg|gif)$ ]] && return 0
    [[ "$file" =~ /\.git/ ]] && return 0
    [[ "$file" =~ /\.tdoc/ ]] && return 0

    # Check for hardcoded patterns
    for pattern in "${HARDCODED_PATTERNS[@]}"; do
        if grep -nE "$pattern" "$file" 2>/dev/null | grep -v '^#' | grep -q .; then
            if [[ $violations -eq 0 ]]; then
                echo -e "${RED}✗ $file${NC}"
            fi
            violations=$((violations + 1))
            grep -nE "$pattern" "$file" | grep -v '^#' | while IFS=: read -r line_num line_content; do
                echo -e "  ${YELLOW}Line $line_num:${NC} $line_content"
            done
        fi
    done

    return $violations
}

# Scan directory for violations
scan_directory() {
    local dir="${1:-.}"
    local total_files=0
    local total_violations=0

    echo "Scanning for hardcoded paths in: $dir"
    echo "================================================"
    echo ""

    while IFS= read -r -d '' file; do
        total_files=$((total_files + 1))
        if ! validate_file "$file"; then
            total_violations=$((total_violations + 1))
        fi
    done < <(find "$dir" -type f -name "*.sh" -print0)

    echo ""
    echo "================================================"
    echo "Scanned $total_files files"
    if [[ $total_violations -gt 0 ]]; then
        echo -e "${RED}Found violations in $total_violations files${NC}"
        return 1
    else
        echo -e "${GREEN}No hardcoded path violations found!${NC}"
        return 0
    fi
}

# Fix hardcoded paths in a file
fix_file() {
    local file="$1"
    local backup="${file}.bak"

    # Create backup
    cp "$file" "$backup"

    # Apply fixes
    sed -i.tmp \
        -e 's|export TETRA_SRC=/Users/[^/]*/src/devops/tetra|: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." \&\& pwd)}"|g' \
        -e 's|export TETRA_DIR=/Users/[^/]*/tetra|: "${TETRA_DIR:=$HOME/tetra}"|g' \
        -e 's|TETRA_SRC=/Users/[^/]*/src/devops/tetra|TETRA_SRC="${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." \&\& pwd)}"|g' \
        -e 's|TETRA_DIR=/Users/[^/]*/tetra|TETRA_DIR="${TETRA_DIR:=$HOME/tetra}"|g' \
        "$file"

    rm -f "${file}.tmp"

    echo -e "${GREEN}✓ Fixed: $file${NC}"
    echo "  Backup saved to: $backup"
}

# Main script logic
main() {
    case "${1:-scan}" in
        --check-file)
            validate_file "${2:?Missing file argument}"
            ;;
        --fix-file)
            fix_file "${2:?Missing file argument}"
            ;;
        --help|-h)
            cat <<EOF
Path Validation Utility

Usage:
  validate_paths.sh [directory]           Scan directory for violations
  validate_paths.sh --check-file <file>   Check a single file
  validate_paths.sh --fix-file <file>     Fix a single file (creates backup)
  validate_paths.sh --help                Show this help

Detects hardcoded paths that should use TETRA_SRC or TETRA_DIR variables.

Examples:
  validate_paths.sh                       # Scan current directory
  validate_paths.sh /path/to/tetra/bash   # Scan specific directory
  validate_paths.sh --fix-file boot/boot_debug.sh
EOF
            ;;
        *)
            scan_directory "${1:-.}"
            ;;
    esac
}

main "$@"
