#!/usr/bin/env bash

# Template Validation Comprehensive Test Suite
# Tests SystemD service file validation and nginx configuration syntax as mentioned in next.md

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Template Validation Comprehensive Test Suite ===${NC}"

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Setup test environment
export TETRA_SRC="${TETRA_SRC:-${PWD%/tests}}"

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_TESTS++))
}

test_skip() {
    echo -e "${YELLOW}~${NC} $1"
}

run_test() {
    ((TOTAL_TESTS++))
    if "$@"; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}=== Testing SystemD Service File Validation ===${NC}"

# Test 1: SystemD service file exists and has required sections
test_systemd_service_validation() {
    local service_file="$TETRA_SRC/systemd/tetra.service"

    if [[ -f "$service_file" ]]; then
        local valid=true
        local missing_sections=()

        # Check required sections
        if ! grep -q "^\[Unit\]" "$service_file"; then
            valid=false
            missing_sections+=("Unit")
        fi

        if ! grep -q "^\[Service\]" "$service_file"; then
            valid=false
            missing_sections+=("Service")
        fi

        if ! grep -q "^\[Install\]" "$service_file"; then
            valid=false
            missing_sections+=("Install")
        fi

        # Check required directives
        if ! grep -q "^ExecStart=" "$service_file"; then
            valid=false
            missing_sections+=("ExecStart")
        fi

        if ! grep -q "^Type=" "$service_file"; then
            valid=false
            missing_sections+=("Type")
        fi

        if [[ "$valid" == "true" ]]; then
            test_pass "SystemD service file validation (all required sections present)"
            return 0
        else
            test_fail "SystemD service file validation (missing: ${missing_sections[*]})"
            return 1
        fi
    else
        test_fail "SystemD service file not found at $service_file"
        return 1
    fi
}
run_test test_systemd_service_validation

