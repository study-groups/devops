# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
```bash
# Build the application
go mod tidy
go build -o tubes ./cmd/tubes

# Or use the helper script
source tubes.sh
tubes_build

# Run the application
./tubes
# or
tubes_run

# Clean build artifacts
tubes_clean
```

### Testing
```bash
# Run tests (standard Go testing)
go test ./...

# Run tests for specific package
go test ./internal/tui
```

### MULTIDIFF System
The project uses a custom MULTIDIFF format for patch management (work in progress):
```bash
# Generate MULTIDIFF from git changes
tubes_mdiff_gen [--cached] [<pathspec>...]

# Apply MULTIDIFF patch
tubes_mdiff_apply <patch.multipatch>

# Convert git diff to MULTIDIFF format
tubes_mdiff_from_git [--cached] [<pathspec>...]
```

**Note**: MULTIDIFF is evolving and subject to change. The broader theme includes tracking multicursor, multicat, multidiff formats, and potentially multimerge capabilities.

### AI Integration
The project includes AI integration through symbolic links to backend utilities:
```bash
# Access AI utilities (behind-the-scenes)
@rag  # Retrieval-Augmented Generation (linked to /Users/mricos/src/bash/rag)
@qa   # Question Answering (linked to /Users/mricos/src/bash/qa)
```

## Architecture Overview

### Core Structure
This is a Go TUI (Terminal User Interface) application using the Charm/Bubbletea framework. The architecture follows MVC patterns with:

- **Model**: Application state in `internal/tui/model.go` and related files
- **View**: UI rendering in `internal/tui/view.go` 
- **Controller**: Command handling in `internal/tui/commands.go`

### Multiple Model Implementations
The codebase contains three model implementations:
- `model.go` - Original model (minimal/placeholder implementation)
- `hybrid_model.go` - Hybrid architecture combining Bubbletea state management with tview layout components
- `tubes_model.go` - New deterministic layout architecture with `codeintel.CursorDirectory` navigation and strict UI geometry

### Key Internal Packages
- `internal/tui/` - Main TUI implementation with Bubbletea
- `internal/layout/` - Layout management system
- `internal/codeintel/` - Code intelligence and cursor management
- `internal/theme/` - Styling and theming
- `internal/api/` - HTTP API server
- `internal/modules/` - Module system

### Environment Variables
- `TUBES_DIR` - Task directory root (required for tasks mode)
- `TUBES_SRC` - Source code directory

### Application Modes
1. **Self Mode** (`/mode self`) - Project tree (left) + source view (right)
2. **Tasks Mode** (`/mode tasks`) - Task types (left) + module view (right)

## Core Commands (within TUI)
The application uses a `/command` pattern:

- `/help` - Show all available commands
- `/mode [self|tasks]` - Switch between modes
- `/open <path>` - Open file in right column
- `/resize col [+|-]<pct>` - Adjust column width
- `/resize band <header|cli|status|footer> [+|-]<n>` - Adjust band height
- `/run <action>` - Run flow actions (compile, test, llm-ask, llm-apply, llm-commit, llm-reset)
- `/clear` - Clear and reload left panel
- `/api` - List HTTP API endpoints

### Flow Actions
- `compile` - Build from `project.tubes` config
- `test` - Run tests
- `llm-ask` - LLM query (placeholder)
- `llm-apply` - Apply LLM suggestions (placeholder)
- `llm-commit` - Commit with LLM (placeholder)
- `llm-reset` - Reset LLM state (placeholder)

## Task Management
The project follows a task-centric workflow:

- Tasks are units of work with concrete scope
- Each task has a branch: `tubes/task/<slug>`
- Configuration and artifacts stored under `$TUBES_DIR/<task-type>/<task>/`
- Tasks may host multiple flows (execution graphs)

## Key Dependencies
- `github.com/charmbracelet/bubbletea` v1.3.6 - Elm Architecture TUI framework
- `github.com/charmbracelet/bubbles` v0.21.0 - Reusable UI components
- `github.com/charmbracelet/lipgloss` v1.1.0 - Styling system
- `github.com/joho/godotenv` v1.5.1 - Environment variable loading

## Development Notes
- The project uses Go 1.23+ with toolchain go1.24.6
- Logging goes to `tubes.log` by default
- HTTP API server runs on configurable port (default 8080)
- Uses standard Go project layout with `cmd/` and `internal/` directories
- MULTIDIFF format is used for expressing code changes (see `tubes.spec`)

## Current Development Focus
Primary focus is improving the UI for better control over styling and providing `/ui` commands for self-investigation and modification:

- **Styling improvements**: Current look and feel needs work (too much yellow coloring)
- **Layout behavior**: Lane 0 elements should stack from bottom and expand upward, not downward
- **UI commands**: Need `/ui` command suite for runtime UI inspection and modification
- **Theme system**: Better control over visual presentation through `internal/theme/`

## Response Format Preferences
When providing code suggestions, use:
- **MULTICAT** format for multiple functions/files (as specified in `tubes.spec`)
- **MULTIDIFF** format for single function changes and small differences
- Always return answers in MULTICAT format as single, long file in triple tick code fence
- Always update STATUS file with files array of previous and current names touched