tetra_deploy_orchestrator() {
    # Source config file if first argument is a readable file
    if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
        echo "Sourcing config file: $1"
        . "$1"
        local config_file="$1"
    fi

    local DEPLOY_DIR
    DEPLOY_DIR="$(dirname "${BASH_SOURCE[0]}")"
    
    echo "🚀 === TETRA DEPLOY ORCHESTRATOR ==="
    echo "📅 Started at: $(date)"
    echo "🔧 Config: ${config_file:-defaults}"
    echo

    # Source transfer functions early
    if [ ! -f "$DEPLOY_DIR/transfer.sh" ]; then
        echo "❌ transfer.sh not found. Cannot proceed with environment promotion."
    else
        source "$DEPLOY_DIR/transfer.sh"

        # Step 1: Promote Environment File (Pull from Source)
        echo "🌱 Step 1: Promote Environment File from Source"
        if [ -n "$ENV_SOURCE_HOST" ]; then
            echo "This deployment is configured to PULL the environment file from a source system."
            echo "  - Source: $ENV_SOURCE_USER@$ENV_SOURCE_HOST:$ENV_SOURCE_PATH"
            echo "  - To Local: $LOCAL_ENV_FILE"

            read -p "Do you want to proceed with this pull? (y/N/e) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Ee]$ ]]; then
                if [ -n "$config_file" ]; then
                    echo "Opening config file for editing: $config_file"
                    ${EDITOR:-vim} "$config_file"
                    echo "🛑 Config file changed. Please re-run the deployment script to apply changes."
                    return 1
                else
                    echo "❌ Cannot edit config: no config file was specified."
                fi
            elif [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "Pulling from source..."
                (
                    export REMOTE_HOST="$ENV_SOURCE_HOST"
                    export REMOTE_USER="$ENV_SOURCE_USER"
                    export REMOTE_ENV_FILE="$ENV_SOURCE_PATH"
                    tetra_transfer_pull
                )
                if [ $? -eq 0 ]; then
                    echo "✅ Pull from source completed."
                else
                    echo "❌ Pull from source FAILED. Aborting."
                    return 1
                fi
            else
                echo "🛑 Promotion PULL skipped by user. The existing local file (if any) will be used."
            fi
        else
            echo "ℹ️  No environment promotion configured (ENV_SOURCE_HOST not set)."
        fi
        echo

        # Step 2: Deploy Environment File (Push to Target)
        echo "📁 Step 2: Deploy Environment File to Target"
        if [ -n "$LOCAL_ENV_FILE" ] && [ -n "$REMOTE_ENV_FILE" ]; then
             while true; do
                if [ ! -f "$LOCAL_ENV_FILE" ]; then
                    echo "❌ Local environment file '$LOCAL_ENV_FILE' not found. Cannot push. Aborting."
                    return 1
                fi

                echo "This deployment will PUSH the local environment file to the target system."
                echo "  - From Local: $LOCAL_ENV_FILE"
                echo "  - To Target:  $REMOTE_USER@$REMOTE_HOST:$REMOTE_ENV_FILE"

                read -p "Do you want to proceed with this push? (y/N/e) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    echo "Pushing to target..."
                    tetra_transfer_push
                    if [ $? -eq 0 ]; then
                        echo "✅ Push to target completed."
                        break
                    else
                        echo "❌ Push to target FAILED. Aborting."
                        return 1
                    fi
                elif [[ $REPLY =~ ^[Ee]$ ]]; then
                    echo "Opening local environment file for editing: $LOCAL_ENV_FILE"
                    mkdir -p "$(dirname "$LOCAL_ENV_FILE")"
                    ${EDITOR:-vim} "$LOCAL_ENV_FILE"
                    echo "File editing complete. Please review your changes and the prompt again."
                    echo
                else
                    echo "🛑 Deployment PUSH skipped by user. The build may fail if the remote env file is outdated."
                    break
                fi
            done
        else
            echo "ℹ️  No environment deployment configured (LOCAL_ENV_FILE/REMOTE_ENV_FILE not set)."
        fi
        echo
    fi

    # Step 3: Merge code
    echo "🔀 Step 3: Merge code"
    if [ -f "$DEPLOY_DIR/merge.sh" ]; then
        source "$DEPLOY_DIR/merge.sh"
        if tetra_deploy_merge "$config_file"; then
            echo "✅ Merge completed"
        else
            echo "❌ Merge failed"
            return 1
        fi
    else
        echo "❌ merge.sh not found"
        return 1
    fi
    echo

    # Step 4: Build application
    echo "🔨 Step 4: Build application"
    if [ -f "$DEPLOY_DIR/build.sh" ]; then
        source "$DEPLOY_DIR/build.sh"
        if tetra_deploy_build "$config_file"; then
            echo "✅ Build completed"
        else
            echo "❌ Build failed"
            return 1
        fi
    else
        echo "❌ build.sh not found"
        return 1
    fi
    echo

    # Step 5: Restart services
    echo "🔄 Step 5: Restart services"
    if [ -f "$DEPLOY_DIR/restart.sh" ]; then
        source "$DEPLOY_DIR/restart.sh"
        if tetra_deploy_restart "$config_file"; then
            echo "✅ Services restarted"
        else
            echo "⚠️  Service restart failed"
        fi
    else
        echo "⚠️  restart.sh not found, skipping"
    fi
    echo

    echo "🎉 === DEPLOY COMPLETED ==="
    echo "📅 Finished at: $(date)"
}

tetra_deploy_orchestrator_local() {
    # Source config file if first argument is a readable file
    if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
        echo "Sourcing config file: $1"
        . "$1"
        local config_file="$1"
    fi

    # Set defaults for local execution
    local REPO_PATH="${REPO_PATH:-$HOME/src/pixeljam}"
    local BRANCH="${BRANCH:-staging}"
    local MERGE_BRANCH="${MERGE_BRANCH:-api-dev}"
    local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/arcade}"
    local HARD_MERGE="${HARD_MERGE:-false}"
    
    echo "🏠 === TETRA LOCAL DEPLOY ORCHESTRATOR ==="
    echo "📅 Started at: $(date)"
    echo "👤 User: $(whoami)"
    echo "🏠 Host: $(hostname)"
    echo "🔧 Config: ${config_file:-defaults}"
    echo

    # Step 1: Ensure we're in the right directory
    echo "📁 Step 1: Navigate to repository"
    if [ ! -d "$REPO_PATH" ]; then
        echo "❌ Repository not found: $REPO_PATH"
        return 1
    fi
    cd "$REPO_PATH"
    echo "✅ In: $(pwd)"
    echo

    # Step 2: Git operations
    echo "🔀 Step 2: Git merge operations"
    
    git checkout "$BRANCH" || { echo "❌ Failed to checkout $BRANCH"; return 1; }
    
    if [ "$HARD_MERGE" = "true" ]; then
        echo "⚠️  Hard merge: discarding local changes"
        git reset --hard
        git clean -fd
    fi
    
    git pull origin "$BRANCH" || { echo "❌ Failed to pull $BRANCH"; return 1; }
    git fetch origin || { echo "❌ Failed to fetch"; return 1; }
    git merge "origin/$MERGE_BRANCH" -m "Merging origin/$MERGE_BRANCH into $BRANCH" || { echo "❌ Failed to merge"; return 1; }
    git push origin "$BRANCH" || { echo "❌ Failed to push"; return 1; }
    
    echo "✅ Git operations completed"
    echo

    # Step 3: Navigate to project directory
    echo "🎯 Step 3: Navigate to project directory"
    PROJECT_DIR="$REPO_PATH/$PROJECT_SUBDIR"
    if [ ! -d "$PROJECT_DIR" ]; then
        echo "❌ Project directory not found: $PROJECT_DIR"
        return 1
    fi
    cd "$PROJECT_DIR"
    echo "✅ In: $(pwd)"
    echo

    # Step 4: Environment setup and build
    echo "🔨 Step 4: Build application"
    
    # Load NVM if available
    export NVM_DIR="$HOME/pj/nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh"
        echo "✅ NVM loaded"
    else
        echo "⚠️  NVM not found at $NVM_DIR"
    fi
    
    # Show versions
    echo "📋 Node: $(node --version 2>/dev/null || echo 'not found')"
    echo "📋 NPM: $(npm --version 2>/dev/null || echo 'not found')"
    
    # Build
    echo "🔨 Running npm run build..."
    if npm run build; then
        echo "✅ Build completed"
        echo "$(date): Local build completed successfully" >> ~/.build_history
    else
        echo "❌ Build failed"
        return 1
    fi
    echo

    # Step 5: Restart services (if we have sudo access)
    echo "🔄 Step 5: Restart services"
    local SERVICE1="${SERVICE1:-nginx}"
    local SERVICE2="${SERVICE2:-arcade-staging}"
    
    if command -v systemctl >/dev/null 2>&1; then
        echo "🔄 Restarting $SERVICE1..."
        sudo systemctl restart "$SERVICE1" 2>/dev/null && echo "✅ $SERVICE1 restarted" || echo "⚠️  $SERVICE1 restart failed"
        
        echo "🔄 Restarting $SERVICE2..."
        sudo systemctl restart "$SERVICE2" 2>/dev/null && echo "✅ $SERVICE2 restarted" || echo "⚠️  $SERVICE2 restart failed"
    else
        echo "⚠️  systemctl not available, skipping service restart"
    fi
    echo

    echo "🎉 === LOCAL DEPLOY COMPLETED ==="
    echo "📅 Finished at: $(date)"
}

