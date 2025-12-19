#!/usr/bin/env bash

# =============================================================================
# TDS Module Color Configuration
# =============================================================================
#
# Shared utility for per-module color configuration using TDS palettes.
# Any tetra module can use this to manage semantic color tokens stored
# in $MODULE_DIR/config/colors.conf.
#
# USAGE:
#   # In your module's includes.sh, after sourcing TDS:
#   source "$TDS_SRC/core/module_config.sh"
#
#   # Register module with default tokens
#   declare -gA TLS_COLOR_TOKENS=(
#       [file.directory]="verbs:5"
#       [time.hot]="mode:2"
#   )
#   tds_module_register "tls" "$TLS_DIR/config/colors.conf" TLS_COLOR_TOKENS
#
#   # Get colors
#   local hex=$(tds_module_color "tls" "file.directory")
#
# =============================================================================

# Registry of module configs: module -> config_file
declare -gA _TDS_MODULE_CONFIGS=()

# Registry of module token arrays: module -> array_name
declare -gA _TDS_MODULE_ARRAYS=()

# =============================================================================
# MODULE REGISTRATION
# =============================================================================

# Register a module's color configuration
# Args: module_name, config_file_path, token_array_name
tds_module_register() {
    local module="$1"
    local config_file="$2"
    local array_name="$3"

    _TDS_MODULE_CONFIGS["$module"]="$config_file"
    _TDS_MODULE_ARRAYS["$module"]="$array_name"

    # Create config dir if needed
    local config_dir=$(dirname "$config_file")
    [[ -d "$config_dir" ]] || mkdir -p "$config_dir"

    # Load existing config (overrides defaults in array)
    tds_module_load "$module"
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Extract unique prefixes from associative array keys and output sorted
# Args: array_name (nameref)
# Output: sorted prefixes, one per line
_tds_get_prefixes() {
    local -n _arr="$1"
    local -A seen=()
    local prefix
    for key in "${!_arr[@]}"; do
        prefix="${key%%.*}"
        [[ -z "${seen[$prefix]}" ]] && { seen["$prefix"]=1; echo "$prefix"; }
    done | sort
}

# Get sorted keys matching a prefix from associative array
# Args: array_name, prefix
# Output: sorted keys matching prefix.*, one per line
_tds_get_keys_by_prefix() {
    local -n _arr="$1"
    local prefix="$2"
    printf '%s\n' "${!_arr[@]}" | grep "^${prefix}\." | sort
}

# =============================================================================
# CONFIG FILE OPERATIONS
# =============================================================================

# Load module's color config from file into its token array
# Returns: 0 on success or if no config exists, 1 on error
tds_module_load() {
    local module="$1"
    local config_file="${_TDS_MODULE_CONFIGS[$module]}"
    local array_name="${_TDS_MODULE_ARRAYS[$module]}"

    # No config file is not an error - module uses defaults
    [[ -z "$config_file" || ! -f "$config_file" ]] && return 0

    # Missing array name is an error
    if [[ -z "$array_name" ]]; then
        echo "Error: No token array registered for module '$module'" >&2
        return 1
    fi

    local -n tokens="$array_name"

    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${key// /}" ]] && continue

        # Trim whitespace
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"

        tokens["$key"]="$value"
    done < "$config_file"
}

# Save module's current tokens to config file
tds_module_save() {
    local module="$1"
    local config_file="${_TDS_MODULE_CONFIGS[$module]}"
    local array_name="${_TDS_MODULE_ARRAYS[$module]}"

    [[ -z "$config_file" || -z "$array_name" ]] && return 1

    local -n tokens="$array_name"
    local config_dir=$(dirname "$config_file")
    [[ -d "$config_dir" ]] || mkdir -p "$config_dir"

    # Generate config with header
    {
        _tds_module_header "$module"

        # Group by prefix and write
        local prefix
        while IFS= read -r prefix; do
            echo "# -----------------------------------------------------------------------------"
            echo "# ${prefix^^} TOKENS"
            echo "# -----------------------------------------------------------------------------"
            local key
            while IFS= read -r key; do
                echo "$key=${tokens[$key]}"
            done < <(_tds_get_keys_by_prefix "$array_name" "$prefix")
            echo ""
        done < <(_tds_get_prefixes "$array_name")
    } > "$config_file"

    echo "$config_file"
}

# Generate header for config file (internal)
_tds_module_header() {
    local module="$1"
    local upper="${module^^}"

    cat << EOF
# =============================================================================
# ${upper} Color Configuration
# =============================================================================
# Location: \$${upper}_DIR/config/colors.conf
#
# Edit values to customize colors. Run \`$module color show\` to preview.
#
# FORMAT: token=palette:index  (e.g., verbs:5, mode:2, env:1, nouns:3)
#         token=RRGGBB         (direct hex, e.g., FF5500)
#
# PALETTES (0-7):
#   env   - Environment: alternating A/B hue families
#   mode  - Status: [0]=error [1]=warn [2]=success [3]=info [4-7]=dim
#   verbs - Actions: rainbow (red->orange->yellow->green->cyan->blue->purple->pink)
#   nouns - Content: grayscale gradient (dark -> bright)
#
# =============================================================================

EOF
}

# Write default config if none exists
tds_module_init_config() {
    local module="$1"
    local config_file="${_TDS_MODULE_CONFIGS[$module]}"

    [[ -z "$config_file" ]] && return 1
    [[ -f "$config_file" ]] && return 0  # Already exists

    tds_module_save "$module"
}

# =============================================================================
# COLOR RESOLUTION
# =============================================================================

# Resolve palette:index or hex to hex color (always without # prefix)
_tds_resolve_ref() {
    local ref="$1"
    local result=""

    # Direct hex value (with or without #)
    if [[ "$ref" =~ ^#?([0-9A-Fa-f]{6})$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    # Palette reference: palette:index
    if [[ "$ref" =~ ^([a-z]+):([0-7])$ ]]; then
        local palette="${BASH_REMATCH[1]}"
        local index="${BASH_REMATCH[2]}"
        local palette_name="${palette^^}_PRIMARY"

        # Validate palette exists and use nameref for lookup
        if declare -p "$palette_name" &>/dev/null; then
            local -n palette_arr="$palette_name"
            result="${palette_arr[$index]:-$TDS_FALLBACK_GRAY}"
        else
            result="$TDS_FALLBACK_GRAY"
        fi
        # Strip # if present (palettes may be inconsistent)
        echo "${result#\#}"
        return
    fi

    echo "$TDS_FALLBACK_GRAY"
}

# Get hex color for a module's token
# Args: module_name, token_name
tds_module_color() {
    local module="$1"
    local token="$2"
    local array_name="${_TDS_MODULE_ARRAYS[$module]}"

    [[ -z "$array_name" ]] && { echo "$TDS_FALLBACK_GRAY"; return; }

    local -n tokens="$array_name"
    local ref="${tokens[$token]}"

    [[ -z "$ref" ]] && { echo "$TDS_FALLBACK_GRAY"; return; }

    _tds_resolve_ref "$ref"
}

# Get ANSI escape for a module's token
tds_module_escape() {
    local module="$1"
    local token="$2"
    local hex=$(tds_module_color "$module" "$token")

    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))

    printf '\e[38;2;%d;%d;%dm' "$r" "$g" "$b"
}

# Print colored text using module token
tds_module_print() {
    local module="$1"
    local token="$2"
    local text="$3"
    local hex=$(tds_module_color "$module" "$token")

    if declare -f text_color >/dev/null 2>&1; then
        text_color "$hex"
        printf "%s" "$text"
        reset_color
    else
        printf "%s" "$text"
    fi
}

# =============================================================================
# PREVIEW / SHOW
# =============================================================================

# Show all tokens for a module with color preview
tds_module_show() {
    local module="$1"
    local config_file="${_TDS_MODULE_CONFIGS[$module]}"
    local array_name="${_TDS_MODULE_ARRAYS[$module]}"

    [[ -z "$array_name" ]] && { echo "Module '$module' not registered"; return 1; }

    local -n tokens="$array_name"
    local upper="${module^^}"

    echo "$upper Color Configuration"
    printf '=%.0s' {1..60}; echo
    echo "Config: $config_file"
    echo "Theme:  ${TDS_ACTIVE_THEME:-default}"
    echo ""

    # Show palette legend with semantic conventions
    echo "Palettes:"
    for palette in env mode verbs nouns; do
        printf "  %-6s " "$palette"
        local -n parr="${palette^^}_PRIMARY"
        if [[ -n "${parr[0]:-}" ]] && declare -f text_color >/dev/null 2>&1; then
            # Show 8 color swatches
            for i in {0..7}; do
                local phex="${parr[$i]:-888888}"
                phex="${phex#\#}"
                text_color "$phex"
                printf "▪"
                reset_color
            done
            printf "  "
            # Show semantic labels in their colors
            case "$palette" in
                env)
                    for i in 0 1 2 3; do
                        text_color "${parr[$i]#\#}"; printf "A%d " "$i"; reset_color
                    done
                    for i in 4 5 6 7; do
                        text_color "${parr[$i]#\#}"; printf "B%d " "$((i-4))"; reset_color
                    done
                    ;;
                mode)
                    text_color "${parr[0]#\#}"; printf "err "; reset_color
                    text_color "${parr[1]#\#}"; printf "warn "; reset_color
                    text_color "${parr[2]#\#}"; printf "ok "; reset_color
                    text_color "${parr[3]#\#}"; printf "info "; reset_color
                    text_color "${parr[4]#\#}"; printf "1░ "; reset_color
                    text_color "${parr[5]#\#}"; printf "2▒ "; reset_color
                    text_color "${parr[6]#\#}"; printf "3▓ "; reset_color
                    text_color "${parr[7]#\#}"; printf "4█"; reset_color
                    ;;
                verbs)
                    local labels=("red" "org" "yel" "grn" "cyn" "blu" "pur" "pnk")
                    for i in {0..7}; do
                        text_color "${parr[$i]#\#}"; printf "%s " "${labels[$i]}"; reset_color
                    done
                    ;;
                nouns)
                    text_color "${parr[0]#\#}"; printf "dark "; reset_color
                    for i in 1 2 3 4 5 6; do
                        text_color "${parr[$i]#\#}"; printf "─"; reset_color
                    done
                    text_color "${parr[7]#\#}"; printf " bright"; reset_color
                    ;;
            esac
        else
            for i in {0..7}; do printf "."; done
        fi
        echo
    done
    echo ""

    # Group by prefix using helper
    local prefix key
    while IFS= read -r prefix; do
        echo "[$prefix]"
        while IFS= read -r key; do
            local ref="${tokens[$key]}"
            local hex=$(tds_module_color "$module" "$key")

            # Parse palette:index reference
            local palette_name=""
            local palette_idx=""
            if [[ "$ref" =~ ^([a-z]+):([0-7])$ ]]; then
                palette_name="${BASH_REMATCH[1]}"
                palette_idx="${BASH_REMATCH[2]}"
            fi

            printf "  %-26s " "$key"
            if declare -f text_color >/dev/null 2>&1; then
                # Column 2: color swatch
                text_color "$hex"
                printf "██"
                reset_color

                # Column 3: hex value
                printf " #%-7s " "$hex"

                # Column 4: colored reference
                text_color "$hex"
                printf "%-8s" "$ref"
                reset_color

                # Column 5: palette with position indicator
                if [[ -n "$palette_name" ]]; then
                    printf " "
                    local -n parr="${palette_name^^}_PRIMARY"
                    for i in {0..7}; do
                        local phex="${parr[$i]:-$TDS_FALLBACK_GRAY}"
                        phex="${phex#\#}"
                        text_color "$phex"
                        if [[ "$i" == "$palette_idx" ]]; then
                            printf "●"
                        else
                            printf "▪"
                        fi
                        reset_color
                    done
                fi
            else
                printf " #%-8s %s" "$hex" "$ref"
            fi
            echo
        done < <(_tds_get_keys_by_prefix "$array_name" "$prefix")
        echo ""
    done < <(_tds_get_prefixes "$array_name")
}

# =============================================================================
# CONFIG PATH
# =============================================================================

tds_module_config_path() {
    local module="$1"
    echo "${_TDS_MODULE_CONFIGS[$module]}"
}
