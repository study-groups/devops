#!/usr/bin/env bash

# Chroma - Terminal Markdown Viewer
# Beautifully render markdown in your terminal with theme-aware colors
# Powered by TDS (Tetra Display System)

# Verify TDS is loaded (should be loaded by includes.sh)
if [[ "${TDS_LOADED}" != "true" ]]; then
    echo "Error: TDS not loaded. Chroma must be loaded via the module system:" >> "$debug_log"
    echo "  tmod load chroma" >> "$debug_log"
    echo "Or source the includes file:" >> "$debug_log"
    echo "  source \$TETRA_SRC/bash/chroma/includes.sh" >> "$debug_log"
    return 1
fi

# TDS_SRC should be set by TDS module, but ensure it's available
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"

# Load rule/hook system
if [[ -f "$TDS_SRC/renderers/markdown_rules.sh" ]]; then
    source "$TDS_SRC/renderers/markdown_rules.sh"
fi

# Chroma configuration (map to TDS config)
: "${CHROMA_PAGER:=less -R}"
export TDS_MARKDOWN_PAGER="$CHROMA_PAGER"

# Legacy chroma_render function - delegates to TDS
chroma_render() {
    tds_render_markdown "$@"
}

# Chroma command interface - delegates to TDS
chroma() {
    local debug_log="/tmp/chroma_debug.log"
    [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] chroma called with $# args: $*" >> "$debug_log"
    local file=""
    local use_pager=""  # Auto-detect: false for pipes, true for files
    local show_rules=false

    # Parse arguments
    [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] Starting argument parse loop" >> "$debug_log"
    while [[ $# -gt 0 ]]; do
        [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] Processing arg: $1" >> "$debug_log"
        case "$1" in
            --no-pager|-n)
                use_pager=false
                shift
                ;;
            --pager|-p)
                use_pager=true
                shift
                ;;
            --theme|-t)
                # Theme support - switch TDS theme
                if [[ -n "$2" ]]; then
                    tds_switch_theme "$2" 2>/dev/null || {
                        echo "Warning: Unknown theme '$2', using current theme" >> "$debug_log"
                    }
                fi
                shift 2
                ;;
            --width|-w)
                TDS_MARKDOWN_WIDTH="$2"
                shift 2
                ;;
            --preset)
                # Load rule preset
                if [[ -n "$2" ]]; then
                    chroma_load_preset "$2" 2>/dev/null || {
                        echo "Warning: Unknown preset '$2'" >> "$debug_log"
                    }
                fi
                shift 2
                ;;
            --rule)
                # Add single transformation rule
                if [[ -n "$2" ]]; then
                    chroma_register_rule "custom" "$2"
                fi
                shift 2
                ;;
            --list-rules)
                show_rules=true
                shift
                ;;
            --clear-rules)
                chroma_clear_rules
                echo "All rules and hooks cleared"
                return 0
                ;;
            --help|-h)
                cat <<EOF
Chroma - Terminal Markdown Viewer

Beautifully render markdown in your terminal with theme-aware colors.
Powered by TDS (Tetra Display System).

Usage: chroma [OPTIONS] [FILE|-]

Options:
  -p, --pager           Use pager for output (DEFAULT)
  -n, --no-pager        Disable pager (print to stdout)
  -w, --width N         Set line width (default: terminal width)
  -t, --theme NAME      Switch TDS theme (default, warm, cool, neutral, electric)
  --preset NAME         Load rule preset (markers, bookmarks, sections, all)
  --rule PATTERN        Add custom sed transformation rule
  --list-rules          Show active rules and hooks
  --clear-rules         Clear all rules and hooks
  -h, --help            Show this help

Arguments:
  FILE                  Markdown file to render
  -                     Read from stdin (also default when piped)

Environment:
  CHROMA_PAGER          Pager command (default: less -R)
  TDS_ACTIVE_THEME      Default theme to use

Examples:
  chroma README.md                          Render file in pager
  cat file.md | chroma                      Render piped markdown in pager
  tsm help start | chroma                   View TSM help beautifully
  chroma -n documentation.md                Print to stdout (no pager)
  chroma -w 100 -t warm file.md             Custom width and theme
  chroma --preset markers file.md           Highlight TODO/FIXME markers
  chroma --rule "s/API/🔌 API/g" README.md  Custom transformation
  echo "# Test" | chroma -n                 Print to stdout, no pager

Themes:
  default    - Balanced colors for general use
  warm       - Amber tones for org/planning content
  cool       - Blue tones for logs/analysis
  neutral    - Green tones for system content
  electric   - Purple tones for deploy/action content

Rule Presets:
  markers    - Highlight TODO, FIXME, NOTE, IMPORTANT markers
  bookmarks  - Add visual bookmarks to H1 headings
  sections   - Add section separators to headings
  all        - Load all presets

Integration:
  Chroma integrates with TSM help system:
    tsm help <topic> | chroma

  Use in scripts:
    source \$TETRA_SRC/bash/tds/tds.sh
    tds_markdown file.md

  Rule/Hook API:
    source \$TETRA_SRC/bash/tds/chroma.sh
    chroma_register_rule "my_rule" "s/foo/bar/g"
    chroma_register_hook "POST_HEADING" "my_transform_func"
    chroma_load_preset "markers"
EOF
                return 0
                ;;
            *)
                file="$1"
                shift
                ;;
        esac
    done

    # Show rules if requested
    if [[ "$show_rules" == true ]]; then
        chroma_list_rules
        return 0
    fi

    # Auto-detect pager mode if not explicitly set
    if [[ -z "$use_pager" ]]; then
        # Default to pager for all cases (piped input, files, etc.)
        # Use --no-pager/-n to disable
        use_pager=true
        [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] Auto-detected: use pager (default)" >> "$debug_log"
    fi

    [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] use_pager=$use_pager file='$file'" >> "$debug_log"
    [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] About to call tds_markdown" >> "$debug_log"

    # Delegate to TDS markdown renderer (handles stdin automatically)
    if [[ "$use_pager" == true ]]; then
        [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] Calling: tds_markdown --pager $file" >> "$debug_log"
        tds_markdown --pager "$file"
    else
        [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] Calling: tds_markdown $file" >> "$debug_log"
        tds_markdown "$file"
    fi
    local exit_code=$?
    [[ "${CHROMA_DEBUG:-0}" == "1" ]] && echo "[$(date +%T)] tds_markdown returned with code: $exit_code" >> "$debug_log"
    return $exit_code
}

# Export for use as command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    chroma "$@"
fi
