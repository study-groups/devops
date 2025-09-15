# Generate .env file
# Usage: tetra_generate_env <env.meta.toml> <environment> <output_file>
tetra_generate_env() {
  local meta_toml="$1"
  local environment="$2"
  local output_file="${3:-/tmp/tetra-env/${environment}.env}"

  if [[ -z "$meta_toml" || -z "$environment" ]]; then
    echo "⚠️  Usage: tetra_generate_env <env.meta.toml> <environment> [output_file]"
    return 1
  fi

  mkdir -p "$(dirname "$output_file")"

  echo "🔧 Generating .env → $output_file"
  tetra_toml_generate_env "$meta_toml" "$environment" > "$output_file"
  local code=$?

  if [[ $code -eq 0 ]]; then
    echo "✅ Generated $output_file"
  else
    echo "❌ Failed to generate env file"
    return 2
  fi
}

# Generate entrypoint.sh from template
# Usage: tetra_generate_entrypoint <env.meta.toml> <environment> <project_dir> [template_file]
tetra_generate_entrypoint() {
  local meta_toml="$1"
  local environment="$2"
  local project_dir="$3"
  local template="${4:-config/templates/entrypoint.sh.tpl}"
  local output="${project_dir}/entrypoints/${environment}.sh"

  echo "🔧 Generating entrypoint → $output"

  eval "$(tetra_toml_generate_env "$meta_toml" "$environment" | sed 's/^export //')"
  export ENVIRONMENT="$environment"
  export ENTRYPOINT_SH="$output"

  mkdir -p "$(dirname "$output")"
  envsubst < "$template" > "$output"
  chmod +x "$output"

  echo "✅ Entrypoint script generated: $output"
}

# Generate systemd service
# Usage: tetra_generate_service <env.meta.toml> <environment> <project_dir> [template_file]
tetra_generate_service() {
  local meta_toml="$1"
  local environment="$2"
  local project_dir="$3"
  local template="${4:-config/templates/service.tpl}"
  local output="${project_dir}/entrypoints/${environment}.service"

  echo "🔧 Generating systemd service → $output"

  eval "$(tetra_toml_generate_env "$meta_toml" "$environment" | sed 's/^export //')"
  export ENVIRONMENT="$environment"
  export ENTRYPOINT_SH="${project_dir}/entrypoints/${environment}.sh"
  export WORKING_DIR="$project_dir"

  mkdir -p "$(dirname "$output")"
  envsubst < "$template" > "$output"

  echo "✅ systemd service generated: $output"
}

# Generate all artifacts
# Usage: tetra_generate_all <env.meta.toml> <environment> <project_dir>
tetra_generate_all() {
  local meta_toml="$1"
  local environment="$2"
  local project_dir="$3"

  if [[ -z "$meta_toml" || -z "$environment" || -z "$project_dir" ]]; then
    echo "⚠️  Usage: tetra_generate_all <env.meta.toml> <environment> <project_dir>"
    return 1
  fi

  local env_out="${project_dir}/env/generated/${environment}.role.env"
  local entrypoint_out="${project_dir}/entrypoints/${environment}.sh"
  local service_out="${project_dir}/entrypoints/${environment}.service"

  echo "🎯 Generating all deploy artifacts for '$environment'..."

  tetra_generate_env "$meta_toml" "$environment" "$env_out" || return 2
  tetra_generate_entrypoint "$meta_toml" "$environment" "$project_dir" || return 3
  tetra_generate_service "$meta_toml" "$environment" "$project_dir" || return 4

  echo "✅ All artifacts generated:"
  echo "  - .env      : $env_out"
  echo "  - entrypoint: $entrypoint_out"
  echo "  - service   : $service_out"
}

# Optional runner for CLI usage
# Usage: tetra_generate <meta_toml> <env> <project_dir> [all|env|entrypoint|service]
tetra_generate() {
  local meta_toml="$1"
  local env="$2"
  local project_dir="$3"
  local action="${4:-all}"

  case "$action" in
    all)
      tetra_generate_all "$meta_toml" "$env" "$project_dir"
      ;;
    env)
      tetra_generate_env "$meta_toml" "$env" "${project_dir}/env/generated/${env}.role.env"
      ;;
    entrypoint)
      tetra_generate_entrypoint "$meta_toml" "$env" "$project_dir"
      ;;
    service)
      tetra_generate_service "$meta_toml" "$env" "$project_dir"
      ;;
    *)
      echo "Usage: tetra_generate <meta_toml> <env> <project_dir> [all|env|entrypoint|service]"
      return 1
      ;;
  esac
}
