# =================== tetra_runtime_ (artifact generation) =====================

# Generate a .env file for a given environment from canonical TOML.
# Usage: tetra_runtime_generate_env <env.meta.toml> <environment> <output_file>
tetra_runtime_generate_env() {
    local meta_toml="$1"
    local environment="$2"
    local output_file="${3:-/tmp/tetra-env/$environment.env}"
    if [ -z "$meta_toml" ] || [ -z "$environment" ]; then
        echo "Usage: tetra_runtime_generate_env <env.meta.toml> <environment> [output_file]"
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
# Usage: tetra_runtime_generate_entrypoint <env.meta.toml> <environment> <project_dir> [template_file]
tetra_runtime_generate_entrypoint() {
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
# Usage: tetra_runtime_generate_service <env.meta.toml> <environment> <project_dir> [template_file]
tetra_runtime_generate_service() {
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

# ===================== tetra_deploy_ (file transfer) ==========================

# Pushes any file (env, entrypoint, service) to a remote host as described in a transfer config.
# Usage: tetra_deploy_push_file <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>
tetra_deploy_push_file() {
    local config="$1"
    local local_var="$2"
    local remote_var="$3"
    if [ -z "$config" ] || [ ! -f "$config" ] || [ -z "$local_var" ] || [ -z "$remote_var" ]; then
        echo "Usage: tetra_deploy_push_file <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>"
        return 1
    fi
    . "$config"
    local local_file="${!local_var}"
    local remote_file="${!remote_var}"
    if [ ! -f "$local_file" ]; then
        echo "Local file not found: $local_file"
        return 2
    fi
    echo "Pushing $local_file → $REMOTE_USER@$REMOTE_HOST:$remote_file"
    scp "$local_file" "$REMOTE_USER@$REMOTE_HOST:$remote_file"
    if [ $? -eq 0 ]; then
        echo "Pushed $local_file to $REMOTE_USER@$REMOTE_HOST:$remote_file"
    else
        echo "Failed to push"
        return 3
    fi
}

# Pulls any file (env, entrypoint, service) from a remote host as described in a transfer config.
# Usage: tetra_deploy_pull_file <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>
tetra_deploy_pull_file() {
    local config="$1"
    local local_var="$2"
    local remote_var="$3"
    if [ -z "$config" ] || [ ! -f "$config" ] || [ -z "$local_var" ] || [ -z "$remote_var" ]; then
        echo "Usage: tetra_deploy_pull_file <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>"
        return 1
    fi
    . "$config"
    local local_file="${!local_var}"
    local remote_file="${!remote_var}"
    mkdir -p "$(dirname "$local_file")"
    echo "Pulling $REMOTE_USER@$REMOTE_HOST:$remote_file → $local_file"
    scp "$REMOTE_USER@$REMOTE_HOST:$remote_file" "$local_file"
    if [ $? -eq 0 ]; then
        echo "Pulled $remote_file to $local_file"
    else
        echo "Failed to pull"
        return 2
    fi
}

# Summarizes the status of local and remote files for any artifact pair.
# Usage: tetra_deploy_status <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>
tetra_deploy_status() {
    local config="$1"
    local local_var="$2"
    local remote_var="$3"
    if [ -z "$config" ] || [ ! -f "$config" ] || [ -z "$local_var" ] || [ -z "$remote_var" ]; then
        echo "Usage: tetra_deploy_status <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>"
        return 1
    fi
    . "$config"
    local local_file="${!local_var}"
    local remote_file="${!remote_var}"

    echo "==== tetra_deploy_status ===="
    echo "  Local path:  $local_file"
    if [ -f "$local_file" ]; then
        local lstat
        lstat=$(stat --format="exists: yes | size: %s bytes | mtime: %y | perms: %A" "$local_file")
        echo "  Local file:  $lstat"
    else
        echo "  Local file:  exists: NO"
    fi

    echo "  Remote:      $REMOTE_USER@$REMOTE_HOST:$remote_file"
    ssh "$REMOTE_USER@$REMOTE_HOST" "if [ -f '$remote_file' ]; then stat --format='exists: yes | size: %s bytes | mtime: %y | perms: %A' '$remote_file'; else echo 'exists: NO'; fi" 2>/dev/null | sed 's/^/  Remote file: /'
    echo "=============================="
}
