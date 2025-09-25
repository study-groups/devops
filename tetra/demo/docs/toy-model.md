# Toy Model: Self-Explaining Demo Design

## Overview

The toy model is a **self-referential demonstration** of the TView system. It explains tetra's architecture by implementing a simplified version that demonstrates its own concepts. This creates a living tutorial where users learn by interacting with the system.

## Demo Environment Design

### Simplified Context (3×3 Matrix)

```
        LEARN   BUILD   TEST
DEMO      L₁      B₁     T₁
LOCAL     L₂      B₂     T₂
REMOTE    L₃      B₃     T₃
```

Each cell contains actions that explain or demonstrate that context:
- **DEMO:LEARN (L₁)**: Tutorial actions explaining the system
- **LOCAL:BUILD (B₂)**: Actions that create new components locally
- **REMOTE:TEST (T₃)**: Actions that validate remote functionality

### Self-Referential Actions

#### DEMO:LEARN Actions
```bash
declare -A EXPLAIN_FORMULA_ACTION=(
    ["verb"]="explain_concept"
    ["nouns_creation"]="concept='E x M + A = R',depth=2"
    ["nouns_runtime"]="current_env=\${CURRENT_ENV},current_mode=\${CURRENT_MODE}"
    ["display"]="Explain E×M+A=R Formula"
    ["description"]="Interactive explanation of the core formula"
)

declare -A SHOW_STRUCTURE_ACTION=(
    ["verb"]="show_directory_tree"
    ["nouns_creation"]="path=demo/,max_depth=3,highlight_pattern=*.sh"
    ["display"]="Show Demo Structure"
    ["description"]="Display the toy model's file organization"
)

declare -A DEMONSTRATE_CONTEXT_ACTION=(
    ["verb"]="demonstrate_context_switching"
    ["nouns_runtime"]="available_envs=\${ALL_ENVIRONMENTS},available_modes=\${ALL_MODES}"
    ["display"]="Demonstrate Context Switching"
    ["description"]="Show how E×M creates different contexts"
)
```

#### LOCAL:BUILD Actions
```bash
declare -A CREATE_ACTION_ACTION=(
    ["verb"]="create_action_template"
    ["nouns_creation"]="template_type=ACTION_DEF,output_dir=demo/created"
    ["nouns_runtime"]="action_name=\${USER_INPUT},target_env=\${SELECTED_ENV}"
    ["display"]="Create New Action"
    ["description"]="Generate ACTION_DEF template with guided input"
)

declare -A BUILD_MODULE_ACTION=(
    ["verb"]="scaffold_module"
    ["nouns_creation"]="structure=standard,include_tests=true"
    ["nouns_runtime"]="module_name=\${USER_INPUT},target_modes=\${SELECTED_MODES}"
    ["display"]="Build New Module"
    ["description"]="Create complete module with actions.sh and documentation"
)
```

#### REMOTE:TEST Actions
```bash
declare -A VALIDATE_FORMULA_ACTION=(
    ["verb"]="validate_formula_implementation"
    ["nouns_creation"]="test_cases=all,verbose=true"
    ["nouns_runtime"]="current_context=\${CURRENT_ENV}:\${CURRENT_MODE}"
    ["display"]="Validate E×M+A=R"
    ["description"]="Test that formula works correctly in current context"
)

declare -A TEST_SEPARATION_ACTION=(
    ["verb"]="test_tui_tview_separation"
    ["nouns_creation"]="interface_tests=true,content_tests=true"
    ["display"]="Test Interface/Content Separation"
    ["description"]="Verify TUI and TView systems are properly separated"
)
```

## Educational Workflow

### 1. Formula Introduction (DEMO:LEARN)
User starts here to understand the basic concepts:
- **explain_formula**: Interactive walkthrough of E×M+A=R
- **show_structure**: Visual representation of how code is organized
- **demonstrate_context**: Live switching between contexts to show differences

### 2. Hands-On Building (LOCAL:BUILD)
User learns by creating:
- **create_action**: Build their own ACTION_DEF with guidance
- **build_module**: Scaffold a complete module structure
- **compose_workflow**: Create STEP_DEF sequences

### 3. Validation and Testing (REMOTE:TEST)
User verifies understanding:
- **validate_formula**: Test that their understanding is correct
- **test_separation**: Verify they understand the interface/content split
- **run_integration**: Execute complete end-to-end scenarios

## Self-Explaining Properties

### Recursive Demonstration
The toy model demonstrates concepts by **using those same concepts**:
- Uses ACTION_DEF to explain ACTION_DEF
- Uses E×M+A formula to show how E×M+A formula works
- Uses interface/content separation to teach interface/content separation

### Interactive Learning
```
User: "How does E×M+A=R work?"
System: Demonstrates by showing:
1. Current E (DEMO) × Current M (LEARN)
2. Available A (explain actions)
3. Executes explain_formula action
4. Shows R (explanation output)
5. "You just experienced E×M+A=R!"
```

### Progressive Complexity
- **DEMO environment**: Simple, educational examples
- **LOCAL environment**: Intermediate, practical examples
- **REMOTE environment**: Advanced, real-world examples

## Implementation Strategy

### Phase 1: Basic Demo
```
demo/
├── tview/
│   └── modules/
│       └── learn/
│           └── actions.sh  # Only explain_formula action
└── tui/
    └── layout.sh           # Minimal 4-line header
```

### Phase 2: Interactive Demo
Add BUILD and TEST modes with actions that modify the demo itself:
```
LOCAL:BUILD actions can create new DEMO:LEARN actions
REMOTE:TEST actions validate the newly created actions
```

### Phase 3: Meta-Demo
The demo becomes self-hosting:
```
Actions that create actions that create actions...
Complete recursive demonstration of system capabilities
```

## Learning Outcomes

After using the toy model, users will understand:
1. **E×M+A=R Formula**: How environment, mode, and actions combine
2. **ACTION_DEF Structure**: verb×nouns with resolution timing
3. **Interface/Content Separation**: Why TUI and TView are separate
4. **Module Architecture**: How to create and organize modules
5. **System Extension**: How to add new environments, modes, and actions

## Success Metrics

The toy model succeeds when:
- **New users** can navigate and understand the system in < 10 minutes
- **Developers** can create new actions using the demo as reference
- **The demo** serves as living documentation that stays current
- **Edge cases** are covered through interactive exploration
- **System concepts** are reinforced through hands-on experience

## Future Extensions

### Multi-Language Demo
Show the same concepts implemented in different languages:
- **Bash version**: Current implementation
- **Python version**: Same interface, Python backend
- **JavaScript version**: Web-based TUI

### Advanced Concepts
- **Workflow composition**: STEP_DEF demonstrations
- **Error handling**: Failure scenarios and recovery
- **Performance**: Large-scale action execution
- **Security**: Permission and validation examples

### Integration Demo
Show how the toy model concepts apply to the full tetra system:
- **Real environments**: LOCAL, DEV, STAGING, PROD
- **Real modules**: TKM, TSM, DEPLOY, etc.
- **Real workflows**: Complete deployment pipelines

The toy model serves as both **learning tool** and **reference implementation**, ensuring that the concepts remain understandable and the architecture stays clean.