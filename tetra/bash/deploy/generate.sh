# =================== tetra_generate_ (artifact generation) ====================

# Generate a .env file for a given environment from canonical TOML.
# Usage: tetra_generate_env <env.meta.toml> <environment> <output_file>
tetra_generate_env() {
    local meta_toml="$1"
    local environment="$2"
    local output_file="${3:-/tmp/tetra-env/$environment.env}"
    if [ -z "$meta_toml" ] || [ -z "$environment" ]; then
        echo "Usage: tetra_generate_env <env.meta.toml> <environment> [output_file]"
        return 1
    fi
    mkdir -p "$(dirname "$output_file")"
    tetra_toml_generate_env "$meta_toml" "$environment" > "$output_file"
    if [ $? -eq 0 ]; then
        echo "Generated $output_file"
    else
        echo "Failed to generate env file"
        return 2
    fi
}

# Generate a bash entrypoint script from template and TOML for the environment.
# Usage: tetra_generate_entrypoint <env.meta.toml> <environment> <project_dir> [template_file]
tetra_generate_entrypoint() {
    local meta_toml="$1"
    local environment="$2"
    local project_dir="$3"
    local template="${4:-config/templates/entrypoint.sh.tpl}"
    local output="${project_dir}/entrypoints/${environment}.sh"
    eval "$(tetra_toml_generate_env "$meta_toml" "$environment" | sed 's/^export //')"
    export ENVIRONMENT="$environment"
    export ENTRYPOINT_SH="${output}"
    envsubst < "$template" > "$output"
    chmod +x "$output"
    echo "Generated $output"
}

# Generate a systemd service file from template and TOML for the environment.
# Usage: tetra_generate_service <env.meta.toml> <environment> <project_dir> [template_file]
tetra_generate_service() {
    local meta_toml="$1"
    local environment="$2"
    local project_dir="$3"
    local template="${4:-config/templates/service.tpl}"
    local output="${project_dir}/entrypoints/${environment}.service"
    eval "$(tetra_toml_generate_env "$meta_toml" "$environment" | sed 's/^export //')"
    export ENVIRONMENT="$environment"
    export ENTRYPOINT_SH="${project_dir}/entrypoints/${environment}.sh"
    export WORKING_DIR="$project_dir"
    envsubst < "$template" > "$output"
    echo "Generated $output"
}

# ==============================================================================
# tetra_generate_all
#   Generate all core runtime artifacts (.env, entrypoint, service) for an environment.
#   Usage: tetra_generate_all <env.meta.toml> <environment> <project_dir>
#   - .env is written to $project_dir/env/generated/<environment>.role.env
#   - entrypoint script: $project_dir/entrypoints/<environment>.sh
#   - systemd service:   $project_dir/entrypoints/<environment>.service
# ==============================================================================

tetra_generate_all() {
    local meta_toml="$1"
    local environment="$2"
    local project_dir="$3"

    if [ -z "$meta_toml" ] || [ -z "$environment" ] || [ -z "$project_dir" ]; then
        echo "Usage: tetra_generate_all <env.meta.toml> <environment> <project_dir>"
        return 1
    fi

    local env_out="${project_dir}/env/generated/${environment}.role.env"
    local entrypoint_out="${project_dir}/entrypoints/${environment}.sh"
    local service_out="${project_dir}/entrypoints/${environment}.service"

    echo "Generating .env file: $env_out"
    tetra_generate_env "$meta_toml" "$environment" "$env_out" || return 2

    echo "Generating entrypoint: $entrypoint_out"
    tetra_generate_entrypoint "$meta_toml" "$environment" "$project_dir" || return 3

    echo "Generating service: $service_out"
    tetra_generate_service "$meta_toml" "$environment" "$project_dir" || return 4

    echo "All artifacts generated for environment: $environment"
    return 0
}
