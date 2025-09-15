# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **MULTICAT Toolchain** for managing file content and diffs in a plain-text archival format. The project enables structured RAG workflows by creating a composable CLI pipeline for file concatenation, splitting, patching, and LLM interaction.

## Core Architecture

The toolchain follows a **three-phase pattern**:
1. **Capture** → `multicat.sh` creates `.mc` files from source code
2. **Transform** → Send to LLM, get back modified `.mc` with patches
3. **Apply** → `multisplit.sh` recreates files with safety checks

### Key Components

**Primary Tools:**
- `multicat.sh` - Concatenates files into MULTICAT format with metadata headers
- `multisplit.sh` - Extracts blocks from `.mc` files with interactive overwrite protection
- `multidiff.sh` - Expands `mode: diff` blocks using local disk context
- `mcinfo.sh` - Lists and summarizes blocks from `.mc` files

**Supporting Tools:**
- `qpatch.sh` - Advanced git-apply wrapper for patch management
- `qpatch-inspect.sh` - Patch inspection and analysis utility
- `getcode.sh` - Code extraction utility
- `replace.sh` - File content replacement utility
- `multifind.sh` - Advanced file search with ranking capabilities
- `fzfgrep.sh` - Interactive fuzzy search for code patterns

**Utility Tools:**
- `rag_tools.sh` - Clipboard image encoding for RAG workflows
- `ast.sh` - Shell script AST manipulation utilities

**Aliases and Integration:**
- `aliases.sh` defines: `mc`, `ms`, `mi`, `mf`, `replace` shortcuts
- `bin/mc` wrapper script for streamlined usage

## MULTICAT Block Format

```text
#MULTICAT_START
# dir: /path/to/file
# file: main.js
# mode: diff           (optional: 'diff' or 'full'; default: full)
# requires: true       (optional: set if disk context used)
# note: suspicious     (optional: set if disk file not declared)
#MULTICAT_END
<file content or unified diff here>
```

## Common Development Commands

**Create MULTICAT from source:**
```bash
./multicat.sh -r src/ > code.mc
```

**Extract files safely (with prompts):**
```bash
./multisplit.sh -y response.mc
```

**Extract files forcefully:**
```bash
./multisplit.sh -Y response.mc
```

**Inspect MULTICAT contents:**
```bash
./mcinfo.sh code.mc
```

**Apply patches with auto-detection:**
```bash
./qpatch.sh < patch.diff
```

**Inspect patches before applying:**
```bash
./qpatch-inspect.sh patch.diff
```

**Search for files with ranking:**
```bash
./multifind.sh pattern /search/dir
```

**Interactive code search:**
```bash
./fzfgrep.sh
```

## Directory Management Features

- `multicat.sh` supports directory remapping with `-d a=b` flag
- Manifest mode with `-m <file>` for canonical file lists  
- Root directory control with `-C <dir>` for path relativization
- `--tree-only` mode for FILETREE section generation

## Safety Features

- `multisplit.sh` always prompts before overwriting existing files (unless `-Y` used)
- `qpatch.sh` includes auto-detection of patch strip levels and target directories
- All tools support dry-run modes for preview
- Built-in exclude pattern support via `.gitignore` and `.multignore`

## Integration Points

- **qa/** symlink connects to broader QA toolchain
- `QA_DIR` environment variable for patch database integration
- Git-aware patching through `qpatch.sh`
- Clipboard image encoding via `rag_png()` function in `rag_tools.sh`
- Shell AST manipulation through `rag_bash_ast()` and `rag_ast_bash()` functions
- Extensible through mel_* function patterns (future)

## Notes for Development

- Tools are designed to be stateless and composable via Unix pipelines
- All scripts include comprehensive help via `-h/--help`
- Error handling follows fail-fast principles with `set -euo pipefail`
- Path handling is normalization-safe with `realpath` usage