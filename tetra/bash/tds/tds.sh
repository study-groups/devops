#!/usr/bin/env bash

# TDS - Tetra Display System
# A layered display framework for terminal UIs with semantic color tokens

# Determine TDS directory
TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export TDS_SRC

# Layer 0: ANSI utilities (width calculation, alignment)
source "$TDS_SRC/core/ansi.sh"

# Layer 1: Color foundation (from tetra/bash/color)
COLOR_SRC="${COLOR_SRC:-$(dirname "$TDS_SRC")/color}"
if [[ -f "$COLOR_SRC/color_core.sh" ]]; then
    source "$COLOR_SRC/color_core.sh"
else
    echo "Error: Color system not found at $COLOR_SRC" >&2
    return 1
fi

# Layer 1.5: Semantic colors (must load before themes)
# Themes need tds_apply_semantic_colors() function
source "$TDS_SRC/core/semantic_colors.sh"

# Layer 1.6: Theme validation and stack management
source "$TDS_SRC/core/theme_validation.sh"
source "$TDS_SRC/core/theme_stack.sh"
source "$TDS_SRC/core/token_validation.sh"

# Layer 2: Theme system (load themes after semantic_colors.sh)
source "$TDS_SRC/themes/theme_registry.sh"
source "$TDS_SRC/themes/default.sh"

# Temperature themes (for module phase-shifts)
# Register them lazily - themes will be sourced on-demand when first used
tds_register_lazy_theme "warm" "tds_theme_warm" "Warm amber temperature for org"
tds_register_lazy_theme "cool" "tds_theme_cool" "Cool blue temperature for logs"
tds_register_lazy_theme "neutral" "tds_theme_neutral" "Neutral green temperature for tsm"
tds_register_lazy_theme "electric" "tds_theme_electric" "Electric purple temperature for deploy"

# Load active theme (sets palette arrays and semantic colors)
TDS_ACTIVE_THEME="${TDS_ACTIVE_THEME:-default}"
# Quiet load during initialization
TDS_QUIET_LOAD=1 tds_switch_theme "$TDS_ACTIVE_THEME" 2>/dev/null || {
    echo "Warning: Failed to load theme '$TDS_ACTIVE_THEME', falling back to default" >&2
    TDS_QUIET_LOAD=1 tds_switch_theme "default" 2>/dev/null
}

# Layer 3: Color tokens (existing palette → semantic mapping)
source "$TDS_SRC/tokens/color_tokens.sh"
source "$TDS_SRC/tokens/repl_tokens.sh"
source "$TDS_SRC/tokens/unicode_explorer_tokens.sh"

# Layer 4: Layout utilities (borders, panels, spacing)
source "$TDS_SRC/layout/borders.sh"
source "$TDS_SRC/layout/spacing.sh"

# Layer 5: Components (pre-built panels and UI elements)
source "$TDS_SRC/components/panels.sh"

# Layer 6: Display semantics (typography, spacing, emphasis)
source "$TDS_SRC/semantics/typography.sh"
source "$TDS_SRC/semantics/repl_ui.sh"

# Layer 7: Content renderers (markdown, code, tables, etc.)
source "$TDS_SRC/renderers/markdown.sh"
source "$TDS_SRC/renderers/toml.sh"

# Layer 8: Message Sequence Charts (co-developed with bash/msc)
# TDS acts as shepherd for MSC library
MSC_SRC="${MSC_SRC:-$(dirname "$TDS_SRC")/msc}"
if [[ -f "$MSC_SRC/includes.sh" ]]; then
    source "$MSC_SRC/includes.sh"
else
    # MSC not yet installed, skip silently
    :
fi

# TDS initialized
export TDS_LOADED=true

# NOTE: Chroma is now a separate module at bash/chroma
# It can be loaded via: tmod load chroma

# Version info
export TDS_VERSION="1.0.0"

# ============================================================================
# TDS COMMAND INTERFACE
# ============================================================================

# Load REPL
source "$TDS_SRC/tds_repl.sh"

