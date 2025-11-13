#!/usr/bin/env bash
# action_runner.sh - Generic Org Action Runner
# Integrates TES (Tetra Endpoint Specification)
# NOTE: TTS integration disabled to prevent fork bombs

# Source dependencies
source "${TETRA_SRC}/bash/org/org_constants.sh"

# TES Preview Resolution - lightweight version without execution
# Returns: Multi-line string with TES endpoint information
org_resolve_tes_preview() {
    local action="$1"
    local env="${2:-Local}"

    local verb="${action%%:*}"
    local noun="${action##*:}"
    local active_org=$(org_active 2>/dev/null || echo "[UNRESOLVED]")

    local output=""
    local tes_symbol=""

    case "$env" in
        "Local")
            tes_symbol="@local"
            output+="│   Type:       local\n"
            output+="│   Symbol:     $tes_symbol\n"
            output+="│   SSH:        # Local environment - no SSH needed\n"
            ;;

        "Dev"|"Staging"|"Production")
            local env_lower="${env,,}"
            tes_symbol="@$env_lower"
            output+="│   Type:       remote\n"
            output+="│   Symbol:     $tes_symbol\n"

            if [[ "$active_org" == "[UNRESOLVED]" || "$active_org" == "none" ]]; then
                output+="│   SSH:        ⚠️  No active organization\n"
            else
                local toml_file="$TETRA_DIR/orgs/$active_org/tetra.toml"

                if [[ ! -f "$toml_file" ]]; then
                    output+="│   SSH:        ⚠️  tetra.toml not found\n"
                else
                    # Parse SSH config from TOML
                    local ssh_host=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^host" | head -1 | cut -d'"' -f2)
                    local ssh_user=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^user" | head -1 | cut -d'"' -f2)
                    local ssh_port=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^port" | head -1 | awk '{print $3}')
                    local ssh_key=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^identity" | head -1 | cut -d'"' -f2)

                    if [[ -z "$ssh_host" || -z "$ssh_user" ]]; then
                        output+="│   SSH:        ⚠️  Incomplete SSH config\n"
                    else
                        # Build SSH command
                        local ssh_cmd="ssh"
                        [[ -n "$ssh_key" ]] && ssh_cmd+=" -i ${ssh_key/#\~/$HOME}"
                        [[ -n "$ssh_port" ]] && ssh_cmd+=" -p $ssh_port"
                        ssh_cmd+=" $ssh_user@$ssh_host"

                        output+="│   SSH:        $ssh_cmd\n"
                    fi
                fi
            fi
            ;;
    esac

    echo -e "$output"
}

# Action runner configuration
ORG_TXNS_DIR="${TETRA_DIR}/org/txns"
mkdir -p "$ORG_TXNS_DIR"

# Override TTM_TXNS_DIR for org module
export TTM_TXNS_DIR="$ORG_TXNS_DIR"

