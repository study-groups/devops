#!/usr/bin/env bash
# Chroma Plugin: Bat Syntax Highlighting
# Uses bat for syntax highlighting in code blocks

# Plugin state
declare -g _CHROMA_BAT_AVAILABLE=0

# Initialize plugin
_chroma_bat_init() {
    # Check if bat is available
    if command -v bat &>/dev/null; then
        _CHROMA_BAT_AVAILABLE=1
    fi

    # Declare configuration options
    chroma_config_declare "bat-syntax" "enabled" "true" "Enable bat syntax highlighting"
    chroma_config_declare "bat-syntax" "theme" "" "Bat theme (empty = default)"
    chroma_config_declare "bat-syntax" "style" "plain" "Bat style (plain, numbers, grid, etc)"
    chroma_config_declare "bat-syntax" "fallback_color" "179" "ANSI color when bat unavailable"

    # Register hook if bat is available
    if (( _CHROMA_BAT_AVAILABLE )); then
        chroma_hook render_code _chroma_bat_render_code
    fi
}

# Render code line using bat
# Args: lang, content, pad
_chroma_bat_render_code() {
    local lang="$1"
    local content="$2"
    local pad="$3"

    # Check if enabled
    local enabled=$(chroma_config_get "bat-syntax" "enabled")
    [[ "$enabled" != "true" ]] && return 1

    # If no language specified or bat not available, fall back
    [[ -z "$lang" ]] && return 1
    (( ! _CHROMA_BAT_AVAILABLE )) && return 1

    # Build bat command with config
    local style=$(chroma_config_get "bat-syntax" "style")
    local theme=$(chroma_config_get "bat-syntax" "theme")

    local bat_opts=(--style="$style" --color=always --language="$lang")
    [[ -n "$theme" ]] && bat_opts+=(--theme="$theme")

    # Use bat for syntax highlighting
    local highlighted
    highlighted=$(echo "$content" | bat "${bat_opts[@]}" 2>/dev/null)

    if [[ $? -eq 0 && -n "$highlighted" ]]; then
        printf '%s  %s\n' "$pad" "$highlighted"
        return 0  # Handled
    fi

    return 1  # Fall back to default
}

# Register the plugin
chroma_register_plugin "bat-syntax" "_chroma_bat_init"
