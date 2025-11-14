# TDS TOML Inline Table Enhancement

## Summary
Enhanced the TDS TOML renderer to pretty-print TOML inline tables (JSON-like dictionaries) across multiple lines with proper indentation and syntax highlighting.

## Changes Made

### Modified File
- `/Users/mricos/src/devops/tetra/bash/tds/renderers/toml.sh`

### Enhancement Details
Added inline table parsing and multi-line rendering before array handling in `tds_render_toml_value()` function (lines 94-139).

## Before (Original)
Inline tables like `{ auth_user = "root", work_user = "dev", host = "137.184.226.163" }` would be rendered as-is on a single line, making them hard to read.

## After (Enhanced)
```toml
"@dev" = {
  auth_user = "root"
  work_user = "dev"
  host = "137.184.226.163"
  auth_key = "~/.ssh/id_rsa"
}
```

## Features
- **Automatic detection** of inline table syntax `{ key = value, ... }`
- **Multi-line formatting** with proper indentation (2 spaces)
- **Syntax highlighting** using TDS semantic color tokens:
  - Keys: `content.emphasis.bold` (orange/amber)
  - Values: Type-appropriate colors (strings, numbers, booleans)
  - Braces/operators: `text.secondary` (muted)
- **Recursive rendering** - values are rendered using the same logic as regular TOML values

## Use Cases
Perfect for rendering:
- SSH connector configurations
- Infrastructure mappings
- Complex nested configuration objects
- Any TOML inline table/dictionary structures

## Testing
Test file created: `test_connectors.toml`
Test script: `test_inline_tables.sh`

Run: `./test_inline_tables.sh` to see the pretty-printing in action.

## Implementation
The enhancement checks for inline table pattern `^\{(.+)\}$` and:
1. Splits content by commas
2. Parses each key=value pair
3. Renders with indentation and color highlighting
4. Recursively processes values for proper type rendering
