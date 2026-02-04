#!/usr/bin/env bash
# Build .tsm files from env.toml
# Usage: ./build.sh [env]  (default: all environments)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PBASE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/env.toml"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: env.toml not found"
    exit 1
fi

# Simple TOML parser - gets value from section
get_toml() {
    local section="$1"
    local key="$2"
    awk -v section="$section" -v key="$key" '
        /^\[/ { in_section = ($0 == "[" section "]") }
        in_section && $1 == key {
            sub(/^[^=]*= *"?/, "")
            sub(/"? *$/, "")
            print
        }
    ' "$ENV_FILE"
}

# Get service config
NAME=$(get_toml "service" "name")
COMMAND=$(get_toml "service" "command")

# Get shared config
PORT=$(get_toml "shared" "PORT")
PBASE_PORT=$(get_toml "shared" "PBASE_PORT")
S3_BUCKET=$(get_toml "shared" "S3_BUCKET")
S3_ENDPOINT=$(get_toml "shared" "S3_ENDPOINT")

# Build function
build_env() {
    local env="$1"
    local output="$SCRIPT_DIR/${NAME}-${env}.tsm"

    # Get env-specific config
    local pbase_env=$(get_toml "$env" "PBASE_ENV")
    local tetra_dir=$(get_toml "$env" "TETRA_DIR")
    local tetra_org=$(get_toml "$env" "TETRA_ORG")
    local pbase_src=$(get_toml "$env" "PBASE_SRC")
    local pd_dir=$(get_toml "$env" "PD_DIR")
    local games_dir=$(get_toml "$env" "GAMES_DIR")
    local cwd=$(get_toml "$env" "cwd")

    # Expand $HOME for local env
    tetra_dir="${tetra_dir//\$HOME/$HOME}"
    pbase_src="${pbase_src//\$HOME/$HOME}"
    pd_dir="${pd_dir//\$HOME/$HOME}"
    games_dir="${games_dir//\$HOME/$HOME}"
    cwd="${cwd//\$HOME/$HOME}"

    # Source org secrets at build time
    local secrets_file="${tetra_dir}/orgs/${tetra_org}/secrets.env"
    local s3_access_key=""
    local s3_secret_key=""
    local resend_api_key=""

    if [[ -f "$secrets_file" ]]; then
        source "$secrets_file"
        s3_access_key="$DO_SPACES_KEY"
        s3_secret_key="$DO_SPACES_SECRET"
        resend_api_key="${RESEND_API_KEY:-}"
        echo "Loaded secrets from: $secrets_file"
    else
        echo "Warning: secrets not found at $secrets_file"
    fi

    cat > "$output" << EOF
#!/usr/bin/env bash
# Generated from env.toml [$env] - do not edit
# Regenerate: ./build.sh $env
# Source: $ENV_FILE
# Built: $(date -Iseconds)

export TSM_NAME="$NAME"
export TSM_CWD="$cwd"
export TSM_PORT="$PORT"
export PORT="$PORT"
export PBASE_PORT="$PBASE_PORT"
export PBASE_ENV="$pbase_env"
export PBASE_SRC="$pbase_src"
export PD_DIR="$pd_dir"
export GAMES_DIR="$games_dir"
export S3_BUCKET="$S3_BUCKET"
export S3_ENDPOINT="$S3_ENDPOINT"
export S3_ACCESS_KEY="$s3_access_key"
export S3_SECRET_KEY="$s3_secret_key"
export RESEND_API_KEY="$resend_api_key"
export TSM_COMMAND="$COMMAND"
EOF

    chmod +x "$output"
    echo "Built: $output"
    echo "  PD_DIR=$pd_dir"
    echo "  GAMES_DIR=$games_dir"
}

# Build specified env or all
if [[ -n "$1" ]]; then
    build_env "$1"
else
    for env in local dev staging prod; do
        build_env "$env"
    done
fi

echo "Done."
