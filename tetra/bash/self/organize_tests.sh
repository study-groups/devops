#!/usr/bin/env bash

# Tetra Test Organizer - Reorganizes test files into proper module structure

TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$TETRA_SRC/bash/self/preflight.sh" check || exit 1

# Colors
declare -r RED='\033[0;31m'
declare -r GREEN='\033[0;32m'
declare -r BLUE='\033[0;34m'
declare -r YELLOW='\033[1;33m'
declare -r CYAN='\033[0;36m'
declare -r GRAY='\033[0;37m'
declare -r BOLD='\033[1m'
declare -r NC='\033[0m'

# Test file mappings based on filename patterns
declare -A TEST_MAPPINGS=(
    # TSM tests
    ["test_tsm_"]="tsm"
    ["test_systemd_"]="tsm"
    ["test_service_"]="tsm"
    ["test_port_"]="tsm"
    ["test_secure_"]="tsm"
    ["test_environment_"]="tsm"

    # TView tests
    ["test_tview_"]="tview"
    ["test_tdash_"]="tview"

    # Module system tests
    ["test_module_"]="core"
    ["test_organization_"]="core"
    ["test_template_"]="core"

    # Environment tests
    ["test_tetra_env_"]="env"
    ["test_env_"]="env"
)

# Analyze current test structure
analyze_test_structure() {
    echo -e "${BOLD}📊 Current Test Structure Analysis${NC}\n"

    local main_tests_dir="$TETRA_SRC/../tetra/tests"
    local module_test_files=0
    local misplaced_files=0

    echo -e "${BLUE}Main tests directory:${NC} $main_tests_dir"

    if [[ -d "$main_tests_dir" ]]; then
        echo -e "\n${YELLOW}Files in main tests directory:${NC}"
        for file in "$main_tests_dir"/*; do
            if [[ -f "$file" && "$file" == *.sh ]]; then
                local basename=$(basename "$file")
                local suggested_module=""

                # Check mapping
                for pattern in "${!TEST_MAPPINGS[@]}"; do
                    if [[ "$basename" == *"$pattern"* ]]; then
                        suggested_module="${TEST_MAPPINGS[$pattern]}"
                        break
                    fi
                done

                if [[ -n "$suggested_module" ]]; then
                    echo -e "  ${RED}📄${NC} $basename ${YELLOW}→${NC} tests/$suggested_module/"
                    ((misplaced_files++))
                else
                    echo -e "  ${GREEN}📄${NC} $basename ${GRAY}(stays in root)${NC}"
                fi
            fi
        done
    fi

    echo -e "\n${CYAN}Module-specific test directories:${NC}"
    for module_dir in "$TETRA_SRC/bash"/*/; do
        local module_name=$(basename "$module_dir")
        local tests_dir="$module_dir/tests"

        if [[ -d "$tests_dir" ]]; then
            local test_count=$(find "$tests_dir" -name "*.sh" -type f | wc -l | tr -d ' ')
            echo -e "  ${GREEN}✓${NC} $module_name/tests/ ($test_count files)"
            ((module_test_files += test_count))
        else
            echo -e "  ${GRAY}○${NC} $module_name/tests/ (missing)"
        fi
    done

    echo -e "\n${BOLD}Summary:${NC}"
    echo -e "  📊 Module test files: $module_test_files"
    echo -e "  ⚠️  Misplaced files: $misplaced_files"
}

# Create organized test structure
create_test_structure() {
    local dry_run="${1:-false}"

    echo -e "${BOLD}🏗️  Creating Organized Test Structure${NC}\n"

    # Create tests directory structure
    local tests_root="$TETRA_SRC/../tests"
    mkdir -p "$tests_root"/{tsm,tview,core,env}

    echo -e "${GREEN}Created test directories:${NC}"
    for dir in tsm tview core env; do
        echo -e "  📁 tests/$dir/"
    done

    if [[ "$dry_run" == "false" ]]; then
        # Create README files for each test category
        create_test_readme_files "$tests_root"
    fi
}