# Load tab completion
source "$TDS_SRC/tds_complete.sh"

# ============================================================================
# THEME MANAGEMENT FUNCTIONS
# ============================================================================

# Create a new theme from template
tds_create_theme() {
    local name="$1"
    local base="${2:-default}"

    [[ -z "$name" ]] && { echo "Usage: tds create <name> [base-theme]"; return 1; }

    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ -f "$theme_file" ]]; then
        echo "Theme '$name' already exists: $theme_file"
        return 1
    fi

    # Generate theme file
    cat > "$theme_file" <<THEME_EOF
#!/usr/bin/env bash
# TDS Theme: ${name^}
# Created: $(date +%Y-%m-%d)

# Source guard
[[ "\${__TDS_THEME_${name^^}_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_${name^^}_LOADED=true

tds_theme_${name}() {
    # Theme metadata
    THEME_NAME="${name}"
    THEME_DESCRIPTION="Custom theme: ${name}"

    # ========================================================================
    # BASE PALETTE - Customize these hex colors
    # ========================================================================

    # Primary colors (main theme color)
    PALETTE_PRIMARY_100="#e0f2fe"
    PALETTE_PRIMARY_200="#bae6fd"
    PALETTE_PRIMARY_300="#7dd3fc"
    PALETTE_PRIMARY_400="#38bdf8"
    PALETTE_PRIMARY_500="#0ea5e9"      # Primary (main)
    PALETTE_PRIMARY_600="#0284c7"
    PALETTE_PRIMARY_700="#0369a1"
    PALETTE_PRIMARY_800="#075985"
    PALETTE_PRIMARY_900="#0c4a6e"

    # Secondary colors
    PALETTE_SECONDARY_100="#dbeafe"
    PALETTE_SECONDARY_200="#bfdbfe"
    PALETTE_SECONDARY_300="#93c5fd"
    PALETTE_SECONDARY_400="#60a5fa"
    PALETTE_SECONDARY_500="#3b82f6"    # Secondary (main)
    PALETTE_SECONDARY_600="#2563eb"
    PALETTE_SECONDARY_700="#1d4ed8"
    PALETTE_SECONDARY_800="#1e40af"
    PALETTE_SECONDARY_900="#1e3a8a"

    # Accent colors
    PALETTE_ACCENT_100="#cffafe"
    PALETTE_ACCENT_200="#a5f3fc"
    PALETTE_ACCENT_300="#67e8f9"
    PALETTE_ACCENT_400="#22d3ee"
    PALETTE_ACCENT_500="#06b6d4"       # Accent (main)
    PALETTE_ACCENT_600="#0891b2"
    PALETTE_ACCENT_700="#0e7490"
    PALETTE_ACCENT_800="#155e75"
    PALETTE_ACCENT_900="#164e63"

    # Neutrals (grays)
    PALETTE_NEUTRAL_100="#f8fafc"
    PALETTE_NEUTRAL_200="#f1f5f9"
    PALETTE_NEUTRAL_300="#e2e8f0"
    PALETTE_NEUTRAL_400="#cbd5e1"
    PALETTE_NEUTRAL_500="#94a3b8"
    PALETTE_NEUTRAL_600="#64748b"
    PALETTE_NEUTRAL_700="#475569"
    PALETTE_NEUTRAL_800="#334155"
    PALETTE_NEUTRAL_900="#1e293b"

    # State colors
    PALETTE_SUCCESS="#10b981"
    PALETTE_WARNING="#f59e0b"
    PALETTE_ERROR="#ef4444"
    PALETTE_INFO="#06b6d4"

    # ========================================================================
    # PALETTE ARRAYS - Map to TDS token system
    # ========================================================================

    ENV_PRIMARY=(
        "\$PALETTE_PRIMARY_500"   # 0: success/secondary
        "\$PALETTE_PRIMARY_400"   # 1
        "\$PALETTE_PRIMARY_300"   # 2
        "\$PALETTE_PRIMARY_600"   # 3
        "\$PALETTE_NEUTRAL_500"   # 4
        "\$PALETTE_NEUTRAL_600"   # 5: muted
        "\$PALETTE_NEUTRAL_700"   # 6
        "\$PALETTE_NEUTRAL_100"   # 7
    )

    MODE_PRIMARY=(
        "\$PALETTE_SECONDARY_500" # 0: info/primary
        "\$PALETTE_SECONDARY_400" # 1
        "\$PALETTE_SECONDARY_300" # 2
        "\$PALETTE_SECONDARY_600" # 3
        "\$PALETTE_NEUTRAL_400"   # 4
        "\$PALETTE_NEUTRAL_500"   # 5: muted/border
        "\$PALETTE_NEUTRAL_600"   # 6: text.secondary
        "\$PALETTE_NEUTRAL_200"   # 7: text.primary
    )

    VERBS_PRIMARY=(
        "\$PALETTE_ERROR"         # 0: error
        "\$PALETTE_ACCENT_400"    # 1
        "\$PALETTE_WARNING"       # 2: warning
        "\$PALETTE_PRIMARY_500"   # 3
        "\$PALETTE_PRIMARY_400"   # 4
        "\$PALETTE_NEUTRAL_600"   # 5
        "\$PALETTE_NEUTRAL_700"   # 6
        "\$PALETTE_NEUTRAL_300"   # 7
    )

    NOUNS_PRIMARY=(
        "\$PALETTE_ACCENT_500"    # 0: pending
        "\$PALETTE_ACCENT_400"    # 1
        "\$PALETTE_PRIMARY_400"   # 2
        "\$PALETTE_SECONDARY_400" # 3
        "\$PALETTE_NEUTRAL_300"   # 4
        "\$PALETTE_NEUTRAL_400"   # 5
        "\$PALETTE_NEUTRAL_500"   # 6
        "\$PALETTE_NEUTRAL_200"   # 7
    )

    # Apply semantic colors
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "${name}" "tds_theme_${name}" "Custom theme: ${name}"

export -f tds_theme_${name}
THEME_EOF

    echo "Created theme: $theme_file"
    echo "Edit with: tds edit $name"
    echo "Load with: tds switch $name"
}

# Edit a theme file
tds_edit_theme() {
    local name="${1:-$(tds_active_theme)}"
    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ ! -f "$theme_file" ]]; then
        echo "Theme not found: $name"
        echo "Available: $(printf '%s ' "${!TDS_THEME_REGISTRY[@]}")"
        return 1
    fi

    "${EDITOR:-vi}" "$theme_file"

    # Offer to reload
    echo "Reload theme? [y/N] "
    read -r reply
    if [[ "$reply" =~ ^[Yy]$ ]]; then
        source "$theme_file"
        tds_switch_theme "$name"
    fi
}

