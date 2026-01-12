#!/usr/bin/env bash
# tdocs.sh - Main dispatcher for tdocs v2
#
# Commands:
#   mount   - manage mount points
#   ls      - list documents (→ slot 0)
#   view    - view document by reference
#   tag     - add tags to document
#   untag   - remove tags
#   tags    - list all tags
#   tagged  - find docs with tag
#   slots   - show slot info
#   help    - show help

_tdocs_help() {
    cat << 'EOF'
tdocs v2 - Minimal document management

MOUNT POINTS
  tdocs mount add <path> [name]   Add a mount point
  tdocs mount rm <name>           Remove mount point
  tdocs mount ls                  List mounts
  tdocs mount enable <name>       Enable mount
  tdocs mount disable <name>      Disable mount

LISTING
  tdocs ls                        List all docs → slot 0
  tdocs ls --mount <name>         List from specific mount
  tdocs ls --tag <tag>            Filter by tag
  tdocs ls --save <name>          Save as named list

VIEWING
  tdocs view <ref>                View document content
  tdocs view <ref> --meta         Show metadata
  tdocs view <ref> --path         Show full path
  tdocs view <ref> --edit         Open in editor

  References:
    4         → 4th item of current list (slot 0)
    1:3       → 3rd item of previous list (slot 1)
    sdk:2     → 2nd item of named list "sdk"

TAGGING
  tdocs tag <ref> <tag> [...]     Add tags to document
  tdocs tag <ref>                 Show tags for document
  tdocs untag <ref> <tag> [...]   Remove tags
  tdocs tags                      List all known tags
  tdocs tagged <tag>              Find docs with tag

INFO
  tdocs slots                     Show slot info
  tdocs help                      This help

EXAMPLES
  tdocs mount add ~/src/devops/tetra/bash tetra
  tdocs ls
  tdocs view 4
  tdocs tag 4 sdk api
  tdocs ls --tag sdk
  tdocs view sdk:1
EOF
}

tdocs() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Mount management
        mount|m)
            _tdocs_mount "$@"
            ;;

        # Listing
        ls|list)
            _tdocs_ls "$@"
            ;;

        # Viewing
        view|v)
            _tdocs_view "$@"
            ;;

        # Tagging
        tag)
            _tdocs_tag_add "$@"
            ;;
        untag)
            _tdocs_untag "$@"
            ;;
        tags)
            _tdocs_tags_list
            ;;
        tagged)
            _tdocs_tagged "$@"
            ;;

        # Info
        slots)
            _tdocs_slots_info
            ;;

        # Help
        help|--help|-h)
            _tdocs_help
            ;;

        # Quick view (if numeric)
        [0-9]*)
            _tdocs_view "$cmd" "$@"
            ;;

        *)
            echo "[tdocs] Unknown command: $cmd" >&2
            echo "Use 'tdocs help' for usage" >&2
            return 1
            ;;
    esac
}
