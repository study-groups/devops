#!/usr/bin/env bash

# TView Data Loading - TOML parsing and environment data collection

# Data loading functions
detect_active_toml() {
    # Check for organization-based TOML first
    local tetra_toml="$TETRA_DIR/config/tetra.toml"

    if [[ -L "$tetra_toml" ]]; then
        # Organization system is active
        ACTIVE_TOML="$tetra_toml"
        local target=$(readlink "$tetra_toml")
        ACTIVE_ORG=$(basename "$(dirname "$target")")
        PROJECT_NAME="$ACTIVE_ORG"
    else
        # Fallback to local TOML files
        local toml_files=(*.toml)
        if [[ -f "${toml_files[0]}" ]]; then
            ACTIVE_TOML="${toml_files[0]}"
            PROJECT_NAME="$(basename "$ACTIVE_TOML" .toml)"
            ACTIVE_ORG=""
        else
            ACTIVE_TOML=""
            PROJECT_NAME=""
            ACTIVE_ORG=""
        fi
    fi
}

# Load customization overrides from .customizations.toml
load_customization_overrides() {
    local customization_file

    # Look for customization file in organization directory
    if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        customization_file="$TETRA_DIR/orgs/$ACTIVE_ORG/${ACTIVE_ORG}.customizations.toml"
    else
        # Fallback to local directory
        customization_file="$(dirname "${ACTIVE_TOML:-}")/../customizations.toml"
    fi

    if [[ -f "$customization_file" ]]; then
        # Parse customization file with CUSTOM namespace
        if toml_parse "$customization_file" "CUSTOM" 2>/dev/null; then
            # Load SSH users arrays
            DEV_SSH_USERS=($(toml_get "ssh_users" "dev" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))
            STAGING_SSH_USERS=($(toml_get "ssh_users" "staging" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))
            PROD_SSH_USERS=($(toml_get "ssh_users" "prod" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))
            QA_SSH_USERS=($(toml_get "ssh_users" "qa" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))

            # Load SSH config preferences
            DEV_DOMAIN=$(toml_get "ssh_config" "dev_domain" "CUSTOM" 2>/dev/null || echo "")
            STAGING_DOMAIN=$(toml_get "ssh_config" "staging_domain" "CUSTOM" 2>/dev/null || echo "")
            PROD_DOMAIN=$(toml_get "ssh_config" "prod_domain" "CUSTOM" 2>/dev/null || echo "")
            QA_DOMAIN=$(toml_get "ssh_config" "qa_domain" "CUSTOM" 2>/dev/null || echo "")
            PREFER_DOMAIN_SSH=$(toml_get "ssh_config" "prefer_domain_ssh" "CUSTOM" 2>/dev/null || echo "false")

            # Load environment mapping overrides
            STAGING_SERVER_OVERRIDE=$(toml_get "environment_mapping" "staging_server_override" "CUSTOM" 2>/dev/null || echo "")
            QA_SERVER_OVERRIDE=$(toml_get "environment_mapping" "qa_server_override" "CUSTOM" 2>/dev/null || echo "")
        fi
    else
        # Set defaults if no customization file
        DEV_SSH_USERS=("root" "dev")
        STAGING_SSH_USERS=("root" "staging")
        PROD_SSH_USERS=("root" "production")
        QA_SSH_USERS=("root" "qa")
        PREFER_DOMAIN_SSH="false"
    fi

    # Apply environment mapping overrides
    apply_environment_mapping_overrides
}

# Apply environment mapping overrides (staging on prod server, etc.)
apply_environment_mapping_overrides() {
    # Handle staging_server_override = "prod_server"
    if [[ "$STAGING_SERVER_OVERRIDE" == "prod_server" ]]; then
        # Staging uses prod server's IP and hardware info, but keeps staging SSH config
        STAGING_IP="$PROD_IP"
        STAGING_PRIVATE_IP="$PROD_PRIVATE_IP"
        STAGING_REGION="$PROD_REGION"
        STAGING_SIZE="$PROD_SIZE"
        STAGING_MEMORY="$PROD_MEMORY"
        # Keep staging nickname and SSH users as configured
        # This allows staging to be a user on the prod machine
    fi

    # Handle qa_server_override if configured
    if [[ "$QA_SERVER_OVERRIDE" == "dev_server" ]]; then
        QA_IP="$DEV_IP"
        QA_PRIVATE_IP="$DEV_PRIVATE_IP"
        QA_REGION="$DEV_REGION"
        QA_SIZE="$DEV_SIZE"
        QA_MEMORY="$DEV_MEMORY"
    fi
}

