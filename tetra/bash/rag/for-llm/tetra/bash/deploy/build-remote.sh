tetra_deploy_build_remote(){

ssh staging@pixeljamarcade.com "bash -l -c '
    set -e
    echo \"⚡️ Starting remote build on staging...\"

    # --- Load Node Version Manager (NVM) ---
    # Using the path from your tetra_deploy_build script
    export NVM_DIR=\"\$HOME/pj/nvm\"
    if [ -s \"\$NVM_DIR/nvm.sh\" ]; then
        source \"\$NVM_DIR/nvm.sh\"
        echo \"✅ NVM loaded. Node version: \$(node -v)\"
    else
        echo \"⚠️  NVM not found at \$NVM_DIR, build might fail.\"
    fi

    # --- Navigate to Project Directory ---
    # Using paths from your tetra_deploy_build script
    PROJECT_DIR=\"\$HOME/src/pixeljam/pja/arcade\"
    echo \"📂 Navigating to \$PROJECT_DIR\"
    cd \"\$PROJECT_DIR\" || { echo \"❌ Directory not found!\"; exit 1; }

    # --- Run the Build ---
    echo \"🔨 Running npm run build:staging...\"
    npm run build:staging

    echo \"🎉 Build command finished.\"
'"

}
