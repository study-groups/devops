# Noun-Verb Ontology: The Four Semantic Layers

## The System Has Four Distinct Noun Types

The current TUI system conflates multiple semantic categories under the single term "noun", creating fundamental ambiguity in verb×noun resolution. Analysis reveals four distinct ontological layers:

| Noun Type | Definition | Example | Semantic Boundary |
|-----------|------------|---------|-------------------|
| **Capability** | Actions a module can perform | `stats`, `error`, `config` | Module interface |
| **Environmental** | Entities available in context | `demo,colors,input,tui` | Runtime scope |
| **Compositional** | Hierarchical object access | `css.layout`, `color.palette` | Object structure |
| **Collection** | Parallel entity sets | `[demo,colors,input,tui]` | Set operations |

### Capability Nouns Represent Module Interface

**Definition**: What a module *can do* - its action surface area.

**Characteristics**:
- Verb-coupled: `show::stats` vs `configure::stats` are different operations
- Module-bound: Each capability belongs to specific module context
- Atomic: Cannot be further decomposed within module boundary

**Examples**:
```
stats     → module introspection data
error     → diagnostic output
config    → configuration state
state     → runtime internal state
```

### Environmental Nouns Define Available Context

**Definition**: What entities are *available* in the current execution environment.

**Characteristics**:
- Context-dependent: APP vs DEV vs TEST environments provide different noun sets
- Scope-bound: Determined by environment capabilities
- Dynamic: Can change based on loaded modules and permissions

**Current Implementation**:
```bash
ENV_NOUNS[APP]="demo,colors,input,tui"        # 4 nouns available
ENV_NOUNS[DEV]="demo,colors,input,tui,Module,inspect"  # 6 nouns available
ENV_NOUNS[TEST]="tui"                         # 1 noun available
```

### Compositional Nouns Enable Hierarchical Access

**Definition**: Structured access to nested module components using dot notation.

**Characteristics**:
- Path-like: Traverse module boundaries with explicit structure
- Hierarchical: Parent.child.grandchild relationships
- Traversable: Support breadth-first and depth-first access patterns

**Examples**:
```
css.layout          → layout subsystem of CSS module
color.palette.primary → primary colors within palette subsystem
input.handler.keyboard → keyboard handler within input module
```

### Collection Nouns Support Set Operations

**Definition**: Parallel entities that can be operated on individually or collectively.

**Characteristics**:
- Distributive: Verbs apply to each member or to collection as unit
- Parallel: No hierarchical relationships between members
- Enumerable: Support iteration and mapping operations

**Current Problem**: `"demo colors input tui"` treated as single compound noun instead of collection.

## Plurality Creates Semantic Ambiguity

### The Core Disambiguation Problem

**Current Issue**: Parser cannot determine semantic category from syntax alone.

**Example**: `"demo colors input tui"`
- **As single noun**: Compound entity requiring `UNIFIED_TYPES["demo colors input tui"]` mapping
- **As collection**: Four separate nouns requiring individual `UNIFIED_TYPES` lookups
- **As hierarchy**: Attempt to access `demo.colors.input.tui` structure

### Resolution Ambiguity Patterns

| Input String | Possible Interpretations | System Response |
|--------------|-------------------------|----------------|
| `demo` | Single capability noun | ✓ Direct lookup |
| `demo,colors` | Collection of 2 nouns | ✗ Parsed as compound |
| `demo.colors` | Hierarchical access | ✗ No dot notation support |
| `demo colors` | Space-separated collection? | ✗ Treated as compound |

### Failure Mode Analysis

**Root Cause**: Single parsing strategy cannot handle multiple semantic categories.

**Current Behavior**:
1. `get_env_nouns(APP)` returns `"demo,colors,input,tui"`
2. Comma-to-space conversion: `tr ',' ' '` → `"demo colors input tui"`
3. Parser treats entire string as single noun
4. `UNIFIED_TYPES["demo colors input tui"]` lookup fails
5. Array subscript error: `noun_value=""` → `UNIFIED_TYPES[""]`

## Environmental Context Determines Noun Availability

### Context-Dependent Noun Spaces

**Principle**: Available nouns change based on execution environment, not just module capabilities.

**Environment Hierarchy**:
- **TEST**: Minimal noun set for focused debugging (`tui`)
- **APP**: User-facing application nouns (`demo,colors,input,tui`)
- **DEV**: Extended set including introspection (`demo,colors,input,tui,Module,inspect`)

### Dynamic Availability Resolution

**Current Implementation**: Static arrays define environment capabilities.

**Problem**: No runtime discovery of actual module availability.

**Example Scenario**:
```bash
# Environment declares colors available
ENV_NOUNS[APP]="demo,colors,input,tui"

# But colors module failed to load
# System still attempts colors operations
# Leading to runtime failures
```

### Context Inheritance Patterns

**Question**: Should DEV environment inherit APP nouns + add extras?

**Current**: Explicit repetition in arrays
**Alternative**: Compositional inheritance with override capability

## Modules Exist in Multiple Semantic Spaces

### The Module Identity Problem

**Core Issue**: Each module simultaneously exists as:

1. **Capability Provider** - What verbs it can handle
2. **Environmental Noun** - What others can operate on it
3. **Context Provider** - What noun space it makes available
4. **Data Structure** - What internal state it exposes

### Multi-Role Example: Color Module

**As Capability Provider**:
```bash
# Module handles these verb×noun combinations
show::palette     → display color schemes
configure::theme  → modify color settings
test::contrast    → validate accessibility
```

**As Environmental Noun**:
```bash
# Other modules can operate on color module
show colors       → introspect color module state
configure colors  → modify color module settings
reset colors      → restore color defaults
```

**As Context Provider**:
```bash
# Color module provides these nouns to environment
palette, theme, contrast, scheme, saturation
```

**As Data Structure**:
```bash
# Internal state accessible via hierarchical access
colors.palette.primary
colors.theme.current
colors.settings.contrast_ratio
```

### Semantic Space Conflicts

**Problem**: Same identifier has different meanings in different semantic spaces.

**Example**: `colors`
- In capability space: `show colors` = introspect color module
- In context space: `colors` is invalid (should be `palette` or `theme`)
- In hierarchical space: `colors.palette` = access color module's palette
- In collection space: `[demo,colors,input,tui]` = colors as peer entity

### Resolution Strategy Requirements

**Need**: Semantic routing that disambiguates based on:
- **Calling context** (which module is requesting resolution)
- **Available environment** (what's actually loaded and accessible)
- **Structural indicators** (syntax hints about intended semantics)
- **Verb compatibility** (what operations make sense for each interpretation)

## Implications for System Design

### Current System Limitations

1. **Single parser** cannot handle multiple semantic categories
2. **Static arrays** don't reflect dynamic module availability
3. **No semantic routing** to disambiguate identifier meanings
4. **Compound noun handling** conflates collections with hierarchies

### Required Architectural Changes

1. **Multi-stage parsing** with semantic category detection
2. **Dynamic noun discovery** based on actual module state
3. **Context-aware resolution** with semantic space routing
4. **Explicit collection syntax** to distinguish from compound nouns

This ontological analysis provides the foundation for implementing categorical semantics and proper noun/verb resolution in the system.