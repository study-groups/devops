# Resolution Strategy: Implementing Compositional Noun-Verb Semantics

## Singular Nouns Eliminate Ambiguity

### The Constraint Principle

**Core Rule**: `verb × noun` accepts only singular nouns, eliminating plurality ambiguity.

**Rationale**: By constraining the basic operation to singular forms, we force explicit handling of collections and hierarchies through compositional patterns.

**Benefits**:
1. **Eliminates parsing ambiguity** - no confusion between compound and collection nouns
2. **Forces explicit semantics** - collections and hierarchies require different syntax
3. **Enables compositional reasoning** - complex operations built from simple primitives
4. **Simplifies type checking** - singular operations have predictable signatures

### Singular Noun Grammar

**Valid Singular Forms**:
```
show demo      ✓  Single capability noun
show colors    ✓  Single environmental noun
show css       ✓  Single module noun
show palette   ✓  Single component noun
```

**Invalid Plural Forms**:
```
show demo,colors,input,tui    ✗  Collection - use explicit list syntax
show demo colors input tui    ✗  Space-separated - ambiguous parsing
show demo-colors-input-tui    ✗  Compound - use hierarchy syntax
```

### Explicit Collection Syntax

**Proposed Syntax**: `verb [noun1,noun2,noun3]`
```bash
show [demo,colors,input,tui]    # Explicit collection
configure [theme,palette]       # Collection configuration
test [input,tui]               # Collection testing
```

**Parsing Strategy**:
```bash
parse_action() {
    local input="$1"
    if [[ "$input" =~ ^([a-z]+)\ \[([^]]+)\]$ ]]; then
        local verb="${BASH_REMATCH[1]}"
        local noun_list="${BASH_REMATCH[2]}"
        IFS=',' read -ra nouns <<< "$noun_list"

        # Generate action for each noun
        for noun in "${nouns[@]}"; do
            generate_action "$verb" "$noun"
        done
    elif [[ "$input" =~ ^([a-z]+)\ ([a-z.]+)$ ]]; then
        local verb="${BASH_REMATCH[1]}"
        local noun="${BASH_REMATCH[2]}"
        generate_action "$verb" "$noun"
    else
        error "Invalid action syntax: $input"
    fi
}
```

## Composite Traversal Uses Breadth-First Search

### Hierarchical Noun Structure

**Dot Notation**: `parent.child.grandchild` for hierarchical access

**Examples**:
```
css.layout          → layout subsystem of CSS module
css.layout.grid     → grid component of layout subsystem
color.palette.primary → primary colors in palette subsystem
input.handler.key   → keyboard handler in input system
```

### Breadth-First Resolution Algorithm

**Problem**: `show mod` should find first component with show capability

**Strategy**: Traverse module structure breadth-first until verb handler found

**Algorithm**:
```bash
resolve_hierarchical_noun() {
    local verb="$1"
    local hierarchical_noun="$2"

    # Parse hierarchy into components
    IFS='.' read -ra components <<< "$hierarchical_noun"

    # Start with root component
    local queue=("${components[0]}")
    local processed=()

    while [[ ${#queue[@]} -gt 0 ]]; do
        local current="${queue[0]}"
        queue=("${queue[@]:1}")  # dequeue

        # Check if current component has verb handler
        if has_verb_handler "$verb" "$current"; then
            echo "$current"
            return 0
        fi

        processed+=("$current")

        # Add child components to queue
        local children=($(get_child_components "$current"))
        for child in "${children[@]}"; do
            if ! array_contains "$child" processed; then
                queue+=("$child")
            fi
        done
    done

    # If no handler found, return error
    return 1
}
```

### Capability Discovery Pattern

**Module Interface Introspection**:
```bash
get_child_components() {
    local component="$1"

    case "$component" in
        css)
            echo "layout typography colors spacing"
            ;;
        layout)
            echo "grid flexbox positioning margins"
            ;;
        colors)
            echo "palette theme contrast saturation"
            ;;
        input)
            echo "keyboard mouse touch navigation"
            ;;
        *)
            # Dynamic discovery if module provides introspection
            if command -v "${component}_list_subcomponents" >/dev/null; then
                "${component}_list_subcomponents"
            fi
            ;;
    esac
}
```

### Breadth-First vs Depth-First Trade-offs

**Breadth-First Advantages**:
- Finds handlers at shallow levels first
- More intuitive for most user expectations
- Avoids deep rabbit holes in complex hierarchies

**Depth-First Alternative**:
- Follows natural tree traversal
- May find more specific handlers
- Can get lost in deep structures

