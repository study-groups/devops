#!/usr/bin/env bash
# extra.sh - Build extras/plugins operations
# Usage: tut extra <verb> [args]

_tut_extra() {
    local verb="${1:-help}"
    shift || true

    case "$verb" in
        list|ls)     _tut_extra_list "$@" ;;
        show|s)      _tut_extra_show "$@" ;;
        help|"")     _tut_extra_help ;;
        *)
            _tut_error "Unknown: extra $verb"
            _tut_extra_help
            return 1
            ;;
    esac
}

_tut_extra_help() {
    _tut_heading 2 "tut extra"
    echo
    echo "  Manage build extras and plugins"
    echo
    _tut_section "COMMANDS"
    echo "  list, ls      List available extras"
    echo "  show, s       Show extra details"
    echo
    _tut_section "EXAMPLES"
    echo "  tut extra list"
    echo "  tut extra show design-tokens"
}

# =============================================================================
# LIST
# =============================================================================

_tut_extra_list() {
    _tut_heading 2 "Build Extras"
    echo
    echo "  Extras are optional features automatically included in built documents."
    echo "  Some are always-on, others are URL-activated or JSON-configured."
    echo

    _tut_section "ALWAYS INCLUDED"
    _tut_extra_row "design-tokens" "?design=true" "Live theme editor FAB"
    _tut_extra_row "mindmap"       "content block" "Visual concept maps"

    _tut_section "JSON-CONFIGURED"
    _tut_extra_row "tds"           "metadata.theme.tds" "Tetra Design System theme"

    _tut_section "FILES"
    echo "  Location: \$TUT_SRC/templates/"
    echo
    _tut_path "base-styles.css" "$TUT_SRC/templates/base-styles.css"
    _tut_path "base-script.js" "$TUT_SRC/templates/base-script.js"
    _tut_path "design-tokens.*" "$TUT_SRC/templates/design-tokens.css"
    _tut_path "mindmap/*" "$TUT_SRC/templates/mindmap/"

    echo
    _tut_info "Use: tut extra show <name> for details"
}

_tut_extra_row() {
    local name="$1"
    local activation="$2"
    local desc="$3"
    printf "  %-16s %-20s %s\n" "$name" "$activation" "$desc"
}

# =============================================================================
# SHOW
# =============================================================================

_tut_extra_show() {
    local extra="$1"

    case "$extra" in
        "")
            _tut_extra_list
            ;;
        design-tokens)
            _tut_extra_show_design_tokens
            ;;
        mindmap)
            _tut_extra_show_mindmap
            ;;
        tds)
            _tut_extra_show_tds
            ;;
        *)
            _tut_error "Unknown extra: $extra"
            _tut_info "Available: design-tokens, mindmap, tds"
            return 1
            ;;
    esac
}

_tut_extra_show_design_tokens() {
    _tut_heading 2 "Design Tokens Extra"
    echo
    _tut_section "OVERVIEW"
    echo "  Live theme editor for customizing document appearance."
    echo "  Provides window.TUT namespace for theme management."
    echo

    _tut_section "ACTIVATION"
    echo "  URL parameter:    ?design=true"
    echo "  Always bundled:   Yes (hidden by default)"
    echo

    _tut_section "FEATURES"
    echo "  - Floating Action Button (FAB) in bottom-right"
    echo "  - Color token editor with live preview"
    echo "  - Layout settings (border style, radius, sidebar)"
    echo "  - Typography (heading, body, code fonts)"
    echo "  - Google Fonts integration"
    echo "  - Theme save/load/export (JSON, CSS, JS)"
    echo "  - Element Inspector (Shift+hold on any element)"
    echo

    _tut_section "JAVASCRIPT API"
    echo "  TUT.Tokens.get('--bg-primary')      Get token value"
    echo "  TUT.Tokens.set('--bg-primary', x)   Set token value"
    echo "  TUT.Theme.build()                   Export current theme"
    echo "  TUT.Theme.apply(theme)              Apply theme object"
    echo "  TUT.Theme.save('name')              Save to localStorage"
    echo

    _tut_section "FILES"
    _tut_path "CSS" "$TUT_SRC/templates/design-tokens.css"
    _tut_path "HTML" "$TUT_SRC/templates/design-tokens.html"
    _tut_path "JS" "$TUT_SRC/templates/design-tokens.js"

    _tut_section "USAGE"
    echo "  # View any tut doc in design mode:"
    echo "  open \"\$TUT_DIR/generated/my-guide.html?design=true\""
}

_tut_extra_show_mindmap() {
    _tut_heading 2 "Mindmap Extra"
    echo
    _tut_section "OVERVIEW"
    echo "  Visual radial diagrams for concept relationships."
    echo "  Auto-included when content contains mindmap blocks."
    echo

    _tut_section "ACTIVATION"
    echo "  Content block:    { \"type\": \"mindmap\", ... }"
    echo "  Always bundled:   Yes (CSS/JS included if block present)"
    echo

    _tut_section "JSON STRUCTURE"
    cat << 'JSON'
  {
    "type": "mindmap",
    "title": "Optional caption",
    "center": { "label": "Core", "sub": "subtitle" },
    "spokes": [
      { "label": "Node 1", "sub": "detail", "path": "/path", "description": "..." },
      { "label": "Node 2", "sub": "detail" }
    ]
  }
JSON
    echo

    _tut_section "FILES"
    _tut_path "CSS" "$TUT_SRC/templates/mindmap/mindmap.css"
    _tut_path "JS" "$TUT_SRC/templates/mindmap/mindmap.js"
}

_tut_extra_show_tds() {
    _tut_heading 2 "TDS Theme Extra"
    echo
    _tut_section "OVERVIEW"
    echo "  Apply Tetra Design System themes to documents."
    echo "  Themes are defined in \$TETRA_SRC/bash/tds/."
    echo

    _tut_section "ACTIVATION"
    echo "  JSON metadata:    \"theme\": { \"tds\": \"theme-name\" }"
    echo "  Requires:         TDS module loaded"
    echo

    _tut_section "EXAMPLE"
    cat << 'JSON'
  {
    "metadata": {
      "title": "My Guide",
      "theme": {
        "tds": "dracula"
      }
    },
    ...
  }
JSON
    echo

    _tut_section "AVAILABLE THEMES"
    if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
        source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null
        if declare -f tds_list_themes &>/dev/null; then
            tds_list_themes 2>/dev/null | head -10
        else
            echo "  (TDS loaded but tds_list_themes not available)"
        fi
    else
        echo "  (TDS module not found)"
    fi
}
