#!/usr/bin/env bash
# TDS Theme Commands - CRUD operations for themes

# Create a new theme from template
tds_create_theme() {
    local name="$1"
    local base="${2:-default}"

    [[ -z "$name" ]] && { echo "Usage: tds theme create <name> [base-theme]"; return 1; }

    # Validate theme name (alphanumeric, underscore, hyphen, must start with letter)
    if [[ ! "$name" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ ]]; then
        echo "Invalid theme name: $name" >&2
        echo "Name must start with a letter and contain only alphanumeric, underscore, or hyphen" >&2
        return 1
    fi

    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ -f "$theme_file" ]]; then
        echo "Theme '$name' already exists: $theme_file" >&2
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
    THEME_NAME="${name}"
    THEME_DESCRIPTION="Custom theme: ${name}"

    # Primary colors
    PALETTE_PRIMARY_500="#0ea5e9"
    PALETTE_SECONDARY_500="#3b82f6"
    PALETTE_ACCENT_500="#06b6d4"

    # Neutrals
    PALETTE_NEUTRAL_100="#f8fafc"
    PALETTE_NEUTRAL_500="#94a3b8"
    PALETTE_NEUTRAL_900="#1e293b"

    # State colors
    PALETTE_SUCCESS="#10b981"
    PALETTE_WARNING="#f59e0b"
    PALETTE_ERROR="#ef4444"

    # Palette arrays
    ENV_PRIMARY=(
        "\$PALETTE_PRIMARY_500" "\$PALETTE_PRIMARY_500"
        "\$PALETTE_PRIMARY_500" "\$PALETTE_PRIMARY_500"
        "\$PALETTE_NEUTRAL_500" "\$PALETTE_NEUTRAL_500"
        "\$PALETTE_NEUTRAL_500" "\$PALETTE_NEUTRAL_100"
    )

    MODE_PRIMARY=(
        "\$PALETTE_SECONDARY_500" "\$PALETTE_SECONDARY_500"
        "\$PALETTE_SECONDARY_500" "\$PALETTE_SECONDARY_500"
        "\$PALETTE_NEUTRAL_500" "\$PALETTE_NEUTRAL_500"
        "\$PALETTE_NEUTRAL_500" "\$PALETTE_NEUTRAL_100"
    )

    VERBS_PRIMARY=(
        "\$PALETTE_ERROR" "\$PALETTE_ACCENT_500"
        "\$PALETTE_WARNING" "\$PALETTE_PRIMARY_500"
        "\$PALETTE_PRIMARY_500" "\$PALETTE_NEUTRAL_500"
        "\$PALETTE_NEUTRAL_500" "\$PALETTE_NEUTRAL_100"
    )

    NOUNS_PRIMARY=(
        "\$PALETTE_ACCENT_500" "\$PALETTE_ACCENT_500"
        "\$PALETTE_PRIMARY_500" "\$PALETTE_SECONDARY_500"
        "\$PALETTE_NEUTRAL_100" "\$PALETTE_NEUTRAL_500"
        "\$PALETTE_NEUTRAL_500" "\$PALETTE_NEUTRAL_100"
    )

    tds_apply_semantic_colors
}

tds_register_theme "${name}" "tds_theme_${name}" "Custom theme: ${name}"
export -f tds_theme_${name}
THEME_EOF

    echo "Created theme: $theme_file"
    echo "Edit with: tds theme edit $name"
    echo "Load with: tds theme set $name"
}

# Edit a theme file
tds_edit_theme() {
    local name="${1:-$(tds_active_theme)}"
    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ ! -f "$theme_file" ]]; then
        echo "Theme not found: $name" >&2
        echo "Available: $(printf '%s ' "${!TDS_THEME_REGISTRY[@]}")" >&2
        return 1
    fi

    "${EDITOR:-vi}" "$theme_file"

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

    [[ -z "$src" || -z "$dst" ]] && { echo "Usage: tds theme copy <source> <dest>"; return 1; }

    local src_file="$TDS_SRC/themes/${src}.sh"
    local dst_file="$TDS_SRC/themes/${dst}.sh"

    if [[ ! -f "$src_file" ]]; then
        echo "Source theme not found: $src" >&2
        return 1
    fi

    if [[ -f "$dst_file" ]]; then
        echo "Destination theme already exists: $dst" >&2
        return 1
    fi

    sed -e "s/tds_theme_${src}/tds_theme_${dst}/g" \
        -e "s/THEME_NAME=\"${src}\"/THEME_NAME=\"${dst}\"/g" \
        -e "s/__TDS_THEME_${src^^}/__TDS_THEME_${dst^^}/g" \
        -e "s/\"${src}\"/\"${dst}\"/g" \
        "$src_file" > "$dst_file"

    echo "Copied $src -> $dst"
    echo "Edit with: tds theme edit $dst"
}

