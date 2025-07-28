tetra_deploy_orchestrator() {
    # Source config file if first argument is a readable file
    if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
        echo "Sourcing config file: $1"
        . "$1"
        local config_file="$1"
    fi

    local DEPLOY_DIR="$(dirname "${BASH_SOURCE[0]}")"
    
    echo "🚀 === TETRA DEPLOY ORCHESTRATOR ==="
    echo "📅 Started at: $(date)"
    echo "🔧 Config: ${config_file:-defaults}"
    echo

    # Step 1: Transfer environment files
    echo "📁 Step 1: Transfer environment files"
    if [ -f "$DEPLOY_DIR/transfer.sh" ]; then
        source "$DEPLOY_DIR/transfer.sh"
        if tetra_transfer push "$config_file" 2>/dev/null; then
            echo "✅ Transfer completed"
        else
            echo "⚠️  Transfer skipped or failed"
        fi
    else
        echo "⚠️  transfer.sh not found, skipping"
    fi
    echo

    # Step 2: Merge code
    echo "🔀 Step 2: Merge code"
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

    # Step 3: Build application
    echo "🔨 Step 3: Build application"
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

    # Step 4: Restart services
    echo "🔄 Step 4: Restart services"
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