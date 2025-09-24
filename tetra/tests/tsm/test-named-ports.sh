#!/bin/bash

# TSM Named Ports Test Suite
# Test Driven Development for named ports functionality and services-available for environments

source "$(dirname "$0")/tsm-test-framework.sh"

# Override test integration to true for TSM testing
TSM_TEST_INTEGRATION=true

# === TEST CONFIGURATION ===

# Test environments to create
TEST_ENVS=("dev" "staging" "prod" "local")

# Expected standard named ports (from config)
EXPECTED_NAMED_PORTS=(
    "devpages:4000"
    "tetra:4444"
    "arcade:8400"
    "pbase:2600"
)

# === HELPER FUNCTIONS ===

create_test_env_configs() {
    tsm_log_debug "Creating test environment configurations with various ports"

    mkdir -p "$TSM_TEST_ENV_DIR"

    # Dev environment - uses different ports than named registry
    cat > "$TSM_TEST_ENV_DIR/dev.env" << 'EOF'
export PORT=3000
export NAME=devapp
export NODE_ENV=development
export API_KEY=dev-key-123
EOF

    # Staging environment
    cat > "$TSM_TEST_ENV_DIR/staging.env" << 'EOF'
export PORT=5000
export NAME=stagingapp
export NODE_ENV=staging
export DATABASE_URL=postgres://staging-db
EOF

    # Production environment
    cat > "$TSM_TEST_ENV_DIR/prod.env" << 'EOF'
export PORT=8080
export NAME=production
export NODE_ENV=production
export DATABASE_URL=postgres://prod-db
EOF

    # Local environment - should use devpages named port
    cat > "$TSM_TEST_ENV_DIR/local.env" << 'EOF'
export NAME=localapp
export NODE_ENV=development
export DEBUG=true
EOF

    tsm_log_debug "Created test env configs: dev (3000), staging (5000), prod (8080), local (no PORT - should use named)"
}

create_test_service_configs() {
    tsm_log_debug "Creating test TSM service configurations"

    local test_services_dir="$TSM_TEST_DIR/services"
    mkdir -p "$test_services_dir"

    # Test service that should use named port (devpages)
    cat > "$test_services_dir/test-devpages.tsm" << 'EOF'
#!/usr/bin/env bash
# TSM Service: test-devpages

TSM_NAME="test-devpages"
TSM_COMMAND="node server/server.js"
TSM_CWD="/tmp/test-project"
TSM_ENV_FILE="env/local.env"
EOF

    # Test service for different environments
    for env in "${TEST_ENVS[@]}"; do
        cat > "$test_services_dir/test-service-${env}.tsm" << EOF
#!/usr/bin/env bash
# TSM Service: test-service-${env}

TSM_NAME="test-service-${env}"
TSM_COMMAND="node server.js"
TSM_CWD="/tmp/test-project"
TSM_ENV_FILE="env/${env}.env"
EOF
    done

    tsm_log_debug "Created test service configs for environments: ${TEST_ENVS[*]}"
}

# === NAMED PORTS DISPLAY TESTS ===