# Delete a theme
tds_delete_theme() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: tds theme delete <name>"; return 1; }

    case "$name" in
        default|warm|cool|neutral|electric|arctic)
            echo "Cannot delete built-in theme: $name" >&2
            return 1
            ;;
    esac

    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ ! -f "$theme_file" ]]; then
        echo "Theme not found: $name" >&2
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

# Save current in-memory state as a new theme
tds_save_theme() {
    local name="$1"
    if [[ -z "$name" ]]; then
        echo "Usage: tds theme save <name>" >&2
        return 1
    fi

    if [[ ! "$name" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ ]]; then
        echo "Invalid theme name: $name" >&2
        return 1
    fi

    local theme_file="$TDS_SRC/themes/${name}.sh"

    if [[ -f "$theme_file" ]]; then
        echo "Theme already exists: $name" >&2
        return 1
    fi

    cat > "$theme_file" <<EOF
#!/usr/bin/env bash
# Theme: $name
# Generated: $(date '+%Y-%m-%d %H:%M:%S')
# Base: $(tds_active_theme)

_tds_load_${name}() {
    ENV_PRIMARY=(
$(for i in "${!ENV_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${ENV_PRIMARY[$i]}" "$i"; done)
    )

    MODE_PRIMARY=(
$(for i in "${!MODE_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${MODE_PRIMARY[$i]}" "$i"; done)
    )

    VERBS_PRIMARY=(
$(for i in "${!VERBS_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${VERBS_PRIMARY[$i]}" "$i"; done)
    )

    NOUNS_PRIMARY=(
$(for i in "${!NOUNS_PRIMARY[@]}"; do printf '        "%s"  # %d\n' "${NOUNS_PRIMARY[$i]}" "$i"; done)
    )
}

tds_register_theme "$name" "_tds_load_${name}"
EOF

    echo "Saved theme: $name"
    echo "  File: $theme_file"
}

# Command handlers
_tds_cmd_get_theme() {
    local theme="${1:-$(tds_active_theme)}"
    echo
    echo "=== Theme: $theme ==="
    echo
    echo "Active: $(tds_active_theme)"
    echo "Available: $(printf '%s ' "${!TDS_THEME_REGISTRY[@]}")"
}

_tds_cmd_set_theme() {
    local theme="$1"
    if [[ -z "$theme" ]]; then
        echo "Usage: tds theme set <name>"
        echo "Available: $(printf '%s ' "${!TDS_THEME_REGISTRY[@]}")"
        return 1
    fi
    tds_switch_theme "$theme"
}

_tds_cmd_get_themes() {
    tds_list_themes
}

_tds_cmd_validate_theme() {
    local theme="${1:-$(tds_active_theme)}"
    if [[ -z "${TDS_THEME_REGISTRY[$theme]}" ]]; then
        echo "x Theme not found: $theme"
        return 1
    fi
    if tds_switch_theme "$theme" 2>/dev/null; then
        echo "ok Theme valid: $theme"
        return 0
    else
        echo "x Theme failed to load: $theme"
        return 1
    fi
}

# Resource handler
_tds_theme() {
    local action="${1:-}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)     _tds_cmd_get_themes ;;
        get)         _tds_cmd_get_theme "$@" ;;
        set|switch)  _tds_cmd_set_theme "$@" ;;
        create|new)  tds_create_theme "$@" ;;
        delete|rm)   tds_delete_theme "$@" ;;
        copy|cp)     tds_copy_theme "$@" ;;
        edit)        tds_edit_theme "$@" ;;
        path)        tds_path_theme "$@" ;;
        save)        tds_save_theme "$@" ;;
        validate)    _tds_cmd_validate_theme "$@" ;;
        help|--help|-h|"")
            _tds_theme_help
            ;;
        *)
            echo "Unknown action: theme $action"
            _tds_theme_help
            return 1
            ;;
    esac
}

_tds_theme_help() {
    echo
    echo "tds theme - Manage color themes"
    echo
    echo "  list              List available themes"
    echo "  get [name]        Show theme info"
    echo "  set <name>        Activate theme"
    echo "  create <name>     Create from template"
    echo "  delete <name>     Delete custom theme"
    echo "  copy <src> <dst>  Copy to new name"
    echo "  edit [name]       Edit in \$EDITOR"
    echo "  path [name]       Show file path"
    echo "  save <name>       Save current state as theme"
    echo "  validate [name]   Check theme validity"
    echo
}

export -f tds_create_theme tds_edit_theme tds_copy_theme tds_delete_theme
export -f tds_path_theme tds_save_theme _tds_theme _tds_theme_help
export -f _tds_cmd_get_theme _tds_cmd_set_theme _tds_cmd_get_themes _tds_cmd_validate_theme
