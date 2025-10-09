#!/usr/bin/env bash

# Consolidated Color Module for demo/basic/010
# Single responsibility: All color functions with dynamic state management

# Load core color systems (adjust paths for modules/colors/)
COLORS_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$COLORS_DIR/color_core.sh"
source "$COLORS_DIR/color_palettes.sh"
source "$COLORS_DIR/color_themes.sh"
source "$COLORS_DIR/color_elements.sh"
source "$COLORS_DIR/color_ui.sh"

# ===== DYNAMIC COLOR STATE MANAGEMENT =====

# Track current color combinations to prevent collisions
declare -A CURRENT_COLOR_STATE=(
    [verb_color]=""
    [noun_color]=""
    [verb_bg]=""
    [noun_bg]=""
    [response_type]=""
    [last_refresh]=""
)

# Track used color combinations for optimization
declare -A COLOR_COMBO_CACHE=()

# Response type definitions with priority levels (Unix streams + extensions)
declare -A RESPONSE_TYPES=(
    [var]="7"         # Highest - tetra variables
    [stderr]="6"      # Standard error stream
    [stdout]="5"      # Standard output stream
    [stdin]="4"       # Standard input stream
    [pipe]="3"        # Pipe streams and data flow
    [file]="2"        # File operations
    [dev]="1"         # Development tools
    [data]="0"        # Lowest - data structures
)

# Response type color assignments (will be calculated for max distance)
declare -A RESPONSE_TYPE_COLORS=()

# ===== ADVANCED COLOR DISTANCE ALGORITHMS =====

