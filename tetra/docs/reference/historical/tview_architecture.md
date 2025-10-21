# TView Architecture Documentation

## Tetra x TOML Integration: How TView Works

TView is the interactive interface for Tetra's modular DevOps system. It provides a hierarchical navigation paradigm that combines **Environments** (TETRA, LOCAL, DEV, STAGING, PROD, QA) with **Modes** (TOML, TKM, TSM, DEPLOY, ORG, RCM, SPAN) to create contextual, actionable interfaces.

### Module Loading Architecture

#### Core Module Bootstrap
```bash
# Entry point: bash/tview/includes.sh
source "$TETRA_SRC/bash/tview/tview_repl.sh"

# Main core: bash/tview/tview_core.sh
TVIEW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TVIEW_DIR/tview_data.sh"         # Data loading functions
source "$TVIEW_DIR/tview_render.sh"       # Display rendering
source "$TVIEW_DIR/tview_modes.sh"        # Mode content rendering
source "$TVIEW_DIR/tview_actions.sh"      # Modal actions
source "$TVIEW_DIR/tview_navigation.sh"   # Navigation functions
source "$TVIEW_DIR/tview_hooks.sh"        # Context-triggered actions
source "$TVIEW_DIR/tview_repl.sh"         # REPL interfaces
```

#### Dynamic Function Discovery
TView uses a **dynamic function discovery** system where each ENV×Mode combination can have specialized rendering functions:

```bash
# Pattern: render_{mode}_{environment}
render_toml_tetra()    # TOML mode in TETRA environment
render_toml_local()    # TOML mode in LOCAL environment
render_tsm_dev()       # TSM mode in DEV environment
render_rcm_staging()   # RCM mode in STAGING environment
```

#### External Module Integration
TView can dynamically load external module renderers:

```bash
# bash/tview/tview_render.sh
local module_tview="$TETRA_SRC/bash/$module_lower/tview/render.sh"
if [[ -f "$module_tview" ]]; then
    source "$module_tview"
    local render_func="render_${module_lower}_${env_lower}"
    if declare -f "$render_func" >/dev/null; then
        "$render_func"
    fi
fi
```

### Configuration System: Tetra x TOML

#### Configuration Discovery Process

1. **Active Organization Detection** (`bash/tview/tview_data.sh`):
```bash
detect_active_toml() {
    # Primary: Check TETRA_DIR/config/active_org
    local active_org_file="$TETRA_DIR/config/active_org"
    if [[ -f "$active_org_file" ]]; then
        export TETRA_ACTIVE_ORG="$(cat "$active_org_file")"
        local org_toml="$TETRA_DIR/orgs/$TETRA_ACTIVE_ORG/tetra.toml"
        if [[ -f "$org_toml" ]]; then
            ACTIVE_TOML="$org_toml"
            ACTIVE_ORG="$TETRA_ACTIVE_ORG"
            PROJECT_NAME="$TETRA_ACTIVE_ORG"
        fi
    fi

    # Fallback: Legacy symlink system
    local tetra_toml="$TETRA_DIR/config/tetra.toml"
    if [[ -L "$tetra_toml" ]]; then
        ACTIVE_TOML="$tetra_toml"
        ACTIVE_ORG=$(basename "$(dirname "$target")")
    fi
}
```

2. **Configuration Parameters Extracted**:
   - `ACTIVE_ORG` - Current organization (e.g., "pixeljam-arcade")
   - `ACTIVE_TOML` - Path to active TOML file
   - `PROJECT_NAME` - Human-readable project name
   - `TETRA_DIR` - Tetra installation directory

3. **TOML Structure Example**:
```toml
[metadata]
name = "pixeljam-arcade"
type = "digitalocean-managed"
description = "pixeljam-arcade infrastructure managed via DigitalOcean"

[org]
name = "pixeljam-arcade"
provider = "digitalocean"
region = "sfo3"

[infrastructure]
dev_server = "pxjam-arcade-qa01"
dev_ip = "137.184.226.163"
staging_server = "pxjam-arcade-staging01"
prod_server = "pxjam-arcade-prod01"

[environments.local]
description = "Local development environment"
domain = "localhost"
app_port = 3000

[services.app]
type = "nodejs"
environments = ["dev", "staging", "prod"]
```

### Current ENVxMODE Element System

#### Selectable Elements Implementation

**Navigation State Variables**:
```bash
# Global navigation state (bash/tview/tview_core.sh)
CURRENT_MODE="TOML"        # Current mode selection
CURRENT_ENV="TETRA"        # Current environment selection
CURRENT_ITEM=0             # Current item index within mode+env
DRILL_LEVEL=0              # Drill-down navigation level
```

**Element Selection Pattern**:
```bash
# Each render function provides selectable elements
render_toml_tetra() {
    cat << EOF
📄 Active TOML: $ACTIVE_TOML
$(highlight_line "   ├─ [metadata] Project metadata and organization" "$(is_current_item 0)" "$MODE_TOML_COLOR")
$(highlight_line "   ├─ [org] Organization configuration" "$(is_current_item 1)" "$MODE_TOML_COLOR")
$(highlight_line "   ├─ [infrastructure] Server and environment setup" "$(is_current_item 2)" "$MODE_TOML_COLOR")
$(highlight_line "   └─ [services] Application service definitions" "$(is_current_item 3)" "$MODE_TOML_COLOR")
EOF
}
```

