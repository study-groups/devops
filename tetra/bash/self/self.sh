#!/usr/bin/env bash
# tetra-self: Main entry point for self-management module

# Main command router
tetra-self() {
    local command="$1"
    shift

    case "$command" in
        clean)
            _tetra_self_clean "$@"
            ;;
        audit)
            if [[ "$1" == "--modules" ]]; then
                bash "$MOD_SRC/audit_modules.sh"
            else
                _tetra_self_audit "$@"
            fi
            ;;
        modules)
            _tetra_self_modules "$@"
            ;;
        legacy)
            _tetra_self_legacy "$@"
            ;;
        organize)
            _tetra_self_organize "$@"
            ;;
        preflight)
            _tetra_self_preflight "$@"
            ;;
        dev)
            _tetra_self_dev "$@"
            ;;
        lint)
            _tetra_self_lint "$@"
            ;;
        install)
            _tetra_self_install "$@"
            ;;

        upgrade)
            _tetra_self_upgrade "$@"
            ;;
        backup)
            _tetra_self_backup "$@"
            ;;
        restore)
            _tetra_self_restore "$@"
            ;;
        help|--help|-h)
            _tetra_self_help
            ;;
        *)
            echo "Error: Unknown command: $command"
            echo ""
            _tetra_self_help
            return 1
            ;;
    esac
}

# Help text with optional TDS colorization
_tetra_self_help() {
    # Check if TDS is available
    local use_color=false
    if type tds_color &>/dev/null; then
        use_color=true
    fi

    # Helper functions for conditional coloring
    _c_h1() { if $use_color; then tds_color "content.heading.h1" "$1"; else echo "$1"; fi; }
    _c_h2() { if $use_color; then tds_color "content.heading.h2" "$1"; else echo "$1"; fi; }
    _c_cmd() { if $use_color; then tds_color "content.code.inline" "$1"; else echo "$1"; fi; }
    _c_opt() { if $use_color; then tds_color "warning" "$1"; else echo "$1"; fi; }
    _c_text() { if $use_color; then tds_color "text.secondary" "$1"; else echo "$1"; fi; }
    _c_example() { if $use_color; then tds_color "info" "$1"; else echo "$1"; fi; }

    echo ""
    _c_h1 "tetra-self: Self-Management Module"
    echo ""
    echo ""

    _c_h2 "USAGE:"
    echo "    $(_c_cmd "tetra-self") <command> [options]"
    echo ""

    _c_h2 "FILE MANAGEMENT:"
    echo "    $(_c_cmd "audit")           $(_c_text "Categorize and report all files in TETRA_DIR")"
    echo "                    Options: $(_c_opt "[--detail] [--modules]")"
    echo "                    --modules: Audit module completeness (L1-L4)"
    echo ""
    echo "    $(_c_cmd "clean")           $(_c_text "Remove testing/experimental files")"
    echo "                    Options: $(_c_opt "[--dry-run] [--purge]")"
    echo ""
    echo "    $(_c_cmd "organize tests")  $(_c_text "Reorganize test files into module structure")"
    echo "                    Options: $(_c_opt "[analyze|organize|full]")"
    echo ""

    _c_h2 "MODULE MANAGEMENT:"
    echo "    $(_c_cmd "modules list")    $(_c_text "List all registered modules with status")"
    echo "    $(_c_cmd "modules index")   $(_c_text "Rebuild module metadata index")"
    echo ""
    echo "    $(_c_cmd "legacy list")     $(_c_text "Show legacy/experimental/deprecated modules")"
    echo "    $(_c_cmd "legacy classify") $(_c_text "Classify and move modules by type")"
    echo ""
    echo "    $(_c_cmd "dev list")        $(_c_text "List development modules")"
    echo "    $(_c_cmd "dev register")    $(_c_text "Register development modules")"
    echo ""

    _c_h2 "CODE QUALITY:"
    echo "    $(_c_cmd "lint")            $(_c_text "Run code quality checks (default: all)")"
    echo "                    Options: $(_c_opt "[orphans|structure|dead|deps|git|status|all]")"
    echo "                    orphans: Find misplaced .sh files"
    echo "                    structure: Validate directory structure"
    echo "                    dead: Detect unused modules"
    echo "                    deps: Validate TETRA_SRC usage"
    echo "                    git: Show git status"
    echo "                    status: Health summary"
    echo ""

    _c_h2 "SYSTEM:"
    echo "    $(_c_cmd "preflight")       $(_c_text "Validate TETRA_DIR/TETRA_SRC environment")"
    echo "                    Options: $(_c_opt "[check|fix]")"
    echo ""
    echo "    $(_c_cmd "install")         $(_c_text "Verify tetra installation and bootstrap")"
    echo ""
    echo "    $(_c_cmd "upgrade")         $(_c_text "Update tetra from source (requires git repo)")"
    echo ""

    _c_h2 "BACKUP/RESTORE:"
    echo "    $(_c_cmd "backup")          $(_c_text "Create compressed backup of TETRA_DIR")"
    echo "                    Options: $(_c_opt "[--exclude-runtime] [--include-source]")"
    echo ""
    echo "    $(_c_cmd "restore") <file>  $(_c_text "Restore TETRA_DIR from backup tarball")"
    echo ""

    _c_h2 "EXAMPLES:"
    echo "    $(_c_example "tetra-self audit --modules")         # Audit module completeness"
    echo "    $(_c_example "tetra-self modules list")            # List all modules"
    echo "    $(_c_example "tetra-self legacy list")             # Show legacy modules"
    echo "    $(_c_example "tetra-self organize tests analyze")  # Analyze test structure"
    echo "    $(_c_example "tetra-self lint")                    # Run all code quality checks"
    echo "    $(_c_example "tetra-self lint orphans")            # Find orphaned files"
    echo "    $(_c_example "tetra-self lint status")             # Quick health summary"
    echo "    $(_c_example "tetra-self preflight check")         # Validate environment"
    echo "    $(_c_example "tetra-self dev list")                # List development modules"
    echo "    $(_c_example "tetra-self clean --dry-run")         # Preview cleanup"
    echo "    $(_c_example "tetra-self backup")                  # Create full backup"
    echo ""

    if $use_color; then
        echo "See $(_c_cmd "bash/self/README.md") for complete documentation."
    else
        echo "See bash/self/README.md for complete documentation."
    fi
    echo ""
}

