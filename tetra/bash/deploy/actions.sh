#!/usr/bin/env bash
# Deploy Module TCS-Compliant Actions
# Follows Tetra Module Convention 2.0 and TCS 3.0

# Import deploy functionality
: "${DEPLOY_SRC:=$TETRA_SRC/bash/deploy}"
source "$DEPLOY_SRC/deploy.sh" 2>/dev/null || true

# Register deploy actions with TUI
deploy_register_actions() {
    # Ensure declare_action exists
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Generate environment file
    declare_action "generate_env" \
        "verb=generate" \
        "noun=env" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=meta_toml,environment,output_file" \
        "output=@tui[status]" \
        "effects=@local[file/created]" \
        "immediate=false" \
        "can=Generate .env file from TOML for environment" \
        "cannot=Modify source TOML"

    # Generate entrypoint script
    declare_action "generate_entrypoint" \
        "verb=generate" \
        "noun=entrypoint" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=meta_toml,environment,project_dir,template" \
        "output=@tui[status]" \
        "effects=@local[file/created]" \
        "immediate=false" \
        "can=Generate bash entrypoint script from template" \
        "cannot=Modify template files"

    # Build project
    declare_action "build_project" \
        "verb=build" \
        "noun=project" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=project_dir,environment" \
        "output=@tui[content]" \
        "effects=@local[artifact/built]" \
        "immediate=false" \
        "can=Build project for target environment" \
        "cannot=Modify source files"

    # Deploy to Spaces
    declare_action "deploy_spaces" \
        "verb=deploy" \
        "noun=spaces" \
        "exec_at=@spaces" \
        "contexts=Remote" \
        "modes=Execute" \
        "tes_operation=@spaces" \
        "inputs=build_dir,bucket,target_path" \
        "output=@tui[status]" \
        "effects=@spaces[objects/uploaded]" \
        "immediate=false" \
        "can=Deploy build artifacts to DigitalOcean Spaces" \
        "cannot=Modify source files or rollback"

    # Deploy to remote server
    declare_action "deploy_remote" \
        "verb=deploy" \
        "noun=remote" \
        "exec_at=@remote" \
        "contexts=Remote" \
        "modes=Execute" \
        "tes_operation=@remote" \
        "inputs=host,project_dir,environment" \
        "output=@tui[status]" \
        "effects=@remote[service/updated]" \
        "immediate=false" \
        "can=Deploy to remote server via SSH" \
        "cannot=Modify local source"

    # Deploy status check
    declare_action "check_status" \
        "verb=check" \
        "noun=status" \
        "exec_at=@remote" \
        "contexts=Remote" \
        "modes=Inspect" \
        "tes_operation=@remote" \
        "inputs=host,service_name" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Check deployment status on remote server" \
        "cannot=Modify service state"
}

# Execute deploy actions
deploy_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        generate:env)
            local meta_toml="${args[0]}"
            local environment="${args[1]}"
            local output_file="${args[2]:-}"

            if [[ -z "$meta_toml" || -z "$environment" ]]; then
                echo "Error: meta_toml and environment required"
                return 1
            fi

            tetra_runtime_generate_env "$meta_toml" "$environment" "$output_file"
            ;;

        generate:entrypoint)
            local meta_toml="${args[0]}"
            local environment="${args[1]}"
            local project_dir="${args[2]}"
            local template="${args[3]:-}"

            if [[ -z "$meta_toml" || -z "$environment" || -z "$project_dir" ]]; then
                echo "Error: meta_toml, environment, and project_dir required"
                return 1
            fi

            tetra_runtime_generate_entrypoint "$meta_toml" "$environment" "$project_dir" "$template"
            ;;

        build:project)
            local project_dir="${args[0]}"
            local environment="${args[1]:-production}"

            if [[ -z "$project_dir" ]]; then
                echo "Error: project_dir required"
                return 1
            fi

            deploy_build "$project_dir" "$environment"
            ;;

        deploy:spaces)
            local build_dir="${args[0]}"
            local bucket="${args[1]}"
            local target_path="${args[2]}"

            if [[ -z "$build_dir" || -z "$bucket" || -z "$target_path" ]]; then
                echo "Error: build_dir, bucket, and target_path required"
                return 1
            fi

            deploy_to_spaces "$build_dir" "$bucket" "$target_path"
            ;;

        deploy:remote)
            local host="${args[0]}"
            local project_dir="${args[1]}"
            local environment="${args[2]:-production}"

            if [[ -z "$host" || -z "$project_dir" ]]; then
                echo "Error: host and project_dir required"
                return 1
            fi

            deploy_to_remote "$host" "$project_dir" "$environment"
            ;;

        check:status)
            local host="${args[0]}"
            local service_name="${args[1]}"

            if [[ -z "$host" || -z "$service_name" ]]; then
                echo "Error: host and service_name required"
                return 1
            fi

            deploy_check_status "$host" "$service_name"
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

export -f deploy_register_actions
export -f deploy_execute_action
