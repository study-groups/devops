

# MELVIN Knowledge Plugins

Knowledge plugins extend MELVIN's understanding of specific project types and conventions.

## Available Plugins

### tetra.sh
Tetra-specific knowledge:
- Strong globals pattern
- No dotfiles rule
- Lazy loading via boot_modules.sh
- Dual directory (TETRA_SRC vs TETRA_DIR)
- Module types and structure
- Bootstrap chain
- Integration with tetra-self module

## Creating a Custom Plugin

### 1. Create Plugin File

`bash/melvin/knowledge/myproject.sh`:

```bash
#!/usr/bin/env bash

# Load your project's knowledge
melvin_load_myproject_knowledge() {
    # Add concepts
    MELVIN_CONCEPTS["my_pattern"]="Explanation of your pattern"
    MELVIN_CONCEPTS["my_convention"]="Your convention explanation"

    # Add examples
    MELVIN_PATTERN_EXAMPLES["my_pattern"]="code example here"

    # Add custom logic
    export MELVIN_HAS_CUSTOM_FEATURE=1
}

# Register your knowledge domain
melvin_register_knowledge "myproject" "melvin_load_myproject_knowledge"

# Export your loader
export -f melvin_load_myproject_knowledge
```

### 2. Configure Project

Create `.melvin-config` in your project root:

```bash
# .melvin-config
MELVIN_CONTEXT="myproject"
MELVIN_ROOT_NAME="My Awesome Project"

# Source your plugin
source "$MELVIN_SRC/knowledge/myproject.sh"
```

### 3. Use MELVIN

```bash
cd /path/to/your/project
melvin health              # Uses your custom knowledge
melvin concepts            # Shows your concepts
melvin ask "your question"  # Context-aware answers
```

## Plugin API

### Required Functions

#### melvin_load_CONTEXT_knowledge()
Called when MELVIN detects your context. Should populate:
- `MELVIN_CONCEPTS` - Concept explanations
- `MELVIN_PATTERN_EXAMPLES` - Code examples
- Any custom globals

### Available Data Structures

#### MELVIN_CONCEPTS
```bash
MELVIN_CONCEPTS["concept_name"]="Explanation text"
```

#### MELVIN_PATTERN_EXAMPLES
```bash
MELVIN_PATTERN_EXAMPLES["pattern_name"]="Example code"
```

#### MELVIN_KNOWLEDGE_DOMAINS
```bash
MELVIN_KNOWLEDGE_DOMAINS["domain_name"]="loader_function"
```

### Available Functions

From `melvin_knowledge.sh`:
- `melvin_add_concept <name> <explanation>`
- `melvin_add_pattern_example <pattern> <example>`
- `melvin_get_concept <name>`
- `melvin_list_concepts`

From `melvin_context.sh`:
- `melvin_get_context` - Get current context name
- `melvin_get_root` - Get current root path

From `melvin_classify.sh`:
- `melvin_classify_generic <dir>` - Generic classification
- `melvin_get_type <module>` - Get module type
- `melvin_list_by_type <type>` - List modules

## Example: Bash-Lib Plugin

```bash
#!/usr/bin/env bash

melvin_load_bashlib_knowledge() {
    # Bash-lib specific conventions
    MELVIN_CONCEPTS["lib_pattern"]="Libraries in lib/ directory"
    MELVIN_CONCEPTS["test_pattern"]="Tests in spec/ with bats"

    MELVIN_PATTERN_EXAMPLES["lib_pattern"]="lib/string.sh\nlib/array.sh"

    # Custom classification
    melvin_classify_bashlib() {
        local dir="$1"

        if [[ -d "$dir/lib" ]]; then
            echo "BASH_LIB_PROJECT"
        else
            melvin_classify_generic "$dir"
        fi
    }

    export -f melvin_classify_bashlib
}

melvin_register_knowledge "bashlib" "melvin_load_bashlib_knowledge"
export -f melvin_load_bashlib_knowledge
```

## Best Practices

### 1. Keep Plugins Focused
One plugin per project type or framework.

### 2. Provide Good Examples
Real code examples are more helpful than abstract explanations.

### 3. Context Detection
Make your plugin detectable via files in the project root.

### 4. Graceful Degradation
Always provide fallbacks to generic behavior.

### 5. Documentation
Document your concepts clearly and concisely.

## Testing Your Plugin

```bash
# Point MELVIN at test project
melvin --root=/path/to/test/project

# Check context detection
melvin context

# Verify concepts loaded
melvin concepts

# Test classification
melvin health

# Ask questions
melvin ask "What is the structure?"
```

## Contributing Plugins

To contribute a plugin to MELVIN:

1. Create plugin in `knowledge/`
2. Add documentation
3. Test on real projects
4. Submit PR with examples

## Plugin Ideas

- **Go modules**: Go-specific project structure
- **Python packages**: Python packaging conventions
- **Node.js**: npm/package.json patterns
- **Makefiles**: Build system conventions
- **Docker**: Container structure patterns
- **Kubernetes**: K8s resource organization

The sky's the limit!
