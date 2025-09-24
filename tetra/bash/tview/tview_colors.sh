#!/usr/bin/env bash

# TView Color Design Tokens - Rich color palette for semantic UI
# Single responsibility: Centralized color definitions and environment theming

# ===== BASE COLOR PALETTE =====
# Foundation colors - consistent across all terminals
setup_color_palette() {
    # Core ANSI colors
    local BLACK=$(tput setaf 0 2>/dev/null || echo "")
    local RED=$(tput setaf 1 2>/dev/null || echo "")
    local GREEN=$(tput setaf 2 2>/dev/null || echo "")
    local YELLOW=$(tput setaf 3 2>/dev/null || echo "")
    local BLUE=$(tput setaf 4 2>/dev/null || echo "")
    local MAGENTA=$(tput setaf 5 2>/dev/null || echo "")
    local CYAN=$(tput setaf 6 2>/dev/null || echo "")
    local WHITE=$(tput setaf 7 2>/dev/null || echo "")

    # Extended 256-color palette (with fallbacks)
    local BRIGHT_RED=$(tput setaf 9 2>/dev/null || echo "$RED")
    local BRIGHT_GREEN=$(tput setaf 10 2>/dev/null || echo "$GREEN")
    local BRIGHT_YELLOW=$(tput setaf 11 2>/dev/null || echo "$YELLOW")
    local BRIGHT_BLUE=$(tput setaf 12 2>/dev/null || echo "$BLUE")
    local BRIGHT_MAGENTA=$(tput setaf 13 2>/dev/null || echo "$MAGENTA")
    local BRIGHT_CYAN=$(tput setaf 14 2>/dev/null || echo "$CYAN")
    local BRIGHT_WHITE=$(tput setaf 15 2>/dev/null || echo "$WHITE")

    # Rich extended colors (256-color with ANSI fallbacks)
    local ORANGE=$(tput setaf 208 2>/dev/null || echo "$YELLOW")
    local PURPLE=$(tput setaf 93 2>/dev/null || echo "$MAGENTA")
    local TEAL=$(tput setaf 37 2>/dev/null || echo "$CYAN")
    local LIME=$(tput setaf 118 2>/dev/null || echo "$GREEN")
    local PINK=$(tput setaf 198 2>/dev/null || echo "$MAGENTA")
    local GOLD=$(tput setaf 220 2>/dev/null || echo "$YELLOW")
    local STEEL=$(tput setaf 67 2>/dev/null || echo "$BLUE")
    local CORAL=$(tput setaf 203 2>/dev/null || echo "$RED")

    # Text formatting
    local BOLD=$(tput bold 2>/dev/null || echo "")
    local DIM=$(tput dim 2>/dev/null || echo "")
    local UNDERLINE=$(tput smul 2>/dev/null || echo "")
    local REVERSE=$(tput rev 2>/dev/null || echo "")
    local RESET=$(tput sgr0 2>/dev/null || echo "")

    # Export all colors as globals
    export COLOR_BLACK="$BLACK" COLOR_RED="$RED" COLOR_GREEN="$GREEN" COLOR_YELLOW="$YELLOW"
    export COLOR_BLUE="$BLUE" COLOR_MAGENTA="$MAGENTA" COLOR_CYAN="$CYAN" COLOR_WHITE="$WHITE"
    export COLOR_BRIGHT_RED="$BRIGHT_RED" COLOR_BRIGHT_GREEN="$BRIGHT_GREEN"
    export COLOR_BRIGHT_YELLOW="$BRIGHT_YELLOW" COLOR_BRIGHT_BLUE="$BRIGHT_BLUE"
    export COLOR_BRIGHT_MAGENTA="$BRIGHT_MAGENTA" COLOR_BRIGHT_CYAN="$BRIGHT_CYAN" COLOR_BRIGHT_WHITE="$BRIGHT_WHITE"
    export COLOR_ORANGE="$ORANGE" COLOR_PURPLE="$PURPLE" COLOR_TEAL="$TEAL" COLOR_LIME="$LIME"
    export COLOR_PINK="$PINK" COLOR_GOLD="$GOLD" COLOR_STEEL="$STEEL" COLOR_CORAL="$CORAL"
    export COLOR_BOLD="$BOLD" COLOR_DIM="$DIM" COLOR_UNDERLINE="$UNDERLINE" COLOR_REVERSE="$REVERSE" COLOR_RESET="$RESET"

    # ===== SEMANTIC COLOR PALETTES =====

    # The 4 Amigos Colors - Classic rich palette for general UI
    export AMIGOS_ORANGE="$ORANGE"         # Warm accent and highlights
    export AMIGOS_TEAL="$TEAL"             # Cool secondary and info
    export AMIGOS_LIME="$LIME"             # Success and active states
    export AMIGOS_CORAL="$CORAL"           # Attention and warnings

    # The 4 Tetra Colors - Tetra-specific brand palette
    export TETRA_PURPLE="$PURPLE"          # Primary brand color (requested)
    export TETRA_GOLD="$GOLD"              # Secondary brand color
    export TETRA_STEEL="$STEEL"            # Neutral brand color
    export TETRA_PINK="$PINK"              # Accent brand color

    # ===== SEMANTIC DESIGN TOKENS =====

    # Environment Color Assignments (distinct and meaningful)
    export ENV_LOCAL_COLOR="$STEEL"         # Cool blue-gray for local development
    export ENV_DEV_COLOR="$LIME"            # Bright green for active development
    export ENV_STAGING_COLOR="$GOLD"        # Warning gold for staging validation
    export ENV_PROD_COLOR="$CORAL"          # Alert coral for production operations
    export ENV_QA_COLOR="$PURPLE"           # Testing purple for QA environment
    export ENV_SYSTEM_COLOR="$BRIGHT_CYAN"  # System-level cyan for overview

    # Mode Color Assignments (functional groupings)
    export MODE_TOML_COLOR="$CYAN"          # Configuration cyan
    export MODE_TKM_COLOR="$MAGENTA"        # Key management magenta
    export MODE_TSM_COLOR="$BLUE"           # Service management blue
    export MODE_DEPLOY_COLOR="$RED"         # Deployment red (high stakes)
    export MODE_ORG_COLOR="$YELLOW"         # Organization yellow (structural)
    export MODE_RCM_COLOR="$GREEN"          # Remote commands green (execution)

    # Status Color Assignments (universal meanings)
    export STATUS_SUCCESS_COLOR="$BRIGHT_GREEN"    # ✓ Success operations
    export STATUS_ERROR_COLOR="$BRIGHT_RED"        # ✗ Failed operations
    export STATUS_WARNING_COLOR="$BRIGHT_YELLOW"   # ⚠ Warning states
    export STATUS_INFO_COLOR="$BRIGHT_BLUE"        # ℹ Information
    export STATUS_PENDING_COLOR="$DIM"             # ⟳ In progress
    export STATUS_HIGHLIGHT_COLOR="$REVERSE"       # Selected items

    # Action Color Assignments (command types)
    export ACTION_SSH_COLOR="$TEAL"                # SSH connections
    export ACTION_SERVICE_COLOR="$BLUE"            # Service operations
    export ACTION_CONFIG_COLOR="$ORANGE"           # Configuration changes
    export ACTION_DEPLOY_COLOR="$RED"              # Deployment actions
    export ACTION_VIEW_COLOR="$CYAN"               # View/read operations
    export ACTION_EDIT_COLOR="$YELLOW"             # Edit operations

    # UI Element Colors
    export UI_BRAND_COLOR="$BRIGHT_CYAN"           # TVIEW branding
    export UI_ACCENT_COLOR="$YELLOW"               # Highlights and accents
    export UI_MUTED_COLOR="$DIM"                   # Secondary text
    export UI_BORDER_COLOR="$WHITE"                # Borders and separators
    export UI_SELECTION_COLOR="$REVERSE"           # Selected items
}

