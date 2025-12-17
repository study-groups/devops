#!/usr/bin/env bash

# vox_includes.sh - VOX Module Bootstrap
#
# Sources all vox modules and sets up the environment.
# This is the main entry point for using the vox subsystem.
#
# Usage:
#   source $TETRA_SRC/bash/vox/vox_includes.sh
#   vox_help

#==============================================================================
# GUARD
#==============================================================================

[[ -n "$_VOX_LOADED" ]] && return 0
declare -g _VOX_LOADED=1

#==============================================================================
# PATH SETUP
#==============================================================================

: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:=$HOME/tetra}"

declare -g VOX_SRC="$TETRA_SRC/bash/vox"
declare -g VOX_DIR="$TETRA_DIR/vox"
declare -g CHROMA_SRC="$TETRA_SRC/bash/chroma"

# Ensure directories exist
mkdir -p "$VOX_DIR"/{db,cache,export}

#==============================================================================
# DEPENDENCY CHECK
#==============================================================================

_vox_check_deps() {
    local missing=()

    # Required: jq for JSON processing
    command -v jq &>/dev/null || missing+=("jq")

    # Optional but recommended
    local optional=()
    command -v espeak-ng &>/dev/null || command -v espeak &>/dev/null || optional+=("espeak-ng")
    command -v bat &>/dev/null || optional+=("bat")

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Error: Missing required dependencies: ${missing[*]}" >&2
        return 1
    fi

    if [[ ${#optional[@]} -gt 0 ]]; then
        echo "Warning: Missing optional dependencies: ${optional[*]}" >&2
        echo "  espeak-ng: Required for G2P (grapheme-to-phoneme) conversion" >&2
        echo "  bat: Enhanced syntax highlighting for code blocks" >&2
    fi

    return 0
}

#==============================================================================
# MODULE LOADING
#==============================================================================

_vox_source_module() {
    local module="$1"
    local path="$VOX_SRC/$module"

    if [[ -f "$path" ]]; then
        source "$path"
        return 0
    else
        echo "Warning: Module not found: $path" >&2
        return 1
    fi
}

_vox_load_modules() {
    local modules=(
        "vox_g2p.sh"
        "vox_annotate.sh"
        "vox_pipeline.sh"
        "vox_tui.sh"
    )

    local loaded=0
    local failed=0

    for module in "${modules[@]}"; do
        if _vox_source_module "$module"; then
            ((loaded++))
        else
            ((failed++))
        fi
    done

    # Also source chroma if available (for CST parsing)
    if [[ -f "$CHROMA_SRC/core/cst_render.sh" ]]; then
        source "$CHROMA_SRC/core/cst_render.sh"
    fi

    return 0
}

#==============================================================================
# VERSION & INFO
#==============================================================================

declare -g VOX_VERSION="1.0.0"

vox_version() {
    echo "VOX $VOX_VERSION"
    echo "Location: $VOX_SRC"
    echo "Data: $VOX_DIR"
}

vox_info() {
    echo "VOX - Voice Annotation & Synthesis System"
    echo ""
    vox_version
    echo ""
    echo "Modules:"
    printf "  %-20s %s\n" "vox_g2p" "$(declare -F vox_g2p &>/dev/null && echo '✓ loaded' || echo '✗ not loaded')"
    printf "  %-20s %s\n" "vox_annotate" "$(declare -F vox_annotate &>/dev/null && echo '✓ loaded' || echo '✗ not loaded')"
    printf "  %-20s %s\n" "vox_pipeline" "$(declare -F vox_pipeline &>/dev/null && echo '✓ loaded' || echo '✗ not loaded')"
    printf "  %-20s %s\n" "vox_tui" "$(declare -F vox_tui &>/dev/null && echo '✓ loaded' || echo '✗ not loaded')"
    echo ""
    echo "Dependencies:"
    printf "  %-20s %s\n" "jq" "$(command -v jq &>/dev/null && echo '✓ found' || echo '✗ missing (required)')"
    printf "  %-20s %s\n" "espeak-ng" "$(command -v espeak-ng &>/dev/null && echo '✓ found' || (command -v espeak &>/dev/null && echo '✓ espeak found' || echo '⚠ missing (for G2P)'))"
    printf "  %-20s %s\n" "bat" "$(command -v bat &>/dev/null && echo '✓ found' || echo '⚠ missing (optional)')"
}

#==============================================================================
# HELP
#==============================================================================

vox_help() {
    cat <<'EOF'
VOX - Voice Annotation & Synthesis System

COMMANDS:
  G2P:
    vox g2p <cmd>         Full g2p subcommand (word|json|text|formants|cst|langs)
    vox word <word>       Quick: word → IPA
    vox ipa <word>        Alias for word

  ANNOTATE:
    vox annotate <cmd>    Full annotate subcommand (create|read|update|delete|...)
    vox create            Quick: create annotation from stdin
    vox list              List all documents
    vox read <id> <kind>  Read annotation (source|cst|tokens|phonemes|prosody)

  PIPELINE:
    vox pipeline <cmd>    Full pipeline subcommand (process|render|synth|stats|...)
    vox process           Quick: full pipeline from stdin
    vox render <id>       Render document to terminal
    vox synth <id>        Generate audio
    vox stats <id>        Show phoneme statistics

  TUI:
    vox tui <id>          Interactive phoneme editor
    vox edit <id>         Alias for tui
    vox palette           Show color system

  INFO:
    vox version           Show version
    vox info              Show module status
    vox help              This help

QUICK START:
  echo "Hello, world!" | vox create     # Create annotation
  vox list                               # View documents
  vox render <doc_id>                    # Render to terminal
  vox synth <doc_id> en-us               # Generate audio
  vox tui <doc_id>                       # Edit interactively

SUBCOMMAND HELP:
  vox g2p help            G2P commands
  vox annotate help       Annotation CRUD
  vox pipeline help       Pipeline stages
  vox tui help            TUI controls

ENVIRONMENT:
  VOX_SRC         Source directory (default: $TETRA_SRC/bash/vox)
  VOX_DIR         Data directory (default: $TETRA_DIR/vox)
  VOX_G2P_LANG    Language for G2P (default: en-us)
EOF
}

#==============================================================================
# UNIFIED CLI
#==============================================================================

vox() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        #--------------------------------------------------------------
        # G2P Commands
        #--------------------------------------------------------------
        g2p)
            vox_g2p "$@"
            ;;
        word|ipa)
            vox_g2p word "$@"
            ;;

        #--------------------------------------------------------------
        # Annotation Commands
        #--------------------------------------------------------------
        annotate|ann)
            vox_annotate "$@"
            ;;
        create|c)
            vox_annotate create "$@"
            ;;
        list|ls)
            vox_annotate list "$@"
            ;;
        read|r)
            vox_annotate read "$@"
            ;;

        #--------------------------------------------------------------
        # Pipeline Commands
        #--------------------------------------------------------------
        pipeline|pipe)
            vox_pipeline "$@"
            ;;
        process)
            vox_pipeline process "$@"
            ;;
        render)
            vox_pipeline render "$@"
            ;;
        synth|audio)
            vox_pipeline synth "$@"
            ;;
        stats)
            vox_pipeline stats "$@"
            ;;

        #--------------------------------------------------------------
        # TUI Commands
        #--------------------------------------------------------------
        tui|edit|e)
            vox_tui "$@"
            ;;
        palette|colors)
            vox_tui palette
            ;;

        #--------------------------------------------------------------
        # Info Commands
        #--------------------------------------------------------------
        version|v)
            vox_version
            ;;
        info|i)
            vox_info
            ;;
        help|h|--help|-h)
            vox_help
            ;;

        *)
            echo "Unknown command: $cmd" >&2
            echo "Run 'vox help' for usage" >&2
            return 1
            ;;
    esac
}

#==============================================================================
# INITIALIZATION
#==============================================================================

# Check dependencies (warning only, don't fail)
_vox_check_deps 2>/dev/null || true

# Load all modules
_vox_load_modules

# Load tab completion
[[ -f "$VOX_SRC/index.sh" ]] && source "$VOX_SRC/index.sh"

#==============================================================================
# EXPORTS
#==============================================================================

export VOX_SRC VOX_DIR VOX_VERSION
export -f vox vox_help vox_info vox_version
export -f _vox_check_deps _vox_source_module _vox_load_modules