# Weighted RGB distance (gives more importance to perceptual differences)
weighted_rgb_distance() {
    local hex1="$1" hex2="$2"
    local r1 g1 b1 r2 g2 b2

    local rgb1=$(hex_to_rgb "$hex1")
    local rgb2=$(hex_to_rgb "$hex2")
    # Parse RGB values using parameter expansion (bulletproof)
    local r1=${rgb1%% *} g1=${rgb1#* }; g1=${g1%% *}; local b1=${rgb1##* }
    local r2=${rgb2%% *} g2=${rgb2#* }; g2=${g2%% *}; local b2=${rgb2##* }

    # Weighted RGB distance (closer to human perception)
    # Red and green are weighted more heavily than blue
    local dr=$((r1 - r2))
    local dg=$((g1 - g2))
    local db=$((b1 - b2))

    # Human eye sensitivity weights: red=0.30, green=0.59, blue=0.11
    local distance=$(( (dr*dr*30 + dg*dg*59 + db*db*11) / 100 ))

    echo "$distance"
}

# Three-way color distance for tetra variables
three_way_distance() {
    local target_color="$1"
    local avoid_color1="$2"
    local avoid_color2="$3"

    local dist1=$(weighted_rgb_distance "$target_color" "$avoid_color1")
    local dist2=$(weighted_rgb_distance "$target_color" "$avoid_color2")

    # Use harmonic mean of distances to ensure good separation from BOTH
    local combined_distance
    if (( dist1 > 0 && dist2 > 0 )); then
        combined_distance=$(( (2 * dist1 * dist2) / (dist1 + dist2) ))
    else
        combined_distance=0
    fi

    echo "$combined_distance"
}

# Advanced color contrast ratio calculation
color_contrast_ratio() {
    local hex1="$1" hex2="$2"
    local r1 g1 b1 r2 g2 b2

    local rgb1=$(hex_to_rgb "$hex1")
    local rgb2=$(hex_to_rgb "$hex2")
    # Parse RGB values using parameter expansion (bulletproof)
    local r1=${rgb1%% *} g1=${rgb1#* }; g1=${g1%% *}; local b1=${rgb1##* }
    local r2=${rgb2%% *} g2=${rgb2#* }; g2=${g2%% *}; local b2=${rgb2##* }

    # Calculate relative luminance (simplified)
    local lum1=$(( (r1*30 + g1*59 + b1*11) / 100 ))
    local lum2=$(( (r2*30 + g2*59 + b2*11) / 100 ))

    # Ensure lum1 is lighter
    if (( lum1 < lum2 )); then
        local temp=$lum1
        lum1=$lum2
        lum2=$temp
    fi

    # Contrast ratio approximation
    local contrast_ratio=$(( (lum1 + 5) * 100 / (lum2 + 5) ))
    echo "$contrast_ratio"
}

# Use weighted distance as primary algorithm
color_distance() {
    weighted_rgb_distance "$1" "$2"
}

# Advanced maximum distance color finder for tetra variables
find_max_distance_color_advanced() {
    local avoid_color1="$1"
    local avoid_color2="${2:-}"
    local palette_name="${3:-ENV_PRIMARY}"
    local algorithm="${4:-three_way}"  # three_way, contrast, or distance

    local max_score=0
    local best_color=""
    local -n palette_ref=$palette_name

    for color in "${palette_ref[@]}"; do
        local score=0

        case "$algorithm" in
            "three_way")
                if [[ -n "$avoid_color2" ]]; then
                    score=$(three_way_distance "$color" "$avoid_color1" "$avoid_color2")
                else
                    score=$(color_distance "$color" "$avoid_color1")
                fi
                ;;
            "contrast")
                local contrast1=$(color_contrast_ratio "$color" "$avoid_color1")
                local contrast2=100
                if [[ -n "$avoid_color2" ]]; then
                    contrast2=$(color_contrast_ratio "$color" "$avoid_color2")
                fi
                # Use minimum contrast to ensure good readability against both
                if (( contrast1 < contrast2 )); then
                    score=$contrast1
                else
                    score=$contrast2
                fi
                ;;
            *)
                # Default distance algorithm
                local distance1=$(color_distance "$color" "$avoid_color1")
                local distance2=0
                if [[ -n "$avoid_color2" ]]; then
                    distance2=$(color_distance "$color" "$avoid_color2")
                    # Use minimum distance (ensure far from BOTH)
                    if (( distance1 < distance2 )); then
                        score=$distance1
                    else
                        score=$distance2
                    fi
                else
                    score=$distance1
                fi
                ;;
        esac

        if (( score > max_score )); then
            max_score=$score
            best_color=$color
        fi
    done

    echo "$best_color"
}

# Legacy compatibility wrapper
find_max_distance_color() {
    find_max_distance_color_advanced "$1" "$2" "$3" "distance"
}

# ===== INTELLIGENT COLOR ASSIGNMENT FUNCTIONS =====

# Get verb color (foreground only, bold)
get_smart_verb_color() {
    local verb="$1"
    local verb_index="${VERBS[$verb]:-0}"
    local verb_color="${VERBS_PRIMARY[$verb_index]}"

    # Store in state
    CURRENT_COLOR_STATE[verb_color]="$verb_color"
    CURRENT_COLOR_STATE[verb_bg]=""  # No background for verbs

    printf "\033[1m"  # Bold
    text_color "$verb_color"
}

# Get noun color (foreground only, no background)
get_smart_noun_color() {
    local noun="$1"
    local noun_index="${NOUNS[$noun]:-0}"
    local noun_color="${NOUNS_PRIMARY[$noun_index]}"

    # Store in state (no background)
    CURRENT_COLOR_STATE[noun_color]="$noun_color"
    CURRENT_COLOR_STATE[noun_bg]=""

    printf "\033[1m"  # Bold
    text_color "$noun_color"
}

# Get response type color (maximum distance from verb AND noun)
get_response_type_color() {
    local response_type="$1"

    local verb_color="${CURRENT_COLOR_STATE[verb_color]}"
    local noun_bg="${CURRENT_COLOR_STATE[noun_bg]}"

    # Find color with maximum distance from both verb and noun
    local optimal_color
    if [[ -n "$verb_color" && -n "$noun_bg" ]]; then
        optimal_color=$(find_max_distance_color "$verb_color" "$noun_bg" "MODE_PRIMARY")
    elif [[ -n "$verb_color" ]]; then
        optimal_color=$(find_max_distance_color "$verb_color" "" "MODE_PRIMARY")
    else
        # Fallback to response type priority-based color
        local priority="${RESPONSE_TYPES[$response_type]:-3}"
        optimal_color="${MODE_PRIMARY[$priority]}"
    fi

    # Cache the result
    RESPONSE_TYPE_COLORS[$response_type]="$optimal_color"
    CURRENT_COLOR_STATE[response_type]="$optimal_color"

    printf "\033[1m"  # Bold
    text_color "$optimal_color"
}

# ===== SAFE COLOR FUNCTIONS (prevent fg/bg collisions) =====

# Safe verb display (foreground only)
safe_verb_display() {
    local verb="$1"
    get_smart_verb_color "$verb"
    printf "%s" "$verb"
    reset_color
}

# Safe noun display (foreground only)
safe_noun_display() {
    local noun="$1"
    get_smart_noun_color "$noun"
    printf "%s" "$noun"
    reset_color
}

# Safe noun display with uniform color (all nouns same color)
safe_noun_display_uniform() {
    local noun="$1"
    # Use first noun color for all nouns
    local uniform_color="${NOUNS_PRIMARY[0]}"

    printf "\033[1m"  # Bold
    text_color "$uniform_color"
    printf "%s" "$noun"
    reset_color
}

# Safe response type display
safe_response_type_display() {
    local response_type="$1"
    get_response_type_color "$response_type"
    printf "[%s]" "$response_type"
    reset_color
}

# ===== ACTION LINE COMPONENTS =====

# Cache for rendered action strings to avoid re-rendering
declare -A ACTION_RENDER_CACHE

# Render verb noun combination with safe colors (minimal application syntax)
render_action_verb_noun() {
    local verb="$1"
    local noun="$2"

    # Get configurable sigil from typography module and apply verb color to entire sigil+verb unit
    local sigil_verb="$(render_action_sigil "$verb")"
    get_smart_verb_color "$verb"
    printf "%s" "$sigil_verb"
    reset_color

    render_action_separator
    safe_noun_display_uniform "$noun"
}

# Render response type with maximum distance coloring
render_response_type() {
    local verb="$1"
    local noun="$2"

    # Determine response type based on verb:noun combination
    local response_type="STD_OUT"  # Default

    case "$verb:$noun" in
        "configure:colors"|"reset:colors"|"toggle:"*) response_type="ENV_VAR" ;;
        "show:header"|"show:palette"|"show:"*) response_type="STD_OUT" ;;
        "test:"*|"analyze:"*) response_type="STD_ERR" ;;
        "cycle:"*|"document:"*) response_type="PIPE" ;;
        *) response_type="FILE" ;;
    esac

    printf " → "
    safe_response_type_display "$response_type"
}