create_test_readme_files() {
    local tests_root="$1"

    # TSM tests README
    cat > "$tests_root/tsm/README.md" << 'EOF'
# TSM (Tetra Service Manager) Tests

Test suite for the core service management system.

## Test Categories:
- **Service Management**: Process lifecycle, start/stop/restart
- **Port Management**: Port allocation, conflicts, registry
- **Environment Management**: Secure env loading, validation
- **Systemd Integration**: Service file generation, management
- **Security**: Secure environment handling, validation

## Running Tests:
```bash
# Run all TSM tests
./tests/tsm/run_all.sh

# Run specific test
./tests/tsm/test_tsm_service_management.sh
```
EOF

    # TView tests README
    cat > "$tests_root/tview/README.md" << 'EOF'
# TView (Tetra View) Tests

Test suite for the interactive dashboard and UI system.

## Test Categories:
- **Navigation**: Mode switching, drill-down behavior
- **Rendering**: Display formatting, color themes
- **Integration**: Module-specific views, action handlers
- **REPL**: Command line interface, context switching

## Running Tests:
```bash
# Run all TView tests
./tests/tview/run_all.sh
```
EOF

    # Core tests README
    cat > "$tests_root/core/README.md" << 'EOF'
# Tetra Core System Tests

Test suite for core Tetra functionality.

## Test Categories:
- **Module System**: Loading, dependencies, validation
- **Organization**: File structure, naming conventions
- **Templates**: Configuration templates, validation
- **Integration**: Cross-module functionality

## Running Tests:
```bash
# Run all core tests
./tests/core/run_all.sh
```
EOF

    # Environment tests README
    cat > "$tests_root/env/README.md" << 'EOF'
# Environment Management Tests

Test suite for environment and configuration management.

## Test Categories:
- **Environment Loading**: .env files, validation
- **Security**: Secure handling, encryption
- **Templates**: Environment templates, generation
- **Integration**: Multi-environment workflows

## Running Tests:
```bash
# Run all environment tests
./tests/env/run_all.sh
```
EOF

    echo -e "${GREEN}✓${NC} Created README files for all test categories"
}

