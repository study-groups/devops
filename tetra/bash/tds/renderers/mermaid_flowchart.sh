#!/usr/bin/env bash

# Mermaid Flowchart Renderer for TDS
# Provisional ASCII/ANSI renderer for mermaid flowchart syntax

# Dependencies
source "${COLOR_SRC}/color_core.sh" 2>/dev/null || true
source "${TDS_SRC}/core/semantic_colors.sh" 2>/dev/null || true

# Global state for flowchart parsing
declare -A FLOWCHART_NODES
declare -A FLOWCHART_EDGES
declare -a FLOWCHART_EDGE_LIST
declare -A FLOWCHART_NODE_TYPES
declare -A FLOWCHART_NODE_STYLES

# Node type symbols
declare -A NODE_SYMBOLS=(
    ["default"]="[·]"
    ["round"]="(·)"
    ["stadium"]="([·])"
    ["subroutine"]="[|·|]"
    ["cylindrical"]="[(·)]"
    ["circle"]="((·))"
    ["asymmetric"]=">·]"
    ["rhombus"]="{·}"
    ["hexagon"]="{{·}}"
    ["parallelogram"]="[/·/]"
    ["trapezoid"]="[/·\\]"
)

# Initialize flowchart state
tds_flowchart_init() {
    FLOWCHART_NODES=()
    FLOWCHART_EDGES=()
    FLOWCHART_EDGE_LIST=()
    FLOWCHART_NODE_TYPES=()
    FLOWCHART_NODE_STYLES=()
}

# Parse node definition and extract ID, label, and type
# Examples:
#   Start([User Interaction])
#   Config[gmmConfig Object]
#   Loop1{For each class c=0,1,2}
tds_flowchart_parse_node() {
    local node_def="$1"
    local node_id=""
    local node_label=""
    local node_type="default"

    # Extract node ID and content
    if [[ "$node_def" =~ ^([A-Za-z0-9_]+)\(\[([^\]]*)\]\)$ ]]; then
        # Stadium: ID([label])
        node_id="${BASH_REMATCH[1]}"
        node_label="${BASH_REMATCH[2]}"
        node_type="stadium"
    elif [[ "$node_def" =~ ^([A-Za-z0-9_]+)\(\(([^\)]*)\)\)$ ]]; then
        # Circle: ID((label))
        node_id="${BASH_REMATCH[1]}"
        node_label="${BASH_REMATCH[2]}"
        node_type="circle"
    elif [[ "$node_def" =~ ^([A-Za-z0-9_]+)\(([^\)]*)\)$ ]]; then
        # Round: ID(label)
        node_id="${BASH_REMATCH[1]}"
        node_label="${BASH_REMATCH[2]}"
        node_type="round"
    elif [[ "$node_def" =~ ^([A-Za-z0-9_]+)\{([^\}]*)\}$ ]]; then
        # Rhombus/Decision: ID{label}
        node_id="${BASH_REMATCH[1]}"
        node_label="${BASH_REMATCH[2]}"
        node_type="rhombus"
    elif [[ "$node_def" =~ ^([A-Za-z0-9_]+)\[\[([^\]]*)\]\]$ ]]; then
        # Subroutine: ID[[label]]
        node_id="${BASH_REMATCH[1]}"
        node_label="${BASH_REMATCH[2]}"
        node_type="subroutine"
    elif [[ "$node_def" =~ ^([A-Za-z0-9_]+)\[([^\]]*)\]$ ]]; then
        # Default rectangle: ID[label]
        node_id="${BASH_REMATCH[1]}"
        node_label="${BASH_REMATCH[2]}"
        node_type="default"
    elif [[ "$node_def" =~ ^([A-Za-z0-9_]+)$ ]]; then
        # Just ID (reference to existing node)
        node_id="${BASH_REMATCH[1]}"
        node_label="$node_id"
        node_type="default"
    fi

    if [[ -n "$node_id" ]]; then
        FLOWCHART_NODES["$node_id"]="$node_label"
        FLOWCHART_NODE_TYPES["$node_id"]="$node_type"
    fi

    echo "$node_id"
}