# ===== STATE MANAGEMENT =====

# Refresh color state (call when navigation changes)
refresh_color_state() {
    local current_verb="$1"
    local current_noun="$2"
    local action_key="$current_verb:$current_noun"

    # Skip if we already refreshed for this action recently
    if [[ "${CURRENT_COLOR_STATE[last_action]}" == "$action_key" ]]; then
        return 0
    fi

    local timestamp=$(date +%s)

    # Clear previous state
    CURRENT_COLOR_STATE[verb_color]=""
    CURRENT_COLOR_STATE[noun_color]=""
    CURRENT_COLOR_STATE[verb_bg]=""
    CURRENT_COLOR_STATE[noun_bg]=""
    CURRENT_COLOR_STATE[response_type]=""
    CURRENT_COLOR_STATE[last_refresh]="$timestamp"
    CURRENT_COLOR_STATE[last_action]="$action_key"

    # Pre-calculate colors for current selection
    if [[ -n "$current_verb" ]]; then
        get_smart_verb_color "$current_verb" > /dev/null
    fi
    if [[ -n "$current_noun" ]]; then
        get_smart_noun_color "$current_noun" > /dev/null
    fi
}

# Show color state debug info
show_color_state() {
    echo "=== Color State Debug ==="
    echo "Verb color: ${CURRENT_COLOR_STATE[verb_color]}"
    echo "Noun bg: ${CURRENT_COLOR_STATE[noun_bg]}"
    echo "Noun fg: ${CURRENT_COLOR_STATE[noun_color]}"
    echo "Response: ${CURRENT_COLOR_STATE[response_type]}"
    echo "Last refresh: ${CURRENT_COLOR_STATE[last_refresh]}"
    echo "Cache size: ${#COLOR_COMBO_CACHE[@]}"
    echo
}

# ===== BACKWARD COMPATIBILITY FUNCTIONS =====

# Legacy function compatibility (deprecated, use safe_* functions)
get_verb_color() {
    local verb="$1"
    echo "${VERBS[$verb]:-0}"
}

get_noun_color() {
    local noun="$1"
    echo "${NOUNS[$noun]:-0}"
}

# ===== INITIALIZATION =====

# Initialize color module
init_color_module() {
    echo "Color module initialized with dynamic state management"

    # Pre-populate response type colors for common combinations
    for response_type in "${!RESPONSE_TYPES[@]}"; do
        RESPONSE_TYPE_COLORS[$response_type]="${MODE_PRIMARY[${RESPONSE_TYPES[$response_type]}]}"
    done

    # Set initial state
    CURRENT_COLOR_STATE[last_refresh]=$(date +%s)
}

# Call initialization
init_color_module