**Item Highlighting System**:
```bash
highlight_line() {
    local content="$1"
    local is_selected="$2"
    local color="${3:-$COLOR_WHITE}"

    if [[ "$is_selected" == "true" ]]; then
        echo "${SELECTION_BG}${SELECTION_FG}${content}${COLOR_RESET}"
    else
        echo "${color}${content}${COLOR_RESET}"
    fi
}

is_current_item() {
    local item_index="$1"
    [[ "$CURRENT_ITEM" -eq "$item_index" ]]
}
```

**Expandable Elements**:
Currently, expandable elements are implemented as:
1. **Navigation Selection** - Users can move between items with j/k keys
2. **Drill Actions** - Enter key triggers context-specific actions
3. **Modal System** - Actions open modal overlays for detailed operations

#### Current Limitations and Improvement Opportunities

**❌ Current Issues:**

1. **Static Content**: Most render functions return static text rather than dynamic, live data
2. **Limited Expansion**: Elements don't truly "expand" in-place - they trigger modals instead
3. **No Real-time Updates**: Status indicators are mostly decorative, not live
4. **Inconsistent Structure**: Some modes have selectable items, others just display text
5. **Poor Parameter Visibility**: Configuration details are hidden from user

**✅ Better Approaches:**

### Proposed Enhanced ENVxMODE System

#### 1. Dynamic Tree-View Elements
```bash
render_toml_tetra_enhanced() {
    local toml_tree=$(generate_toml_tree "$ACTIVE_TOML")

    case $CURRENT_ITEM in
        0) # metadata section expanded
            echo "📄 Active TOML: $ACTIVE_TOML"
            echo "$(highlight_line "   ▼ [metadata] Project metadata and organization" "true" "$MODE_TOML_COLOR")"
            echo "       ├─ name: $PROJECT_NAME"
            echo "       ├─ type: $(get_toml_value "metadata.type")"
            echo "       └─ description: $(get_toml_value "metadata.description")"
            echo "$(highlight_line "   ▶ [org] Organization configuration" "false" "$MODE_TOML_COLOR")"
            ;;
        1) # org section expanded
            echo "📄 Active TOML: $ACTIVE_TOML"
            echo "$(highlight_line "   ▶ [metadata] Project metadata and organization" "false" "$MODE_TOML_COLOR")"
            echo "$(highlight_line "   ▼ [org] Organization configuration" "true" "$MODE_TOML_COLOR")"
            echo "       ├─ name: $(get_toml_value "org.name")"
            echo "       ├─ provider: $(get_toml_value "org.provider")"
            echo "       └─ region: $(get_toml_value "org.region")"
            ;;
    esac
}
```

#### 2. Live Status Integration
```bash
render_tsm_dev_enhanced() {
    # Real-time SSH connectivity test
    local ssh_status=$(test_ssh_connection "dev")
    local service_status=$(get_remote_service_status "dev" "tetra.service")
    local last_deploy=$(get_last_deployment_time "dev")

    cat << EOF
$(highlight_line "🔌 SSH Connection: $(render_live_status "$ssh_status")" "$(is_current_item 0)" "$STATUS_SUCCESS_COLOR")
$(highlight_line "🛠  Service Status: $(render_live_status "$service_status")" "$(is_current_item 1)" "$STATUS_WARNING_COLOR")
$(highlight_line "🚀 Last Deploy: $last_deploy" "$(is_current_item 2)" "$UI_MUTED_COLOR")
$(highlight_line "📊 Resource Usage: $(get_live_metrics "dev")" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")
EOF
}
```

#### 3. Contextual Action Menus
```bash
generate_context_actions() {
    local mode="$1"
    local env="$2"
    local item_index="$3"

    case "${mode}_${env}_${item_index}" in
        "TOML_TETRA_0")  # metadata section
            echo "[e] Edit metadata  [v] View full  [d] Deploy config"
            ;;
        "TSM_DEV_0")     # SSH connection
            echo "[c] Connect  [t] Test  [k] Key management  [l] Logs"
            ;;
        "RCM_STAGING_1") # Command execution
            echo "[r] Run  [h] History  [s] Schedule  [m] Monitor"
            ;;
    esac
}
```

#### 4. Parameter Dashboard
```bash
render_parameter_dashboard() {
    cat << EOF
┌─ Configuration Status ────────────────────────────────────────┐
│ Active Org: ${STATUS_SUCCESS_COLOR}$ACTIVE_ORG${COLOR_RESET}
│ TOML Path:  $ACTIVE_TOML
│ Tetra Dir:  $TETRA_DIR
│ Modules:    $(count_loaded_modules) loaded
│ Last Sync:  $(get_last_config_sync)
└───────────────────────────────────────────────────────────────┘
EOF
}
```

### Implementation Recommendations

**Phase 1: Parameter Visibility**
- Add status panel showing ACTIVE_ORG, TETRA_DIR, current TOML
- Create `get_toml_value()` function for live parameter extraction
- Show configuration source and validity

**Phase 2: Dynamic Content**
- Replace static render functions with dynamic content generators
- Add expandable tree-view elements for TOML sections
- Implement real-time status indicators

**Phase 3: Contextual Actions**
- Generate action menus based on ENV×Mode×Item context
- Add in-place editing capabilities
- Implement live data refresh

**Phase 4: Module Integration**
- Better TETRA_DIR/<mods> tracking
- Configuration file change monitoring
- External module content integration

This architecture would transform TView from a static navigation interface into an intelligent, contextual dashboard that adapts meaningfully to each Environment×Mode combination.