# Copy an existing theme
tds_copy_theme() {
    local src="$1"
    local dst="$2"

    [[ -z "$src" || -z "$dst" ]] && { echo "Usage: tds copy <source> <dest>"; return 1; }

    local src_file="$TDS_SRC/themes/${src}.sh"
    local dst_file="$TDS_SRC/themes/${dst}.sh"

    if [[ ! -f "$src_file" ]]; then
        echo "Source theme not found: $src"
        return 1
    fi

    if [[ -f "$dst_file" ]]; then
        echo "Destination theme already exists: $dst"
        return 1
    fi

    # Copy and update names
    sed -e "s/tds_theme_${src}/tds_theme_${dst}/g" \
        -e "s/THEME_NAME=\"${src}\"/THEME_NAME=\"${dst}\"/g" \
        -e "s/__TDS_THEME_${src^^}/__TDS_THEME_${dst^^}/g" \
        -e "s/\"${src}\"/\"${dst}\"/g" \
        "$src_file" > "$dst_file"

    echo "Copied $src → $dst"
    echo "Edit with: tds edit $dst"
}

# Delete a theme
tds_delete_theme() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: tds delete <theme>"; return 1; }

    # Protect built-in themes
    case "$name" in
        default|warm|cool|neutral|electric)
            echo "Cannot delete built-in theme: $name"
            return 1
            ;;
    esac

    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ ! -f "$theme_file" ]]; then
        echo "Theme not found: $name"
        return 1
    fi

    echo "Delete theme '$name'? [y/N] "
    read -r reply
    if [[ "$reply" =~ ^[Yy]$ ]]; then
        rm "$theme_file"
        echo "Deleted: $name"
    fi
}

# Show theme file path
tds_path_theme() {
    local name="${1:-$(tds_active_theme)}"
    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ -f "$theme_file" ]]; then
        echo "$theme_file"
    else
        echo "Theme not found: $name" >&2
        return 1
    fi
}

# ============================================================================
# COMMAND HANDLERS - Property-based operations
# ============================================================================

# Theme operations
_tds_cmd_get_theme() {
    local verbose=false
    [[ "$1" == "-v" ]] && { verbose=true; shift; }
    local theme="${1:-$(tds_active_theme)}"

    echo
    echo "═══ Theme: $theme ═══"
    echo

    if [[ "$verbose" == true ]]; then
        # Full info: description, all palettes, token count
        echo "Status: $(tds_active_theme | grep -q "^${theme}$" && echo "active" || echo "available")"
        echo "Tokens: ${#TDS_COLOR_TOKENS[@]} defined"
        echo
    fi

    # Show palette preview
    if [[ -f "$TDS_SRC/tools/show_palette.sh" ]]; then
        bash "$TDS_SRC/tools/show_palette.sh" "$theme"
    else
        echo "Active: $(tds_active_theme)"
        echo "Available: $(printf '%s ' "${!TDS_THEME_REGISTRY[@]}")"
    fi
}

_tds_cmd_set_theme() {
    local theme="$1"
    if [[ -z "$theme" ]]; then
        echo "Usage: tds set theme <name>"
        echo "Available: $(printf '%s ' "${!TDS_THEME_REGISTRY[@]}")"
        return 1
    fi
    tds_switch_theme "$theme"
}

_tds_cmd_get_themes() {
    tds_list_themes
}

# Alias for backwards compat
_tds_cmd_list_themes() {
    _tds_cmd_get_themes
}

_tds_cmd_validate_theme() {
    local theme="${1:-$(tds_active_theme)}"
    if [[ -z "${TDS_THEME_REGISTRY[$theme]}" ]]; then
        echo "✗ Theme not found: $theme"
        return 1
    fi
    # Try to load the theme
    if tds_switch_theme "$theme" 2>/dev/null; then
        echo "✓ Theme valid: $theme"
        return 0
    else
        echo "✗ Theme failed to load: $theme"
        return 1
    fi
}

# Palette operations
_tds_cmd_get_palette() {
    local palette_name="${1^^}"  # Convert to uppercase

    if [[ -z "$palette_name" ]]; then
        # Show all palettes
        for name in ENV MODE VERBS NOUNS; do
            _tds_show_single_palette "${name}_PRIMARY"
        done
        return
    fi

    # Map friendly names to full names
    case "$palette_name" in
        ENV) palette_name="ENV_PRIMARY" ;;
        MODE) palette_name="MODE_PRIMARY" ;;
        VERBS) palette_name="VERBS_PRIMARY" ;;
        NOUNS) palette_name="NOUNS_PRIMARY" ;;
        *_PRIMARY) ;; # Already full name
        *)
            echo "Unknown palette: $palette_name"
            echo "Available: env, mode, verbs, nouns"
            return 1
            ;;
    esac

    _tds_show_single_palette "$palette_name"
}