# ===== ENVIRONMENT-AWARE COLOR FUNCTIONS =====

# Get environment color based on current environment
get_env_color() {
    local env="$1"
    case "$env" in
        "LOCAL") echo "$ENV_LOCAL_COLOR" ;;
        "DEV") echo "$ENV_DEV_COLOR" ;;
        "STAGING") echo "$ENV_STAGING_COLOR" ;;
        "PROD") echo "$ENV_PROD_COLOR" ;;
        "QA") echo "$ENV_QA_COLOR" ;;
        "SYSTEM") echo "$ENV_SYSTEM_COLOR" ;;
        *) echo "$COLOR_WHITE" ;;
    esac
}

# Get mode color based on current mode
get_mode_color() {
    local mode="$1"
    case "$mode" in
        "TOML") echo "$MODE_TOML_COLOR" ;;
        "TKM") echo "$MODE_TKM_COLOR" ;;
        "TSM") echo "$MODE_TSM_COLOR" ;;
        "DEPLOY") echo "$MODE_DEPLOY_COLOR" ;;
        "ORG") echo "$MODE_ORG_COLOR" ;;
        "RCM") echo "$MODE_RCM_COLOR" ;;
        *) echo "$COLOR_WHITE" ;;
    esac
}

# Get status color based on state
get_status_color() {
    local status="$1"
    case "$status" in
        "success"|"active"|"connected"|"ok") echo "$STATUS_SUCCESS_COLOR" ;;
        "error"|"failed"|"inactive"|"disconnected") echo "$STATUS_ERROR_COLOR" ;;
        "warning"|"pending"|"testing") echo "$STATUS_WARNING_COLOR" ;;
        "info"|"unknown") echo "$STATUS_INFO_COLOR" ;;
        "executing"|"loading") echo "$STATUS_PENDING_COLOR" ;;
        *) echo "$COLOR_WHITE" ;;
    esac
}

