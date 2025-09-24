# Bash Terminal App Framework (BTAF)

## Core Philosophy
- **Single responsibility modules** - Each file does ONE thing
- **Declarative actions** - Define what actions exist, framework handles the rest
- **Consistent input patterns** - One way to handle keys, modals, navigation
- **Screen management** - Automatic refresh, layout, and state handling

## Framework Structure

```
bash/framework/
├── core/
│   ├── app.sh           # Main app controller
│   ├── input.sh         # Single-key input handling
│   ├── screen.sh        # Screen management & refresh
│   └── state.sh         # Application state management
├── components/
│   ├── modal.sh         # Standard modal system
│   ├── action_selector.sh # Action selection component
│   ├── header.sh        # Header rendering
│   └── content.sh       # Content area management
└── utils/
    ├── keys.sh          # Key binding definitions
    ├── colors.sh        # Color management
    └── layout.sh        # Layout calculations
```

## Key Features

### 1. Declarative Action System
```bash
# Define actions in simple arrays
declare -A ACTIONS=(
    ["TOML:TETRA"]="edit_config:Edit TOML config:toml_editor"
    ["TOML:DEV"]="deploy:Deploy to DEV:deploy_script"
    ["TSM:LOCAL"]="start_service:Start service:tsm_start"
)

# Framework automatically:
# - Creates action selector header
# - Handles navigation (i/k for up/down)
# - Shows help text in gray
# - Displays position (4/7)
# - Executes selected action
```

### 2. Consistent Input Pattern
```bash
# One function for all single-key input
read_key() {
    read -n1 -s key
    echo "$key"
}

# Standard exit pattern
exit_modal() {
    clear
    refresh_screen
}
```

### 3. Screen Management
```bash
# Automatic screen refresh after any modal/action
refresh_screen() {
    clear
    render_header
    render_action_selector
    render_content
}
```

### 4. State Management
```bash
declare -gA APP_STATE=(
    ["current_env"]="TETRA"
    ["current_mode"]="TOML"
    ["current_action_index"]="0"
    ["content_visible"]="false"
)
```

## Benefits
- **Eliminates modal exit issues** - Built-in screen refresh
- **Reduces code complexity** - Framework handles common patterns
- **Consistent UX** - Same behavior everywhere
- **Easy to extend** - Just add actions to arrays
- **Maintainable** - Clear separation of concerns