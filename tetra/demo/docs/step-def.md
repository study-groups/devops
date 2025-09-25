# STEP_DEF Specification

## Overview

STEP_DEF is a separate abstraction from ACTION_DEF designed specifically for **workflow state transitions**. While ACTION_DEF handles individual operations, STEP_DEF manages sequences of operations with dependencies, checkpoints, and rollback capabilities.

## Structure

```bash
declare -A STEP_NAME_STEP=(
    ["name"]="step_identifier"
    ["verb"]="operation_function"
    ["nouns"]="context_variables"
    ["preconditions"]="required_states"
    ["success_state"]="resulting_state"
    ["failure_state"]="error_state"
    ["rollback"]="recovery_function"
    ["checkpoint"]="true|false"
    ["idempotent"]="true|false"
)

declare -A WORKFLOW_NAME_WORKFLOW=(
    ["steps"]="step1,step2,step3"
    ["dependencies"]="step1→step2→step3"
    ["rollback_chain"]="step3→step2→step1"
    ["checkpoint_states"]="step2_complete,step3_complete"
    ["resume_points"]="step2,step3"
)
```

## State Machine Model

Each STEP_DEF represents a state transition in a finite state machine:

```
[Initial State] --[preconditions met]--> [STEP EXECUTION] --[success]--> [Success State]
                                              |
                                         [failure]
                                              |
                                              v
                                        [Failure State] --[rollback]--> [Previous State]
```

## Step Types

### Validation Steps
```bash
declare -A VALIDATE_CONFIG_STEP=(
    ["name"]="validate_config"
    ["verb"]="validate_configuration"
    ["nouns"]="config_file=\${CONFIG_PATH},schema=\${SCHEMA_PATH}"
    ["preconditions"]="config_exists"
    ["success_state"]="validated"
    ["failure_state"]="invalid"
    ["rollback"]="none"  # Validation doesn't change state
    ["idempotent"]="true"
)
```

### Build Steps
```bash
declare -A BUILD_ARTIFACT_STEP=(
    ["name"]="build_artifact"
    ["verb"]="compile_and_package"
    ["nouns"]="source=\${SOURCE_DIR},target=\${BUILD_DIR}"
    ["preconditions"]="validated,dependencies_ready"
    ["success_state"]="built"
    ["failure_state"]="build_failed"
    ["rollback"]="cleanup_build_artifacts"
    ["checkpoint"]="true"  # Can resume from here
    ["idempotent"]="false"  # Rebuilding may produce different results
)
```

### Deploy Steps
```bash
declare -A DEPLOY_SERVICE_STEP=(
    ["name"]="deploy_service"
    ["verb"]="install_and_configure"
    ["nouns"]="artifact=\${ARTIFACT_PATH},target=\${DEPLOY_TARGET}"
    ["preconditions"]="built,target_ready"
    ["success_state"]="deployed"
    ["failure_state"]="deploy_failed"
    ["rollback"]="restore_previous_version"
    ["checkpoint"]="true"
    ["idempotent"]="false"  # Deployment changes system state
)
```

## Workflow Composition

### Linear Workflow
```bash
declare -A BUILD_DEPLOY_WORKFLOW=(
    ["steps"]="validate,build,test,deploy,verify"
    ["dependencies"]="validate→build→test→deploy→verify"
    ["rollback_chain"]="deploy→test→build"  # Skip validate (idempotent)
    ["checkpoint_states"]="built,deployed,verified"
    ["resume_points"]="build,deploy"
)
```

### Parallel Workflow
```bash
declare -A PARALLEL_TEST_WORKFLOW=(
    ["steps"]="unit_test,integration_test,security_test"
    ["dependencies"]="(unit_test||integration_test||security_test)→aggregate_results"
    ["rollback_chain"]="none"  # Tests don't modify state
    ["checkpoint_states"]="all_tests_complete"
)
```

## Execution Engine

### Step Execution
```bash
execute_step() {
    local step_def="$1"
    local context="$2"

    # Check preconditions
    if ! check_preconditions "$step_def" "$context"; then
        return 1
    fi

    # Execute step verb with resolved nouns
    if execute_step_verb "$step_def" "$context"; then
        set_state "$(get_step_success_state "$step_def")"
        create_checkpoint_if_enabled "$step_def"
    else
        set_state "$(get_step_failure_state "$step_def")"
        execute_rollback_if_available "$step_def"
    fi
}
```

### Workflow Execution
```bash
execute_workflow() {
    local workflow_def="$1"
    local context="$2"

    for step in $(get_workflow_steps "$workflow_def"); do
        if ! execute_step "$step" "$context"; then
            # Handle failure based on workflow policy
            execute_workflow_rollback "$workflow_def" "$step"
            return 1
        fi
    done
}
```

## Key Differences from ACTION_DEF

| Aspect | ACTION_DEF | STEP_DEF |
|--------|------------|----------|
| Purpose | Individual operations | Workflow state transitions |
| State | Stateless | Stateful with pre/post conditions |
| Rollback | Not applicable | Built-in rollback support |
| Dependencies | None | Explicit step dependencies |
| Checkpoints | Not applicable | Resume/restart points |
| Idempotency | Not specified | Explicitly declared |

## Integration with ACTION_DEF

STEP_DEFs can invoke ACTION_DEFs as their verb implementation:
```bash
declare -A BUILD_STEP=(
    ["verb"]="execute_action"  # Delegates to ACTION_DEF system
    ["nouns"]="action=BUILD_ARTIFACT_ACTION,context=\${WORKFLOW_CONTEXT}"
    # ... other STEP_DEF properties
)
```

This allows complex workflows to leverage the ACTION_DEF system while maintaining state transition semantics.