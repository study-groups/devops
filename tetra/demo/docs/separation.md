# Interface vs Content Separation

## Overview

The TView system implements a strict separation between **interface concerns** (TUI) and **content concerns** (TView). This separation allows independent development, testing, and modification of display logic versus business logic.

## Separation Principles

### TUI System (Interface Concerns)
**Responsibility**: How to display and interact
- Layout and positioning
- Color schemes and themes
- Input handling and navigation
- Screen refresh and rendering
- Mode switching (gamepad/REPL)

### TView System (Content Concerns)
**Responsibility**: What to display and execute
- Module discovery and loading
- Action definition and registration
- Workflow execution and state management
- Environment context resolution
- Business logic and operations

## Interface Contract

The two systems communicate through a well-defined interface:

### TUI → TView (Content Requests)
```bash
# TUI requests content from TView
get_available_environments()  # Returns: DEMO, LOCAL, REMOTE
get_available_modes()        # Returns: LEARN, BUILD, TEST
get_actions(env, mode)       # Returns: action_id:display_name pairs
execute_action(action_id, env, mode)  # Executes and returns result
```

### TView → TUI (Display Requests)
```bash
# TView requests display services from TUI
render_header(env, mode)     # Display 4-line header
render_content(data)         # Display action results
render_status(message)       # Display status/error messages
render_modal(title, content) # Display popup information
```

## File Organization

### TUI Files (Interface)
```
demo/tui/
├── layout.sh    # Screen layout, regions, positioning
├── colors.sh    # Color definitions, theme management
├── input.sh     # Key handling, navigation, mode switching
└── render.sh    # Drawing functions, screen updates
```

### TView Files (Content)
```
demo/tview/
├── actions.sh   # ACTION_DEF registry and management
├── workflows.sh # STEP_DEF registry and execution
└── modules/     # LEARN, BUILD, TEST module implementations
```

## Benefits of Separation

### Independent Development
- **UI changes** don't affect business logic
- **Business logic changes** don't affect display
- **Different teams** can work on each system
- **Easier testing** of each concern separately

### Flexibility
- **Multiple interfaces**: Could add web UI, mobile app
- **Theme changes**: Easy to modify colors, layout
- **Input methods**: Could add voice control, mouse
- **Display modes**: Terminal, GUI, headless

### Maintainability
- **Clear responsibilities**: No mixed concerns
- **Easier debugging**: Problems isolated to correct system
- **Better testing**: Unit test business logic, integration test interface
- **Code reuse**: TView logic works with any interface

## Communication Patterns

### Data Flow
```
User Input → TUI → TView → Business Logic → TView → TUI → Display
```

### Error Handling
```
TView Error → TUI Error Display
TUI Error → TUI Error Display (no TView involvement)
```

### State Management
- **TUI State**: Current selections, display settings, input mode
- **TView State**: Environment context, action registry, execution state
- **Shared State**: Minimal - only current env/mode/action selection

## Implementation Guidelines

### TUI Guidelines
1. **Never call business logic directly**
2. **Always go through TView interface**
3. **Handle all display concerns**
4. **Manage user interaction state**
5. **Provide consistent visual feedback**

### TView Guidelines
1. **Never call display functions directly**
2. **Return data, not formatted output**
3. **Handle all business logic**
4. **Manage execution context**
5. **Validate all operations**

## Testing Strategy

### TUI Testing
- **Visual regression tests**: Screenshot comparisons
- **Input simulation tests**: Key press sequences
- **Responsiveness tests**: Different screen sizes
- **Accessibility tests**: Screen reader compatibility

### TView Testing
- **Unit tests**: Individual ACTION_DEF functions
- **Integration tests**: Module loading and execution
- **State tests**: Environment context resolution
- **Error handling tests**: Invalid input handling

### Integration Testing
- **End-to-end tests**: Complete user workflows
- **Interface contract tests**: TUI ↔ TView communication
- **Error propagation tests**: Error handling across boundary

## Example Separation

### Bad (Mixed Concerns)
```bash
# DON'T DO THIS - Mixed interface and content
execute_ssh_action() {
    echo "Testing SSH connection..."  # ← Interface concern
    ssh -o ConnectTimeout=2 "$host"   # ← Content concern
    if [[ $? -eq 0 ]]; then
        echo "✓ Connection successful"  # ← Interface concern
    else
        echo "✗ Connection failed"     # ← Interface concern
    fi
}
```

### Good (Separated Concerns)
```bash
# TView - Content only
execute_ssh_action() {
    local result=$(ssh -o ConnectTimeout=2 "$host" 2>&1)
    local status=$?

    # Return data structure, not formatted output
    echo "status:$status"
    echo "output:$result"
    echo "timestamp:$(date)"
}

# TUI - Interface only
display_action_result() {
    local result="$1"
    local status=$(echo "$result" | grep "^status:" | cut -d: -f2)

    if [[ $status -eq 0 ]]; then
        render_success "✓ Connection successful"
    else
        render_error "✗ Connection failed"
    fi
}
```

This separation ensures clean, maintainable, and flexible code architecture.