# Parse edge and label
# Examples:
#   --> (simple arrow)
#   -->|label| (arrow with label)
#   -.->|label| (dotted arrow with label)
tds_flowchart_parse_edge() {
    local edge_text="$1"
    local edge_label=""
    local edge_style="solid"

    # Extract label if present: -->|label|
    if [[ "$edge_text" =~ --\>[[:space:]]*\|([^\|]*)\| ]]; then
        edge_label="${BASH_REMATCH[1]}"
        edge_style="solid"
    elif [[ "$edge_text" =~ -\.-\>[[:space:]]*\|([^\|]*)\| ]]; then
        edge_label="${BASH_REMATCH[1]}"
        edge_style="dotted"
    elif [[ "$edge_text" =~ ==\>[[:space:]]*\|([^\|]*)\| ]]; then
        edge_label="${BASH_REMATCH[1]}"
        edge_style="thick"
    elif [[ "$edge_text" =~ --\> ]]; then
        edge_style="solid"
    elif [[ "$edge_text" =~ -\.-\> ]]; then
        edge_style="dotted"
    elif [[ "$edge_text" =~ ==\> ]]; then
        edge_style="thick"
    fi

    echo "$edge_label|$edge_style"
}

# Parse flowchart line
tds_flowchart_parse_line() {
    local line="$1"

    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*%% ]] && return

    # Remove leading/trailing whitespace
    line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    # Check for flowchart declaration
    [[ "$line" =~ ^flowchart ]] && return

    # Check for style declaration (style NodeId fill:#color,...)
    if [[ "$line" =~ ^style[[:space:]]+([A-Za-z0-9_]+)[[:space:]]+ ]]; then
        local node_id="${BASH_REMATCH[1]}"
        FLOWCHART_NODE_STYLES["$node_id"]="$line"
        return
    fi

    # Parse node relationships with various formats
    # Format 1: A --> B
    # Format 2: A -->|label| B
    # Format 3: A --> B[Label]
    # Format 4: A([Label]) --> B{Label}

    # Try to match: NodeSpec Arrow NodeSpec
    # where NodeSpec can be: ID, ID[label], ID(label), ID{label}, etc.
    # and Arrow can be: -->, -->|label|, etc.

    # First, try to split by arrow patterns
    local arrow_pattern='([-=]+\>|[-=]+\>[ ]*\|[^|]+\|)'

    if [[ "$line" =~ $arrow_pattern ]]; then
        # Split the line on the arrow
        local before_arrow="${line%%-->*}"
        local after_split="${line#*-->}"

        # Extract edge label if present
        local edge_label=""
        if [[ "$after_split" =~ ^\|([^\|]+)\|[[:space:]]* ]]; then
            edge_label="${BASH_REMATCH[1]}"
            after_split="${after_split#*\|*\|}"
        fi

        # Clean up before/after
        before_arrow=$(echo "$before_arrow" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
        after_split=$(echo "$after_split" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

        # Parse from node
        local from_id=$(tds_flowchart_parse_node "$before_arrow")

        # Parse to node (might have another arrow after it)
        local to_node_text="$after_split"
        # Extract just the first node if there's a chain
        if [[ "$to_node_text" =~ ([A-Za-z0-9_]+[[:space:]]*[\[\(\{][^\]\)\}]*[\]\)\}]|[A-Za-z0-9_]+) ]]; then
            to_node_text="${BASH_REMATCH[0]}"
        fi
        local to_id=$(tds_flowchart_parse_node "$to_node_text")

        # Store edge
        if [[ -n "$from_id" && -n "$to_id" ]]; then
            FLOWCHART_EDGE_LIST+=("$from_id|$to_id|$edge_label|solid")
        fi
    fi
}