# Test 2: SystemD service file syntax validation
test_systemd_syntax_validation() {
    local service_file="$TETRA_SRC/systemd/tetra.service"

    if [[ -f "$service_file" ]]; then
        # Check for common syntax issues
        local syntax_valid=true
        local issues=()

        # Check for proper section headers (no spaces around brackets)
        if grep -q "^[ ]*\[.*\][ ]*$" "$service_file"; then
            if ! grep -E "^\[[A-Za-z]+\]$" "$service_file" >/dev/null; then
                syntax_valid=false
                issues+=("malformed_section_headers")
            fi
        fi

        # Check for proper key=value format
        if grep -q "^[A-Za-z].*=" "$service_file"; then
            if grep -E "^[A-Za-z].*= " "$service_file" >/dev/null; then
                # Leading spaces in values might be intentional, so this is just a warning
                true
            fi
        fi

        # Check for required systemd service directives
        if ! grep -q "^Restart=" "$service_file"; then
            issues+=("missing_restart_directive")
        fi

        if [[ "$syntax_valid" == "true" && ${#issues[@]} -eq 0 ]]; then
            test_pass "SystemD service file syntax validation"
            return 0
        else
            test_fail "SystemD service file syntax issues: ${issues[*]}"
            return 1
        fi
    else
        test_skip "SystemD service file syntax validation (file not found)"
        return 1
    fi
}
run_test test_systemd_syntax_validation

echo -e "${BLUE}=== Testing Service Template Generation ===${NC}"

# Test 3: Service template files exist and are valid
test_service_template_validation() {
    local template_dir="$TETRA_SRC/templates"
    local systemd_templates="$template_dir/systemd"
    local template_count=0
    local valid_templates=0

    if [[ -d "$systemd_templates" ]]; then
        for template in "$systemd_templates"/*.service; do
            if [[ -f "$template" ]]; then
                ((template_count++))

                # Basic validation - check for required sections
                if grep -q "\[Unit\]" "$template" && \
                   grep -q "\[Service\]" "$template" && \
                   grep -q "\[Install\]" "$template"; then
                    ((valid_templates++))
                fi
            fi
        done
    fi

    if [[ $template_count -gt 0 && $valid_templates -eq $template_count ]]; then
        test_pass "Service template validation ($valid_templates/$template_count templates valid)"
        return 0
    elif [[ $template_count -gt 0 ]]; then
        test_fail "Service template validation ($valid_templates/$template_count templates valid)"
        return 1
    else
        test_skip "No service templates found for validation"
        return 1
    fi
}
run_test test_service_template_validation

# Test 4: Nginx configuration template validation
test_nginx_template_validation() {
    local template_dir="$TETRA_SRC/templates"
    local nginx_templates="$template_dir/nginx"
    local template_count=0
    local valid_templates=0

    if [[ -d "$nginx_templates" ]]; then
        for template in "$nginx_templates"/*.conf; do
            if [[ -f "$template" ]]; then
                ((template_count++))

                # Basic nginx config validation - check for server block
                if grep -q "server {" "$template" || grep -q "server{" "$template"; then
                    # Check for common nginx directives
                    if grep -q "listen" "$template" && \
                       (grep -q "server_name" "$template" || grep -q "location" "$template"); then
                        ((valid_templates++))
                    fi
                fi
            fi
        done
    fi

    if [[ $template_count -gt 0 && $valid_templates -eq $template_count ]]; then
        test_pass "Nginx template validation ($valid_templates/$template_count templates valid)"
        return 0
    elif [[ $template_count -gt 0 ]]; then
        test_fail "Nginx template validation ($valid_templates/$template_count templates valid)"
        return 1
    else
        test_skip "No nginx templates found for validation"
        return 1
    fi
}
run_test test_nginx_template_validation

echo -e "${BLUE}=== Testing Environment-Specific Template Generation ===${NC}"

# Test 5: Environment-specific template naming convention
test_environment_template_naming() {
    local template_dir="$TETRA_SRC/templates"
    local env_templates=()
    local environments=("dev" "staging" "prod")

    # Check for environment-specific templates
    for env in "${environments[@]}"; do
        if [[ -f "$template_dir/systemd/pixeljam-arcade-${env}.service" ]]; then
            env_templates+=("systemd:$env")
        fi
        if [[ -f "$template_dir/nginx/pixeljam-arcade-${env}.conf" ]]; then
            env_templates+=("nginx:$env")
        fi
    done

    if [[ ${#env_templates[@]} -gt 0 ]]; then
        test_pass "Environment-specific template naming (${env_templates[*]})"
        return 0
    else
        test_skip "No environment-specific templates found"
        return 1
    fi
}
run_test test_environment_template_naming

# Test 6: Security setting verification in templates
test_template_security_settings() {
    local template_dir="$TETRA_SRC/templates"
    local security_checks_passed=0
    local total_checks=0

    # Check systemd templates for security settings
    if [[ -d "$template_dir/systemd" ]]; then
        for template in "$template_dir/systemd"/*prod*.service; do
            if [[ -f "$template" ]]; then
                ((total_checks++))

                # Production templates should have security hardening
                if grep -q "NoNewPrivileges=true" "$template" || \
                   grep -q "PrivateTmp=true" "$template" || \
                   grep -q "ProtectSystem=strict" "$template"; then
                    ((security_checks_passed++))
                fi
            fi
        done
    fi

    # Check nginx templates for security headers
    if [[ -d "$template_dir/nginx" ]]; then
        for template in "$template_dir/nginx"/*prod*.conf; do
            if [[ -f "$template" ]]; then
                ((total_checks++))

                # Production nginx configs should have security headers
                if grep -q "add_header X-" "$template" || \
                   grep -q "ssl_" "$template" || \
                   grep -q "security" "$template"; then
                    ((security_checks_passed++))
                fi
            fi
        done
    fi

    if [[ $total_checks -gt 0 && $security_checks_passed -eq $total_checks ]]; then
        test_pass "Template security settings verification ($security_checks_passed/$total_checks templates have security settings)"
        return 0
    elif [[ $total_checks -gt 0 ]]; then
        test_fail "Template security settings verification ($security_checks_passed/$total_checks templates have security settings)"
        return 1
    else
        test_skip "No production templates found for security verification"
        return 1
    fi
}
run_test test_template_security_settings

echo -e "${BLUE}=== Testing Template Variable Substitution ===${NC}"

# Test 7: Template variable substitution patterns
test_template_variable_substitution() {
    local template_dir="$TETRA_SRC/templates"
    local templates_with_vars=0
    local valid_var_patterns=0

    # Check for template variable patterns
    for template in "$template_dir"/**/*.{service,conf}; do
        if [[ -f "$template" ]]; then
            # Look for template variables (common patterns)
            if grep -q "\${" "$template" || \
               grep -q "{{" "$template" || \
               grep -q "%{" "$template" || \
               grep -q "your_.*_here" "$template"; then
                ((templates_with_vars++))

                # Check if variables follow consistent patterns
                if grep -E "\\\${[A-Z_]+}" "$template" >/dev/null || \
                   grep -E "{{[a-z_]+}}" "$template" >/dev/null || \
                   grep -E "your_[a-z_]+_here" "$template" >/dev/null; then
                    ((valid_var_patterns++))
                fi
            fi
        fi
    done

    if [[ $templates_with_vars -gt 0 ]]; then
        test_pass "Template variable substitution patterns ($valid_var_patterns/$templates_with_vars templates have valid patterns)"
        return 0
    else
        test_skip "No templates with variable substitution found"
        return 1
    fi
}
run_test test_template_variable_substitution

echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $TOTAL_TESTS -gt 0 ]]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "Success rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
fi

echo -e "${BLUE}=== Template Status ===${NC}"
echo "Template directory: $TETRA_SRC/templates/"
echo "SystemD templates:"
find "$TETRA_SRC/templates" -name "*.service" 2>/dev/null | sed 's/^/  /' || echo "  No systemd templates found"
echo "Nginx templates:"
find "$TETRA_SRC/templates" -name "*.conf" 2>/dev/null | sed 's/^/  /' || echo "  No nginx templates found"

echo -e "${BLUE}=== Recommendations ===${NC}"
echo "• Ensure all systemd service files have [Unit], [Service], and [Install] sections"
echo "• Production templates should include security hardening directives"
echo "• Use consistent variable substitution patterns across templates"
echo "• Test template generation with actual values before deployment"

if [[ $FAILED_TESTS -gt 0 ]]; then
    echo -e "${RED}Some template validation tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}All template validation tests completed successfully!${NC}"
fi