**Recommended**: Breadth-first as default, with optional depth-first flag.

## List Distribution Generates Multiple Actions

### Collection Processing Strategy

**Input**: `show [demo,colors,input,tui]`
**Output**: Array of individual actions, not single compound action

**Functorial Mapping**:
```bash
distribute_verb_over_collection() {
    local verb="$1"
    shift
    local nouns=("$@")
    local actions=()

    for noun in "${nouns[@]}"; do
        local action=$(generate_singular_action "$verb" "$noun")
        if [[ $? -eq 0 ]]; then
            actions+=("$action")
        else
            log_warning "Failed to generate action for $verb $noun"
        fi
    done

    echo "${actions[@]}"
}
```

### Parallel vs Sequential Execution

**Parallel Execution Pattern**:
```bash
execute_action_collection() {
    local actions=("$@")
    local pids=()

    # Start all actions in parallel
    for action in "${actions[@]}"; do
        execute_action_async "$action" &
        pids+=($!)
    done

    # Wait for completion
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
}
```

**Sequential Execution Pattern**:
```bash
execute_action_sequence() {
    local actions=("$@")
    local results=()

    for action in "${actions[@]}"; do
        local result=$(execute_action_sync "$action")
        results+=("$result")

        # Stop on first failure if needed
        if [[ $? -ne 0 ]] && [[ "$FAIL_FAST" == "true" ]]; then
            break
        fi
    done

    echo "${results[@]}"
}
```

### Result Aggregation Strategies

**Collection Results**: Multiple individual results need aggregation

**Aggregation Patterns**:

1. **Concatenation**: Join all outputs
```bash
aggregate_concat() {
    local results=("$@")
    printf "%s\n" "${results[@]}"
}
```

2. **Summary**: Provide overview statistics
```bash
aggregate_summary() {
    local results=("$@")
    local success_count=0
    local total_count=${#results[@]}

    for result in "${results[@]}"; do
        if [[ "$result" != "ERROR:"* ]]; then
            ((success_count++))
        fi
    done

    echo "Completed $success_count/$total_count actions successfully"
}
```

3. **Structured**: Preserve individual results with metadata
```bash
aggregate_structured() {
    local verb="$1"
    shift
    local nouns=("$@")
    local results=("$@")

    for i in "${!nouns[@]}"; do
        echo "${nouns[i]}: ${results[i]}"
    done
}
```

## Capability Resolution Walks Object Trees

### Module Capability Trees

**Tree Structure**: Modules organize capabilities in hierarchical trees

**Example: CSS Module Tree**:
```
css/
├── layout/
│   ├── grid
│   ├── flexbox
│   └── positioning
├── typography/
│   ├── fonts
│   ├── sizing
│   └── spacing
└── colors/
    ├── palette
    ├── theme
    └── contrast
```

### Capability Provider Interface

**Standard Interface**: All capability providers implement discovery protocol

**Interface Definition**:
```bash
# Required functions for capability providers
${module}_list_capabilities() {
    # Return list of capabilities this module provides
}

${module}_has_capability() {
    local capability="$1"
    # Return 0 if module has capability, 1 otherwise
}

${module}_get_capability_handler() {
    local capability="$1"
    # Return handler function name for capability
}

${module}_get_subcapabilities() {
    local capability="$1"
    # Return list of sub-capabilities under this capability
}
```

### Tree Walking Algorithm

**Capability Resolution**:
```bash
resolve_capability() {
    local verb="$1"
    local noun="$2"

    # First, try direct capability lookup
    if has_direct_capability "$verb" "$noun"; then
        get_direct_handler "$verb" "$noun"
        return 0
    fi

    # If not found, walk capability tree
    walk_capability_tree "$verb" "$noun"
}

walk_capability_tree() {
    local verb="$1"
    local target_noun="$2"
    local current_path=""

    # Get root modules
    local modules=($(list_loaded_modules))

    for module in "${modules[@]}"; do
        if walk_module_tree "$verb" "$target_noun" "$module" ""; then
            return 0
        fi
    done

    return 1
}

walk_module_tree() {
    local verb="$1"
    local target_noun="$2"
    local module="$3"
    local path="$4"

    local current_noun="$module"
    [[ -n "$path" ]] && current_noun="$path.$module"

    # Check if current node matches target and has verb
    if [[ "$current_noun" == "$target_noun" ]] || [[ "$module" == "$target_noun" ]]; then
        if "${module}_has_capability" "$verb"; then
            echo "$("${module}_get_capability_handler" "$verb")"
            return 0
        fi
    fi

    # Recursively check subcapabilities
    local subcaps=($(${module}_get_subcapabilities "$verb" 2>/dev/null))
    for subcap in "${subcaps[@]}"; do
        local new_path="$current_noun"
        if walk_module_tree "$verb" "$target_noun" "$subcap" "$new_path"; then
            return 0
        fi
    done

    return 1
}
```

