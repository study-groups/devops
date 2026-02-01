#!/usr/bin/env bash
# test-nh-bridge.sh - Tests for nh_bridge JSON parsing and import
set +e

source "$(dirname "$0")/test-framework.sh"

# Test fixture
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_FILE="$SCRIPT_DIR/fixtures/testorg-digocean.json"

startup_test_setup "NH Bridge Tests"

# Source nh_bridge modules
source "$TETRA_SRC/bash/nh_bridge/nhb_import.sh"
source "$TETRA_SRC/bash/nh_bridge/nhb_bridge.sh"

# ─── JSON Parsing ───

test_nhb_get_droplets() {
    local count
    count=$(_nhb_get_droplets "$JSON_FILE" | wc -l | tr -d ' ')
    [[ "$count" -eq 3 ]]
}

test_nhb_get_base_domain() {
    local domain
    domain=$(_nhb_get_base_domain "$JSON_FILE")
    [[ "$domain" == "testorg.example.com" ]]
}

test_nhb_droplet_ip() {
    local droplet ip
    droplet=$(_nhb_get_droplets "$JSON_FILE" | head -1)
    ip=$(_nhb_droplet_ip "$droplet")
    [[ "$ip" == "192.0.2.10" ]]
}

test_nhb_droplet_private_ip() {
    local droplet pip
    droplet=$(_nhb_get_droplets "$JSON_FILE" | head -1)
    pip=$(_nhb_droplet_private_ip "$droplet")
    [[ "$pip" == "10.0.0.10" ]]
}

# ─── Environment Detection ───

test_nhb_detect_env_dev() {
    local result
    result=$(_nhb_detect_env "testorg-dev01" "dev ")
    [[ "$result" == "dev" ]]
}

test_nhb_detect_env_qa() {
    local result
    result=$(_nhb_detect_env "testorg-qa01" "qa ")
    [[ "$result" == "staging" ]]
}

test_nhb_detect_env_prod() {
    local result
    result=$(_nhb_detect_env "testorg-prod01" "production ")
    [[ "$result" == "prod" ]]
}

test_nhb_detect_env_unknown() {
    local result
    result=$(_nhb_detect_env "mystery-box" "")
    [[ -z "$result" ]]
}

test_nhb_env_map_override() {
    # Create temp env-map.conf next to the JSON
    local map_file="${JSON_FILE%/*}/env-map.conf"
    local had_map=false
    [[ -f "$map_file" ]] && had_map=true && cp "$map_file" "${map_file}.bak"

    cat > "$map_file" << 'EOF'
testorg-dev01=dev
testorg-qa01=staging
testorg-prod01=prod
EOF

    _nhb_load_env_map "$JSON_FILE"

    local result
    result=$(_nhb_get_envs "testorg-qa01" "")
    local ok=false
    [[ "$result" == "staging" ]] && ok=true

    # Cleanup
    if [[ "$had_map" == "true" ]]; then
        mv "${map_file}.bak" "$map_file"
    else
        rm -f "$map_file"
    fi

    # Reset map
    _NHB_ENV_MAP=()

    $ok
}

# ─── Full Import ───

test_nhb_import_creates_infra_toml() {
    _create_test_org "testorg-nhb" >/dev/null
    nhb_import "$JSON_FILE" "testorg-nhb" "no-build" >/dev/null 2>&1
    # nhb_import writes to flat structure: $org_dir/10-infrastructure.toml
    [[ -f "$TETRA_DIR/orgs/testorg-nhb/10-infrastructure.toml" ]]
}

test_nhb_import_has_all_envs() {
    local infra="$TETRA_DIR/orgs/testorg-nhb/10-infrastructure.toml"
    grep -q '\[env\.dev\]' "$infra" &&
    grep -q '\[env\.staging\]' "$infra" &&
    grep -q '\[env\.prod\]' "$infra"
}

test_nhb_import_has_correct_ips() {
    local infra="$TETRA_DIR/orgs/testorg-nhb/10-infrastructure.toml"
    grep -q '192.0.2.10' "$infra" &&
    grep -q '192.0.2.20' "$infra" &&
    grep -q '192.0.2.30' "$infra"
}

test_nhb_import_has_domain() {
    local infra="$TETRA_DIR/orgs/testorg-nhb/10-infrastructure.toml"
    grep -q 'testorg.example.com' "$infra"
}

# ─── Run ───

log_section "JSON Parsing"
run_test "nhb_get_droplets parses 3 droplets" test_nhb_get_droplets
run_test "nhb_get_base_domain extracts domain" test_nhb_get_base_domain
run_test "nhb_droplet_ip gets public IP" test_nhb_droplet_ip
run_test "nhb_droplet_private_ip gets private IP" test_nhb_droplet_private_ip

log_section "Environment Detection"
run_test "detect_env: dev tag -> dev" test_nhb_detect_env_dev
run_test "detect_env: qa tag -> staging" test_nhb_detect_env_qa
run_test "detect_env: production tag -> prod" test_nhb_detect_env_prod
run_test "detect_env: unknown -> empty" test_nhb_detect_env_unknown
run_test "env-map.conf overrides auto-detection" test_nhb_env_map_override

log_section "Full Import"
run_test "nhb_import creates 10-infrastructure.toml" test_nhb_import_creates_infra_toml
run_test "nhb_import output has all envs" test_nhb_import_has_all_envs
run_test "nhb_import output has correct IPs" test_nhb_import_has_correct_ips
run_test "nhb_import output has domain" test_nhb_import_has_domain

startup_test_results "NH Bridge Results"
exit $TESTS_FAILED