_tds_show_single_palette() {
    local palette_name="$1"
    echo
    echo "═══ $palette_name ═══"
    echo

    if declare -p "$palette_name" >/dev/null 2>&1; then
        local -n palette="$palette_name"
        for i in "${!palette[@]}"; do
            local hex="${palette[$i]}"
            printf "[%d] " "$i"
            text_color "$hex"
            bg_only "$hex"
            printf "   "
            reset_color
            printf " %s\n" "$hex"
        done
    else
        echo "  (not defined)"
    fi
    echo
}

_tds_cmd_list_palettes() {
    echo
    echo "═══ Palettes ═══"
    echo
    echo "  env     ENV_PRIMARY     Environment colors"
    echo "  mode    MODE_PRIMARY    Mode indicators"
    echo "  verbs   VERBS_PRIMARY   Action colors"
    echo "  nouns   NOUNS_PRIMARY   Entity colors"
    echo
}

# Token operations
_tds_cmd_get_token() {
    local token="$1"

    if [[ -z "$token" ]]; then
        echo "Usage: tds get token <name>"
        echo "Example: tds get token content.heading.h1"
        return 1
    fi

    if [[ -n "${TDS_COLOR_TOKENS[$token]}" ]]; then
        local ref="${TDS_COLOR_TOKENS[$token]}"
        local hex=$(tds_resolve_color "$token")
        echo
        echo "Token:   $token"
        echo "Maps to: $ref"
        echo -n "Hex:     "
        if [[ -n "$hex" ]]; then
            text_color "$hex"
            bg_only "$hex"
            printf "   "
            reset_color
            echo " $hex"
        else
            echo "(unresolved)"
        fi
        echo
    else
        echo "Token not found: $token"
        echo "Use 'tds tokens' to list available tokens"
        return 1
    fi
}

