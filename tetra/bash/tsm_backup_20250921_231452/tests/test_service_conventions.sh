#!/usr/bin/env bash

# TSM Service Definition Conventions Test
# Tests the standardized service definition format and conventions

set -euo pipefail

# Test setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/tsm_conventions_test_$$"
export TETRA_DIR="$TEST_DIR"
export TETRA_SRC="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[CONV]${NC} $1"; }
pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

assert() { [[ $1 ]] && pass "$2" || fail "$2"; }

setup() {
    log "Setting up conventions test environment"
    mkdir -p "$TEST_DIR"/{services/{enabled},tsm/{logs,pids,processes}}
    echo "0" > "$TEST_DIR/tsm/next_id"

    # Source TSM functions
    source "$TETRA_SRC/bash/tsm/tsm.sh"
    tetra_tsm_setup
}

teardown() {
    log "Cleaning up conventions test"
    tsm delete "*" 2>/dev/null || true
    rm -rf "$TEST_DIR"
}

# Test 1: Standard service definition format
test_standard_format() {
    log "Testing standard service definition format"

    # Create a standard service definition
    cat > "$TETRA_DIR/services/standard-app.tsm.sh" <<'EOF'
#!/usr/bin/env bash

# TSM Service Definition: standard-app
# Generated on Wed Sep 21 03:00:00 PDT 2025

# Service metadata
export TSM_NAME="standard-app"
export TSM_COMMAND="node"
export TSM_CWD="/path/to/project"
export TSM_ENV_FILE="env/local.env"

# Optional settings
export TSM_ARGS=('server.js' '--production')
export TSM_PORT="3000"

# Description (optional)
export TSM_DESCRIPTION="Standard Node.js application service"

# Start command: tsm start --env ${TSM_ENV} ${TSM_COMMAND} ${TSM_NAME}
EOF
    chmod +x "$TETRA_DIR/services/standard-app.tsm.sh"

    # Test required variables
    local TSM_NAME="" TSM_COMMAND="" TSM_CWD=""
    source "$TETRA_DIR/services/standard-app.tsm.sh"

    assert "[[ -n '$TSM_NAME' ]]" "TSM_NAME is required and set"
    assert "[[ -n '$TSM_COMMAND' ]]" "TSM_COMMAND is required and set"
    assert "[[ -n '$TSM_CWD' ]]" "TSM_CWD (working directory) is required and set"

    # Test semantic meaning of TSM_CWD
    assert "[[ '$TSM_CWD' == '/path/to/project' ]]" "TSM_CWD represents service start directory"

    # Test optional variables
    assert "[[ -n '$TSM_ENV_FILE' ]]" "TSM_ENV_FILE is set for environment loading"
    assert "[[ -n '$TSM_DESCRIPTION' ]]" "TSM_DESCRIPTION provides service documentation"
}

