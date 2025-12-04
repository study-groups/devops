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

# Set individual palette color (in-memory only)
_tds_cmd_set_palette() {
    local palette="$1"
    local index="$2"
    local hex="$3"

    if [[ -z "$palette" || -z "$index" || -z "$hex" ]]; then
        echo "Usage: tds set palette <name> <index> <hex>"
        echo "Example: tds set palette env 0 #ff0000"
        echo "Palettes: env, mode, verbs, nouns"
        return 1
    fi

    # Validate hex format
    if [[ ! "$hex" =~ ^#[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid hex color: $hex (expected #RRGGBB)"
        return 1
    fi

    # Validate index is a number
    if [[ ! "$index" =~ ^[0-9]+$ ]]; then
        echo "Invalid index: $index (expected number)"
        return 1
    fi

    # Map palette name to array
    local array_name
    case "${palette,,}" in
        env)   array_name="ENV_PRIMARY" ;;
        mode)  array_name="MODE_PRIMARY" ;;
        verbs) array_name="VERBS_PRIMARY" ;;
        nouns) array_name="NOUNS_PRIMARY" ;;
        *)
            echo "Unknown palette: $palette"
            echo "Palettes: env, mode, verbs, nouns"
            return 1
            ;;
    esac

    # Set the value using nameref
    declare -n arr="$array_name"
    local old_value="${arr[$index]:-}"
    arr[$index]="$hex"

    echo "Set ${array_name}[$index]: ${old_value:-<empty>} → $hex"
    echo "(in-memory only, reset on theme switch)"
}