# Render a single node with proper formatting
tds_flowchart_render_node() {
    local node_id="$1"
    local node_label="${FLOWCHART_NODES[$node_id]}"
    local node_type="${FLOWCHART_NODE_TYPES[$node_id]:-default}"

    # Apply semantic colors
    local color_token="content.code.inline"
    [[ "$node_type" == "rhombus" ]] && color_token="content.emphasis.bold"
    [[ "$node_type" == "circle" || "$node_type" == "stadium" ]] && color_token="content.heading.h3"

    if type tds_text_color &>/dev/null; then
        tds_text_color "$color_token"
    fi

    # Truncate long labels
    local max_label_len=40
    if [[ ${#node_label} -gt $max_label_len ]]; then
        node_label="${node_label:0:$max_label_len}…"
    fi

    # Format based on node type
    case "$node_type" in
        circle)
            printf "○ %s" "$node_label"
            ;;
        stadium)
            printf "╭─ %s ─╮" "$node_label"
            ;;
        round)
            printf "( %s )" "$node_label"
            ;;
        rhombus)
            printf "◇ %s ?" "$node_label"
            ;;
        subroutine)
            printf "┃ %s ┃" "$node_label"
            ;;
        *)
            printf "▪ %s" "$node_label"
            ;;
    esac

    if type reset_color &>/dev/null; then
        reset_color
    fi
}

# Render flowchart in linear/list format (provisional)
tds_flowchart_render_linear() {
    local indent="  "
    local edge_count=0

    # Print header
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h2"
    fi
    echo "━━━ FLOWCHART ━━━"
    if type reset_color &>/dev/null; then
        reset_color
    fi
    echo

    # Render edges (relationships)
    for edge_data in "${FLOWCHART_EDGE_LIST[@]}"; do
        IFS='|' read -r from_id to_id edge_label edge_style <<< "$edge_data"

        # Print from node
        printf "%s" "$indent"
        tds_flowchart_render_node "$from_id"
        echo

        # Print edge
        printf "%s" "$indent"
        case "$edge_style" in
            dotted)
                if type tds_text_color &>/dev/null; then
                    tds_text_color "text.secondary"
                fi
                printf "  ┊"
                ;;
            thick)
                if type tds_text_color &>/dev/null; then
                    tds_text_color "content.emphasis.bold"
                fi
                printf "  ┃"
                ;;
            *)
                if type tds_text_color &>/dev/null; then
                    tds_text_color "text.primary"
                fi
                printf "  │"
                ;;
        esac

        # Print edge label if present
        if [[ -n "$edge_label" && "$edge_label" != " " ]]; then
            printf " ─ %s" "$edge_label"
        fi
        if type reset_color &>/dev/null; then
            reset_color
        fi
        echo

        # Print arrow
        printf "%s" "$indent"
        if type tds_text_color &>/dev/null; then
            tds_text_color "text.primary"
        fi
        printf "  ↓"
        if type reset_color &>/dev/null; then
            reset_color
        fi
        echo

        # Print to node
        printf "%s" "$indent"
        tds_flowchart_render_node "$to_id"
        echo
        echo

        ((edge_count++))
    done

    # Print footer
    if type tds_text_color &>/dev/null; then
        tds_text_color "text.secondary"
    fi
    printf "(%d connections)\n" "$edge_count"
    if type reset_color &>/dev/null; then
        reset_color
    fi
    echo
}

# Main renderer for mermaid flowchart
tds_render_mermaid_flowchart() {
    local input="$1"

    # Initialize state
    tds_flowchart_init

    # Read input line by line
    while IFS= read -r line; do
        tds_flowchart_parse_line "$line"
    done <<< "$input"

    # Render output
    tds_flowchart_render_linear
}

# Hook function to intercept mermaid code blocks in markdown
tds_mermaid_code_block_hook() {
    local language="$1"
    local content="$2"

    # Only process flowchart diagrams
    if [[ "$language" == "mermaid" && "$content" =~ flowchart ]]; then
        tds_render_mermaid_flowchart "$content"
        return 0
    fi

    return 1
}

# Export functions
export -f tds_flowchart_init
export -f tds_flowchart_parse_node
export -f tds_flowchart_parse_edge
export -f tds_flowchart_parse_line
export -f tds_flowchart_render_node
export -f tds_flowchart_render_linear
export -f tds_render_mermaid_flowchart
export -f tds_mermaid_code_block_hook
