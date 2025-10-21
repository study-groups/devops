#!/usr/bin/env bash
# Force reload TDS and org modules

echo "Unloading old TDS functions..."
unset -f tds_resolve_color tds_text_color tds_bg_color tds_color_swatch
unset -f tds_repl_build_prompt tds_repl_render_env tds_repl_render_mode
unset -f tds_repl_render_action tds_repl_render_org
unset -f tds_repl_feedback_env tds_repl_feedback_mode tds_repl_feedback_action
unset -f org_repl _org_build_prompt _org_cycle_env _org_cycle_mode _org_cycle_action

echo "Reloading TDS..."
source "$TETRA_SRC/bash/tds/tds.sh"

echo "Reloading org module..."
source "$TETRA_SRC/bash/org/includes.sh"

echo "✓ Reload complete"
echo ""
echo "Testing token resolution:"
result=$(tds_resolve_color "repl.prompt.bracket")
echo "  repl.prompt.bracket → $result"

if [[ "$result" =~ ^[0-9A-F]+$ ]]; then
    echo "✓ Token resolution working!"
else
    echo "✗ Token resolution failed"
fi