# Color a text string with environment theming
colorize_env() {
    local text="$1"
    local env="$2"
    local color=$(get_env_color "$env")
    echo "${COLOR_BOLD}${color}${text}${COLOR_RESET}"
}

# Color a text string with mode theming
colorize_mode() {
    local text="$1"
    local mode="$2"
    local color=$(get_mode_color "$mode")
    echo "${COLOR_BOLD}${color}${text}${COLOR_RESET}"
}

# Color a text string with status theming
colorize_status() {
    local text="$1"
    local status="$2"
    local color=$(get_status_color "$status")
    echo "${color}${text}${COLOR_RESET}"
}

# ===== PALETTE ACCESS FUNCTIONS =====

# Get an amigos color by index (0-3) or name
get_amigos_color() {
    local selector="$1"
    case "$selector" in
        0|"orange") echo "$AMIGOS_ORANGE" ;;
        1|"teal") echo "$AMIGOS_TEAL" ;;
        2|"lime") echo "$AMIGOS_LIME" ;;
        3|"coral") echo "$AMIGOS_CORAL" ;;
        *) echo "$AMIGOS_ORANGE" ;; # Default to first color
    esac
}

# Get a tetra color by index (0-3) or name
get_tetra_color() {
    local selector="$1"
    case "$selector" in
        0|"purple") echo "$TETRA_PURPLE" ;;
        1|"gold") echo "$TETRA_GOLD" ;;
        2|"steel") echo "$TETRA_STEEL" ;;
        3|"pink") echo "$TETRA_PINK" ;;
        *) echo "$TETRA_PURPLE" ;; # Default to primary brand color
    esac
}

# Color text with amigos palette
colorize_amigos() {
    local text="$1"
    local color_selector="$2"
    local color=$(get_amigos_color "$color_selector")
    echo "${color}${text}${COLOR_RESET}"
}

