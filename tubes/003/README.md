# Tubes

A modern, self-documenting Terminal User Interface (TUI) application built in Go with deterministic layouts and theme management.

## Architecture

Tubes demonstrates clean separation of concerns with:

- **Deterministic Layout System**: Custom grid manager with `Px` (absolute) and `Fr` (fractional) units
- **Theme Management**: YAML-based themes with semantic color tokens and hot-reload capability  
- **MVC Architecture**: Clean separation using Bubbletea for state management
- **Command Registry**: Extensible command system with autocompletion
- **Async Operations**: Background worker support for non-blocking operations

## Key Features

### Layout System
- Eliminates common TUI positioning issues
- CSS Grid-like layout with `Px` and `Fr` units
- Stable, predictable rendering
- Responsive to terminal resize

### Theme System
- YAML configuration files
- Semantic color tokens (primary, surface, accent, etc.)
- Automatic color derivation using LCH color space
- Live theme switching

### Command System
- Tab completion with cycling
- Extensible command registry
- Context-aware help
- Command history

## Quick Start

```bash
# Build and run
source tubes.sh
tubes_build
tubes_run

# Or directly
go build -o tubes ./cmd/tubes
./tubes
```

**Note**: Tubes automatically detects the terminal environment:
- **Full TUI Mode**: When running in a proper terminal with TTY support
- **Simple Mode**: Fallback for environments without TTY (SSH, containers, etc.)

### TUI Mode Features
- Deterministic grid layout with muted top status bar
- ESC toggles between self/tasks modes (Ctrl+C to quit)
- Blue status bar for system messages
- Feedback area for help and command completion
- Borderless input to prevent cut-off issues

### Simple Mode Features
- Command-line interface for any environment
- All core functionality available via text commands
- Theme management and mode switching

## Available Commands

- `/help` - Show all commands and shortcuts
- `/mode self|tasks` - Switch between modes
- `/theme list|use|preview` - Theme management
- `/open <file>` - Open file in main panel
- `/clear` - Clear and reload panels
- `/quit` - Exit application

### Keyboard Shortcuts

- `Tab` - Cycle command completions (or switch modes when input empty)
- `Shift+Tab` - Reverse cycle completions
- `Enter` - Execute command
- `Ctrl+C` / `Esc` - Quit

## Themes

Themes are stored in `themes/` directory:
- `monochrome.yaml` - Default dark theme
- `dracula.yaml` - Popular Dracula color scheme

Current theme is stored in `themes/.current`. Set `TUBES_THEME` environment variable to override.

## Project Structure

```
cmd/tubes/main.go           # Application entry point
internal/
├── layout/                 # Deterministic grid layout system
├── theme/                  # YAML-based theme management
└── tui/                   # MVC TUI implementation
    ├── model.go           # Application state
    ├── commands.go        # Command handlers
    └── autocomplete.go    # Tab completion
themes/                    # Theme configurations
```

## Development

The project uses Go 1.21+ with modern TUI libraries:
- `github.com/charmbracelet/bubbletea` - Elm Architecture for Go
- `github.com/charmbracelet/bubbles` - Reusable UI components  
- `github.com/charmbracelet/lipgloss` - Terminal styling
- `github.com/lucasb-eyer/go-colorful` - Color manipulation

## Status

Core TUI features are implemented and working:
- ✅ Deterministic layout system
- ✅ Theme management with YAML configs
- ✅ MVC structure with Bubbletea
- ✅ Command registry with autocompletion
- 🚧 File navigation (basic tree view)
- 🚧 Async worker pool
- 🚧 HTTP API server
- 🚧 MULTIDIFF system

This serves as a solid foundation for building sophisticated TUI applications with stable layouts and modern UX patterns.