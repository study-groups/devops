#!/usr/bin/env bash
# Chroma Plugin: Bat Syntax Highlighting
# Uses bat for syntax highlighting in code blocks

# Plugin state
declare -g _CHROMA_BAT_AVAILABLE=0
declare -ga _CHROMA_CODE_BUFFER=()
declare -g _CHROMA_COLLECTING_CODE=0

# Initialize plugin
_chroma_bat_init() {
    # Check if bat is available
    if command -v bat &>/dev/null; then
        _CHROMA_BAT_AVAILABLE=1
        chroma_hook render_code _chroma_bat_render_code
    fi
}

# Render code line using bat
# Args: lang, content, pad
_chroma_bat_render_code() {
    local lang="$1"
    local content="$2"
    local pad="$3"

    # If no language specified, fall back to default
    [[ -z "$lang" ]] && return 1

    # Use bat for syntax highlighting
    # --style=plain removes line numbers and borders
    # --color=always forces color output
    local highlighted
    highlighted=$(echo "$content" | bat --style=plain --color=always --language="$lang" 2>/dev/null)

    if [[ $? -eq 0 && -n "$highlighted" ]]; then
        printf '%s  %s\n' "$pad" "$highlighted"
        return 0  # Handled
    fi

    return 1  # Fall back to default
}

# Register the plugin
chroma_register_plugin "bat-syntax" "_chroma_bat_init"