### CSS-Like Hierarchical Notation

**Proposed Syntax**: Mirror CSS selector syntax for familiar hierarchical access

**Examples**:
```bash
show css.layout           # Direct child access
show css > layout         # Direct child selector
show css layout           # Descendant selector
show css.layout.grid      # Deep path access
show css [layout,colors]  # Multiple child selection
```

**Parser Enhancement**:
```bash
parse_hierarchical_action() {
    local input="$1"

    if [[ "$input" =~ ^([a-z]+)\ ([a-z]+)\.([a-z.]+)$ ]]; then
        # Direct path: show css.layout.grid
        local verb="${BASH_REMATCH[1]}"
        local root="${BASH_REMATCH[2]}"
        local path="${BASH_REMATCH[3]}"
        resolve_path_action "$verb" "$root.$path"

    elif [[ "$input" =~ ^([a-z]+)\ ([a-z]+)\ >\ ([a-z]+)$ ]]; then
        # Direct child: show css > layout
        local verb="${BASH_REMATCH[1]}"
        local parent="${BASH_REMATCH[2]}"
        local child="${BASH_REMATCH[3]}"
        resolve_child_action "$verb" "$parent" "$child"

    elif [[ "$input" =~ ^([a-z]+)\ ([a-z]+)\ ([a-z]+)$ ]]; then
        # Descendant: show css layout
        local verb="${BASH_REMATCH[1]}"
        local ancestor="${BASH_REMATCH[2]}"
        local descendant="${BASH_REMATCH[3]}"
        resolve_descendant_action "$verb" "$ancestor" "$descendant"
    fi
}
```

## Semantic Routing Implementation

### Multi-Stage Resolution Pipeline

**Stage 1: Syntax Analysis**
```bash
analyze_syntax() {
    local input="$1"

    if [[ "$input" =~ \[.*\] ]]; then
        echo "collection"
    elif [[ "$input" =~ \. ]]; then
        echo "hierarchical"
    elif [[ "$input" =~ ^[a-z]+\ [a-z]+$ ]]; then
        echo "singular"
    else
        echo "invalid"
    fi
}
```

**Stage 2: Semantic Category Detection**
```bash
detect_semantic_category() {
    local noun="$1"

    # Check if it's a known capability
    if is_capability_noun "$noun"; then
        echo "capability"
        return
    fi

    # Check if it's in environment
    if is_environmental_noun "$noun"; then
        echo "environmental"
        return
    fi

    # Check if it's a loaded module
    if is_module_noun "$noun"; then
        echo "module"
        return
    fi

    echo "unknown"
}
```

**Stage 3: Resolution Strategy Selection**
```bash
select_resolution_strategy() {
    local syntax_type="$1"
    local semantic_category="$2"

    case "$syntax_type:$semantic_category" in
        "singular:capability")
            echo "direct_capability_lookup"
            ;;
        "singular:environmental")
            echo "environment_noun_lookup"
            ;;
        "singular:module")
            echo "module_introspection"
            ;;
        "collection:*")
            echo "distribute_over_collection"
            ;;
        "hierarchical:*")
            echo "tree_traversal"
            ;;
        *)
            echo "error_unknown_combination"
            ;;
    esac
}
```

### Unified Resolution Interface

**Main Resolution Function**:
```bash
resolve_verb_noun() {
    local verb="$1"
    local noun_expression="$2"

    local syntax_type=$(analyze_syntax "$noun_expression")

    case "$syntax_type" in
        "singular")
            local semantic_category=$(detect_semantic_category "$noun_expression")
            local strategy=$(select_resolution_strategy "$syntax_type" "$semantic_category")
            execute_resolution_strategy "$strategy" "$verb" "$noun_expression"
            ;;
        "collection")
            distribute_verb_over_collection "$verb" "$noun_expression"
            ;;
        "hierarchical")
            resolve_hierarchical_action "$verb" "$noun_expression"
            ;;
        *)
            error "Cannot resolve verb-noun combination: $verb $noun_expression"
            return 1
            ;;
    esac
}
```

This resolution strategy provides a systematic approach to handling the complexity discovered in the ontological analysis while maintaining the mathematical rigor established in the categorical semantics.