load_toml_data() {
    # Source the TOML parser
    source "$TETRA_SRC/bash/utils/toml_parser.sh" 2>/dev/null || true

    # Load customization overrides if available
    load_customization_overrides

    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        # Use enhanced TOML parser for comprehensive data extraction
        if toml_parse "$ACTIVE_TOML" "TOML" 2>/dev/null; then
            # Extract infrastructure data using TOML parser
            DEV_SERVER=$(toml_get "infrastructure" "dev_server" "TOML" 2>/dev/null || grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_IP=$(toml_get "infrastructure" "dev_ip" "TOML" 2>/dev/null || grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_PRIVATE_IP=$(toml_get "infrastructure" "dev_private_ip" "TOML" 2>/dev/null || grep "^dev_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_MEMORY=$(toml_get "infrastructure" "dev_memory" "TOML" 2>/dev/null || grep "^dev_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_REGION=$(toml_get "infrastructure" "dev_region" "TOML" 2>/dev/null || grep "^dev_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_NICKNAME=$(toml_get "infrastructure" "dev_nickname" "TOML" 2>/dev/null || echo "dev-server")
            DEV_SSH_USER=$(toml_get "infrastructure" "dev_ssh_user" "TOML" 2>/dev/null || echo "dev")
            DEV_SIZE=$(toml_get "infrastructure" "dev_size" "TOML" 2>/dev/null || echo "Unknown")

            STAGING_SERVER=$(toml_get "infrastructure" "qa_server" "TOML" 2>/dev/null || grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_IP=$(toml_get "infrastructure" "qa_ip" "TOML" 2>/dev/null || grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_PRIVATE_IP=$(toml_get "infrastructure" "qa_private_ip" "TOML" 2>/dev/null || grep "^qa_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_MEMORY=$(toml_get "infrastructure" "qa_memory" "TOML" 2>/dev/null || grep "^qa_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_REGION=$(toml_get "infrastructure" "qa_region" "TOML" 2>/dev/null || grep "^qa_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_NICKNAME=$(toml_get "infrastructure" "staging_nickname" "TOML" 2>/dev/null || toml_get "infrastructure" "qa_nickname" "TOML" 2>/dev/null || echo "staging-server")
            STAGING_SSH_USER=$(toml_get "infrastructure" "staging_ssh_user" "TOML" 2>/dev/null || echo "staging")
            STAGING_SIZE=$(toml_get "infrastructure" "staging_size" "TOML" 2>/dev/null || toml_get "infrastructure" "qa_size" "TOML" 2>/dev/null || echo "Unknown")

            PROD_SERVER=$(toml_get "infrastructure" "prod_server" "TOML" 2>/dev/null || grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_IP=$(toml_get "infrastructure" "prod_ip" "TOML" 2>/dev/null || grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_PRIVATE_IP=$(toml_get "infrastructure" "prod_private_ip" "TOML" 2>/dev/null || grep "^prod_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_MEMORY=$(toml_get "infrastructure" "prod_memory" "TOML" 2>/dev/null || grep "^prod_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_REGION=$(toml_get "infrastructure" "prod_region" "TOML" 2>/dev/null || grep "^prod_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_NICKNAME=$(toml_get "infrastructure" "prod_nickname" "TOML" 2>/dev/null || echo "prod-server")
            PROD_SSH_USER=$(toml_get "infrastructure" "prod_ssh_user" "TOML" 2>/dev/null || echo "production")
            PROD_SIZE=$(toml_get "infrastructure" "prod_size" "TOML" 2>/dev/null || echo "Unknown")

            # QA Environment
            QA_SERVER=$(toml_get "infrastructure" "qa_server" "TOML" 2>/dev/null || grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_IP=$(toml_get "infrastructure" "qa_ip" "TOML" 2>/dev/null || grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_PRIVATE_IP=$(toml_get "infrastructure" "qa_private_ip" "TOML" 2>/dev/null || grep "^qa_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_MEMORY=$(toml_get "infrastructure" "qa_memory" "TOML" 2>/dev/null || grep "^qa_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_REGION=$(toml_get "infrastructure" "qa_region" "TOML" 2>/dev/null || grep "^qa_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_NICKNAME=$(toml_get "infrastructure" "qa_nickname" "TOML" 2>/dev/null || echo "qa-server")
            QA_SSH_USER=$(toml_get "infrastructure" "qa_ssh_user" "TOML" 2>/dev/null || echo "qa")
            QA_SIZE=$(toml_get "infrastructure" "qa_size" "TOML" 2>/dev/null || echo "Unknown")

            # Extract domain configuration - multiple fallback strategies
            DOMAIN_BASE=$(toml_get "domains" "base_domain" "TOML" 2>/dev/null || \
                         toml_get "domain" "base" "TOML" 2>/dev/null || \
                         grep "^base_domain" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || \
                         echo "pixeljamarcade.com")

            # Environment-specific domains with enhanced fallbacks
            DEV_DOMAIN=$(toml_get "environments_dev" "domain" "TOML" 2>/dev/null || \
                        toml_get "domains" "dev" "TOML" 2>/dev/null || \
                        toml_get "domain" "dev" "TOML" 2>/dev/null || \
                        echo "dev.$DOMAIN_BASE")

            STAGING_DOMAIN=$(toml_get "environments_staging" "domain" "TOML" 2>/dev/null || \
                           toml_get "domains" "staging" "TOML" 2>/dev/null || \
                           toml_get "domain" "staging" "TOML" 2>/dev/null || \
                           echo "staging.$DOMAIN_BASE")

            PROD_DOMAIN=$(toml_get "environments_prod" "domain" "TOML" 2>/dev/null || \
                         toml_get "domains" "prod" "TOML" 2>/dev/null || \
                         toml_get "domain" "prod" "TOML" 2>/dev/null || \
                         echo "$DOMAIN_BASE")

            # Organization metadata
            ORG_NAME=$(toml_get "metadata" "name" "TOML" 2>/dev/null || \
                      toml_get "org" "name" "TOML" 2>/dev/null || \
                      echo "Unknown")
            ORG_TYPE=$(toml_get "metadata" "type" "TOML" 2>/dev/null || echo "standard")
            ORG_PROVIDER=$(toml_get "infrastructure" "provider" "TOML" 2>/dev/null || \
                          toml_get "org" "provider" "TOML" 2>/dev/null || echo "Unknown")

            # Check for shared infrastructure scenarios
            SHARED_IP_MODE="false"
            if [[ "$DEV_IP" == "$STAGING_IP" && "$STAGING_IP" == "$PROD_IP" && "$DEV_IP" != "Unknown" ]]; then
                SHARED_IP_MODE="true"
                SHARED_IP="$DEV_IP"
            fi

            # Extract port and service configuration
            LOCAL_DOMAIN="localhost"
            LOCAL_PORT=$(toml_get "environments_local" "app_port" "TOML" 2>/dev/null || \
                        toml_get "services_app_dev" "port" "TOML" 2>/dev/null || \
                        grep "^app_port" "$ACTIVE_TOML" | cut -d'=' -f2 | tr -d ' ' 2>/dev/null || echo "3000")
            LOCAL_NODE_ENV=$(toml_get "environments_local" "node_env" "TOML" 2>/dev/null || echo "development")
            LOCAL_DATA_DIR=$(toml_get "paths" "data" "TOML" 2>/dev/null || echo "/home/dev/pj/pd")
            LOCAL_SERVICE_CONFIG=$(toml_get "services_app_dev" "start_command" "TOML" 2>/dev/null || echo "npm run dev")

            # Extract services information
            SERVICES_TYPE=$(toml_get "services_app" "type" "TOML" 2>/dev/null || echo "nodejs")
            SERVICES_ENVIRONMENTS=$(toml_get "services_app" "environments" "TOML" 2>/dev/null | tr -d '[]"' | tr ',' ' ' || echo "dev staging prod")

            # Extract additional configuration sections
            TOML_SECTIONS=""
            if command -v toml_sections >/dev/null 2>&1; then
                TOML_SECTIONS=$(toml_sections "TOML" | tr '\n' ' ')
            fi

            TOML_SYNC_STATUS="Enhanced TOML data loaded"
        else
            # Fallback to basic grep parsing
            DEV_SERVER=$(grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_IP=$(grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_SERVER=$(grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_IP=$(grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_SERVER=$(grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_IP=$(grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DOMAIN_BASE=$(grep "^domain_base" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "pixeljamarcade.com")
            LOCAL_PORT=$(grep "^default_port" "$ACTIVE_TOML" | awk '{print $3}' 2>/dev/null || echo "3000")

            DEV_DOMAIN="dev.$DOMAIN_BASE"
            STAGING_DOMAIN="staging.$DOMAIN_BASE"
            PROD_DOMAIN="$DOMAIN_BASE"
            LOCAL_DOMAIN="localhost"
            LOCAL_NODE_ENV="development"
            LOCAL_DATA_DIR="/home/dev/pj/pd"
            LOCAL_SERVICE_CONFIG="npm run dev"
            ORG_PROVIDER="Unknown"
            SERVICES_TYPE="nodejs"
            SERVICES_ENVIRONMENTS="dev staging prod"

            TOML_SYNC_STATUS="Basic TOML parsing"
        fi
    else
        # Set defaults when no TOML
        DEV_SERVER="Unknown"
        DEV_IP="Unknown"
        STAGING_SERVER="Unknown"
        STAGING_IP="Unknown"
        PROD_SERVER="Unknown"
        PROD_IP="Unknown"
        TOML_SYNC_STATUS="No TOML file - use NH_ variables or create TOML"
        LOCAL_DOMAIN="localhost"
        LOCAL_PORT="3000"
        LOCAL_NODE_ENV="development"
        LOCAL_DATA_DIR="/home/dev/pj/pd"
        LOCAL_SERVICE_CONFIG="npm run dev"
        DOMAIN_BASE="localhost"
        DEV_DOMAIN="localhost"
        STAGING_DOMAIN="localhost"
        PROD_DOMAIN="localhost"
        TOML_SECTIONS=""
        ORG_PROVIDER="Unknown"
        SERVICES_TYPE="nodejs"
        SERVICES_ENVIRONMENTS="dev staging prod"
    fi
}

load_ssh_connectivity() {
    # Fast SSH connectivity test with timeout and parallel execution
    if [[ "$DEV_IP" != "Unknown" ]]; then
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$DEV_IP" exit 2>/dev/null; then
            DEV_SSH_STATUS="✓ Connected"
        else
            DEV_SSH_STATUS="○ No SSH"
        fi
    else
        DEV_SSH_STATUS="○ No IP"
    fi

    if [[ "$STAGING_IP" != "Unknown" ]]; then
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$STAGING_IP" exit 2>/dev/null; then
            STAGING_SSH_STATUS="✓ Connected"
        else
            STAGING_SSH_STATUS="○ No SSH"
        fi
    else
        STAGING_SSH_STATUS="○ No IP"
    fi

    if [[ "$PROD_IP" != "Unknown" ]]; then
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$PROD_IP" exit 2>/dev/null; then
            PROD_SSH_STATUS="✓ Connected"
        else
            PROD_SSH_STATUS="○ No SSH"
        fi
    else
        PROD_SSH_STATUS="○ No IP"
    fi
}

load_environment_data() {
    # Load TSM data
    if command -v tsm >/dev/null 2>&1; then
        TSM_SERVICES=$(tsm list 2>/dev/null | tail -n +3 || echo "")
        TSM_COUNT_RUNNING=$(echo "$TSM_SERVICES" | grep -c "online" 2>/dev/null || echo "0")
        TSM_COUNT_STOPPED=$(echo "$TSM_SERVICES" | grep -c "stopped\|offline" 2>/dev/null || echo "0")
    else
        TSM_SERVICES=""
        TSM_COUNT_RUNNING=0
        TSM_COUNT_STOPPED=0
    fi

    # Load Git data
    if git rev-parse --git-dir >/dev/null 2>&1; then
        GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
        GIT_STATUS=$(git status --porcelain 2>/dev/null)
        if [[ -z "$GIT_STATUS" ]]; then
            GIT_CLEAN="✓"
        else
            GIT_CLEAN="✗"
        fi
    else
        GIT_BRANCH="main"
        GIT_CLEAN="○"
    fi

    # Load Organization data
    if [[ -f "$TETRA_DIR/config/tetra.toml" ]]; then
        # Try to extract active organization from symlink target
        local toml_target=$(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null)
        if [[ -n "$toml_target" ]]; then
            ACTIVE_ORG=$(basename "$(dirname "$toml_target")")
        else
            ACTIVE_ORG="Local Project"
        fi
    else
        ACTIVE_ORG="No active organization"
    fi

    # Count total organizations
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        TOTAL_ORGS=$(find "$TETRA_DIR/orgs" -maxdepth 1 -type d | wc -l)
        TOTAL_ORGS=$((TOTAL_ORGS - 1)) # Subtract 1 for the orgs directory itself
    else
        TOTAL_ORGS=0
    fi

    # Set other defaults
    SSH_AGENT_STATUS="Unknown"
    TKM_KEY_COUNT="Unknown"
    TKM_KNOWN_HOSTS_COUNT="Unknown"
    DEPLOY_READINESS="Unknown"
    BUILD_STATUS="Unknown"
    ORG_STATUS="Ready"
    DEV_ORG_SYNC="Unknown"
    STAGING_ORG_SYNC="Unknown"
    PROD_ORG_SYNC="Unknown"
}

# Helper functions for TOML structure display
show_toml_structure() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "  ├─ [metadata] - Organization info"
        echo "  ├─ [infrastructure] - Server configs"
        echo "  ├─ [domains] - Domain mappings"
        echo "  ├─ [services] - App configurations"
        echo "  └─ [environments] - Env-specific settings"
    else
        echo "  └─ No TOML structure available"
    fi
}

show_services_summary() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "  ├─ Type: ${SERVICES_TYPE:-nodejs}"
        echo "  ├─ Environments: ${SERVICES_ENVIRONMENTS:-dev staging prod}"
        echo "  └─ Config: service ports, commands, env files"
    else
        echo "  └─ No services configuration"
    fi
}

show_local_services_config() {
    echo "  ├─ Start Command: ${LOCAL_SERVICE_CONFIG:-npm run dev}"
    echo "  ├─ Environment File: env/dev.env"
    echo "  └─ Process Management: TSM (Tetra Service Manager)"
}