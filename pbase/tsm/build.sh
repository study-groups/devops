#!/usr/bin/env bash
# Build .tsm files from env.toml
# Usage: ./build.sh [env]  (default: all environments)
# All paths are resolved to absolute paths at build time

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PBASE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/env.toml"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: env.toml not found"
    exit 1
fi

# Source org secrets to resolve $DO_SPACES_KEY etc at build time
SECRETS_FILE="$HOME/tetra/orgs/pixeljam-arcade/secrets.env"
if [[ -f "$SECRETS_FILE" ]]; then
    source "$SECRETS_FILE"
    echo "Loaded secrets from: $SECRETS_FILE"
else
    echo "Warning: secrets.env not found at $SECRETS_FILE"
fi

# Resolve a path to absolute (handles $HOME, ${HOME}, ~)
resolve_path() {
    local path="$1"
    local base_dir="${2:-$PBASE_ROOT}"

    # Expand ${HOME}, $HOME and ~
    path="${path//\$\{HOME\}/$HOME}"
    path="${path//\$HOME/$HOME}"
    path="${path//\~/$HOME}"

    # If relative path, make absolute from base_dir
    if [[ "$path" != /* ]]; then
        path="$base_dir/$path"
    fi

    # Normalize
    if [[ -e "$path" ]] || [[ -e "$(dirname "$path")" ]]; then
        path="$(cd "$(dirname "$path")" 2>/dev/null && pwd)/$(basename "$path")" || path="$path"
    fi

    path="${path//\/\//\/}"
    echo "$path"
}

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
CWD_RAW=$(get_toml "shared" "cwd")
CWD=$(resolve_path "$CWD_RAW" "$PBASE_ROOT")

# Get secrets (expand env vars at build time)
S3_ACCESS_KEY_RAW=$(get_toml "secrets" "S3_ACCESS_KEY")
S3_SECRET_KEY_RAW=$(get_toml "secrets" "S3_SECRET_KEY")
RESEND_API_KEY_RAW=$(get_toml "secrets" "RESEND_API_KEY")

S3_ACCESS_KEY=$(eval echo "$S3_ACCESS_KEY_RAW")
S3_SECRET_KEY=$(eval echo "$S3_SECRET_KEY_RAW")
RESEND_API_KEY=$(eval echo "$RESEND_API_KEY_RAW")

# Build function
build_env() {
    local env="$1"
    local output="$SCRIPT_DIR/${NAME}-${env}.tsm"

    # Get env-specific config
    local pbase_env=$(get_toml "$env" "PBASE_ENV")
    local pd_dir_raw=$(get_toml "$env" "PD_DIR")
    local pd_data_raw=$(get_toml "$env" "PD_DATA")
    local games_dir_raw=$(get_toml "$env" "GAMES_DIR")

    # Resolve PD_DIR to absolute path
    local pd_dir=$(resolve_path "$pd_dir_raw" "$PBASE_ROOT")

    # Derive PD_DATA if not specified
    local pd_data
    if [[ -n "$pd_data_raw" ]]; then
        pd_data=$(resolve_path "$pd_data_raw" "$PBASE_ROOT")
    else
        pd_data="${pd_dir}/data"
    fi

    # Resolve GAMES_DIR if specified
    local games_dir=""
    if [[ -n "$games_dir_raw" ]]; then
        games_dir=$(resolve_path "$games_dir_raw" "$PBASE_ROOT")
    fi

    cat > "$output" << EOF
#!/usr/bin/env bash
# Generated from env.toml [$env] - do not edit
# Regenerate: ./build.sh $env
# Source: $ENV_FILE
# Built: $(date -Iseconds)

export TSM_NAME="$NAME"
export TSM_CWD="$CWD"
export TSM_PORT="$PORT"
export PORT="$PORT"
export PBASE_PORT="$PBASE_PORT"
export PBASE_ENV="$pbase_env"
export PD_DIR="$pd_dir"
export PD_DATA="$pd_data"
export GAMES_DIR="$games_dir"
export S3_BUCKET="$S3_BUCKET"
export S3_ENDPOINT="$S3_ENDPOINT"
export S3_ACCESS_KEY="$S3_ACCESS_KEY"
export S3_SECRET_KEY="$S3_SECRET_KEY"
export RESEND_API_KEY="$RESEND_API_KEY"
export TSM_COMMAND="$COMMAND"
EOF

    chmod +x "$output"
    echo "Built: $output"
    echo "  PD_DIR=$pd_dir"
    echo "  PD_DATA=$pd_data"
    [[ -n "$games_dir" ]] && echo "  GAMES_DIR=$games_dir"
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