# Move files to organized structure
organize_test_files() {
    local dry_run="${1:-false}"
    local main_tests_dir="$TETRA_SRC/../tetra/tests"

    echo -e "${BOLD}📁 Organizing Test Files${NC}\n"

    if [[ ! -d "$main_tests_dir" ]]; then
        echo -e "${RED}Tests directory not found: $main_tests_dir${NC}"
        return 1
    fi

    create_test_structure "$dry_run"

    local moved_count=0

    for file in "$main_tests_dir"/*.sh; do
        if [[ -f "$file" ]]; then
            local basename=$(basename "$file")
            local target_subdir=""

            # Determine target directory
            for pattern in "${!TEST_MAPPINGS[@]}"; do
                if [[ "$basename" == *"$pattern"* ]]; then
                    target_subdir="${TEST_MAPPINGS[$pattern]}"
                    break
                fi
            done

            if [[ -n "$target_subdir" ]]; then
                local target_dir="$main_tests_dir/$target_subdir"
                local target_file="$target_dir/$basename"

                echo -e "${CYAN}Moving:${NC} $basename ${YELLOW}→${NC} tests/$target_subdir/"

                if [[ "$dry_run" == "true" ]]; then
                    echo -e "  ${GRAY}[DRY RUN]${NC} Would move: $file → $target_file"
                else
                    mv "$file" "$target_file"
                    ((moved_count++))
                fi
            else
                echo -e "${GREEN}Keep:${NC} $basename ${GRAY}(in root)${NC}"
            fi
        fi
    done

    if [[ "$dry_run" == "false" ]]; then
        echo -e "\n${GREEN}✓${NC} Moved $moved_count test files"
    else
        echo -e "\n${YELLOW}[DRY RUN]${NC} Would move $moved_count test files"
    fi
}

# Generate test runner scripts
generate_test_runners() {
    local tests_root="$TETRA_SRC/../tests"

    echo -e "${BOLD}🔧 Generating Test Runner Scripts${NC}\n"

    for category in tsm tview core env; do
        local category_dir="$tests_root/$category"
        local runner_script="$category_dir/run_all.sh"

        cat > "$runner_script" << EOF
#!/usr/bin/env bash

# ${category^^} Test Runner - Auto-generated by tetra-test-organizer.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PASSED=0
FAILED=0
TOTAL=0

echo -e "\${BOLD}🧪 Running ${category^^} Tests\${NC}\n"

for test_file in "\$SCRIPT_DIR"/test_*.sh; do
    if [[ -f "\$test_file" ]]; then
        test_name=\$(basename "\$test_file")
        echo -e "\${YELLOW}Running:\${NC} \$test_name"

        ((TOTAL++))

        if "\$test_file"; then
            echo -e "\${GREEN}✓ PASS:\${NC} \$test_name"
            ((PASSED++))
        else
            echo -e "\${RED}✗ FAIL:\${NC} \$test_name"
            ((FAILED++))
        fi

        echo ""
    fi
done

echo -e "\${BOLD}📊 ${category^^} Test Results:\${NC}"
echo -e "  Total: \$TOTAL"
echo -e "  \${GREEN}Passed: \$PASSED\${NC}"
echo -e "  \${RED}Failed: \$FAILED\${NC}"

if [[ \$FAILED -eq 0 ]]; then
    echo -e "\n\${GREEN}\${BOLD}🎉 All ${category^^} tests passed!\${NC}"
    exit 0
else
    echo -e "\n\${RED}\${BOLD}❌ Some ${category^^} tests failed.\${NC}"
    exit 1
fi
EOF

        chmod +x "$runner_script"
        echo -e "${GREEN}✓${NC} Created test runner: tests/$category/run_all.sh"
    done
}

# Interactive mode
interactive_mode() {
    while true; do
        clear
        echo -e "${BOLD}🧪 Tetra Test Organizer${NC}\n"

        analyze_test_structure

        echo -e "\n${CYAN}Actions:${NC}"
        echo "  1. Organize test files (move to proper directories)"
        echo "  2. Create test structure only (no file moves)"
        echo "  3. Generate test runner scripts"
        echo "  4. Dry run (preview changes)"
        echo "  5. Full reorganization (structure + files + runners)"
        echo "  q. Quit"

        read -p $'\n> ' choice

        case "$choice" in
            1)
                organize_test_files false
                read -p $'\nPress Enter to continue...'
                ;;
            2)
                create_test_structure false
                read -p $'\nPress Enter to continue...'
                ;;
            3)
                generate_test_runners
                read -p $'\nPress Enter to continue...'
                ;;
            4)
                organize_test_files true
                read -p $'\nPress Enter to continue...'
                ;;
            5)
                organize_test_files false
                generate_test_runners
                echo -e "\n${GREEN}✓${NC} Full reorganization complete!"
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
    "analyze"|"audit")
        analyze_test_structure
        ;;
    "organize")
        organize_test_files "${2:-false}"
        ;;
    "structure")
        create_test_structure "${2:-false}"
        ;;
    "runners")
        generate_test_runners
        ;;
    "full")
        organize_test_files false
        generate_test_runners
        ;;
    "interactive")
        interactive_mode
        ;;
    *)
        echo "Usage: $0 [analyze|organize|structure|runners|full|interactive] [dry_run]"
        echo "  analyze     - Show current test structure"
        echo "  organize    - Move test files to proper directories"
        echo "  structure   - Create organized directory structure"
        echo "  runners     - Generate test runner scripts"
        echo "  full        - Complete reorganization"
        echo "  interactive - Interactive mode (default)"
        ;;
esac