#!/usr/bin/env bash
# action_runner.sh - Generic Org Action Runner
# Integrates TES (Tetra Endpoint Specification)
# NOTE: TTS integration disabled to prevent fork bombs

# Source dependencies
source "${TETRA_SRC}/bash/org/org_constants.sh"

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

    # PROOF OF LIFE - Show we're actually being called
    echo ""
    echo "Going to execute $verb:$noun in $env environment"
    echo ""

    # Gather context
    local active_org=$(org_active 2>/dev/null || echo "none")
    local current_user="${USER:-unknown}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local mode="${ORG_REPL_MODE:-Inspect}"  # From REPL if available

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  ORG ACTION RUNNER                                        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    # ========================================
    # SECTION 1: Context Gathering
    # ========================================
    echo "┌───────────────────────────────────────────────────────────┐"
    echo "│ 1. CONTEXT                                                │"
    echo "└───────────────────────────────────────────────────────────┘"
    echo ""
    echo "  Action:          $action"
    echo "    ├─ Verb:       $verb (what to do)"
    echo "    └─ Noun:       $noun (target)"
    echo ""
    echo "  Environment:     $env"
    echo "  Mode:            $mode"
    echo "  Organization:    $active_org"
    echo "  User:            $current_user"
    echo "  Timestamp:       $timestamp"
    echo ""

    # ========================================
    # SECTION 2: TES Resolution
    # ========================================
    echo "┌───────────────────────────────────────────────────────────┐"
    echo "│ 2. TES ENDPOINT RESOLUTION                                │"
    echo "└───────────────────────────────────────────────────────────┘"
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

    # ========================================
    # SECTION 3: Action Plan
    # ========================================
    echo "┌───────────────────────────────────────────────────────────┐"
    echo "│ 3. EXECUTION PLAN                                         │"
    echo "└───────────────────────────────────────────────────────────┘"
    echo ""

    _org_explain_action "$verb" "$noun" "$env" "$active_org" "$tes_target"

    echo ""

    # ========================================
    # SECTION 4: Possible Nouns/Targets
    # ========================================
    echo "┌───────────────────────────────────────────────────────────┐"
    echo "│ 4. AVAILABLE TARGETS                                      │"
    echo "└───────────────────────────────────────────────────────────┘"
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

    # ========================================
    # SECTION 5: Prerequisites & Validation
    # ========================================
    echo "┌───────────────────────────────────────────────────────────┐"
    echo "│ 5. PREREQUISITES                                          │"
    echo "└───────────────────────────────────────────────────────────┘"
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
        if timeout 5 ssh -o BatchMode=yes -o ConnectTimeout=3 ${ssh_key:+-i $ssh_key} ${ssh_port:+-p $ssh_port} "$tes_target" "echo ok" &>/dev/null; then
            echo "✓"
        else
            echo "✗"
            echo "    Warning: SSH connection failed (action may fail)"
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

    # ========================================
    # SECTION 6: Confirmation
    # ========================================
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  READY TO EXECUTE                                         ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
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

    # ========================================
    # SECTION 9: Result
    # ========================================
    echo ""
    echo "┌───────────────────────────────────────────────────────────┐"
    echo "│ RESULT                                                    │"
    echo "└───────────────────────────────────────────────────────────┘"
    echo ""

    if [[ $exit_code -eq 0 ]]; then
        echo "  Status:          ✓ SUCCESS"
        echo "  Exit Code:       0"
    else
        echo "  Status:          ✗ FAILED"
        echo "  Exit Code:       $exit_code"
    fi

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  EXECUTION COMPLETE                                       ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
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
