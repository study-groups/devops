#!/usr/bin/env bash
# nhb.sh - Main nhb command dispatcher
#
# Usage:
#   nhb status          Show Nodeholder availability
#   nhb list <json>     List droplets and env mappings
#   nhb import <json> <org>  Import to tetra org
#   nhb workflow        Show workflow documentation
#   nhb help            Show help

nhb() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Status/info
        status|st)
            nhb_status "$@"
            ;;
        workflow|wf)
            nhb_show_workflow
            ;;

        # Core operations
        list|ls)
            nhb_list "$@"
            ;;
        import|i)
            nhb_import "$@"
            ;;
        quick|q)
            nhb_quick_import "$@"
            ;;

        # Validation
        validate|v)
            local json_file="$1"
            if [[ -z "$json_file" ]]; then
                echo "Usage: nhb validate <json_file>"
                return 1
            fi
            nhb_validate_json "$json_file"
            ;;

        # Fetch from Nodeholder
        fetch|f)
            nhb_fetch_latest "$@"
            ;;

        # Help
        help|h|--help|-h)
            nhb_help
            ;;

        *)
            echo "Unknown command: $cmd"
            echo "Run 'nhb help' for usage"
            return 1
            ;;
    esac
}

nhb_help() {
    cat << 'EOF'
nhb - Nodeholder Bridge (digocean.json -> tetra.toml)

COMMANDS
  status          Show Nodeholder availability
  list <json>     Preview droplets + env mappings
  import <j> <o>  Import json to org
  quick <ctx>     Import from $NH_DIR/<ctx>/
  validate <j>    Check json format
  fetch [ctx]     Fetch from DigitalOcean
  workflow        Show architecture

ENV MAPPING ($NH_DIR/<ctx>/env-map.conf)
  do4=staging
  do4n2=prod,staging
EOF
}
