# MULTICAT + AST Tutorial

This tutorial demonstrates the enhanced MULTICAT toolchain with AST-aware function merging capabilities.

## Quick Start

Run the complete interactive tutorial:

```bash
./tutorial.sh
```

## What You'll Learn

### 1. Enhanced AST Architecture
- **ast.sh** - Language-agnostic dispatcher
- **ast_bash.sh** - Bash AST operations using shfmt
- **ast_go.sh** - Go AST operations (basic implementation)

### 2. Function Cursor Meta-Syntax
New MULTICAT mode for surgical function replacement:

```
#MULTICAT_START
# dir: .
# file: script.sh
# mode: function
# cursor: function_name
#MULTICAT_END
function_name() {
  # new implementation
}
```

### 3. Enhanced Merge Tool
**multimerge.sh** supports both approaches:
- Traditional diffs (delegates to multidiff.sh)
- Function cursors (AST-aware replacement)
- Session tracking with timestamps

### 4. Complete Workflow Comparison

**Traditional Diff Workflow:**
```bash
# Capture source
./bash/multicat.sh mpm-broken.sh > capture.mc

# Apply diffs
./bash/multidiff.sh < llm-response-diff.mc > fixed.mc

# Extract files
./bash/multisplit.sh -y fixed.mc
```

**Function Cursor Workflow:**
```bash
# Capture source  
./bash/multicat.sh mpm-broken.sh > capture.mc

# Apply function replacements with session tracking
./bash/multimerge.sh --rag-dir ./rag llm-response-functions.mc > fixed.mc

# Extract files
./bash/multisplit.sh -y fixed.mc
```

## Example Files Created

- **mpm-broken.sh** - Broken mini process manager for demonstration
- **llm-response-diff.mc** - Example LLM response using traditional diffs
- **llm-response-functions.mc** - Example LLM response using function cursors
- **tutorial.sh** - Complete interactive tutorial

## Key Benefits

### Function Cursors vs Traditional Diffs

**Function Cursors:**
✓ Clean, readable replacements  
✓ AST-aware syntax validation  
✓ Robust against formatting changes  
✓ Language-specific intelligence  

**Traditional Diffs:**
✓ Handles complex multi-line changes  
✓ Works with existing tooling  
✗ Fragile to whitespace changes  
✗ Hard to read intent  

### Session Tracking

RAG_DIR structure with timestamp-based sessions:
```
rag/
├── sessions/1673025600/
│   ├── input.mc
│   ├── operations.log
│   ├── summary.txt
│   └── backup_function_file.txt
├── functions/
└── conflicts/
```

## Language Support

Currently implemented:
- **Bash** - Full AST support via shfmt
- **Go** - Basic pattern matching (extensible to full AST)

Planned:
- **JavaScript/TypeScript** - Using Babel/TypeScript compiler API
- **Markdown** - Using AST parsers for structured editing

## Architecture Benefits

1. **Modular Design** - Language-specific AST modules
2. **Backward Compatible** - Existing tools continue to work
3. **Session Tracking** - Full audit trail with timestamps
4. **Hybrid Approach** - Best of both diff and function replacement
5. **Git Integration** - Conflict resolution using git tools

## Next Steps

After running the tutorial, you'll have a complete enhanced MULTICAT system that provides both traditional diff support and modern AST-aware function replacement with comprehensive session tracking.