# Set token mapping (in-memory only)
_tds_cmd_set_token() {
    local token="$1"
    local ref="$2"

    if [[ -z "$token" || -z "$ref" ]]; then
        echo "Usage: tds set token <name> <reference>"
        echo "Example: tds set token status.ok env:2"
        echo "Reference format: palette:index (e.g., env:0, mode:3)"
        return 1
    fi

    # Validate reference format (palette:index or direct hex)
    if [[ ! "$ref" =~ ^(env|mode|verbs|nouns):[0-9]+$ && ! "$ref" =~ ^#[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid reference: $ref"
        echo "Expected: palette:index (e.g., env:0) or #RRGGBB"
        return 1
    fi

    local old_value="${TDS_COLOR_TOKENS[$token]:-}"
    TDS_COLOR_TOKENS[$token]="$ref"

    if [[ -n "$old_value" ]]; then
        echo "Set $token: $old_value → $ref"
    else
        echo "Created $token: $ref"
    fi
    echo "(in-memory only, reset on theme switch)"
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

# Alias: get palettes -> list palettes
_tds_cmd_get_palettes() {
    _tds_cmd_list_palettes
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

    # Collect unique categories using associative array
    local -A seen_cats=()
    for token in "${!TDS_COLOR_TOKENS[@]}"; do
        seen_cats["${token%%.*}"]=1
    done

    # Sort categories
    local categories
    mapfile -t categories < <(printf '%s\n' "${!seen_cats[@]}" | sort)

    for category in "${categories[@]}"; do
        echo "── $category ──"
        # Get sorted tokens for this category
        local tokens
        mapfile -t tokens < <(printf '%s\n' "${!TDS_COLOR_TOKENS[@]}" | grep "^${category}\." | sort)
        for token in "${tokens[@]}"; do
            local ref="${TDS_COLOR_TOKENS[$token]}"
            # Resolve to hex and show colored swatch
            local hex=""
            hex=$(tds_resolve_color "$token" 2>/dev/null)
            if [[ -n "$hex" && "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
                local r=$((16#${hex:0:2}))
                local g=$((16#${hex:2:2}))
                local b=$((16#${hex:4:2}))
                # Use tput for color swatch
                local r5=$(( r * 5 / 255 ))
                local g5=$(( g * 5 / 255 ))
                local b5=$(( b * 5 / 255 ))
                local color256=$(( 16 + 36*r5 + 6*g5 + b5 ))
                local swatch="$(tput setaf $color256)██$(tput sgr0)"
                printf "  %s %-30s → %s\n" "$swatch" "$token" "$ref"
            else
                printf "     %-30s → %s\n" "$token" "$ref"
            fi
        done
        echo
    done
}

# Alias: get tokens -> list tokens
_tds_cmd_get_tokens() {
    _tds_cmd_list_tokens
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

# Save current in-memory state as a new theme
_tds_cmd_save_theme() {
    local name="$1"
    if [[ -z "$name" ]]; then
        echo "Usage: tds save theme <name>"
        echo "Saves current palette/token state as a new theme file"
        return 1
    fi

    # Validate name (alphanumeric, underscore, hyphen)
    if [[ ! "$name" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ ]]; then
        echo "Invalid theme name: $name"
        echo "Use letters, numbers, underscore, hyphen (start with letter)"
        return 1
    fi

    local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    local theme_file="$tds_src/themes/${name}.sh"

    # Check if exists
    if [[ -f "$theme_file" ]]; then
        echo "Theme already exists: $name"
        echo "Use 'tds delete theme $name' first, or choose a different name"
        return 1
    fi

    # Generate theme file
    cat > "$theme_file" <<EOF
#!/usr/bin/env bash
# Theme: $name
# Generated by: tds save theme
# Date: $(date '+%Y-%m-%d %H:%M:%S')
# Base: $(tds_active_theme)

_tds_load_${name}() {
    # Palette: ENV_PRIMARY (environment/success colors)
    ENV_PRIMARY=(
$(for i in "${!ENV_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${ENV_PRIMARY[$i]}" "$i"; done)
    )

    # Palette: MODE_PRIMARY (mode indicator colors)
    MODE_PRIMARY=(
$(for i in "${!MODE_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${MODE_PRIMARY[$i]}" "$i"; done)
    )

    # Palette: VERBS_PRIMARY (action/verb colors)
    VERBS_PRIMARY=(
$(for i in "${!VERBS_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${VERBS_PRIMARY[$i]}" "$i"; done)
    )

    # Palette: NOUNS_PRIMARY (entity/noun colors)
    NOUNS_PRIMARY=(
$(for i in "${!NOUNS_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${NOUNS_PRIMARY[$i]}" "$i"; done)
    )
}

# Register theme
tds_register_theme "$name" "_tds_load_${name}"
EOF

    echo "✓ Saved theme: $name"
    echo "  File: $theme_file"
    echo "  Use 'tds set theme $name' to activate"
    echo "  Use 'tds edit theme $name' to customize"
}

# Doctor - health check and diagnostics
_tds_cmd_doctor() {
    # Get terminal width, default to 80
    local term_width=${COLUMNS:-80}
    local label_width=18
    local value_width=$((term_width - label_width - 4))

    echo
    echo "═══ TDS Doctor ═══"
    echo

    local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    local tds_dir="${TDS_DIR:-$TETRA_DIR/tds}"

    # Paths
    echo "── Paths ──"
    printf "  %-${label_width}s %s\n" "TDS_SRC:" "$tds_src"
    printf "  %-${label_width}s %s\n" "TDS_DIR:" "$tds_dir"
    printf "  %-${label_width}s %s\n" "TETRA_SRC:" "${TETRA_SRC:-<not set>}"
    printf "  %-${label_width}s %s\n" "TETRA_DIR:" "${TETRA_DIR:-<not set>}"
    echo

    # Theme status
    echo "── Themes ──"
    local theme_count=${#TDS_THEME_REGISTRY[@]}
    local active=$(tds_active_theme 2>/dev/null || echo "<none>")
    printf "  %-${label_width}s %s\n" "Active:" "$active"
    printf "  %-${label_width}s %d\n" "Registered:" "$theme_count"
    if [[ $theme_count -gt 0 ]]; then
        local themes_list=$(printf '%s ' "${!TDS_THEME_REGISTRY[@]}" | sort)
        printf "  %-${label_width}s %s\n" "Available:" "$themes_list"
    fi

    # Theme files
    local theme_dir="$tds_src/themes"
    if [[ -d "$theme_dir" ]]; then
        local file_count=$(find "$theme_dir" -name "*.sh" ! -name "theme_registry.sh" 2>/dev/null | wc -l | tr -d ' ')
        printf "  %-${label_width}s %d files\n" "Theme files:" "$file_count"
    else
        printf "  %-${label_width}s %s\n" "Theme dir:" "✗ not found"
    fi
    echo

    # Palettes
    echo "── Palettes ──"
    for name in ENV_PRIMARY MODE_PRIMARY VERBS_PRIMARY NOUNS_PRIMARY; do
        declare -n arr="$name" 2>/dev/null
        local short_name="${name%_PRIMARY}"
        if [[ -v arr ]]; then
            printf "  %-${label_width}s %d colors" "$short_name:" "${#arr[@]}"
            [[ -n "${arr[0]:-}" ]] && printf " (%s)" "${arr[0]}"
            echo
        else
            printf "  %-${label_width}s %s\n" "$short_name:" "✗ undefined"
        fi
    done
    echo

    # Tokens
    echo "── Tokens ──"
    local token_count=${#TDS_COLOR_TOKENS[@]}
    printf "  %-${label_width}s %d\n" "Count:" "$token_count"
    if [[ $token_count -gt 0 ]]; then
        local -A seen_cats=()
        for token in "${!TDS_COLOR_TOKENS[@]}"; do
            seen_cats["${token%%.*}"]=1
        done
        local sorted_cats=$(printf '%s ' "${!seen_cats[@]}" | tr ' ' '\n' | sort | tr '\n' ' ')
        printf "  %-${label_width}s %s\n" "Categories:" "$sorted_cats"
    fi
    echo

    # Semantic colors
    echo "── Semantic ──"
    local semantic_count=${#TDS_SEMANTIC_COLORS[@]}
    printf "  %-${label_width}s %d\n" "Colors:" "$semantic_count"
    echo

    # Validation
    echo "── Health Check ──"
    local issues=0

    # Check TETRA_SRC
    if [[ -z "$TETRA_SRC" ]]; then
        echo "  ✗ TETRA_SRC not set"
        ((issues++))
    elif [[ ! -d "$TETRA_SRC" ]]; then
        echo "  ✗ TETRA_SRC directory not found: $TETRA_SRC"
        ((issues++))
    else
        echo "  ✓ TETRA_SRC valid"
    fi

    # Check theme registry
    if [[ $theme_count -eq 0 ]]; then
        echo "  ✗ No themes registered"
        ((issues++))
    else
        echo "  ✓ Theme registry loaded ($theme_count themes)"
    fi

    # Check active theme
    if [[ -z "$active" || "$active" == "<none>" ]]; then
        echo "  ✗ No active theme"
        ((issues++))
    else
        echo "  ✓ Active theme: $active"
    fi

    # Check palettes populated
    local palette_issues=0
    for name in ENV_PRIMARY MODE_PRIMARY VERBS_PRIMARY NOUNS_PRIMARY; do
        declare -n arr="$name" 2>/dev/null
        if [[ ! -v arr ]] || [[ ${#arr[@]} -eq 0 ]]; then
            ((palette_issues++))
        fi
    done
    if [[ $palette_issues -gt 0 ]]; then
        echo "  ✗ $palette_issues palettes empty or undefined"
        ((issues++))
    else
        echo "  ✓ All palettes populated"
    fi

    # Check tokens
    if [[ $token_count -eq 0 ]]; then
        echo "  ⚠ No tokens defined (optional)"
    else
        echo "  ✓ Tokens defined ($token_count)"
    fi

    echo
    if [[ $issues -eq 0 ]]; then
        echo "Status: ✓ Healthy"
    else
        echo "Status: ✗ $issues issue(s) found"
    fi
    echo
    echo "── Quick Reference ──"
    echo "  tds get tokens        List all tokens"
    echo "  tds get palettes      List palette names"
    echo "  tds get themes        List available themes"
    echo
}

# Help
_tds_cmd_help() {
    cat <<'EOF'

TDS - Tetra Design System

USAGE: tds <verb> <noun> [args]

COMMANDS                                        COMPLETIONS
  get theme [-v]          Show active theme     <themes>
  get themes              List all themes
  get palette [name]      Show palette colors   env|mode|verbs|nouns
  get palettes            List palette names
  get token <name>        Resolve to hex        <tokens>
  get tokens              List all tokens
  get hex <color>         Show color swatch     #RRGGBB

  set theme <name>        Switch theme          <themes>
  set palette <p> <i> <#> Set palette color     env|mode|verbs|nouns 0-7
  set token <name> <ref>  Set token mapping     <tokens> palette:index

  validate theme [name]   Check theme loads     <themes>
  validate tokens         Check token mappings

  create theme <name>    Create from template
  delete theme <name>    Delete custom theme   <custom-themes>
  copy theme <s> <d>     Copy theme            <themes>
  edit theme [name]      Open in $EDITOR       <themes>
  path theme [name]      Show file path        <themes>
  save theme <name>      Save current state    (new name)

  doctor                 Health check & diagnostics
  help                   This help
  repl                   Interactive explorer

EXAMPLES
  tds get theme            Show active theme with palette preview
  tds set theme warm       Switch to warm theme
  tds set palette env 0 #ff0000   Change env[0] to red (in-memory)
  tds set token status.ok env:2   Remap token (in-memory)
  tds save theme mytheme   Save current state as new theme
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
        doctor) _tds_cmd_doctor; return ;;
        help|--help|-h|"") _tds_cmd_help; return ;;
    esac

    # Require verb-noun syntax: tds <operation> <property> [args]
    local op="$arg1"
    local prop="$arg2"

    # Validate operation
    case "$op" in
        get|set|validate|create|delete|copy|edit|path|save)
            ;;
        *)
            echo "Unknown operation: $op"
            echo "Operations: get, set, validate, create, delete, copy, edit, path, save"
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
