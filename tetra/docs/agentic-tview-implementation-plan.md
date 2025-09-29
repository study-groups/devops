# Agentic TView Implementation Plan: Artifact-Driven Local→Dev Pipeline

## Executive Summary
Transform Tetra's TView from a command interface into an artifact-centric system where actions create investigable traces and enable autonomous deployment pipelines. Focus on local→dev deployment for devpages as the primary example.

## Current State Analysis
- **TView**: Functional ENV×MODE interface with action registry system
- **TSM**: Service management with discovery patterns
- **Deploy**: Basic deployment scripts with DigitalOcean integration
- **Target**: devpages Node.js app with manual deployment process

## Implementation Plan

### Phase 1: Artifact Foundation (Week 1-2)

#### Week 1: Core Artifact System
**Day 1-2: Directory Structure & Metadata**
```bash
# Create artifact storage system
mkdir -p $TETRA_DIR/artifacts/{deployments,tests,builds,checks,approvals}

# Implement artifact metadata functions
create_artifact_metadata() {
    local type="$1" id="$2" app="$3"
    cat > "$TETRA_DIR/artifacts/$type/$id/metadata.json" << EOF
{
    "id": "$id",
    "type": "$type",
    "app": "$app",
    "created_at": "$(date -Iseconds)",
    "status": "created",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git branch --show-current)"
}
EOF
}
```

**Day 3-4: Artifact Creation Functions**
```bash
# bash/utils/artifacts.sh - New utility module
create_deployment_artifact() {
    local app="$1" source_env="$2" target_env="$3"
    local artifact_id="${app}-deploy-$(date +%Y%m%d_%H%M%S)"
    local artifact_dir="$TETRA_DIR/artifacts/deployments/$artifact_id"

    mkdir -p "$artifact_dir"
    create_artifact_metadata "deployments" "$artifact_id" "$app"

    # Create deployment plan
    generate_deployment_plan "$app" "$source_env" "$target_env" > "$artifact_dir/plan.json"

    # Run pre-deployment checks
    run_pre_deployment_checks "$app" "$target_env" > "$artifact_dir/checks.log"

    echo "$artifact_id"
}
```

**Day 5: Action Registry Extension**
```bash
# Extend bash/tview/action_registry.sh
declare -gA ACTION_ARTIFACTS=()  # Track artifacts created by actions

register_artifact_action() {
    local mode="$1" env="$2" action_id="$3" name="$4" description="$5"
    local artifact_type="$6" handler="$7" module="$8"

    register_action "$mode" "$env" "$action_id" "$name" "$description" "artifact" "$handler" "$module"
    ACTION_ARTIFACTS["${mode}:${env}:${action_id}"]="$artifact_type"
}
```

#### Week 2: First Artifact Actions

**Day 1-2: Convert Deploy Actions**
```bash
# Modify bash/deploy/deploy.sh
deploy_to_dev_artifact() {
    # Create artifact instead of immediate deployment
    local artifact_id=$(create_deployment_artifact "devpages" "local" "dev")
    echo "Created deployment artifact: $artifact_id"
    echo "Use 'Execute Deployment' action to deploy"
    return 0
}

execute_deployment_artifact() {
    local artifact_id="$1"
    local artifact_dir="$TETRA_DIR/artifacts/deployments/$artifact_id"

    # Update status to executing
    jq '.status = "executing" | .started_at = now' "$artifact_dir/metadata.json" > tmp && mv tmp "$artifact_dir/metadata.json"

    # Execute deployment with logging
    actual_deploy_to_dev 2>&1 | tee "$artifact_dir/execution.log"
    local exit_code=$?

    # Update final status
    local status=$([ $exit_code -eq 0 ] && echo "success" || echo "failed")
    jq ".status = \"$status\" | .completed_at = now | .exit_code = $exit_code" "$artifact_dir/metadata.json" > tmp && mv tmp "$artifact_dir/metadata.json"

    return $exit_code
}
```

**Day 3-4: Update TView Integration**
```bash
# Create bash/deploy/tview/render.sh (new file)
source "$TETRA_SRC/bash/tview/action_registry.sh"

register_actions_for_context "DEPLOY" "LOCAL" "deploy" \
    "plan_deploy|Plan Dev Deployment|Create deployment artifact with pre-checks|artifact|deploy_to_dev_artifact" \
    "execute_deploy|Execute Deployment|Run planned deployment|execute|execute_deployment_from_selection" \
    "view_deploys|View Deployments|Browse recent deployment artifacts|display|show_deployment_artifacts"
```

**Day 5: Basic Artifact Inspection**
```bash
# Add to bash/tview/tview_modes.sh
render_artifacts_local() {
    local recent_artifacts=($(find "$TETRA_DIR/artifacts" -name "metadata.json" -exec dirname {} \; | sort -r | head -10))

    cat << EOF
📦 Recent Artifacts ($(date +"%H:%M"))

$(for i in "${!recent_artifacts[@]}"; do
    local artifact_dir="${recent_artifacts[$i]}"
    local metadata="$artifact_dir/metadata.json"
    local id=$(jq -r '.id' "$metadata")
    local type=$(jq -r '.type' "$metadata")
    local status=$(jq -r '.status' "$metadata")
    local app=$(jq -r '.app' "$metadata")

    local status_icon="⏳"
    case "$status" in
        "created") status_icon="📋" ;;
        "executing") status_icon="🔄" ;;
        "success") status_icon="✅" ;;
        "failed") status_icon="❌" ;;
    esac

    highlight_line "   $status_icon [$type] $app - $id" "$(is_current_item $i)" "$ACTION_VIEW_COLOR"
done)

Actions:
$(highlight_line "   [Enter] Inspect selected artifact" "$(is_current_item 10)" "$ACTION_VIEW_COLOR")
$(highlight_line "   [x] Execute artifact (if planned)" "$(is_current_item 11)" "$ACTION_EXECUTE_COLOR")
EOF
}
```

### Phase 2: Enhanced Navigation & Cross-References (Week 3-4)

#### Week 3: Artifact Browser
**Day 1-2: Detailed Artifact Inspection**
```bash
show_artifact_details() {
    local artifact_dir="$1"
    local metadata="$artifact_dir/metadata.json"

    clear
    cat << EOF
$(tput bold)ARTIFACT DETAILS$(tput sgr0)

$(jq -r '. | to_entries[] | "\(.key): \(.value)"' "$metadata")

Files:
$(ls -la "$artifact_dir" | grep -v '^total' | sed 's/^/  /')

$(if [[ -f "$artifact_dir/execution.log" ]]; then
    echo "Recent Log Output:"
    tail -10 "$artifact_dir/execution.log" | sed 's/^/  /'
fi)

[l] View full logs  [e] Execute  [ESC] Back
EOF
}
```

**Day 3-4: Artifact Actions Menu**
```bash
artifact_action_menu() {
    local artifact_dir="$1"
    local status=$(jq -r '.status' "$artifact_dir/metadata.json")

    case "$status" in
        "created")
            echo "[x] Execute artifact  [d] Delete  [c] Copy for edit"
            ;;
        "executing")
            echo "[k] Kill execution  [l] Follow logs"
            ;;
        "success")
            echo "[r] Create rollback  [c] Clone for new deploy  [a] Archive"
            ;;
        "failed")
            echo "[x] Retry execution  [l] View logs  [d] Debug"
            ;;
    esac
}
```

**Day 5: Integration with Existing Modes**
```bash
# Update bash/tview/tview_modes.sh to add ARTIFACTS as new mode
AVAILABLE_MODES=("TOML" "TSM" "TKM" "DEPLOY" "ORG" "RCM" "SPAN" "ARTIFACTS")
```

#### Week 4: Cross-Referenced Actions
**Day 1-3: Build and Test Artifacts**
```bash
create_build_artifact() {
    local app="$1"
    local artifact_id="${app}-build-$(date +%Y%m%d_%H%M%S)"
    local artifact_dir="$TETRA_DIR/artifacts/builds/$artifact_id"

    mkdir -p "$artifact_dir"
    create_artifact_metadata "builds" "$artifact_id" "$app"

    # Capture build context
    cat > "$artifact_dir/build-plan.json" << EOF
{
    "app": "$app",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "dependencies_hash": "$(npm ls --json | jq -r '.dependencies | keys | sort | join(",")')",
    "build_command": "npm run build"
}
EOF

    echo "$artifact_id"
}

create_test_artifact() {
    local app="$1" build_artifact_id="$2"
    local artifact_id="${app}-test-$(date +%Y%m%d_%H%M%S)"
    local artifact_dir="$TETRA_DIR/artifacts/tests/$artifact_id"

    mkdir -p "$artifact_dir"
    create_artifact_metadata "tests" "$artifact_id" "$app"

    # Reference build artifact
    jq --arg build_id "$build_artifact_id" '.build_artifact = $build_id' "$artifact_dir/metadata.json" > tmp && mv tmp "$artifact_dir/metadata.json"

    echo "$artifact_id"
}
```

**Day 4-5: Deployment Dependencies**
```bash
# Enhanced deployment artifact creation
create_deployment_artifact() {
    local app="$1" source_env="$2" target_env="$3"
    local build_artifact_id="$4" test_artifact_id="$5"

    local artifact_id="${app}-deploy-$(date +%Y%m%d_%H%M%S)"
    local artifact_dir="$TETRA_DIR/artifacts/deployments/$artifact_id"

    mkdir -p "$artifact_dir"
    create_artifact_metadata "deployments" "$artifact_id" "$app"

    # Add dependencies
    jq --arg build_id "$build_artifact_id" --arg test_id "$test_artifact_id" \
       '.dependencies = {build_artifact: $build_id, test_artifact: $test_id}' \
       "$artifact_dir/metadata.json" > tmp && mv tmp "$artifact_dir/metadata.json"

    echo "$artifact_id"
}
```

### Phase 3: Autonomous Pipeline (Week 5-6)

#### Week 5: Background Watchers
**Day 1-2: Git Change Detection**
```bash
# New TSM service: bash/tsm/services/devpages-watcher.sh
start_devpages_pipeline_watcher() {
    local last_commit=$(git rev-parse HEAD)

    while true; do
        local current_commit=$(git rev-parse HEAD)

        if [[ "$current_commit" != "$last_commit" ]]; then
            echo "🔍 New commit detected: $current_commit"

            # Create build artifact
            local build_id=$(create_build_artifact "devpages")
            if execute_build_artifact "$build_id"; then
                echo "✅ Build successful: $build_id"

                # Create test artifact
                local test_id=$(create_test_artifact "devpages" "$build_id")
                if execute_test_artifact "$test_id"; then
                    echo "✅ Tests passed: $test_id"

                    # Create deployment artifact (ready to deploy)
                    local deploy_id=$(create_deployment_artifact "devpages" "local" "dev" "$build_id" "$test_id")
                    echo "🚀 Deployment ready: $deploy_id"

                    # Auto-deploy if configured
                    if should_auto_deploy_to_dev "devpages"; then
                        echo "🎯 Auto-deploying..."
                        execute_deployment_artifact "$deploy_id"
                    fi
                fi
            fi

            last_commit="$current_commit"
        fi

        sleep 60  # Check every minute
    done
}
```

**Day 3-4: Pipeline Configuration**
```bash
# Add to tetra.toml
[pipeline.devpages]
auto_deploy_to_dev = true
require_tests = true
require_manual_staging = true
require_manual_prod = true

[pipeline.arcade]
auto_deploy_to_dev = false
require_performance_tests = true
```

**Day 5: TSM Integration**
```bash
# Register pipeline watcher as TSM service
# Add to bash/tsm/tsm_services_config.sh
declare -A TSM_SERVICE_DEFINITIONS=(
    ["devpages-watcher"]="bash/tsm/services/devpages-watcher.sh:start_devpages_pipeline_watcher:devpages pipeline automation"
)
```

#### Week 6: Pipeline Dashboard
**Day 1-3: Pipeline Status Visualization**
```bash
render_pipeline_local() {
    local devpages_status=$(get_pipeline_status "devpages")
    local arcade_status=$(get_pipeline_status "arcade")

    cat << EOF
🏭 Deployment Pipeline Status

devpages: local → dev → staging → prod
$(render_pipeline_flow "devpages" "$devpages_status")

arcade: local → dev → staging → prod
$(render_pipeline_flow "arcade" "$arcade_status")

Recent Pipeline Activity:
$(get_recent_pipeline_artifacts | head -5 | while read artifact; do
    render_pipeline_artifact_summary "$artifact"
done)

Pipeline Services:
$(highlight_line "   [devpages-watcher] $(tsm status devpages-watcher)" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")
$(highlight_line "   [arcade-watcher] $(tsm status arcade-watcher)" "$(is_current_item 1)" "$ACTION_VIEW_COLOR")
EOF
}
```

**Day 4-5: Pipeline Controls**
```bash
# Pipeline control actions
register_actions_for_context "PIPELINE" "LOCAL" "pipeline" \
    "start_watchers|Start All Watchers|Begin autonomous pipeline monitoring|execute|start_all_pipeline_watchers" \
    "pause_auto_deploy|Pause Auto-Deploy|Stop automatic deployments|execute|pause_auto_deployment" \
    "manual_promote|Manual Promote|Promote latest successful build to next env|execute|manual_promote_dialog"
```

## Testing Strategy

### Unit Testing
- Test artifact creation functions with mock data
- Verify JSON metadata format and required fields
- Test action registry integration

### Integration Testing
- Full local→dev pipeline with devpages
- TView navigation through artifacts
- TSM service integration for watchers

### User Acceptance Testing
- Deploy devpages using artifact system
- Navigate and inspect deployment artifacts
- Verify rollback capability

## Success Criteria
1. **Artifact Traceability**: Every deployment has complete audit trail from commit to deployment
2. **Investigation Capability**: Can drill down from deployment failure to root cause through artifacts
3. **Autonomous Operation**: New commits automatically create deployment artifacts when tests pass
4. **TView Integration**: Seamless navigation between traditional modes and new ARTIFACTS mode
5. **Backward Compatibility**: Existing TView functionality remains intact

## Risk Mitigation
- **Disk Space**: Implement artifact cleanup/archiving after 30 days
- **Performance**: Limit artifact storage and add indexing for navigation
- **Complexity**: Maintain simple fallback to direct deployment commands
- **Reliability**: Extensive error handling in autonomous watchers

## File Structure Overview
```
tetra/
├── artifacts/                          # New artifact storage
│   ├── deployments/                    # Deployment artifacts
│   ├── builds/                         # Build artifacts
│   ├── tests/                          # Test artifacts
│   └── checks/                         # Health check artifacts
├── bash/
│   ├── utils/
│   │   └── artifacts.sh                # New: Artifact utilities
│   ├── tview/
│   │   ├── action_registry.sh          # Enhanced: Artifact actions
│   │   └── tview_modes.sh              # Enhanced: ARTIFACTS mode
│   ├── deploy/
│   │   ├── deploy.sh                   # Enhanced: Artifact-first deploy
│   │   └── tview/
│   │       └── render.sh               # New: Deploy TView integration
│   └── tsm/
│       ├── services/
│       │   └── devpages-watcher.sh     # New: Pipeline watcher
│       └── tsm_services_config.sh      # Enhanced: Pipeline services
├── tetra.toml                          # Enhanced: Pipeline config
└── docs/
    └── agentic-tview-implementation-plan.md  # This document
```

This plan transforms Tetra into an artifact-driven system while maintaining the familiar TView interface and adding powerful autonomous capabilities for the local→dev deployment pipeline.