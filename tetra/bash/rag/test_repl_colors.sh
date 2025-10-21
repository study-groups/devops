#!/usr/bin/env bash
# Test script for RAG REPL colors

# Set up paths
export TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RAG_SRC="$TETRA_SRC/bash/rag"
export RAG_DIR="${RAG_DIR:-$HOME/.tetra/rag}"

echo "TETRA_SRC: $TETRA_SRC"
echo "RAG_SRC: $RAG_SRC"
echo ""

# Source color system
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh"
    source "$TETRA_SRC/bash/color/color_elements.sh"
    COLOR_ENABLED=1
    echo "✓ Color system loaded"
else
    COLOR_ENABLED=0
    echo "✗ Color system not found"
    exit 1
fi

echo ""
echo "Testing color functions:"
echo "========================"
echo ""

# Test basic colors
echo "$(text_color "00D4AA")Cyan/Teal text$(reset_color)"
echo "$(text_color "7AA2F7")Blue text$(reset_color)"
echo "$(text_color "BB9AF7")Purple text$(reset_color)"
echo "$(text_color "9ECE6A")Green text$(reset_color)"
echo "$(text_color "E0AF68")Orange text$(reset_color)"
echo "$(text_color "F7768E")Red text$(reset_color)"
echo "$(text_color "565F89")Gray text$(reset_color)"

echo ""
echo "Testing prompt simulation:"
echo "=========================="
echo ""

# Simulate different flow stages
for stage in NEW SELECT ASSEMBLE SUBMIT APPLY VALIDATE DONE FAIL; do
    case "$stage" in
        NEW) stage_color="7AA2F7" ;;
        SELECT) stage_color="BB9AF7" ;;
        ASSEMBLE) stage_color="9D7CD8" ;;
        SUBMIT) stage_color="E0AF68" ;;
        APPLY) stage_color="FF9E64" ;;
        VALIDATE) stage_color="F7768E" ;;
        DONE) stage_color="9ECE6A" ;;
        FAIL) stage_color="F7768E" ;;
        *) stage_color="565F89" ;;
    esac

    short_flow="test-flow"
    prompt="$(text_color "565F89")[$(text_color "00D4AA")$short_flow$(text_color "565F89"):$(text_color "$stage_color")$stage$(text_color "565F89")]$(reset_color) $(text_color "7AA2F7")rag>$(reset_color) "
    echo -n "$prompt"
    echo "echo 'hello'"
done

echo ""
echo "Color test complete!"
