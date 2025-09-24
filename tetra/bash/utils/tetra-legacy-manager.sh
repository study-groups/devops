#!/usr/bin/env bash

# Tetra Legacy Module Manager
# Organizes legacy, experimental, and deprecated modules

source "$HOME/src/devops/tetra/bash/utils/tetra-pre-flight-check.sh" check || exit 1

# Colors
declare -r RED='\033[0;31m'
declare -r GREEN='\033[0;32m'
declare -r BLUE='\033[0;34m'
declare -r YELLOW='\033[1;33m'
declare -r CYAN='\033[0;36m'
declare -r GRAY='\033[0;37m'
declare -r BOLD='\033[1m'
declare -r NC='\033[0m'

# Module classifications (must match module_discovery.sh)
declare -A MODULE_TYPES=(
    # Core modules
    ["tsm"]="core"
    ["tview"]="core"
    ["git"]="core"
    ["ssh"]="core"
    ["enc"]="core"
    ["deploy"]="core"
    ["nginx"]="core"
    ["sync"]="core"
    ["sys"]="core"

    # Extensions
    ["agents"]="extension"
    ["hotrod"]="extension"
    ["reporting"]="extension"

    # Legacy modules (the ones to potentially move)
    ["pb"]="legacy"
    ["node"]="legacy"
    ["pico"]="legacy"
    ["pm"]="legacy"
    ["tmux"]="legacy"
    ["user"]="legacy"

    # Experimental
    ["anthropic"]="experimental"
    ["claude"]="experimental"
    ["melvin"]="experimental"
    ["nvm"]="experimental"
    ["paste"]="experimental"
    ["pbvm"]="experimental"
    ["ml"]="experimental"

    # Deprecated
    ["wip"]="deprecated"
    ["graveyard"]="deprecated"
)

# Show current module organization
show_current_organization() {
    echo -e "${BOLD}📦 Current Tetra Module Organization${NC}\n"

    local ast_data
    ast_data="$($TETRA_SRC/bash/ast/module_discovery.sh discover)"

    for type in core extension legacy experimental deprecated plugin; do
        local modules
        modules=$(echo "$ast_data" | jq -r ".modules | to_entries[] | select(.value.type == \"$type\") | .key" | sort)

        if [[ -n "$modules" ]]; then
            local count=$(echo "$modules" | wc -l | tr -d ' ')
            case "$type" in
                "core") echo -e "${BLUE}🔧 Core ($count):${NC}" ;;
                "extension") echo -e "${GREEN}🔌 Extensions ($count):${NC}" ;;
                "legacy") echo -e "${YELLOW}📚 Legacy ($count):${NC}" ;;
                "experimental") echo -e "${CYAN}🧪 Experimental ($count):${NC}" ;;
                "deprecated") echo -e "${GRAY}🗑️  Deprecated ($count):${NC}" ;;
                "plugin") echo -e "${NC}⚙️  Plugins ($count):${NC}" ;;
            esac

            while IFS= read -r module; do
                [[ -n "$module" ]] && echo "  - $module"
            done <<< "$modules"
            echo
        fi
    done
}

# Create legacy directory structure
create_legacy_structure() {
    echo -e "${BOLD}🏗️  Creating legacy directory structure...${NC}\n"

    # Create legacy directories
    mkdir -p "$TETRA_SRC/bash/legacy"
    mkdir -p "$TETRA_SRC/bash/experimental"
    mkdir -p "$TETRA_SRC/bash/deprecated"

    # Create README files
    cat > "$TETRA_SRC/bash/legacy/README.md" << 'EOF'
# Legacy Modules

These modules are **legacy** - they work but are no longer actively developed or recommended for new use.

They are kept for backward compatibility but may be removed in future versions.

## Modules in this directory:
- **pb**, **pbvm** - Process management (replaced by TSM)
- **pm** - Package management (replaced by system package managers)
- **tmux** - Terminal multiplexer integration
- **user** - User management utilities
- **node** - Node.js utilities (replaced by dedicated tooling)
- **pico** - Micro framework (experimental phase ended)

## Migration Guide:
- For process management: Use `tsm` instead of `pb`/`pbvm`
- For package management: Use system package managers directly
- For Node.js: Use `nvm` and modern Node tooling
EOF

    cat > "$TETRA_SRC/bash/experimental/README.md" << 'EOF'
# Experimental Modules

These modules are **experimental** - they may change significantly or be removed.

Use at your own risk in production environments.

## Modules in this directory:
- **anthropic**, **claude** - AI integration experiments
- **ml** - Machine learning utilities
- **nvm** - Node version management
- **paste** - Clipboard management
EOF

    echo -e "${GREEN}✓${NC} Directory structure created"
}

