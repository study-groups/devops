#!/usr/bin/env bash
# Chroma - Plugin configuration system
# Part of the chroma modular markdown renderer

# Configuration storage: "plugin.option" → value
declare -gA CHROMA_CONFIG=()

# Configuration metadata: "plugin.option" → "default|description"
declare -gA CHROMA_CONFIG_META=()

# Declare a configuration option with default value
# Usage: chroma_config_declare <plugin> <option> <default> [description]
chroma_config_declare() {
    local plugin="$1"
    local option="$2"
    local default="$3"
    local desc="${4:-}"

    [[ -z "$plugin" || -z "$option" ]] && {
        echo "Usage: chroma_config_declare <plugin> <option> <default> [description]" >&2
        return 1
    }

    local key="${plugin}.${option}"

    # Store metadata (default and description)
    CHROMA_CONFIG_META["$key"]="${default}|${desc}"

    # Set default if not already configured
    [[ -z "${CHROMA_CONFIG[$key]+x}" ]] && CHROMA_CONFIG["$key"]="$default"

    return 0
}

# Get a configuration value
# Usage: chroma_config_get <plugin> <option> [default]
# Returns: value via stdout, or default if not set
chroma_config_get() {
    local plugin="$1"
    local option="$2"
    local default="${3:-}"

    local key="${plugin}.${option}"

    if [[ -n "${CHROMA_CONFIG[$key]+x}" ]]; then
        echo "${CHROMA_CONFIG[$key]}"
    elif [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]]; then
        # Return declared default
        echo "${CHROMA_CONFIG_META[$key]%%|*}"
    else
        echo "$default"
    fi
}

# Set a configuration value
# Usage: chroma_config_set <plugin> <option> <value>
chroma_config_set() {
    local plugin="$1"
    local option="$2"
    local value="$3"

    [[ -z "$plugin" || -z "$option" ]] && {
        echo "Usage: chroma_config_set <plugin> <option> <value>" >&2
        return 1
    }

    local key="${plugin}.${option}"
    CHROMA_CONFIG["$key"]="$value"
    return 0
}

# Reset a configuration option to its default
# Usage: chroma_config_reset <plugin> <option>
chroma_config_reset() {
    local plugin="$1"
    local option="$2"
    local key="${plugin}.${option}"

    if [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]]; then
        local default="${CHROMA_CONFIG_META[$key]%%|*}"
        CHROMA_CONFIG["$key"]="$default"
        return 0
    else
        unset "CHROMA_CONFIG[$key]"
        return 1
    fi
}

# List all configuration options
chroma_config_list() {
    echo
    echo "Chroma Configuration"
    echo

    if [[ ${#CHROMA_CONFIG_META[@]} -eq 0 && ${#CHROMA_CONFIG[@]} -eq 0 ]]; then
        echo "  (no configuration options declared)"
        echo
        return
    fi

    # Collect unique plugins
    local -A plugins=()
    for key in "${!CHROMA_CONFIG_META[@]}" "${!CHROMA_CONFIG[@]}"; do
        plugins["${key%%.*}"]=1
    done

    # Show config by plugin
    for plugin in "${!plugins[@]}"; do
        echo "[$plugin]"

        # Find all options for this plugin
        for key in "${!CHROMA_CONFIG_META[@]}"; do
            [[ "${key%%.*}" != "$plugin" ]] && continue

            local option="${key#*.}"
            local meta="${CHROMA_CONFIG_META[$key]}"
            local default="${meta%%|*}"
            local desc="${meta#*|}"
            local current="${CHROMA_CONFIG[$key]:-$default}"

            # Show option with current value and default
            printf "  %-20s = %-15s" "$option" "$current"
            if [[ "$current" != "$default" ]]; then
                printf " (default: %s)" "$default"
            fi
            if [[ -n "$desc" ]]; then
                printf "\n  %-20s   %s" "" "$desc"
            fi
            echo
        done

        # Show any undeclared config for this plugin
        for key in "${!CHROMA_CONFIG[@]}"; do
            [[ "${key%%.*}" != "$plugin" ]] && continue
            [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]] && continue

            local option="${key#*.}"
            local current="${CHROMA_CONFIG[$key]}"
            printf "  %-20s = %s (custom)\n" "$option" "$current"
        done
        echo
    done
}

# Save configuration to file
# Usage: chroma_config_save [file]
chroma_config_save() {
    local config_file="${1:-${CHROMA_CONFIG_FILE:-${TETRA_DIR:-$HOME/tetra}/chroma/config.sh}}"
    local config_dir=$(dirname "$config_file")

    [[ -d "$config_dir" ]] || mkdir -p "$config_dir"

    {
        echo "#!/usr/bin/env bash"
        echo "# Chroma configuration - auto-generated"
        echo "# $(date)"
        echo

        for key in "${!CHROMA_CONFIG[@]}"; do
            # Quote value properly
            printf 'CHROMA_CONFIG[%q]=%q\n' "$key" "${CHROMA_CONFIG[$key]}"
        done
    } > "$config_file"

    echo "Configuration saved to: $config_file"
}

# Load configuration from file
# Usage: chroma_config_load [file]
chroma_config_load() {
    local config_file="${1:-${CHROMA_CONFIG_FILE:-${TETRA_DIR:-$HOME/tetra}/chroma/config.sh}}"

    [[ -f "$config_file" ]] || return 0

    source "$config_file"
    return 0
}

# Show single config value
# Usage: chroma_config_show <plugin.option>
chroma_config_show() {
    local key="$1"

    if [[ "$key" == *.* ]]; then
        local plugin="${key%%.*}"
        local option="${key#*.}"

        if [[ -n "${CHROMA_CONFIG[$key]+x}" ]]; then
            echo "${CHROMA_CONFIG[$key]}"
        elif [[ -n "${CHROMA_CONFIG_META[$key]+x}" ]]; then
            echo "${CHROMA_CONFIG_META[$key]%%|*}"
        else
            echo "Config not found: $key" >&2
            return 1
        fi
    else
        echo "Invalid key format. Use: plugin.option" >&2
        return 1
    fi
}