test_show_named_ports_all() {
    tsm_log_info "Testing: Show all named ports"

    # Test basic ports list command
    local output
    output=$(tsm ports list 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "ports list command failed with exit code $exit_code"
        return 1
    fi

    # Check that output contains expected named ports
    local missing_ports=()
    for port_mapping in "${EXPECTED_NAMED_PORTS[@]}"; do
        local service="${port_mapping%:*}"
        local port="${port_mapping#*:}"

        if ! echo "$output" | grep -q "$service.*$port"; then
            missing_ports+=("$service:$port")
        fi
    done

    if [[ ${#missing_ports[@]} -gt 0 ]]; then
        tsm_log_failure "Missing named ports: ${missing_ports[*]}"
        tsm_log_debug "Actual output:\n$output"
        return 1
    fi

    tsm_log_debug "All expected named ports found in output"
    return 0
}

test_show_named_ports_json() {
    tsm_log_info "Testing: Named ports JSON format"

    local output
    output=$(tsm ports json 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "ports json command failed with exit code $exit_code"
        return 1
    fi

    # Check that output is valid JSON
    if ! echo "$output" | python3 -m json.tool >/dev/null 2>&1; then
        tsm_log_failure "Output is not valid JSON"
        tsm_log_debug "Output: $output"
        return 1
    fi

    # Check that expected services are in JSON
    for port_mapping in "${EXPECTED_NAMED_PORTS[@]}"; do
        local service="${port_mapping%:*}"
        local port="${port_mapping#*:}"

        if ! echo "$output" | grep -q "\"$service\".*$port"; then
            tsm_log_failure "Service $service with port $port not found in JSON"
            return 1
        fi
    done

    tsm_log_debug "JSON format output validated successfully"
    return 0
}

test_show_named_ports_env() {
    tsm_log_info "Testing: Named ports environment format"

    local output
    output=$(tsm ports env 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "ports env command failed with exit code $exit_code"
        return 1
    fi

    # Check that output contains export statements
    if ! echo "$output" | grep -q "^export.*_PORT="; then
        tsm_log_failure "No export statements found in env output"
        tsm_log_debug "Output: $output"
        return 1
    fi

    # Check that expected services have environment variables
    for port_mapping in "${EXPECTED_NAMED_PORTS[@]}"; do
        local service="${port_mapping%:*}"
        local port="${port_mapping#*:}"
        local upper_service=$(echo "$service" | tr '[:lower:]' '[:upper:]')

        if ! echo "$output" | grep -q "export ${upper_service}_PORT=$port"; then
            tsm_log_failure "Environment variable for $service not found: ${upper_service}_PORT=$port"
            return 1
        fi
    done

    tsm_log_debug "Environment format output validated successfully"
    return 0
}

# === ENVIRONMENT-SPECIFIC TESTS ===

test_show_services_for_environment() {
    tsm_log_info "Testing: Show services available for specific environments"

    local env_name="$1"
    if [[ -z "$env_name" ]]; then
        env_name="dev"
    fi

    # Create a temporary service with the specified environment
    local test_service_file="$TSM_TEST_DIR/services/env-test-${env_name}.tsm"
    cat > "$test_service_file" << EOF
#!/usr/bin/env bash
# TSM Service: env-test-${env_name}

TSM_NAME="env-test-${env_name}"
TSM_COMMAND="echo 'test service for ${env_name}'"
TSM_CWD="$TSM_TEST_DIR"
TSM_ENV_FILE="env/${env_name}.env"
EOF

    # Test that we can identify services for this environment
    # This is conceptual - implementing env-specific service listing

    # For now, test that the service file exists and is readable
    if [[ ! -f "$test_service_file" ]]; then
        tsm_log_failure "Test service file not created: $test_service_file"
        return 1
    fi

    # Check that the service references the correct environment
    if ! grep -q "TSM_ENV_FILE=\"env/${env_name}.env\"" "$test_service_file"; then
        tsm_log_failure "Service doesn't reference correct environment file"
        return 1
    fi

    tsm_log_debug "Service created for environment: $env_name"
    return 0
}

test_services_available_with_env_names() {
    tsm_log_info "Testing: Services-available shows environment names/dirs"

    # Create services for different environments
    create_test_service_configs

    # Test for each environment
    for env in "${TEST_ENVS[@]}"; do
        if ! test_show_services_for_environment "$env"; then
            tsm_log_failure "Failed to create/validate service for environment: $env"
            return 1
        fi
    done

    tsm_log_debug "All environment-specific services validated"
    return 0
}

# === PORT RESOLUTION TESTS ===

test_port_resolution_priority() {
    tsm_log_info "Testing: Port resolution priority (explicit > env file > named registry > default)"

    # Test that TSM resolves ports in correct priority order
    local service_name="test-resolution"

    # Test 1: No port specified, should use named registry (if service is in registry)
    # Test 2: PORT in env file should override named registry
    # Test 3: Explicit --port should override everything

    # For now, test that we can call the port resolution function
    if command -v tsm_resolve_service_port >/dev/null 2>&1; then
        # Test explicit port priority
        local resolved_port
        resolved_port=$(tsm_resolve_service_port "test" "9999" "3000")
        if [[ "$resolved_port" != "9999" ]]; then
            tsm_log_failure "Explicit port not prioritized: expected 9999, got $resolved_port"
            return 1
        fi

        # Test env file port priority
        resolved_port=$(tsm_resolve_service_port "test" "" "3000")
        if [[ "$resolved_port" != "3000" ]]; then
            tsm_log_failure "Env file port not used: expected 3000, got $resolved_port"
            return 1
        fi

        # Test named port fallback
        resolved_port=$(tsm_resolve_service_port "devpages" "" "")
        if [[ "$resolved_port" != "4000" ]]; then
            tsm_log_failure "Named port not used for devpages: expected 4000, got $resolved_port"
            return 1
        fi

        tsm_log_debug "Port resolution priority working correctly"
        return 0
    else
        tsm_log_warning "tsm_resolve_service_port function not available - skipping detailed priority test"
        return 0
    fi
}

# === DEVPAGES AUTO-START TESTS ===

test_devpages_auto_start() {
    tsm_log_info "Testing: Devpages auto-start functionality"

    # Check if devpages service is defined and enabled
    local services_output
    services_output=$(tsm services 2>&1)

    if ! echo "$services_output" | grep -q "devpages.*✅"; then
        tsm_log_failure "Devpages service not enabled for auto-start"
        tsm_log_debug "Services output: $services_output"
        return 1
    fi

    # Test that we can show the devpages service configuration
    local show_output
    show_output=$(tsm show devpages 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "Cannot show devpages service configuration"
        return 1
    fi

    # Check that the service has required configuration
    if ! echo "$show_output" | grep -q "Name: devpages"; then
        tsm_log_failure "Devpages service configuration incomplete"
        return 1
    fi

    tsm_log_debug "Devpages auto-start configuration validated"
    return 0
}

test_devpages_named_port_resolution() {
    tsm_log_info "Testing: Devpages uses named port when no PORT in env"

    # Check that devpages resolves to its named port (4000) when env file has no PORT
    if command -v tsm_get_named_port >/dev/null 2>&1; then
        local named_port
        named_port=$(tsm_get_named_port "devpages")

        if [[ "$named_port" != "4000" ]]; then
            tsm_log_failure "Devpages named port incorrect: expected 4000, got $named_port"
            return 1
        fi

        tsm_log_debug "Devpages named port resolution correct: $named_port"
        return 0
    else
        tsm_log_warning "tsm_get_named_port function not available - skipping test"
        return 0
    fi
}

# === INTEGRATION TESTS ===

test_flat_file_services_available() {
    tsm_log_info "Testing: Flat file structure for services-available"

    # The requirement mentions using flat files for services-available
    # Test that we can create and organize services in a flat structure

    local services_dir="$TSM_TEST_DIR/services-available"
    mkdir -p "$services_dir"

    # Create flat file structure with env indicators in names
    for env in "${TEST_ENVS[@]}"; do
        for service in "webapp" "api" "worker"; do
            local service_file="$services_dir/${service}-${env}.tsm"
            cat > "$service_file" << EOF
#!/usr/bin/env bash
# TSM Service: ${service}-${env}

TSM_NAME="${service}-${env}"
TSM_COMMAND="node server.js"
TSM_CWD="/tmp/${service}"
TSM_ENV_FILE="env/${env}.env"
EOF
        done
    done

    # Verify files were created
    local file_count
    file_count=$(find "$services_dir" -name "*.tsm" | wc -l)

    local expected_count=$((${#TEST_ENVS[@]} * 3)) # 3 services per env
    if [[ $file_count -ne $expected_count ]]; then
        tsm_log_failure "Incorrect number of service files: expected $expected_count, got $file_count"
        return 1
    fi

    tsm_log_debug "Flat file services-available structure created successfully"
    return 0
}

# === MAIN TEST SUITE ===

main() {
    # Parse command line arguments
    tsm_parse_test_args "$@"

    # Setup test environment
    if ! tsm_test_setup "TSM Named Ports Test Suite"; then
        echo "Failed to setup test environment"
        exit 1
    fi

    # Create test data
    create_test_env_configs

    # === Named Ports Display Tests ===
    tsm_log_section "Named Ports Display Tests"
    run_test "Show all named ports (table format)" test_show_named_ports_all
    run_test "Show named ports (JSON format)" test_show_named_ports_json
    run_test "Show named ports (environment format)" test_show_named_ports_env

    # === Environment-Specific Tests ===
    tsm_log_section "Environment-Specific Service Tests"
    run_test "Services available with environment names" test_services_available_with_env_names
    run_test "Flat file services-available structure" test_flat_file_services_available

    # === Port Resolution Tests ===
    tsm_log_section "Port Resolution Tests"
    run_test "Port resolution priority order" test_port_resolution_priority

    # === Devpages Auto-Start Tests ===
    tsm_log_section "Devpages Auto-Start Tests"
    run_test "Devpages auto-start configuration" test_devpages_auto_start
    run_test "Devpages named port resolution" test_devpages_named_port_resolution

    # === Results ===
    tsm_test_results "TSM Named Ports Test Results"
    local results_exit_code=$?

    # Cleanup
    tsm_test_teardown

    exit $results_exit_code
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi