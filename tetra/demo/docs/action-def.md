# ACTION_DEF Specification

## Overview

ACTION_DEF is the fundamental data structure for defining executable operations in the TView system. It separates **verbs** (operations) from **nouns** (contextual data) with resolution timing control.

## Structure

```bash
declare -A ACTION_NAME_ACTION=(
    ["verb"]="operation_name"
    ["nouns_creation"]="key=value,key2=value2"     # Resolved at definition time
    ["nouns_runtime"]="key=\${VAR},key2=\${VAR2}" # Resolved at execution time
    ["noun_resolution"]="creation+runtime"          # Resolution timing
    ["environments"]="DEMO,LOCAL,REMOTE"           # Valid environments
    ["display"]="Human Readable Name"              # UI display text
    ["description"]="Detailed explanation"         # Help text
    ["return"]="status|data|modal|navigate"        # Return type
)
```

## Linear Algebra Model

ACTION_DEF implements the mathematical concept **verb × nouns**:

- **verb**: 1×1 operation matrix (the function/command)
- **nouns**: Column vector of contextual values
- **Resolution**: When noun values are determined

## Noun Resolution Timing

### Creation Time Resolution
Values known when ACTION_DEF is defined:
```bash
["nouns_creation"]="timeout=5,retry=3,debug=false"
```

### Runtime Resolution
Values resolved from environment context:
```bash
["nouns_runtime"]="host=\${SSH_HOST},user=\${SSH_USER},port=\${SSH_PORT}"
```

### Environment Variable Sources
- **tetra.toml**: Configuration values
- **secrets.toml**: Sensitive values
- **Shell environment**: System variables

## Examples

### Simple SSH Test Action
```bash
declare -A SSH_TEST_ACTION=(
    ["verb"]="ssh_test_connection"
    ["nouns_creation"]="timeout=2,options='-o ConnectTimeout=2'"
    ["nouns_runtime"]="host=\${SSH_HOST_DEV},user=\${SSH_USER}"
    ["noun_resolution"]="creation+runtime"
    ["environments"]="LOCAL,REMOTE"
    ["display"]="Test SSH Connection"
    ["description"]="Verify SSH connectivity to target host"
    ["return"]="status"
)
```

### Complex Deploy Action
```bash
declare -A DEPLOY_SERVICE_ACTION=(
    ["verb"]="deploy_with_validation"
    ["nouns_creation"]="validate=true,backup=true,timeout=300"
    ["nouns_runtime"]="service=\${SERVICE_NAME},target=\${DEPLOY_TARGET},version=\${BUILD_VERSION}"
    ["noun_resolution"]="creation+runtime"
    ["environments"]="LOCAL,REMOTE"
    ["display"]="Deploy Service"
    ["description"]="Deploy service with pre-validation and backup"
    ["return"]="data"
)
```

## Implementation Functions

Each module must provide:

### get_actions(environment)
Returns ACTION_DEF names valid for the environment:
```bash
get_actions() {
    local env="$1"
    case "$env" in
        "DEMO") echo "explain_action_def:Explain ACTION_DEF" ;;
        "LOCAL") echo "create_action:Create New Action" ;;
    esac
}
```

### execute_action(action_id, environment)
Resolves nouns and executes the verb:
```bash
execute_action() {
    local action_id="$1"
    local env="$2"

    # Load ACTION_DEF
    # Resolve runtime nouns from environment
    # Execute verb with resolved nouns
    # Return result based on return type
}
```

## Return Types

- **status**: Success/failure code
- **data**: Structured output for further processing
- **modal**: Display information in popup
- **navigate**: Change TView state (environment/mode)

## Validation Rules

1. **verb** must be a valid function name
2. **environments** must be subset of available environments
3. **noun_resolution** must specify timing
4. **return** must be valid return type
5. Runtime noun variables must exist in environment context