_tds_cmd_list_tokens() {
    echo
    echo "═══ Color Tokens ═══"
    echo

    if [[ ${#TDS_COLOR_TOKENS[@]} -eq 0 ]]; then
        echo "(no tokens defined)"
        return
    fi

    local categories=()
    for token in "${!TDS_COLOR_TOKENS[@]}"; do
        local category="${token%%.*}"
        if [[ ! " ${categories[*]} " =~ " ${category} " ]]; then
            categories+=("$category")
        fi
    done
    IFS=$'\n' categories=($(sort <<<"${categories[*]}"))
    unset IFS

    for category in "${categories[@]}"; do
        echo "── $category ──"
        for token in $(printf '%s\n' "${!TDS_COLOR_TOKENS[@]}" | grep "^${category}\." | sort); do
            local ref="${TDS_COLOR_TOKENS[$token]}"
            printf "  %-30s → %s\n" "$token" "$ref"
        done
        echo
    done
}

_tds_cmd_validate_tokens() {
    echo
    echo "═══ Token Validation ═══"
    echo

    if declare -f tds_show_token_validation >/dev/null; then
        tds_show_token_validation
    else
        local errors=0
        for token in "${!TDS_COLOR_TOKENS[@]}"; do
            local hex=$(tds_resolve_color "$token" 2>/dev/null)
            if [[ -z "$hex" ]]; then
                echo "✗ $token → (unresolved)"
                ((errors++))
            fi
        done
        if [[ $errors -eq 0 ]]; then
            echo "✓ All ${#TDS_COLOR_TOKENS[@]} tokens valid"
        else
            echo
            echo "Found $errors invalid tokens"
            return 1
        fi
    fi
}

# Hex color utility
_tds_cmd_get_hex() {
    local hex="$1"

    if [[ -z "$hex" ]]; then
        echo "Usage: tds hex <#RRGGBB>"
        return 1
    fi

    hex="${hex#\#}"
    if ! [[ "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid hex color: #$hex"
        echo "Format: #RRGGBB (e.g., #3b82f6)"
        return 1
    fi

    echo
    text_color "#$hex"
    bg_only "#$hex"
    printf "                    \n"
    printf "   #%-14s \n" "$hex"
    printf "                    \n"
    reset_color

    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))
    echo
    echo "RGB: ($r, $g, $b)"
}

# Theme CRUD operations
_tds_cmd_create_theme() {
    local name="$1"
    local base="${2:-default}"
    [[ -z "$name" ]] && { echo "Usage: tds create theme <name> [base]"; return 1; }
    tds_create_theme "$name" "$base"
}

_tds_cmd_delete_theme() {
    local name="$1"
    [[ -z "$name" ]] && { echo "Usage: tds delete theme <name>"; return 1; }
    tds_delete_theme "$name"
}

_tds_cmd_copy_theme() {
    local src="$1" dst="$2"
    [[ -z "$src" || -z "$dst" ]] && { echo "Usage: tds copy theme <src> <dst>"; return 1; }
    tds_copy_theme "$src" "$dst"
}

_tds_cmd_edit_theme() {
    local name="${1:-$(tds_active_theme)}"
    tds_edit_theme "$name"
}

_tds_cmd_path_theme() {
    local name="${1:-$(tds_active_theme)}"
    tds_path_theme "$name"
}

# Help
_tds_cmd_help() {
    cat <<'EOF'

TDS - Tetra Design System

USAGE: tds <verb> <noun> [args]

VERBS
  get        Read/inspect a property
  set        Modify a property
  validate   Check correctness
  create     Create new theme
  delete     Remove theme
  copy       Duplicate theme
  edit       Open in editor
  path       Show file path

NOUNS
  theme      Active theme (get/set/validate)
  themes     All themes (get)
  palette    Color palette (get) - env/mode/verbs/nouns
  palettes   Palette names (get)
  token      Single token (get)
  tokens     All tokens (get/validate)
  hex        Raw hex color (get)

EXAMPLES
  tds get theme              Active theme + palette preview
  tds get theme -v           Full theme info
  tds set theme warm         Switch to warm theme
  tds get themes             List all available themes
  tds validate theme warm    Check theme loads correctly

  tds get palette env        Show env palette
  tds get palette            Show all palettes
  tds get palettes           List palette names

  tds get token X            Resolve token X to hex
  tds get tokens             List all tokens
  tds validate tokens        Check all token mappings

  tds get hex #3b82f6        Show color swatch

  tds create theme <name>    Create from template
  tds delete theme <name>    Delete custom theme
  tds copy theme <src> <dst> Copy theme
  tds edit theme [name]      Edit in $EDITOR
  tds path theme [name]      Show file path

TOOLS
  tds repl                   Interactive explorer
  tds help                   This help

EOF
}

# ============================================================================
# MAIN COMMAND - Parser and Dispatcher
# ============================================================================

tds() {
    local arg1="${1:-}"
    local arg2="${2:-}"
    shift 2 2>/dev/null || shift $# 2>/dev/null
    local args="$*"

    # Handle special commands first
    case "$arg1" in
        repl) tds_repl; return ;;
        help|--help|-h|"") _tds_cmd_help; return ;;
    esac

    # Require verb-noun syntax: tds <operation> <property> [args]
    local op="$arg1"
    local prop="$arg2"

    # Validate operation
    case "$op" in
        get|set|list|validate|create|delete|copy|edit|path)
            ;;
        *)
            echo "Unknown operation: $op"
            echo "Operations: get, set, list, validate, create, delete, copy, edit, path"
            echo "Try: tds help"
            return 1
            ;;
    esac

    # Require property
    if [[ -z "$prop" ]]; then
        echo "Missing property for '$op'"
        echo "Properties: theme, themes, palette, palettes, token, tokens, hex"
        echo "Try: tds help"
        return 1
    fi

    # Dispatch to handler
    local handler="_tds_cmd_${op}_${prop}"

    if declare -f "$handler" >/dev/null 2>&1; then
        "$handler" $args
    else
        echo "Unknown: tds $op $prop"
        echo "Try: tds help"
        return 1
    fi
}

# =============================================================================
# EXPORTS - Auto-export all tds* functions
# =============================================================================

export -f tds
while IFS= read -r func; do
    export -f "$func"
done < <(declare -F | awk '{print $3}' | grep -E '^tds_')