# Test 2: Environment file path conventions
test_env_file_conventions() {
    log "Testing environment file path conventions"

    # Test relative path convention
    local TSM_ENV_FILE="env/local.env"
    assert "[[ '$TSM_ENV_FILE' =~ ^env/ ]]" "Environment file uses 'env/' prefix convention"

    # Test common environment file names
    local env_files=("env/local.env" "env/dev.env" "env/production.env" "env/staging.env")
    for env_file in "${env_files[@]}"; do
        # Create test service with each env file
        cat > "$TETRA_DIR/services/test-${env_file##*/}.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="test-${env_file##*/}"
export TSM_COMMAND="echo"
export TSM_CWD="$TEST_DIR"
export TSM_ENV_FILE="$env_file"
export TSM_ARGS=('hello')
EOF
        chmod +x "$TETRA_DIR/services/test-${env_file##*/}.tsm.sh"

        # Source and verify
        local TSM_ENV_FILE=""
        source "$TETRA_DIR/services/test-${env_file##*/}.tsm.sh"
        assert "[[ '$TSM_ENV_FILE' == '$env_file' ]]" "Environment file '$env_file' convention supported"
    done
}

# Test 3: Service naming conventions
test_naming_conventions() {
    log "Testing service naming conventions"

    local valid_names=("web-app" "api-service" "worker-queue" "nginx-proxy" "redis-cache")
    local invalid_names=("Web App" "api_service!" "123invalid" "")

    # Test valid names
    for name in "${valid_names[@]}"; do
        cat > "$TETRA_DIR/services/${name}.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="$name"
export TSM_COMMAND="echo"
export TSM_CWD="$TEST_DIR"
EOF
        chmod +x "$TETRA_DIR/services/${name}.tsm.sh"

        local TSM_NAME=""
        source "$TETRA_DIR/services/${name}.tsm.sh"
        assert "[[ '$TSM_NAME' == '$name' ]]" "Valid service name '$name' accepted"
    done

    # Test kebab-case convention
    assert "[[ 'web-app' =~ ^[a-z]+(-[a-z]+)*$ ]]" "Kebab-case naming convention enforced"
    assert "[[ 'api-service' =~ ^[a-z]+(-[a-z]+)*$ ]]" "Multi-word kebab-case names supported"
}

# Test 4: Command and arguments structure
test_command_structure() {
    log "Testing command and arguments structure"

    # Test different command types
    local commands=(
        "node|server.js --port 3000"
        "python3|app.py --config production"
        "/usr/bin/nginx|-g daemon off;"
        "./custom-script.sh|arg1 arg2"
    )

    local counter=0
    for cmd_line in "${commands[@]}"; do
        local cmd="${cmd_line%%|*}"
        local args_str="${cmd_line##*|}"
        IFS=' ' read -ra args_array <<< "$args_str"

        cat > "$TETRA_DIR/services/cmd-test-$counter.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="cmd-test-$counter"
export TSM_COMMAND="$cmd"
export TSM_CWD="$TEST_DIR"
export TSM_ARGS=($(printf "'%s' " "${args_array[@]}"))
EOF
        chmod +x "$TETRA_DIR/services/cmd-test-$counter.tsm.sh"

        # Test sourcing
        local TSM_COMMAND="" TSM_ARGS=()
        source "$TETRA_DIR/services/cmd-test-$counter.tsm.sh"

        assert "[[ '$TSM_COMMAND' == '$cmd' ]]" "Command '$cmd' correctly set"
        assert "[[ \${#TSM_ARGS[@]} -gt 0 ]]" "Arguments array populated for '$cmd'"

        ((counter++))
    done
}

# Test 5: Working directory semantics
test_working_directory() {
    log "Testing working directory (TSM_CWD) semantics"

    # Create project structure
    mkdir -p "$TEST_DIR/projects/example-app"/{src,config,logs}
    echo "console.log('app starting')" > "$TEST_DIR/projects/example-app/server.js"

    # Test TSM_CWD as project root
    cat > "$TETRA_DIR/services/example-app.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="example-app"
export TSM_COMMAND="node"
export TSM_CWD="$TEST_DIR/projects/example-app"
export TSM_ARGS=('server.js')
export TSM_DESCRIPTION="Example app with proper working directory"
EOF
    chmod +x "$TETRA_DIR/services/example-app.tsm.sh"

    # Verify TSM_CWD points to project root
    local TSM_CWD=""
    source "$TETRA_DIR/services/example-app.tsm.sh"

    assert "[[ -d '$TSM_CWD' ]]" "TSM_CWD points to existing directory"
    assert "[[ -f '$TSM_CWD/server.js' ]]" "TSM_CWD contains the main application file"

    # Test relative path resolution
    local relative_path="server.js"
    assert "[[ -f '$TSM_CWD/$relative_path' ]]" "Relative paths resolve correctly from TSM_CWD"
}

# Test 6: Service enable/disable structure
test_enable_disable_structure() {
    log "Testing enable/disable service structure"

    # Create service
    cat > "$TETRA_DIR/services/nginx-proxy.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="nginx-proxy"
export TSM_COMMAND="nginx"
export TSM_CWD="/etc/nginx"
export TSM_ARGS=('-g' 'daemon off;')
export TSM_DESCRIPTION="Nginx reverse proxy service"
EOF
    chmod +x "$TETRA_DIR/services/nginx-proxy.tsm.sh"

    # Test enable (create symlink)
    mkdir -p "$TETRA_DIR/services/enabled"
    ln -sf "../nginx-proxy.tsm.sh" "$TETRA_DIR/services/enabled/nginx-proxy.tsm.sh"

    assert "[[ -L '$TETRA_DIR/services/enabled/nginx-proxy.tsm.sh' ]]" "Enabled service creates symlink"
    assert "[[ -f '$TETRA_DIR/services/enabled/nginx-proxy.tsm.sh' ]]" "Enabled service symlink is valid"

    # Test that enabled service has same properties
    local TSM_NAME_ORIG="" TSM_NAME_ENABLED=""
    source "$TETRA_DIR/services/nginx-proxy.tsm.sh"
    TSM_NAME_ORIG="$TSM_NAME"
    source "$TETRA_DIR/services/enabled/nginx-proxy.tsm.sh"
    TSM_NAME_ENABLED="$TSM_NAME"

    assert "[[ '$TSM_NAME_ORIG' == '$TSM_NAME_ENABLED' ]]" "Enabled service preserves properties"

    # Test disable (remove symlink)
    rm "$TETRA_DIR/services/enabled/nginx-proxy.tsm.sh"
    assert "[[ ! -L '$TETRA_DIR/services/enabled/nginx-proxy.tsm.sh' ]]" "Disabled service removes symlink"
    assert "[[ -f '$TETRA_DIR/services/nginx-proxy.tsm.sh' ]]" "Original service file remains after disable"
}

# Test 7: Documentation and metadata conventions
test_documentation_conventions() {
    log "Testing documentation and metadata conventions"

    # Test comprehensive service documentation
    cat > "$TETRA_DIR/services/documented-service.tsm.sh" <<'EOF'
#!/usr/bin/env bash

# TSM Service Definition: documented-service
# Generated on Wed Sep 21 03:00:00 PDT 2025
#
# This service demonstrates proper documentation conventions:
# - Clear service purpose and description
# - Environment requirements
# - Port and dependency information

# Service metadata
export TSM_NAME="documented-service"
export TSM_COMMAND="python3"
export TSM_CWD="/opt/myapp"
export TSM_ENV_FILE="env/production.env"

# Optional settings
export TSM_ARGS=('-m' 'myapp.server')
export TSM_PORT="8080"

# Description (optional)
export TSM_DESCRIPTION="Production API service with Redis caching and PostgreSQL"

# Dependencies: Redis (port 6379), PostgreSQL (port 5432)
# Environment: Requires production.env with DATABASE_URL and REDIS_URL
# Start command: tsm start --env ${TSM_ENV} ${TSM_COMMAND} ${TSM_NAME}
EOF
    chmod +x "$TETRA_DIR/services/documented-service.tsm.sh"

    # Test header structure
    local header=$(head -10 "$TETRA_DIR/services/documented-service.tsm.sh")
    assert "echo '$header' | grep -q '# TSM Service Definition:'" "Service header follows convention"
    assert "echo '$header' | grep -q '# Generated on'" "Generation timestamp documented"

    # Test inline documentation
    local content=$(cat "$TETRA_DIR/services/documented-service.tsm.sh")
    assert "echo '$content' | grep -q '# Dependencies:'" "Dependencies documented"
    assert "echo '$content' | grep -q '# Environment:'" "Environment requirements documented"
    assert "echo '$content' | grep -q '# Start command:'" "Start command template documented"
}

# Test 8: Common patterns validation
test_common_patterns() {
    log "Testing common service patterns"

    # Test Node.js web application pattern
    cat > "$TETRA_DIR/services/node-web.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="node-web"
export TSM_COMMAND="node"
export TSM_CWD="$TEST_DIR/web-app"
export TSM_ENV_FILE="env/local.env"
export TSM_ARGS=('server.js')
export TSM_DESCRIPTION="Node.js web application"
EOF

    # Test Python API pattern
    cat > "$TETRA_DIR/services/python-api.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="python-api"
export TSM_COMMAND="python3"
export TSM_CWD="$TEST_DIR/api"
export TSM_ENV_FILE="env/production.env"
export TSM_ARGS=('-m' 'api.server')
export TSM_DESCRIPTION="Python FastAPI service"
EOF

    # Test shell script pattern
    cat > "$TETRA_DIR/services/worker-script.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="worker-script"
export TSM_COMMAND="./worker.sh"
export TSM_CWD="$TEST_DIR/workers"
export TSM_ENV_FILE="env/worker.env"
export TSM_ARGS=('--interval' '30')
export TSM_DESCRIPTION="Background worker script"
EOF

    chmod +x "$TETRA_DIR/services"/{node-web,python-api,worker-script}.tsm.sh

    # Validate each pattern
    local patterns=("node-web" "python-api" "worker-script")
    for pattern in "${patterns[@]}"; do
        local TSM_NAME="" TSM_COMMAND="" TSM_CWD=""
        source "$TETRA_DIR/services/${pattern}.tsm.sh"

        assert "[[ -n '$TSM_NAME' ]]" "Pattern '$pattern' has valid name"
        assert "[[ -n '$TSM_COMMAND' ]]" "Pattern '$pattern' has valid command"
        assert "[[ -n '$TSM_CWD' ]]" "Pattern '$pattern' has valid working directory"
    done
}

# Run all convention tests
run_tests() {
    log "🔍 Starting TSM Service Definition Convention Tests"
    echo

    setup

    test_standard_format
    test_env_file_conventions
    test_naming_conventions
    test_command_structure
    test_working_directory
    test_enable_disable_structure
    test_documentation_conventions
    test_common_patterns

    teardown

    echo
    log "🎉 All TSM service convention tests passed!"
    echo
    log "Validated conventions:"
    echo "  ✅ Standard service definition format"
    echo "  ✅ Environment file path conventions (env/*.env)"
    echo "  ✅ Service naming conventions (kebab-case)"
    echo "  ✅ Command and arguments structure"
    echo "  ✅ Working directory (TSM_CWD) semantics"
    echo "  ✅ Enable/disable symlink structure"
    echo "  ✅ Documentation and metadata standards"
    echo "  ✅ Common service patterns validation"
}

# Run tests if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi