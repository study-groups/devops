#!/usr/bin/env bash

# TView Workflows - STEP_DEF registry and execution system
# Implements state machine workflows with checkpoints and rollback

# Global workflow registry
declare -gA WORKFLOW_REGISTRY=()
declare -gA STEP_REGISTRY=()

# Workflow execution state
declare -gA WORKFLOW_STATE=()
declare -ga EXECUTION_STACK=()

# Register a STEP_DEF
register_step() {
    local step_name="$1"
    local step_def="$2"

    STEP_REGISTRY["$step_name"]="$step_def"
}

# Register a WORKFLOW_DEF
register_workflow() {
    local workflow_name="$1"
    local workflow_def="$2"

    WORKFLOW_REGISTRY["$workflow_name"]="$workflow_def"
}

# Get STEP_DEF by name
get_step_def() {
    local step_name="$1"

    echo "${STEP_REGISTRY[$step_name]:-}"
}

# Get WORKFLOW_DEF by name
get_workflow_def() {
    local workflow_name="$1"

    echo "${WORKFLOW_REGISTRY[$workflow_name]:-}"
}

# Parse step/workflow field
get_workflow_field() {
    local workflow_def="$1"
    local field="$2"

    # Simple parsing (assumes field=value format)
    echo "$workflow_def" | grep -o "${field}=[^|]*" | cut -d'=' -f2- | tr -d '"'
}

# Check step preconditions
check_preconditions() {
    local step_def="$1"
    local context="$2"

    local preconditions=$(get_workflow_field "$step_def" "preconditions")

    if [[ -z "$preconditions" ]]; then
        return 0  # No preconditions = always ready
    fi

    # Parse comma-separated preconditions
    IFS=',' read -ra conditions <<< "$preconditions"

    for condition in "${conditions[@]}"; do
        condition=$(echo "$condition" | xargs)  # Trim whitespace

        # Check if condition is met in workflow state
        if [[ "${WORKFLOW_STATE[$condition]:-}" != "true" ]]; then
            echo "Precondition not met: $condition" >&2
            return 1
        fi
    done

    return 0
}

# Set workflow state
set_workflow_state() {
    local state_name="$1"
    local state_value="${2:-true}"

    WORKFLOW_STATE["$state_name"]="$state_value"
}

# Get workflow state
get_workflow_state() {
    local state_name="$1"

    echo "${WORKFLOW_STATE[$state_name]:-false}"
}

# Execute a single step
execute_step() {
    local step_name="$1"
    local context="$2"

    local step_def=$(get_step_def "$step_name")
    if [[ -z "$step_def" ]]; then
        echo "Step not found: $step_name" >&2
        return 1
    fi

    # Check preconditions
    if ! check_preconditions "$step_def" "$context"; then
        return 1
    fi

    # Get step properties
    local verb=$(get_workflow_field "$step_def" "verb")
    local nouns=$(get_workflow_field "$step_def" "nouns")
    local success_state=$(get_workflow_field "$step_def" "success_state")
    local failure_state=$(get_workflow_field "$step_def" "failure_state")
    local checkpoint=$(get_workflow_field "$step_def" "checkpoint")

    echo "Executing step: $step_name"
    echo "  Verb: $verb"
    echo "  Nouns: $nouns"

    # Add to execution stack
    EXECUTION_STACK+=("$step_name")

    # Execute the verb
    if execute_step_verb "$verb" "$nouns" "$context"; then
        # Success
        echo "  ✓ Step completed successfully"

        if [[ -n "$success_state" ]]; then
            set_workflow_state "$success_state" "true"
        fi

        if [[ "$checkpoint" == "true" ]]; then
            create_checkpoint "$step_name"
        fi

        return 0
    else
        # Failure
        echo "  ✗ Step failed"

        if [[ -n "$failure_state" ]]; then
            set_workflow_state "$failure_state" "true"
        fi

        # Execute rollback if available
        local rollback=$(get_workflow_field "$step_def" "rollback")
        if [[ -n "$rollback" && "$rollback" != "none" ]]; then
            echo "  Rolling back with: $rollback"
            execute_rollback "$rollback" "$context"
        fi

        return 1
    fi
}

# Execute step verb (this would call actual implementation)
execute_step_verb() {
    local verb="$1"
    local nouns="$2"
    local context="$3"

    case "$verb" in
        "validate_configuration")
            echo "    Validating configuration..."
            sleep 1
            # Simulate success/failure
            return 0
            ;;
        "compile_and_package")
            echo "    Compiling and packaging..."
            sleep 2
            return 0
            ;;
        "install_and_configure")
            echo "    Installing and configuring..."
            sleep 1
            return 0
            ;;
        "test_functionality")
            echo "    Testing functionality..."
            sleep 1
            return 0
            ;;
        *)
            echo "    Unknown verb: $verb"
            return 1
            ;;
    esac
}

# Execute rollback
execute_rollback() {
    local rollback_function="$1"
    local context="$2"

    case "$rollback_function" in
        "cleanup_build_artifacts")
            echo "    Cleaning up build artifacts..."
            sleep 1
            ;;
        "restore_previous_version")
            echo "    Restoring previous version..."
            sleep 1
            ;;
        *)
            echo "    Unknown rollback function: $rollback_function"
            ;;
    esac
}

# Create checkpoint
create_checkpoint() {
    local step_name="$1"

    echo "  📍 Checkpoint created at: $step_name"
    set_workflow_state "checkpoint_${step_name}" "true"
}

# Execute entire workflow
execute_workflow() {
    local workflow_name="$1"
    local context="$2"

    local workflow_def=$(get_workflow_def "$workflow_name")
    if [[ -z "$workflow_def" ]]; then
        echo "Workflow not found: $workflow_name" >&2
        return 1
    fi

    echo "Executing workflow: $workflow_name"
    echo "=================="

    # Get workflow steps
    local steps=$(get_workflow_field "$workflow_def" "steps")
    IFS=',' read -ra step_list <<< "$steps"

    # Execute each step
    local failed_step=""
    for step in "${step_list[@]}"; do
        step=$(echo "$step" | xargs)  # Trim whitespace

        if ! execute_step "$step" "$context"; then
            failed_step="$step"
            break
        fi
        echo ""
    done

    # Handle workflow completion or failure
    if [[ -n "$failed_step" ]]; then
        echo "❌ Workflow failed at step: $failed_step"

        # Execute workflow rollback
        local rollback_chain=$(get_workflow_field "$workflow_def" "rollback_chain")
        if [[ -n "$rollback_chain" ]]; then
            echo "Executing workflow rollback..."
            execute_workflow_rollback "$rollback_chain" "$context"
        fi

        return 1
    else
        echo "✅ Workflow completed successfully: $workflow_name"
        return 0
    fi
}

# Execute workflow rollback chain
execute_workflow_rollback() {
    local rollback_chain="$1"
    local context="$2"

    echo "Rollback chain: $rollback_chain"

    # Parse rollback chain (step1→step2→step3)
    IFS='→' read -ra rollback_steps <<< "$rollback_chain"

    # Execute rollback in reverse order
    for ((i=${#rollback_steps[@]}-1; i>=0; i--)); do
        local step="${rollback_steps[$i]}"
        step=$(echo "$step" | xargs)  # Trim whitespace

        local step_def=$(get_step_def "$step")
        if [[ -n "$step_def" ]]; then
            local rollback=$(get_workflow_field "$step_def" "rollback")
            if [[ -n "$rollback" && "$rollback" != "none" ]]; then
                echo "Rolling back step: $step"
                execute_rollback "$rollback" "$context"
            fi
        fi
    done
}

# Initialize demo workflows
init_demo_workflows() {
    # Register demo steps
    register_step "validate" 'name=validate|verb=validate_configuration|nouns=config=demo.toml|preconditions=|success_state=validated|failure_state=invalid|rollback=none|checkpoint=false|idempotent=true'

    register_step "build" 'name=build|verb=compile_and_package|nouns=source=src/,target=build/|preconditions=validated|success_state=built|failure_state=build_failed|rollback=cleanup_build_artifacts|checkpoint=true|idempotent=false'

    register_step "test" 'name=test|verb=test_functionality|nouns=artifact=build/demo|preconditions=built|success_state=tested|failure_state=test_failed|rollback=none|checkpoint=false|idempotent=true'

    register_step "deploy" 'name=deploy|verb=install_and_configure|nouns=artifact=build/demo,target=/opt/demo|preconditions=tested|success_state=deployed|failure_state=deploy_failed|rollback=restore_previous_version|checkpoint=true|idempotent=false'

    # Register demo workflow
    register_workflow "build_and_deploy" 'steps=validate,build,test,deploy|dependencies=validate→build→test→deploy|rollback_chain=deploy→test→build|checkpoint_states=built,deployed|resume_points=build,deploy'
}

# Show workflow status
show_workflow_status() {
    echo "Workflow State:"
    echo "==============="

    if [[ ${#WORKFLOW_STATE[@]} -eq 0 ]]; then
        echo "No workflow state"
        return
    fi

    for state in "${!WORKFLOW_STATE[@]}"; do
        echo "  $state: ${WORKFLOW_STATE[$state]}"
    done

    echo ""
    echo "Execution Stack: ${EXECUTION_STACK[*]}"
}

# Clear workflow state
clear_workflow_state() {
    WORKFLOW_STATE=()
    EXECUTION_STACK=()
}

# Initialize workflow system
init_workflows() {
    WORKFLOW_REGISTRY=()
    STEP_REGISTRY=()
    WORKFLOW_STATE=()
    EXECUTION_STACK=()

    # Initialize demo workflows
    init_demo_workflows
}

# Cleanup workflow system
cleanup_workflows() {
    WORKFLOW_REGISTRY=()
    STEP_REGISTRY=()
    WORKFLOW_STATE=()
    EXECUTION_STACK=()
}