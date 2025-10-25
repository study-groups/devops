#!/usr/bin/env bash
# generate_celp_codebook.sh - Generate CELP excitation codebook
#
# Uses tetra python environment to run the codebook generator

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source tetra
source ~/tetra/tetra.sh

# Activate tetra python environment
echo "Activating tetra python environment..."
tetra_python_activate

# Check for required packages
echo "Checking dependencies..."
python3 -c "import numpy, scipy" 2>/dev/null || {
    echo "Installing required packages (numpy, scipy)..."
    pip install numpy scipy
}

# Run codebook generator
echo ""
echo "Generating CELP excitation codebook..."
python3 "$SCRIPT_DIR/tools/generate_codebook.py" --output "$SCRIPT_DIR/src/excitation_codebook.h" "$@"

echo ""
echo "✓ Codebook generation complete!"
echo ""
echo "Next steps:"
echo "  1. Implement CELP synthesis mode in formant engine"
echo "  2. Add LPC filtering"
echo "  3. Test hybrid formant + CELP synthesis"
