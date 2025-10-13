#!/usr/bin/env bash

# Tetra Module Configuration System
# Manages persistent module enable/disable state

TETRA_MODULE_CONFIG_DIR="${TETRA_DIR}/config"
TETRA_MODULE_CONFIG_FILE="${TETRA_MODULE_CONFIG_DIR}/modules.conf"

# Essential modules that are always loaded
TETRA_ESSENTIAL_MODULES=(
    "utils"
    "prompt"
)

# Available optional modules
TETRA_OPTIONAL_MODULES=(
    "tmod"
    "pb"
    "tsm"
    "tkm"
    "nvm"
    "python"
    "sync"
    "ssh"
    "node"
    "enc"
    "deploy"
    "rag"
    "spaces"
)

# Initialize module config if it doesn't exist
tetra_module_config_init() {
    mkdir -p "$TETRA_MODULE_CONFIG_DIR"

    if [[ ! -f "$TETRA_MODULE_CONFIG_FILE" ]]; then
        cat > "$TETRA_MODULE_CONFIG_FILE" <<EOF
# Tetra Module Configuration
# Format: module_name=on|off (also accepts: true/false, enabled/disabled, yes/no)
# Essential modules (utils, prompt) are always on

# Optional modules - customize as needed
tmod=on
pb=off
tsm=on
tkm=off
nvm=on
python=on
sync=off
ssh=off
node=on
enc=off
deploy=off
EOF
        echo "📄 Created module config: $TETRA_MODULE_CONFIG_FILE"
    fi
}

# Normalize module state to on/off
tetra_normalize_module_state() {
    local state="$1"
    case "${state,,}" in  # Convert to lowercase
        on|true|enabled|yes|1)
            echo "on"
            ;;
        off|false|disabled|no|0)
            echo "off"
            ;;
        *)
            echo "off"  # Default to off for unknown values
            ;;
    esac
}

# Check if a module is enabled
tetra_module_is_enabled() {
    local module="$1"

    # Essential modules are always enabled
    for essential in "${TETRA_ESSENTIAL_MODULES[@]}"; do
        [[ "$module" == "$essential" ]] && return 0
    done

    # Check config file for optional modules
    if [[ -f "$TETRA_MODULE_CONFIG_FILE" ]]; then
        local config_line=$(grep "^${module}=" "$TETRA_MODULE_CONFIG_FILE" 2>/dev/null)
        if [[ -n "$config_line" ]]; then
            local state="${config_line#*=}"  # Extract value after =
            local normalized=$(tetra_normalize_module_state "$state")
            [[ "$normalized" == "on" ]] && return 0
        fi
    fi

    return 1
}

# Enable a module
tetra_module_enable() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tetra module enable <module_name>"
        return 1
    fi

    # Check if module exists
    local module_valid=false
    for optional in "${TETRA_OPTIONAL_MODULES[@]}"; do
        if [[ "$module" == "$optional" ]]; then
            module_valid=true
            break
        fi
    done

    if [[ "$module_valid" == "false" ]]; then
        echo "❌ Unknown module: $module"
        echo "Available modules: ${TETRA_OPTIONAL_MODULES[*]}"
        return 1
    fi

    tetra_module_config_init

    # Update config file
    if grep -q "^${module}=" "$TETRA_MODULE_CONFIG_FILE"; then
        # Update existing line
        sed -i.bak "s/^${module}=.*/${module}=on/" "$TETRA_MODULE_CONFIG_FILE"
        rm -f "${TETRA_MODULE_CONFIG_FILE}.bak"
    else
        # Add new line
        echo "${module}=on" >> "$TETRA_MODULE_CONFIG_FILE"
    fi

    echo "✅ Module '$module' enabled (will load on next tetra session)"
}

# Disable a module
tetra_module_disable() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tetra module disable <module_name>"
        return 1
    fi

    # Cannot disable essential modules
    for essential in "${TETRA_ESSENTIAL_MODULES[@]}"; do
        if [[ "$module" == "$essential" ]]; then
            echo "❌ Cannot disable essential module: $module"
            return 1
        fi
    done

    tetra_module_config_init

    # Update config file
    if grep -q "^${module}=" "$TETRA_MODULE_CONFIG_FILE"; then
        sed -i.bak "s/^${module}=.*/${module}=off/" "$TETRA_MODULE_CONFIG_FILE"
        rm -f "${TETRA_MODULE_CONFIG_FILE}.bak"
        echo "✅ Module '$module' disabled (will not load on next tetra session)"
    else
        echo "⚠️  Module '$module' not found in config"
    fi
}

# List all modules and their status
tetra_module_list() {
    tetra_module_config_init

    echo "=== Tetra Modules ==="
    echo

    printf "%-12s %-10s %s\n" "MODULE" "STATUS" "TYPE"
    printf "%-12s %-10s %s\n" "------" "------" "----"

    # Show essential modules
    for module in "${TETRA_ESSENTIAL_MODULES[@]}"; do
        printf "%-12s %-10s %s\n" "$module" "on" "essential"
    done

    # Show optional modules
    for module in "${TETRA_OPTIONAL_MODULES[@]}"; do
        if tetra_module_is_enabled "$module"; then
            printf "%-12s %-10s %s\n" "$module" "on" "optional"
        else
            printf "%-12s %-10s %s\n" "$module" "off" "optional"
        fi
    done

    echo
    echo "💡 Use 'tetra module enable/disable <name>' to change settings"
    echo "📄 Config file: $TETRA_MODULE_CONFIG_FILE"
}

# Get list of enabled modules for loading
tetra_get_enabled_modules() {
    tetra_module_config_init

    local enabled_modules=()

    # Add essential modules
    enabled_modules+=("${TETRA_ESSENTIAL_MODULES[@]}")

    # Add enabled optional modules
    for module in "${TETRA_OPTIONAL_MODULES[@]}"; do
        if tetra_module_is_enabled "$module"; then
            enabled_modules+=("$module")
        fi
    done

    printf '%s\n' "${enabled_modules[@]}"
}