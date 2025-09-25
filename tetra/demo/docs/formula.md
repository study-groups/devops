# E × M + A = R Formula

## The Core Formula

**Environment × Mode + Actions = Results**

This formula represents the fundamental operation of the TView system:

- **E (Environment)**: The execution context (DEMO, LOCAL, REMOTE)
- **M (Mode)**: The operational mode (LEARN, BUILD, TEST)
- **A (Actions)**: Available operations discovered from modules
- **R (Result)**: Executed operation output

## How It Works

### 1. Environment Selection (E)
The user selects an environment that provides context:
- **DEMO**: Tutorial/explanation environment
- **LOCAL**: Local development context
- **REMOTE**: Remote execution context

### 2. Mode Selection (M)
The user selects a mode that determines available operations:
- **LEARN**: Educational actions (explain, demonstrate, tutorial)
- **BUILD**: Construction actions (create, assemble, configure)
- **TEST**: Validation actions (verify, check, validate)

### 3. Action Discovery (A)
The system discovers available actions by:
```bash
# Load module actions based on E × M
module_path="demo/tview/modules/${mode_lowercase}/actions.sh"
source "$module_path"
actions=$(get_actions "$environment")
```

### 4. Result Execution (R)
When user executes an action:
```bash
# Execute action with environment context
execute_action "$action_id" "$environment"
```

## Example Flows

### DEMO:LEARN Flow
- Environment: DEMO (tutorial context)
- Mode: LEARN (educational operations)
- Actions: explain_formula, show_structure, demonstrate_ExM
- Result: Educational output explaining the system

### LOCAL:BUILD Flow
- Environment: LOCAL (development context)
- Mode: BUILD (construction operations)
- Actions: create_action, define_workflow, generate_module
- Result: New components created locally

### REMOTE:TEST Flow
- Environment: REMOTE (remote context)
- Mode: TEST (validation operations)
- Actions: validate_config, test_connection, verify_deploy
- Result: Validation results from remote system

## Mathematical Properties

- **Commutative in E×M**: DEMO:LEARN = LEARN:DEMO conceptually
- **Context-dependent A**: Actions vary based on E×M combination
- **Deterministic R**: Same E×M+A always produces same R
- **Composable**: Results can become inputs to new E×M+A operations