# Implementation functions delegated to specialized files:
# - _tetra_self_audit     → audit.sh
# - _tetra_self_clean     → clean.sh
# - _tetra_self_install   → install.sh
# - _tetra_self_upgrade   → install.sh
# - _tetra_self_backup    → backup.sh
# - _tetra_self_restore   → backup.sh
# - _tetra_self_modules   → module management (below)
# - _tetra_self_legacy    → legacy module management (below)
# - _tetra_self_organize  → test organization (below)
# - _tetra_self_preflight → environment validation (below)
# - _tetra_self_dev       → dev module management (below)

# Module management command
_tetra_self_modules() {
    local subcommand="$1"
    shift

    case "$subcommand" in
        list)
            tetra_module_list "$@"
            ;;
        index)
            echo "Rebuilding module index..."
            tetra_load_module_index
            echo "Module index rebuilt"
            ;;
        *)
            echo "Usage: tetra-self modules <list|index>"
            return 1
            ;;
    esac
}

# Legacy module management command
_tetra_self_legacy() {
    local subcommand="$1"
    shift

    case "$subcommand" in
        list|show)
            bash "$MOD_SRC/legacy.sh" show
            ;;
        classify|move)
            bash "$MOD_SRC/legacy.sh" "$subcommand" "$@"
            ;;
        *)
            echo "Usage: tetra-self legacy <list|classify>"
            bash "$MOD_SRC/legacy.sh" show
            ;;
    esac
}

# Test organization command
_tetra_self_organize() {
    local subcommand="$1"
    shift

    case "$subcommand" in
        tests)
            bash "$MOD_SRC/organize_tests.sh" "$@"
            ;;
        *)
            echo "Usage: tetra-self organize tests [analyze|organize|full]"
            return 1
            ;;
    esac
}

# Preflight environment check
_tetra_self_preflight() {
    bash "$MOD_SRC/preflight.sh" "$@"
}

# Dev module management
_tetra_self_dev() {
    local subcommand="$1"
    shift

    case "$subcommand" in
        list)
            tetra_list_dev_modules
            ;;
        register)
            tetra_register_dev_modules
            ;;
        *)
            echo "Usage: tetra-self dev <list|register>"
            tetra_list_dev_modules
            ;;
    esac
}

# Lint/code quality checks
_tetra_self_lint() {
    local subcommand="${1:-all}"
    shift

    case "$subcommand" in
        orphans)
            _tetra_self_lint_orphans "$@"
            ;;
        structure)
            _tetra_self_lint_structure "$@"
            ;;
        dead)
            _tetra_self_lint_dead "$@"
            ;;
        deps)
            _tetra_self_lint_deps "$@"
            ;;
        git)
            _tetra_self_lint_git "$@"
            ;;
        status)
            _tetra_self_lint_status "$@"
            ;;
        all|"")
            _tetra_self_lint_all "$@"
            ;;
        *)
            echo "Usage: tetra-self lint [orphans|structure|dead|deps|git|status|all]"
            return 1
            ;;
    esac
}

# TAS executor wrappers (match expected naming pattern: self_action)
self_audit() { _tetra_self_audit "$@"; }
self_clean() { _tetra_self_clean "$@"; }
self_install() { _tetra_self_install "$@"; }
self_upgrade() { _tetra_self_upgrade "$@"; }
self_backup() { _tetra_self_backup "$@"; }
self_restore() { _tetra_self_restore "$@"; }
self_modules() { _tetra_self_modules "$@"; }
self_legacy() { _tetra_self_legacy "$@"; }
self_organize() { _tetra_self_organize "$@"; }
self_preflight() { _tetra_self_preflight "$@"; }
self_dev() { _tetra_self_dev "$@"; }
self_lint() { _tetra_self_lint "$@"; }

# Export main function
export -f tetra-self
export -f _tetra_self_help

# Export implementation functions
export -f _tetra_self_modules
export -f _tetra_self_legacy
export -f _tetra_self_organize
export -f _tetra_self_preflight
export -f _tetra_self_dev
export -f _tetra_self_lint

# Export TAS wrappers
export -f self_audit
export -f self_clean
export -f self_install
export -f self_upgrade
export -f self_backup
export -f self_restore
export -f self_modules
export -f self_legacy
export -f self_organize
export -f self_preflight
export -f self_dev
export -f self_lint
