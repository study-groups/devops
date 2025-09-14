# Tubes Architecture & Library Summary

## Overview
Tubes is a self-documenting Terminal User Interface (TUI) application built in Go. It demonstrates clean MVC architecture and provides both command-line and HTTP API interfaces for exploring and understanding codebases.

## Core Architecture

### MVC Pattern Implementation
- **Model** (`internal/tui/model.go`): Complete application state management
- **View** (`internal/tui/view.go`): UI rendering and layout 
- **Controller** (`internal/tui/commands.go`, `internal/tui/repl.go`): User input handling

### Key Components

#### Application State (`Model` struct)
- UI Components: `viewport.Model` instances for panels, `textarea.Model` for input
- Layout State: Terminal dimensions, panel configurations
- Domain State: Project navigation, file selection, operating modes
- Command System: Extensible `/command` pattern with autocomplete
- HTTP API Server: Full CLI/API parity

#### Interface Design
- **Minimal Interface**: Bottom-anchored input with scrolling output
- **Dual Modes**: Self-documentation mode and task management mode
- **Real-time Feedback**: Command suggestions and context-aware help

## Library Dependencies

### Core TUI Framework
- **`github.com/charmbracelet/bubbletea`** (v1.3.6): The Elm Architecture for Go
  - Event-driven UI updates via `Update(tea.Msg)` pattern
  - Immutable state management
  - Command/subscription model for async operations

### UI Components
- **`github.com/charmbracelet/bubbles`** (v0.21.0): Reusable UI components
  - `textarea.Model`: Command input with autocompletion
  - `viewport.Model`: Scrollable content panels
- **`github.com/charmbracelet/lipgloss`** (v1.1.1): Styling and layout
  - CSS-like styling for terminal UIs
  - Box model, borders, colors, positioning

### Content Rendering
- **`github.com/charmbracelet/glamour`** (v0.10.0): Markdown rendering
  - Terminal-optimized markdown display
  - Syntax highlighting for code blocks
  - Customizable themes

### Configuration
- **`github.com/joho/godotenv`** (v1.5.1): Environment variable loading
  - `.env` file support for configuration

## Advanced Systems

### Navigation & Selection
- **NavigationState**: Collapsible tree navigation system
- **MultiCursor**: Multi-selection system for batch operations
- **CursorManager**: Content view state management

### Command System
- **AutoComplete**: Real-time command suggestions and validation
- **CommandHistory**: LLM-context aware command history with persistence
- **KeyMapping**: Mode-aware keyboard shortcuts

### Content Processing
- **MarkdownRenderer**: Enhanced markdown display with syntax highlighting
- **File Type Detection**: Context-aware file handling and display

## Environment Configuration

### Required Environment Variables
- `TUBES_DIR`: Task directory (defaults to current working directory)
- `TUBES_SRC`: Source code directory (defaults to current working directory)

### Startup Process
1. Initialize Bubbletea program with mouse support
2. Load environment configuration
3. Build command registry with autocomplete
4. Initialize navigation tree and file cursors
5. Start HTTP API server (optional, via `/server start`)

## API Integration
- HTTP server provides REST endpoints mirroring CLI commands
- Full CLI/API parity for all operations
- JSON responses with structured data

## Key Design Patterns

### Event-Driven Architecture
- All UI updates flow through `Update(tea.Msg)` method
- Immutable state transitions
- Command pattern for user actions

### Plugin-Style Commands
- Commands registered in map with `Name`, `Description`, `Executor`
- Consistent `/command args...` interface
- Extensible command system

### Layered UI System
- Scrolling output area for command results
- Bottom-anchored input with real-time feedback
- Context-aware help and suggestions

## File Structure
```
cmd/tubes/main.go           # Application entry point
internal/tui/
├── app.go                  # Application lifecycle
├── model.go                # MVC Model (application state)
├── view.go                 # MVC View (rendering)
├── commands.go             # MVC Controller (command handling)
├── repl.go                 # Input processing
├── autocomplete.go         # Command completion system
├── navigation.go           # Tree navigation
├── multicursor.go          # Multi-selection system
├── history.go              # Command history with LLM context
├── keymap.go               # Keyboard shortcuts
├── markdown.go             # Markdown rendering
├── cursors.go              # Content view management
├── uiconfig.go             # UI configuration
└── [other specialized modules]
```

This architecture provides a foundation for building sophisticated TUI applications with clean separation of concerns, extensible command systems, and modern terminal UI capabilities.