# Move modules to appropriate directories
move_modules() {
    local target_type="$1"
    local dry_run="${2:-false}"

    echo -e "${BOLD}📁 Moving $target_type modules...${NC}\n"

    local moved_count=0

    for module in "${!MODULE_TYPES[@]}"; do
        if [[ "${MODULE_TYPES[$module]}" == "$target_type" ]]; then
            local source_dir="$TETRA_SRC/bash/$module"
            local target_dir="$TETRA_SRC/bash/$target_type/$module"

            if [[ -d "$source_dir" ]]; then
                echo -e "${CYAN}Moving:${NC} $module → bash/$target_type/"

                if [[ "$dry_run" == "true" ]]; then
                    echo "  [DRY RUN] Would move: $source_dir → $target_dir"
                else
                    mv "$source_dir" "$target_dir"
                    ((moved_count++))
                fi
            else
                echo -e "${GRAY}Skip:${NC} $module (directory not found)"
            fi
        fi
    done

    if [[ "$dry_run" == "false" ]]; then
        echo -e "\n${GREEN}✓${NC} Moved $moved_count $target_type modules"
    else
        echo -e "\n${YELLOW}[DRY RUN]${NC} Would move $moved_count $target_type modules"
    fi
}

# Restore modules from organized directories
restore_modules() {
    local source_type="$1"
    local dry_run="${2:-false}"

    echo -e "${BOLD}↩️  Restoring $source_type modules...${NC}\n"

    local source_base="$TETRA_SRC/bash/$source_type"
    local restored_count=0

    if [[ -d "$source_base" ]]; then
        for module_dir in "$source_base"/*/; do
            if [[ -d "$module_dir" ]]; then
                local module_name=$(basename "$module_dir")
                local target_dir="$TETRA_SRC/bash/$module_name"

                echo -e "${CYAN}Restoring:${NC} $module_name ← bash/$source_type/"

                if [[ "$dry_run" == "true" ]]; then
                    echo "  [DRY RUN] Would restore: $module_dir → $target_dir"
                else
                    mv "$module_dir" "$target_dir"
                    ((restored_count++))
                fi
            fi
        done

        if [[ "$dry_run" == "false" ]]; then
            echo -e "\n${GREEN}✓${NC} Restored $restored_count modules from $source_type"
            # Remove empty directory
            rmdir "$source_base" 2>/dev/null || true
        else
            echo -e "\n${YELLOW}[DRY RUN]${NC} Would restore $restored_count modules from $source_type"
        fi
    else
        echo -e "${GRAY}No $source_type directory found${NC}"
    fi
}

# Interactive mode
interactive_mode() {
    while true; do
        clear
        echo -e "${BOLD}🗂️  Tetra Legacy Module Manager${NC}\n"

        show_current_organization

        echo -e "${CYAN}Actions:${NC}"
        echo "  1. Move legacy modules to legacy/"
        echo "  2. Move experimental modules to experimental/"
        echo "  3. Move deprecated modules to deprecated/"
        echo "  4. Create directory structure only"
        echo "  5. Restore modules from organized directories"
        echo "  6. Dry run (preview changes)"
        echo "  q. Quit"

        read -p $'\n> ' choice

        case "$choice" in
            1)
                create_legacy_structure
                move_modules "legacy"
                read -p $'\nPress Enter to continue...'
                ;;
            2)
                create_legacy_structure
                move_modules "experimental"
                read -p $'\nPress Enter to continue...'
                ;;
            3)
                create_legacy_structure
                move_modules "deprecated"
                read -p $'\nPress Enter to continue...'
                ;;
            4)
                create_legacy_structure
                read -p $'\nPress Enter to continue...'
                ;;
            5)
                echo "Restore from which directory?"
                echo "  1. legacy"
                echo "  2. experimental"
                echo "  3. deprecated"
                read -p "> " restore_choice
                case "$restore_choice" in
                    1) restore_modules "legacy" ;;
                    2) restore_modules "experimental" ;;
                    3) restore_modules "deprecated" ;;
                esac
                read -p $'\nPress Enter to continue...'
                ;;
            6)
                echo "Dry run for which type?"
                echo "  1. legacy"
                echo "  2. experimental"
                echo "  3. deprecated"
                read -p "> " dry_choice
                case "$dry_choice" in
                    1) move_modules "legacy" true ;;
                    2) move_modules "experimental" true ;;
                    3) move_modules "deprecated" true ;;
                esac
                read -p $'\nPress Enter to continue...'
                ;;
            q)
                break
                ;;
        esac
    done
}

# Main execution
case "${1:-interactive}" in
    "show")
        show_current_organization
        ;;
    "move")
        create_legacy_structure
        move_modules "${2:-legacy}" "${3:-false}"
        ;;
    "restore")
        restore_modules "${2:-legacy}" "${3:-false}"
        ;;
    "interactive")
        interactive_mode
        ;;
    *)
        echo "Usage: $0 [show|move|restore|interactive] [type] [dry_run]"
        echo "  show        - Display current module organization"
        echo "  move        - Move modules by type (legacy|experimental|deprecated)"
        echo "  restore     - Restore modules from organized directories"
        echo "  interactive - Interactive management (default)"
        ;;
esac