tetra_deploy_example_config() {
    # This function prints a typical deployment configuration for api-dev -> staging.
    # You can redirect its output to a file or source it directly.
    #
    # Usage:
    #   tetra_deploy_example_config > api-dev-to-staging.sh
    #   source <(tetra_deploy_example_config)

    cat <<EOF
# Typical deployment config: api-dev -> staging

# === SOURCE ENVIRONMENT (for pulling .env file) ===
# Staging pulls from Dev, Prod pulls from Staging, etc.
ENV_SOURCE_HOST="dev.your-server.com"
ENV_SOURCE_USER="dev"
ENV_SOURCE_PATH="~/src/your-repo/path/to/your-project/env/.env.dev"

# === LOCAL & TARGET ENVIRONMENT ===
# Local temporary path to hold the env file
LOCAL_ENV_FILE="/tmp/tetra-deploy/your-project.env"

# Target server settings
REMOTE_HOST="staging.your-server.com"
REMOTE_USER="staging"
REPO_PATH="~/src/your-repo"
REMOTE_ENV_FILE="~/src/your-repo/path/to/your-project/env/.env.staging"

# Git branch settings
BRANCH="staging"
MERGE_BRANCH="api-dev"
PROJECT_SUBDIR="path/to/your-project"
HARD_MERGE="false"

# Service settings
SERVICE1="nginx"
SERVICE2="your-app-service"
EOF
} 

main() {
    # This is the main entry point for the script.
    # It will call the appropriate orchestrator function.
    # For now, it defaults to the main orchestrator.
    tetra_deploy_orchestrator "$@"
}

# This construct ensures that the main function is called only when the script
# is executed directly, not when it is sourced.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi 