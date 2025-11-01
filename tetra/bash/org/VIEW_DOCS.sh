#!/usr/bin/env bash
# View Org Module Documentation with tdocs
# Provides quick access to all org refactoring documentation

echo "========================================"
echo "  Org Module Documentation Viewer"
echo "========================================"
echo ""

# Check if running in tetra environment
if [[ -z "$TETRA_SRC" ]]; then
    echo "Loading tetra..."
    source ~/tetra/tetra.sh 2>&1 | grep -v "cannot set" | grep -v "no job control"
fi

# Load tdocs if not loaded
if ! command -v tdocs >/dev/null 2>&1; then
    echo "Loading tdocs..."
    tmod load tdocs 2>/dev/null
fi

# Check for arguments
if [[ $# -eq 0 ]]; then
    cat << 'EOF'
Available Documentation:

  1. REFACTORING_NOTES.md    - Technical details & architecture
  2. TAB_COMPLETION_GUIDE.md - User guide with examples
  3. INTEGRATION_SUMMARY.md  - Quick reference & status
  4. docs/README.md          - Documentation index

Usage:
  ./VIEW_DOCS.sh 1          # View refactoring notes
  ./VIEW_DOCS.sh 2          # View tab completion guide
  ./VIEW_DOCS.sh 3          # View integration summary
  ./VIEW_DOCS.sh 4          # View documentation index
  ./VIEW_DOCS.sh all        # List all org docs
  ./VIEW_DOCS.sh <file>     # View specific file

With tdoc commands:
  tdoc view bash/org/REFACTORING_NOTES.md
  tdoc view bash/org/TAB_COMPLETION_GUIDE.md
  tdoc list --module org

With less (no colors):
  less bash/org/TAB_COMPLETION_GUIDE.md

EOF
    exit 0
fi

# Handle input
case "$1" in
    1|refactor|REFACTORING*)
        file="bash/org/REFACTORING_NOTES.md"
        ;;
    2|guide|tab|TAB*)
        file="bash/org/TAB_COMPLETION_GUIDE.md"
        ;;
    3|summary|integration|INTEGRATION*)
        file="bash/org/INTEGRATION_SUMMARY.md"
        ;;
    4|index|readme|README*)
        file="bash/org/docs/README.md"
        ;;
    all|list)
        echo "Org Module Documentation Files:"
        echo ""
        tdoc list --module org 2>/dev/null || {
            echo "  bash/org/REFACTORING_NOTES.md"
            echo "  bash/org/TAB_COMPLETION_GUIDE.md"
            echo "  bash/org/INTEGRATION_SUMMARY.md"
            echo "  bash/org/docs/README.md"
        }
        exit 0
        ;;
    *)
        file="$1"
        if [[ ! -f "$file" ]]; then
            echo "Error: File not found: $file"
            exit 1
        fi
        ;;
esac

# View the file
if command -v tdoc >/dev/null 2>&1; then
    echo "Viewing with tdoc: $file"
    echo ""
    tdoc view "$file"
else
    echo "Viewing with less: $file"
    echo "(Install tdoc for better formatting)"
    echo ""
    less "$file"
fi