# Generic org action runner
# Gathers context, resolves endpoints, creates transaction, executes
org_run_action() {
    local action="$1"
    local env="$2"

    # Parse action
    local verb="${action%%:*}"
    local noun="${action##*:}"

    # Verbosity control: simple inspect actions in Local env = quiet mode
    local verbose=true
    if [[ "$env" == "Local" && ( "$verb" == "view" || "$verb" == "list" || "$verb" == "validate" ) ]]; then
        # Execute directly without all the ceremony
        org_execute_action "$action" "$env"
        return $?
    fi

    # Show execution intent
    echo ""
    echo "Going to execute $verb:$noun in $env environment"
    echo ""

    # Gather context
    local active_org=$(org_active 2>/dev/null || echo "none")
    local current_user="${USER:-unknown}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local mode="${ORG_REPL_MODE:-Inspect}"  # From REPL if available

    echo ""
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h2"
        echo "ORG ACTION RUNNER"
        tput sgr0
    else
        echo "ORG ACTION RUNNER"
    fi
    echo ""

    # Context
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        echo "CONTEXT"
        tput sgr0
    else
        echo "CONTEXT"
    fi
    echo ""
    echo "  Action:          $action"
    echo "    • Verb:        $verb (what to do)"
    echo "    • Noun:        $noun (target)"
    echo ""
    echo "  Environment:     $env"
    echo "  Mode:            $mode"
    echo "  Organization:    $active_org"
    echo "  User:            $current_user"
    echo "  Timestamp:       $timestamp"
    echo ""

    # TES Resolution
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        echo "TES ENDPOINT RESOLUTION"
        tput sgr0
    else
        echo "TES ENDPOINT RESOLUTION"
    fi
    echo ""

    local tes_symbol=""
    local tes_method=""
    local tes_target=""
    local tes_location=""
    local tes_requires_ssh=false

    case "$env" in
        "Local")
            tes_symbol="@local"
            tes_method="Direct file operations"
            tes_target="This machine"
            tes_location="$TETRA_DIR/orgs/$active_org/"
            tes_requires_ssh=false

            echo "  Symbol:          $tes_symbol"
            echo "  Target:          $tes_target"
            echo "  Method:          $tes_method"
            echo "  Location:        $tes_location"
            echo "  SSH Required:    No"
            ;;

        "Dev"|"Staging"|"Production")
            local env_lower="${env,,}"
            tes_symbol="@$env_lower"
            tes_requires_ssh=true

            local toml_file="$TETRA_DIR/orgs/$active_org/tetra.toml"

            echo "  Symbol:          $tes_symbol"
            echo "  Source:          tetra.toml"
            echo ""

            if [[ ! -f "$toml_file" ]]; then
                echo "  Status:          ⚠️  ERROR"
                echo "  Error:           tetra.toml not found"
                echo "  Expected:        $toml_file"
                echo ""
                return 1
            fi

            # Parse tetra.toml for endpoint configuration
            local ssh_host=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^host" | head -1 | cut -d'"' -f2)
            local ssh_user=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^user" | head -1 | cut -d'"' -f2)
            local ssh_port=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^port" | head -1 | awk '{print $3}')
            local ssh_key=$(grep -A10 "^\[$env_lower\]" "$toml_file" 2>/dev/null | grep "^identity" | head -1 | cut -d'"' -f2)

            # Validate SSH key if specified
            if [[ -n "$ssh_key" ]]; then
                # Expand tilde to home directory
                ssh_key="${ssh_key/#\~/$HOME}"

                if [[ ! -f "$ssh_key" ]]; then
                    echo "  Status:          ⚠️  ERROR"
                    echo "  Error:           SSH key file not found: $ssh_key"
                    echo ""
                    return 1
                fi

                # Check file permissions (should be 600 or 400)
                local key_perms=$(stat -f "%OLp" "$ssh_key" 2>/dev/null || stat -c "%a" "$ssh_key" 2>/dev/null)
                if [[ "$key_perms" != "600" && "$key_perms" != "400" ]]; then
                    echo "  Status:          ⚠️  WARNING"
                    echo "  Warning:         SSH key has insecure permissions: $key_perms"
                    echo "  Expected:        600 or 400"
                    echo "  Key File:        $ssh_key"
                    echo "  Fix with:        chmod 600 $ssh_key"
                    echo ""
                fi
            fi

            if [[ -z "$ssh_host" || -z "$ssh_user" ]]; then
                echo "  Status:          ⚠️  ERROR"
                echo "  Error:           Incomplete SSH configuration in tetra.toml"
                echo "  Missing:         host or user fields in [$env_lower] section"
                echo ""
                return 1
            fi

            tes_target="$ssh_user@$ssh_host"
            tes_method="SSH connection"
            tes_location="ssh://$ssh_user@$ssh_host${ssh_port:+:$ssh_port}"

            echo "  Resolved Configuration:"
            echo "    ├─ Host:         $ssh_host"
            echo "    ├─ User:         $ssh_user"
            echo "    ├─ Port:         ${ssh_port:-22 (default)}"
            echo "    ├─ Identity:     ${ssh_key:-default}"
            echo "    └─ Full Target:  $tes_target"
            echo ""
            echo "  SSH Command:     ssh ${ssh_key:+-i $ssh_key }${ssh_port:+-p $ssh_port }$tes_target"
            echo "  SSH Required:    Yes"
            ;;
    esac

    echo ""

    # Execution Plan
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        echo "EXECUTION PLAN"
        tput sgr0
    else
        echo "EXECUTION PLAN"
    fi
    echo ""

    _org_explain_action "$verb" "$noun" "$env" "$active_org" "$tes_target"

    echo ""

    # Available Targets
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        echo "AVAILABLE TARGETS"
        tput sgr0
    else
        echo "AVAILABLE TARGETS"
    fi
    echo ""

    case "$noun" in
        "orgs")
            echo "  Target Type:     Organizations"
            local org_count=$(find "$TETRA_DIR/orgs" -maxdepth 1 -type d 2>/dev/null | wc -l)
            echo "  Available:       $((org_count - 1)) organizations in $TETRA_DIR/orgs/"
            ;;
        "toml")
            echo "  Target Type:     Configuration file"
            echo "  File:            $TETRA_DIR/orgs/$active_org/tetra.toml"
            if [[ -f "$TETRA_DIR/orgs/$active_org/tetra.toml" ]]; then
                local line_count=$(wc -l < "$TETRA_DIR/orgs/$active_org/tetra.toml")
                echo "  Status:          ✓ Exists ($line_count lines)"
            else
                echo "  Status:          ⚠️  Not found"
            fi
            ;;
        "secrets")
            echo "  Target Type:     Secrets file"
            echo "  File:            $TETRA_DIR/orgs/$active_org/secrets.env"
            if [[ -f "$TETRA_DIR/orgs/$active_org/secrets.env" ]]; then
                local secret_count=$(grep -c "^[A-Z_]*=" "$TETRA_DIR/orgs/$active_org/secrets.env" 2>/dev/null || echo 0)
                echo "  Status:          ✓ Exists ($secret_count secrets)"
            else
                echo "  Status:          ⚠️  Not found"
            fi
            ;;
        "config")
            echo "  Target Type:     Configuration bundle"
            echo "  Includes:        tetra.toml, secrets.env, scripts/"
            ;;
        *)
            echo "  Target Type:     $noun"
            echo "  Context:         $env environment"
            ;;
    esac

    echo ""

    # Prerequisites
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        echo "PREREQUISITES"
        tput sgr0
    else
        echo "PREREQUISITES"
    fi
    echo ""

    local prereq_passed=true

    # Check organization active
    if [[ "$active_org" == "none" ]]; then
        echo "  ✗ No active organization"
        prereq_passed=false
    else
        echo "  ✓ Active organization: $active_org"
    fi

    # Check SSH connectivity for remote environments
    if [[ "$tes_requires_ssh" == "true" ]]; then
        echo -n "  ⋯ Checking SSH connectivity to $tes_target... "
        if timeout "$ORG_SSH_OVERALL_TIMEOUT" ssh \
            -o BatchMode="$ORG_SSH_BATCH_MODE" \
            -o ConnectTimeout="$ORG_SSH_CONNECT_TIMEOUT" \
            ${ssh_key:+-i "$ssh_key"} \
            ${ssh_port:+-p "$ssh_port"} \
            "$tes_target" "echo ok" &>/dev/null; then
            echo "✓"
        else
            echo "✗"
            echo "    Warning: SSH connection failed (action may fail)"
            echo "    Timeout: ${ORG_SSH_OVERALL_TIMEOUT}s (override with ORG_SSH_OVERALL_TIMEOUT)"
        fi
    fi

    # Check required tools
    case "$verb" in
        "validate")
            if command -v toml >/dev/null 2>&1 || command -v jq >/dev/null 2>&1; then
                echo "  ✓ Validation tools available"
            else
                echo "  ⚠️  No TOML validator found (will use basic checks)"
            fi
            ;;
        "compile")
            if [[ -f "$TETRA_SRC/bash/org/compiler.sh" ]]; then
                echo "  ✓ Compiler available"
            else
                echo "  ✗ Compiler not found"
                prereq_passed=false
            fi
            ;;
    esac

    echo ""

    if [[ "$prereq_passed" != "true" ]]; then
        echo "⚠️  Prerequisites not met. Continue anyway? [y/N]: "
        read -r continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy] ]]; then
            echo ""
            echo "✗ Action cancelled due to failed prerequisites"
            echo ""
            return 1
        fi
    fi

    # Confirmation
    echo ""
    if type tds_text_color &>/dev/null; then
        tds_text_color "repl.feedback.success"
        echo "READY TO EXECUTE"
        tput sgr0
    else
        echo "READY TO EXECUTE"
    fi
    echo ""
    printf "Execute action '$action' on $tes_symbol? [Y/n]: "
    read -r confirm
    confirm="${confirm:-Y}"

    if [[ ! "$confirm" =~ ^[Yy] ]]; then
        echo ""
        echo "✗ Action cancelled by user"
        echo ""
        return 0
    fi

    # ========================================
    # SECTION 7: Execute (TTS disabled)
    # ========================================
    echo ""
    echo "▶ Executing..."
    echo ""

    # ========================================
    # SECTION 8: Execute Action
    # ========================================
    org_execute_action "$action" "$env"
    local exit_code=$?

    # Result
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        if type tds_text_color &>/dev/null; then
            tds_text_color "repl.feedback.success"
            echo "✓ SUCCESS"
            tput sgr0
        else
            echo "✓ SUCCESS"
        fi
        echo "  Exit Code: 0"
    else
        if type tds_text_color &>/dev/null; then
            tds_text_color "repl.feedback.error"
            echo "✗ FAILED"
            tput sgr0
        else
            echo "✗ FAILED"
        fi
        echo "  Exit Code: $exit_code"
    fi
    echo ""

    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h2"
        echo "EXECUTION COMPLETE"
        tput sgr0
    else
        echo "EXECUTION COMPLETE"
    fi
    echo ""

    printf "Press RETURN to continue..."
    read -r

    return $exit_code
}