# Color text with tetra palette
colorize_tetra() {
    local text="$1"
    local color_selector="$2"
    local color=$(get_tetra_color "$color_selector")
    echo "${color}${text}${COLOR_RESET}"
}

# Cycle through amigos colors for lists
cycle_amigos_color() {
    local index="$1"
    local amigos_index=$((index % 4))
    get_amigos_color "$amigos_index"
}

# Cycle through tetra colors for lists
cycle_tetra_color() {
    local index="$1"
    local tetra_index=$((index % 4))
    get_tetra_color "$tetra_index"
}

# ===== THEMED UI COMPONENTS =====

# Render environment badge with appropriate color
render_env_badge() {
    local env="$1"
    local is_current="$2"
    local color=$(get_env_color "$env")

    if [[ "$is_current" == "true" ]]; then
        echo "[${COLOR_BOLD}${color}${env}${COLOR_RESET}]"
    else
        echo "${COLOR_DIM}${env}${COLOR_RESET}"
    fi
}

# Render mode badge with appropriate color
render_mode_badge() {
    local mode="$1"
    local is_current="$2"
    local color=$(get_mode_color "$mode")

    if [[ "$is_current" == "true" ]]; then
        echo "[${COLOR_BOLD}${color}${mode}${COLOR_RESET}]"
    else
        echo "${COLOR_DIM}${mode}${COLOR_RESET}"
    fi
}

# Render status indicator with icon and color
render_status_indicator() {
    local status="$1"
    local text="$2"
    local color=$(get_status_color "$status")

    case "$status" in
        "success"|"connected"|"active")
            echo "${color}✓ ${text}${COLOR_RESET}"
            ;;
        "error"|"failed"|"disconnected"|"inactive")
            echo "${color}✗ ${text}${COLOR_RESET}"
            ;;
        "warning"|"pending")
            echo "${color}⚠ ${text}${COLOR_RESET}"
            ;;
        "executing"|"loading")
            echo "${color}⟳ ${text}${COLOR_RESET}"
            ;;
        *)
            echo "${color}${text}${COLOR_RESET}"
            ;;
    esac
}

# ===== PALETTE-THEMED COMPONENTS =====

# Render REPL prompt with tetra branding
render_repl_prompt() {
    local context="$1"
    local prompt_color=$(get_tetra_color "purple")  # Use primary tetra color
    echo "${prompt_color}${context}>${COLOR_RESET} "
}

# Render module list with alternating amigos colors
render_module_list() {
    local modules=("$@")
    local index=0

    for module in "${modules[@]}"; do
        local color=$(cycle_amigos_color "$index")
        echo "  ${color}${module}${COLOR_RESET}"
        ((index++))
    done
}

# Render tetra brand header
render_tetra_header() {
    local title="$1"
    local purple=$(get_tetra_color "purple")
    local gold=$(get_tetra_color "gold")

    echo "${purple}${COLOR_BOLD}TETRA${COLOR_RESET} ${gold}${title}${COLOR_RESET}"
}

# Render amigos-themed action list
render_action_list_amigos() {
    local actions=("$@")
    local index=0

    for action in "${actions[@]}"; do
        local color=$(cycle_amigos_color "$index")
        echo "  ${COLOR_BOLD}${color}[$((index + 1))]${COLOR_RESET} ${action}"
        ((index++))
    done
}

# Render tetra-themed navigation breadcrumb
render_tetra_breadcrumb() {
    local env="$1"
    local mode="$2"
    local steel=$(get_tetra_color "steel")
    local purple=$(get_tetra_color "purple")
    local pink=$(get_tetra_color "pink")

    echo "${purple}${env}${COLOR_RESET} ${steel}❯${COLOR_RESET} ${pink}${mode}${COLOR_RESET}"
}

# Initialize color system on load
setup_color_palette