# Helper: Explain what an action will do
_org_explain_action() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local org="$4"
    local target="$5"

    echo "  This action will:"
    echo ""

    case "$verb:$noun" in
        "view:orgs")
            echo "    1. List all organizations in $TETRA_DIR/orgs/"
            echo "    2. Highlight the currently active organization"
            echo "    3. Show basic metadata for each"
            ;;
        "view:toml")
            echo "    1. Read tetra.toml from $TETRA_DIR/orgs/$org/"
            echo "    2. Display with syntax highlighting (if available)"
            echo "    3. Show all configured endpoints"
            ;;
        "view:secrets")
            echo "    1. Read secrets.env from $TETRA_DIR/orgs/$org/"
            echo "    2. Display only KEY names (not values)"
            echo "    3. Mask all secret values as '***'"
            ;;
        "validate:toml")
            echo "    1. Parse tetra.toml file"
            echo "    2. Check TOML syntax validity"
            echo "    3. Verify required sections exist"
            echo "    4. Report any errors or warnings"
            ;;
        "push:config")
            echo "    1. Connect to $target via SSH"
            echo "    2. Transfer tetra.toml and secrets.env"
            echo "    3. Set appropriate file permissions"
            echo "    4. Verify transfer completed successfully"
            ;;
        "pull:config")
            echo "    1. Connect to $target via SSH"
            echo "    2. Download remote tetra.toml"
            echo "    3. Save to local $TETRA_DIR/orgs/$org/"
            echo "    4. Create backup of existing local file"
            ;;
        "check:connectivity")
            echo "    1. Resolve SSH target: $target"
            echo "    2. Attempt SSH connection"
            echo "    3. Run basic commands (echo, pwd)"
            echo "    4. Report connection status"
            ;;
        "compile:toml")
            echo "    1. Read source configuration"
            echo "    2. Apply organization-specific transformations"
            echo "    3. Generate compiled tetra.toml"
            echo "    4. Validate output"
            ;;
        *)
            echo "    1. Execute $verb operation"
            echo "    2. Target: $noun in $env environment"
            if [[ "$target" != "This machine" ]]; then
                echo "    3. Connect to: $target"
            fi
            ;;
    esac
}

# Export functions
export -f org_run_action
export -f _org_explain_action
